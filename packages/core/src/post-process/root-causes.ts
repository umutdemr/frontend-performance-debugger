import type { Finding, RootCause } from "@fpd/shared-types";
import { SEVERITY_WEIGHT } from "@fpd/shared-types";

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

type RootCauseGroup = RootCause["group"];

/**
 * Inferred root cause with causal reasoning
 */
export interface InferredRootCause {
  id: string;
  group: RootCauseGroup;
  description: string;
  relatedFindings: string[];
  confidence: "high" | "medium" | "low";
  impactScore: number;
  fixSuggestion?: string;
  frameworkHint?: string;
}

/**
 * Rule for inferring root causes from findings
 */
interface RootCauseRule {
  id: string;
  name: string;
  group: RootCauseGroup;
  patterns: {
    findingIds?: (string | RegExp)[];
    categories?: string[];
    evidencePatterns?: RegExp[];
  };
  minMatches?: number;
  framework?: string | string[];
  priority?: number;
  infer: (
    matchedFindings: Finding[],
    allFindings: Finding[],
    context: InferenceContext,
  ) => InferredRootCause | null;
}

/**
 * Context passed to inference functions
 */
interface InferenceContext {
  framework?: string;
  totalFindings: number;
  severityCounts: Record<string, number>;
}

// ═══════════════════════════════════════════════════════════════
// Inference Rules
// ═══════════════════════════════════════════════════════════════

