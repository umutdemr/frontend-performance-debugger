import type {
  Finding,
  OwnershipHint,
  EnvironmentContext,
} from "@fpd/shared-types";
import { COMMON_OWNERSHIP_PATTERNS } from "@fpd/shared-types";

export interface EnrichmentContext {
  environment: EnvironmentContext;
  appSourcePaths?: string[];
  configPaths?: string[];
}

export function enrichFindings(
  findings: Finding[],
  context: EnrichmentContext,
): Finding[] {
  return findings.map((finding) => enrichFinding(finding, context));
}

function enrichFinding(finding: Finding, context: EnrichmentContext): Finding {
  let enriched = { ...finding };

  if (!enriched.priority) {
    enriched = assignPriority(enriched, context);
  }

  if (!enriched.confidence) {
    enriched = assignConfidence(enriched, context);
  }

  if (!enriched.ownership) {
    enriched.ownership = inferOwnership(enriched, context);
  }

  if (
    context.environment.detectedFramework &&
    !enriched.frameworkRecommendation
  ) {
    const frameworkRec = getFrameworkRecommendation(
      enriched,
      context.environment.detectedFramework,
    );
    if (frameworkRec) {
      enriched.frameworkRecommendation = frameworkRec;
    }
  }

  return enriched;
}

export function assignPriority(
  finding: Finding,
  _context: EnrichmentContext,
): Finding {
  const id = finding.id;
  const category = finding.category;
  const severity = finding.severity;

  if (finding.environmentLimited) {
    if (severity === "info" || severity === "success") {
      finding.priority = "monitor";
      return finding;
    }
    if (category === "rendering" && severity === "critical") {
      finding.priority = "investigate";
      return finding;
    }
  }

  if (category === "rendering" && severity === "critical") {
    finding.priority = "high-impact";
  } else if (id.includes("render-blocking") || id.includes("total-size")) {
    finding.priority = "high-impact";
  } else if (id.includes("server-errors") || id.includes("5xx")) {
    finding.priority = "high-impact";
  } else if (
    category === "accessibility" ||
    id.includes("alt") ||
    id.includes("lazy-loading") ||
    id.includes("dimensions") ||
    id.includes("large-image")
  ) {
    finding.priority = "quick-win";
  } else if (
    id.includes("unused") ||
    id.includes("cache") ||
    id.includes("estimation") ||
    id.includes("api-requests")
  ) {
    finding.priority = "monitor";
  } else if (severity === "warning") {
    finding.priority = "investigate";
  } else if (severity === "info" || severity === "success") {
    finding.priority = "none";
  } else {
    finding.priority = "investigate";
  }

  return finding;
}

export function assignConfidence(
  finding: Finding,
  context: EnrichmentContext,
): Finding {
  const id = finding.id;

  if (finding.confidence) {
    return finding;
  }

  if (finding.environmentLimited) {
    finding.confidence = context.environment.isLocalDev ? "low" : "medium";
    return finding;
  }

  if (
    id.startsWith("perf-") ||
    id.startsWith("network-") ||
    id.includes("render-blocking") ||
    id.includes("server-errors") ||
    id.includes("5xx")
  ) {
    finding.confidence = "high";
  } else if (
    id.includes("heuristic") ||
    id.includes("unused") ||
    id.includes("heavy") ||
    id.includes("many")
  ) {
    finding.confidence = "medium";
  } else if (
    id.includes("limitation") ||
    id.includes("estimation") ||
    id.includes("check-limitation")
  ) {
    finding.confidence = "low";
  } else {
    finding.confidence = "high";
  }

  return finding;
}

function inferOwnership(
  finding: Finding,
  context: EnrichmentContext,
): OwnershipHint {
  const urls = extractUrlsFromFinding(finding);

  for (const url of urls) {
    for (const pattern of COMMON_OWNERSHIP_PATTERNS) {
      if (pattern.patterns.some((p) => p.test(url))) {
        return {
          type: pattern.type,
          confidence: "high",
          reason: pattern.reason,
        };
      }
    }
  }

  if (context.environment.frameworkPatterns) {
    const { ownedPathPatterns, runtimeChunkPatterns, configPatterns } =
      context.environment.frameworkPatterns;

    for (const url of urls) {
      if (
        [...ownedPathPatterns, ...runtimeChunkPatterns].some((p) => p.test(url))
      ) {
        return {
          type: "framework-owned",
          confidence: "high",
          reason: `Managed by ${context.environment.detectedFramework}`,
        };
      }

      if (configPatterns.some((p) => p.test(url))) {
        return {
          type: "config-owned",
          confidence: "high",
          reason: `${context.environment.detectedFramework} configuration`,
        };
      }
    }
  }

  const categoryOwnership = inferFromCategory(finding.category, finding.id);
  if (categoryOwnership) {
    return categoryOwnership;
  }

  return {
    type: "unknown",
    confidence: "low",
  };
}