const ROOT_CAUSE_RULES: RootCauseRule[] = [
  {
    id: "next-image-not-used",
    name: "Next.js Image Optimization Not Used",
    group: "performance",
    framework: ["nextjs", "next.js"],
    patterns: {
      findingIds: [
        /assets-images-no-dimensions/,
        /assets-images-no-lazy/,
        /network-large-resources/,
        /assets-images-no-alt/,
      ],
    },
    minMatches: 2,
    priority: 100,
    infer: (matched, _all, _ctx) => {
      const hasPublicImages = matched.some((f) =>
        f.evidence?.some((e) => {
          const data =
            typeof e.data === "string" ? e.data : JSON.stringify(e.data);
          return (
            data.includes("/icons/") ||
            data.includes("/images/") ||
            (data.includes("localhost") && !data.includes("/_next/image"))
          );
        }),
      );

      const hasLargeImages = matched.some((f) =>
        f.id.includes("large-resources"),
      );
      const hasDimensionIssues = matched.some((f) =>
        f.id.includes("no-dimensions"),
      );
      const hasLazyIssues = matched.some((f) => f.id.includes("no-lazy"));

      let imageCount = 0;
      for (const f of matched) {
        if (f.aggregation?.count) {
          imageCount += f.aggregation.count;
        } else if (f.evidence) {
          imageCount += f.evidence.length;
        }
      }

      const signals = [
        hasPublicImages,
        hasLargeImages,
        hasDimensionIssues,
        hasLazyIssues,
      ].filter(Boolean).length;
      const confidence =
        signals >= 3 ? "high" : signals >= 2 ? "medium" : "low";

      return {
        id: "next-image-not-used",
        group: "performance",
        description: `Images are not using Next.js optimization pipeline (next/image). ${imageCount > 0 ? `${imageCount} images affected.` : ""}`,
        relatedFindings: matched.map((f) => f.id),
        confidence,
        impactScore: calculateImpactScore(matched),
        fixSuggestion:
          "Replace <img> tags with next/image component. Move images from /public to use import or dynamic src.",
        frameworkHint:
          "Use: import Image from 'next/image'; <Image src={...} width={...} height={...} />",
      };
    },
  },

  {
    id: "images-not-optimized",
    name: "Images Not Optimized",
    group: "performance",
    patterns: {
      findingIds: [
        /assets-images-no-dimensions/,
        /assets-images-no-lazy/,
        /network-large-resources/,
      ],
    },
    minMatches: 2,
    priority: 90,
    infer: (matched, _all, ctx) => {
      if (ctx.framework === "nextjs" || ctx.framework === "next.js") {
        return null;
      }

      let imageCount = 0;
      for (const f of matched) {
        imageCount += f.aggregation?.count || f.evidence?.length || 1;
      }

      return {
        id: "images-not-optimized",
        group: "performance",
        description: `${imageCount} images lack optimization: missing dimensions cause layout shifts, missing lazy loading wastes bandwidth.`,
        relatedFindings: matched.map((f) => f.id),
        confidence: matched.length >= 3 ? "high" : "medium",
        impactScore: calculateImpactScore(matched),
        fixSuggestion:
          "Add width/height attributes to prevent CLS. Add loading='lazy' to below-fold images.",
      };
    },
  },

  {
    id: "render-blocking-resources",
    name: "Render Blocking Resources",
    group: "rendering",
    patterns: {
      findingIds: [
        /render-blocking-scripts/,
        /render-blocking-stylesheets/,
        /perf-fcp/,
        /perf-lcp/,
      ],
    },
    minMatches: 2,
    priority: 95,
    infer: (matched, _all, ctx) => {
      const hasScripts = matched.some((f) => f.id.includes("scripts"));
      const hasStylesheets = matched.some((f) => f.id.includes("stylesheets"));
      const hasPoorLCP = matched.some(
        (f) => f.id.includes("lcp") && f.severity === "critical",
      );
      const hasPoorFCP = matched.some(
        (f) => f.id.includes("fcp") && f.severity !== "success",
      );

      const blockingTypes: string[] = [];
      if (hasScripts) blockingTypes.push("JavaScript");
      if (hasStylesheets) blockingTypes.push("CSS");

      let description = `${blockingTypes.join(" and ")} resources in <head> block rendering`;
      if (hasPoorLCP || hasPoorFCP) {
        description += ", directly impacting Core Web Vitals";
      }

      const frameworkHint =
        ctx.framework === "nextjs" || ctx.framework === "next.js"
          ? "Use next/script with strategy='lazyOnload' for non-critical scripts."
          : undefined;

      return {
        id: "render-blocking-resources",
        group: "rendering",
        description,
        relatedFindings: matched.map((f) => f.id),
        confidence:
          (hasScripts || hasStylesheets) && (hasPoorLCP || hasPoorFCP)
            ? "high"
            : "medium",
        impactScore: calculateImpactScore(matched),
        fixSuggestion:
          "Move scripts to end of body or add async/defer. Inline critical CSS.",
        frameworkHint,
      };
    },
  },

  {
    id: "cache-misconfigured",
    name: "Cache Headers Misconfigured",
    group: "network",
    patterns: {
      findingIds: [/cache-/, /no-cache/, /uncached/],
      categories: ["caching"],
    },
    minMatches: 1,
    priority: 70,
    infer: (matched, _all, ctx) => {
      const isLocalDev = matched.some((f) => f.environmentLimited);

      let uncachedCount = 0;
      for (const f of matched) {
        uncachedCount += f.aggregation?.count || f.evidence?.length || 1;
      }

      const hasStaticAssetIssues = matched.some(
        (f) => f.id.includes("static") || f.id.includes("assets"),
      );

      return {
        id: "cache-misconfigured",
        group: "network",
        description: `${uncachedCount} static assets are served without proper cache headers.`,
        relatedFindings: matched.map((f) => f.id),
        confidence: isLocalDev
          ? "low"
          : hasStaticAssetIssues
            ? "high"
            : "medium",
        impactScore: calculateImpactScore(matched) * (isLocalDev ? 0.5 : 1),
        fixSuggestion: "Configure Cache-Control headers for static assets.",
        frameworkHint:
          ctx.framework === "nextjs"
            ? "Next.js auto-sets headers for /_next/static. Check CDN config for /public assets."
            : undefined,
      };
    },
  },

  {
    id: "bundle-not-optimized",
    name: "Bundle Not Optimized",
    group: "architecture",
    patterns: {
      findingIds: [
        /network-total-size/,
        /network-request-count/,
        /network-large-resources/,
      ],
    },
    minMatches: 2,
    priority: 85,
    infer: (matched, _all, ctx) => {
      const hasTotalSizeIssue = matched.some((f) =>
        f.id.includes("total-size"),
      );
      const hasRequestCountIssue = matched.some((f) =>
        f.id.includes("request-count"),
      );

      let totalSizeMB = 0;
      let requestCount = 0;

      for (const f of matched) {
        if (f.id.includes("total-size") && f.evidence) {
          const sizeEvidence = f.evidence.find((e) =>
            e.label?.includes("Size"),
          );
          if (sizeEvidence?.data) {
            const data = sizeEvidence.data as Record<string, unknown>;
            if (data.value) totalSizeMB = parseFloat(String(data.value));
          }
        }
        if (f.id.includes("request-count") && f.evidence) {
          const countEvidence = f.evidence.find((e) =>
            e.label?.includes("Count"),
          );
          if (countEvidence?.data) {
            const data = countEvidence.data as Record<string, unknown>;
            requestCount = Number(data.value) || 0;
          }
        }
      }

      let description = "Application bundle is not properly optimized";
      if (totalSizeMB > 0) description += `: ${totalSizeMB}MB total`;
      if (requestCount > 0) description += `, ${requestCount} requests`;

      const frameworkHint =
        ctx.framework === "nextjs"
          ? "Use next/dynamic for code splitting. Analyze bundle with @next/bundle-analyzer."
          : undefined;

      return {
        id: "bundle-not-optimized",
        group: "architecture",
        description,
        relatedFindings: matched.map((f) => f.id),
        confidence:
          hasTotalSizeIssue && hasRequestCountIssue ? "high" : "medium",
        impactScore: calculateImpactScore(matched),
        fixSuggestion:
          "Implement code splitting, lazy load routes and heavy components.",
        frameworkHint,
      };
    },
  },

  {
    id: "core-web-vitals-failing",
    name: "Core Web Vitals Failing",
    group: "performance",
    patterns: {
      findingIds: [
        /perf-lcp-poor/,
        /perf-cls-poor/,
        /perf-fcp-poor/,
        /perf-ttfb-poor/,
      ],
    },
    minMatches: 1,
    priority: 100,
    infer: (matched, _all, _ctx) => {
      const failingMetrics: string[] = [];
      const values: Record<string, string> = {};

      for (const f of matched) {
        if (f.id.includes("lcp")) {
          failingMetrics.push("LCP");
          const lcpEvidence = f.evidence?.find((e) => e.label === "LCP");
          if (lcpEvidence?.data) {
            const data = lcpEvidence.data as Record<string, unknown>;
            values.LCP = `${data.value}ms`;
          }
        }
        if (f.id.includes("cls")) failingMetrics.push("CLS");
        if (f.id.includes("fcp")) failingMetrics.push("FCP");
        if (f.id.includes("ttfb")) {
          failingMetrics.push("TTFB");
          const ttfbEvidence = f.evidence?.find((e) => e.label === "TTFB");
          if (ttfbEvidence?.data) {
            const data = ttfbEvidence.data as Record<string, unknown>;
            values.TTFB = `${data.value}ms`;
          }
        }
      }

      let description = `Core Web Vitals failing: ${failingMetrics.join(", ")}`;
      const valueStrings = Object.entries(values).map(([k, v]) => `${k}=${v}`);
      if (valueStrings.length > 0)
        description += ` (${valueStrings.join(", ")})`;

      const suggestions: string[] = [];
      if (failingMetrics.includes("LCP"))
        suggestions.push("Optimize largest image/text");
      if (failingMetrics.includes("CLS"))
        suggestions.push("Add dimensions to images/embeds");
      if (failingMetrics.includes("TTFB"))
        suggestions.push("Optimize server response time, use CDN");

      return {
        id: "core-web-vitals-failing",
        group: "performance",
        description,
        relatedFindings: matched.map((f) => f.id),
        confidence: "high",
        impactScore: calculateImpactScore(matched) * 1.5,
        fixSuggestion: suggestions.join(". "),
      };
    },
  },

  {
    id: "accessibility-images",
    name: "Image Accessibility Issues",
    group: "general",
    patterns: {
      findingIds: [/assets-images-no-alt/, /accessibility/],
      categories: ["accessibility"],
    },
    minMatches: 1,
    priority: 50,
    infer: (matched, _all, _ctx) => {
      let imageCount = 0;
      for (const f of matched) {
        imageCount += f.aggregation?.count || f.evidence?.length || 1;
      }

      return {
        id: "accessibility-images",
        group: "general",
        description: `${imageCount} images lack alt text, impacting accessibility and SEO`,
        relatedFindings: matched.map((f) => f.id),
        confidence: "high",
        impactScore: calculateImpactScore(matched),
        fixSuggestion:
          "Add descriptive alt text to informative images. Use alt='' for decorative images.",
      };
    },
  },

  {
    id: "http-security",
    name: "HTTP Security Issue",
    group: "security",
    patterns: {
      findingIds: [/basic-url-no-https/, /security-/],
    },
    minMatches: 1,
    priority: 80,
    infer: (matched, _all, _ctx) => {
      if (matched.every((f) => f.environmentLimited)) {
        return null;
      }

      const hasHttpIssue = matched.some(
        (f) => f.id.includes("https") || f.id.includes("http"),
      );

      return {
        id: "http-security",
        group: "security",
        description:
          "Site is not using HTTPS, impacting security and performance (no HTTP/2)",
        relatedFindings: matched.map((f) => f.id),
        confidence: hasHttpIssue ? "high" : "medium",
        impactScore: calculateImpactScore(matched),
        fixSuggestion: "Enable HTTPS with a valid SSL certificate.",
      };
    },
  },
];

// ═══════════════════════════════════════════════════════════════
// Helper Functions
// ═══════════════════════════════════════════════════════════════

function calculateImpactScore(findings: Finding[]): number {
  let score = 0;
  for (const f of findings) {
    const severityWeight = SEVERITY_WEIGHT[f.severity] || 1;
    const count = f.aggregation?.count || 1;
    score += severityWeight * (1 + Math.log2(Math.max(1, count)));
  }
  return Math.round(score * 10) / 10;
}

function matchesPattern(
  finding: Finding,
  patterns: RootCauseRule["patterns"],
): boolean {
  if (patterns.findingIds) {
    for (const pattern of patterns.findingIds) {
      if (typeof pattern === "string") {
        if (finding.id.includes(pattern)) return true;
      } else if (pattern.test(finding.id)) {
        return true;
      }
    }
  }

  if (patterns.categories?.includes(finding.category)) {
    return true;
  }

  if (patterns.evidencePatterns && finding.evidence) {
    for (const pattern of patterns.evidencePatterns) {
      for (const e of finding.evidence) {
        const data =
          typeof e.data === "string" ? e.data : JSON.stringify(e.data);
        if (pattern.test(data)) return true;
      }
    }
  }

  return false;
}

function frameworkMatches(
  ruleFramework: string | string[] | undefined,
  actualFramework?: string,
): boolean {
  if (!ruleFramework) return true;
  if (!actualFramework) return false;

  const normalized = actualFramework.toLowerCase().replace(/[.\s]/g, "");

  if (Array.isArray(ruleFramework)) {
    return ruleFramework.some((f) =>
      normalized.includes(f.toLowerCase().replace(/[.\s]/g, "")),
    );
  }

  return normalized.includes(ruleFramework.toLowerCase().replace(/[.\s]/g, ""));
}