function inferFromCategory(category: string, id: string): OwnershipHint | null {
  if (id.includes("cache") || category === "caching") {
    if (id.includes("html") || id.includes("document")) {
      return {
        type: "infra-owned",
        confidence: "high",
        reason: "Server or CDN configuration controls document caching",
      };
    }
    return {
      type: "infra-owned",
      confidence: "medium",
      reason: "Caching is typically configured at server/CDN level",
    };
  }

  if (
    id.includes("https") ||
    id.includes("port") ||
    id.includes("server-error")
  ) {
    return {
      type: "infra-owned",
      confidence: "high",
      reason: "Server/hosting configuration",
    };
  }

  if (category === "seo") {
    return {
      type: "app-owned",
      confidence: "high",
      reason: "SEO is determined by application markup and content",
    };
  }

  if (category === "accessibility") {
    return {
      type: "app-owned",
      confidence: "high",
      reason: "Accessibility is determined by application markup",
    };
  }

  if (
    category === "javascript" ||
    category === "rendering" ||
    id.includes("render-blocking")
  ) {
    return {
      type: "app-owned",
      confidence: "medium",
      reason: "Application code and build configuration",
    };
  }

  if (category === "assets" || id.includes("image") || id.includes("size")) {
    return {
      type: "app-owned",
      confidence: "high",
      reason: "Application assets and code",
    };
  }

  return null;
}

function extractUrlsFromFinding(finding: Finding): string[] {
  const urls: string[] = [];

  for (const evidence of finding.evidence) {
    const { data, type } = evidence;

    if (type === "url" && typeof data === "string") {
      urls.push(data);
      continue;
    }

    if (typeof data === "string") {
      try {
        new URL(data);
        urls.push(data);
      } catch {}
      continue;
    }

    if (data && typeof data === "object") {
      const d = data as Record<string, unknown>;

      for (const key of ["url", "href", "src"]) {
        if (typeof d[key] === "string") {
          urls.push(d[key] as string);
        }
      }

      if (Array.isArray(d.urls)) {
        urls.push(...d.urls.filter((u): u is string => typeof u === "string"));
      }

      if (Array.isArray(d.resources)) {
        for (const r of d.resources) {
          if (
            r &&
            typeof r === "object" &&
            typeof (r as any).url === "string"
          ) {
            urls.push((r as any).url);
          }
        }
      }
    }
  }

  return urls;
}

function getFrameworkRecommendation(
  finding: Finding,
  framework: string,
): string | undefined {
  const recommendations: Record<string, Record<string, string>> = {
    "next.js": {
      "render-blocking-scripts":
        "Use next/script with strategy='lazyOnload' for third-party scripts. " +
        "Critical scripts can use strategy='beforeInteractive'.",
      "render-blocking-styles":
        "Next.js automatically handles CSS optimization. Consider using CSS Modules or styled-jsx for component styles.",
      "cache-uncached-resources":
        "Static assets in /public are not automatically cached. Consider using next/image for images " +
        "and ensure your deployment platform configures caching headers.",
      "network-large-payloads":
        "Use next/dynamic for code splitting. Enable SWC minification in next.config.js. " +
        "Consider using next/image for automatic image optimization.",
      "network-large-image":
        "Use next/image for automatic image optimization, WebP/AVIF conversion, and responsive sizing.",
    },
    nuxt: {
      "render-blocking-scripts":
        "Use Nuxt's useHead() composable with defer:true for non-critical scripts, " +
        "or the @nuxt/scripts module for third-party script management.",
      "cache-uncached-resources":
        "Configure cache headers in nuxt.config.js under nitro.routeRules.",
      "network-large-image":
        "Use @nuxt/image module for automatic image optimization.",
    },
    vite: {
      "network-large-payloads":
        "Use dynamic imports for code splitting. Configure build.rollupOptions in vite.config.js for manual chunking.",
      "render-blocking-scripts":
        "Vite automatically adds type='module' to scripts. For third-party scripts, use dynamic imports.",
    },
    gatsby: {
      "network-large-image":
        "Use gatsby-plugin-image with StaticImage or GatsbyImage components for automatic optimization.",
      "render-blocking-styles":
        "Use gatsby-plugin-critical for automatic critical CSS extraction.",
    },
  };

  const frameworkRecs = recommendations[framework.toLowerCase()];
  if (!frameworkRecs) return undefined;

  for (const [key, rec] of Object.entries(frameworkRecs)) {
    if (
      finding.id?.includes(key) ||
      finding.title.toLowerCase().includes(key.replace(/-/g, " "))
    ) {
      return rec;
    }
  }

  return undefined;
}