function deduplicateRootCauses(
  causes: InferredRootCause[],
): InferredRootCause[] {
  const result: InferredRootCause[] = [];
  const sorted = [...causes].sort((a, b) => b.impactScore - a.impactScore);

  for (const cause of sorted) {
    let isDuplicate = false;

    for (const existing of result) {
      if (cause.id === existing.id) {
        isDuplicate = true;
        for (const fid of cause.relatedFindings) {
          if (!existing.relatedFindings.includes(fid)) {
            existing.relatedFindings.push(fid);
          }
        }
        break;
      }

      const overlap = cause.relatedFindings.filter((f) =>
        existing.relatedFindings.includes(f),
      );
      if (
        overlap.length > 0 &&
        overlap.length >= cause.relatedFindings.length * 0.7
      ) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      result.push(cause);
    }
  }

  return result;
}

export function inferRootCauses(
  findings: Finding[],
  framework?: string,
): InferredRootCause[] {
  if (findings.length === 0) return [];

  const context: InferenceContext = {
    framework,
    totalFindings: findings.length,
    severityCounts: {
      critical: findings.filter((f) => f.severity === "critical").length,
      warning: findings.filter((f) => f.severity === "warning").length,
      info: findings.filter((f) => f.severity === "info").length,
      success: findings.filter((f) => f.severity === "success").length,
    },
  };

  const sortedRules = [...ROOT_CAUSE_RULES].sort(
    (a, b) => (b.priority || 0) - (a.priority || 0),
  );
  const inferredCauses: InferredRootCause[] = [];

  for (const rule of sortedRules) {
    if (!frameworkMatches(rule.framework, framework)) continue;

    const matched = findings.filter((f) => matchesPattern(f, rule.patterns));
    const minMatches = rule.minMatches || 1;
    if (matched.length < minMatches) continue;

    const cause = rule.infer(matched, findings, context);
    if (cause) inferredCauses.push(cause);
  }

  const deduplicated = deduplicateRootCauses(inferredCauses);
  deduplicated.sort((a, b) => b.impactScore - a.impactScore);

  return deduplicated;
}

/**
 * Extract root causes (legacy API - backward compatible)
 */
export function extractRootCauses(
  findings: Finding[],
  framework?: string,
): RootCause[] {
  const inferred = inferRootCauses(findings, framework);

  if (inferred.length > 0) {
    return inferred.slice(0, 4).map(
      (cause): RootCause => ({
        group: cause.group,
        description: cause.description,
        impactScore: cause.impactScore,
        relatedFindings: cause.relatedFindings,
        confidence: cause.confidence,
        fixSuggestion: cause.fixSuggestion,
        frameworkHint: cause.frameworkHint,
      }),
    );
  }

  return extractRootCausesLegacy(findings);
}

function extractRootCausesLegacy(findings: Finding[]): RootCause[] {
  const causes: RootCause[] = [];
  const negativeFindings = findings.filter(
    (f) => f.severity === "critical" || f.severity === "warning",
  );

  const sortedFindings = negativeFindings.sort((a, b) => {
    const countA = a.aggregation?.count || 1;
    const countB = b.aggregation?.count || 1;
    const scoreA = SEVERITY_WEIGHT[a.severity] * (1 + Math.log2(countA));
    const scoreB = SEVERITY_WEIGHT[b.severity] * (1 + Math.log2(countB));
    return scoreB - scoreA;
  });

  const topIssues = sortedFindings.slice(0, 4);

  for (const issue of topIssues) {
    let group: RootCauseGroup = "general";

    if (issue.category === "rendering" || issue.id.includes("perf")) {
      group = "performance";
    } else if (
      issue.category === "network" ||
      issue.category === "assets" ||
      issue.category === "caching"
    ) {
      group = "network";
    } else if (issue.category === "seo" || issue.id.includes("security")) {
      group = "security";
    }

    causes.push({
      group,
      description: issue.title,
      impactScore:
        SEVERITY_WEIGHT[issue.severity] * (issue.aggregation?.count || 1),
      relatedFindings: [issue.id],
    });
  }

  return causes;
}

export function getRootCauseSummary(causes: InferredRootCause[]): string {
  if (causes.length === 0) {
    return "No significant root causes identified.";
  }

  const highImpact = causes.filter((c) => c.confidence === "high");

  if (highImpact.length === 1) {
    const first = highImpact[0];
    return first
      ? `Primary issue: ${first.description}`
      : "No significant root causes identified.";
  }

  if (highImpact.length > 1) {
    const first = highImpact[0];
    return first
      ? `${highImpact.length} high-confidence issues. Top: ${first.description}`
      : "Multiple high-confidence issues identified.";
  }

  const first = causes[0];
  return first
    ? `${causes.length} potential issues. Most significant: ${first.description}`
    : "No significant root causes identified.";
}
