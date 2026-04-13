import type {
  Finding,
  Category,
  OwnershipHint,
  Severity,
} from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";
import {
  getEnvironment,
  adjustSeverityForEnvironment,
  createEnvironmentNotes,
  isEnvironmentLimited,
  getConfidenceForEnvironment,
} from "./analyzer.interface.js";
import type {
  NetworkRequest,
  PageMetrics,
} from "../browser/playwright-client.js";
import { isFrameworkOwnedUrl } from "../engine/environment-detector.js";

export class CacheAnalyzer implements Analyzer {
  readonly name = "cache";
  readonly description = "Analyzes HTTP cache headers and caching strategies";
  readonly categories: Category[] = ["caching", "network"];

  private readonly staticAssetExtensions = [
    ".js",
    ".css",
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".avif",
    ".svg",
    ".woff",
    ".woff2",
    ".ttf",
    ".eot",
    ".ico",
  ];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics || !metrics.requests) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [
          "No network metrics available. Playwright integration may not be active.",
        ],
      };
    }

    const requests = metrics.requests;

    const { appRequests, frameworkRequests } = this.categorizeRequests(
      requests,
      context,
    );

    const htmlFinding = this.checkHtmlCaching(requests, context);
    if (htmlFinding) {
      findings.push(htmlFinding);
    }

    const staticAssetFindings = this.checkStaticAssetsCaching(
      appRequests,
      context,
    );
    findings.push(...staticAssetFindings);

    const etagFindings = this.checkETagUsage(context);
    findings.push(...etagFindings);

    const uncachedFindings = this.checkUncachedResources(appRequests, context);
    findings.push(...uncachedFindings);

    if (frameworkRequests.length > 0 && !environment.isLocalDev) {
      const frameworkNote = this.createFrameworkAssetsNote(
        frameworkRequests,
        context,
      );
      if (frameworkNote) {
        findings.push(frameworkNote);
      }
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private categorizeRequests(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): { appRequests: NetworkRequest[]; frameworkRequests: NetworkRequest[] } {
    const environment = getEnvironment(context);
    const appRequests: NetworkRequest[] = [];
    const frameworkRequests: NetworkRequest[] = [];

    for (const request of requests) {
      if (isFrameworkOwnedUrl(request.url, environment.frameworkPatterns)) {
        frameworkRequests.push(request);
      } else {
        appRequests.push(request);
      }
    }

    return { appRequests, frameworkRequests };
  }

  private checkHtmlCaching(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding | null {
    const htmlRequest = requests.find((r) => r.resourceType === "document");
    const environment = getEnvironment(context);

    if (!htmlRequest) {
      return null;
    }

    const envLimited = isEnvironmentLimited(context, "cache");
    const confidence = getConfidenceForEnvironment(context, "cache");

    const envNotes: string[] = [];
    if (environment.isLocalDev) {
      envNotes.push(
        "HTML caching behavior in local development typically differs from production.",
      );
    } else if (!environment.cacheHeadersReliable) {
      envNotes.push(
        "Cache headers in this environment may not reflect production configuration.",
      );
    }

    return {
      id: "cache-html-check-limitation",
      title: "HTML caching check requires response headers",
      description:
        "To properly analyze cache headers, response headers need to be captured. Best practice: HTML should use `Cache-Control: no-cache` or short max-age to ensure fresh content.",
      severity: "info",
      category: "caching",
      evidence: [
        {
          type: "url",
          label: "HTML Document",
          data: htmlRequest.url,
        },
      ],
      impact: "Cannot verify HTML caching strategy",
      recommendation:
        "Ensure HTML uses `Cache-Control: no-cache, must-revalidate` or short max-age (e.g., 300s)",
      confidence,
      environmentLimited: envLimited,
      environmentNotes: envNotes.length > 0 ? envNotes : undefined,
      learnMoreUrl: "https://web.dev/http-cache/",
      ownership: this.getInfraOwnership(
        "Server or CDN configuration controls document caching",
      ),
      analyzer: this.name,
    };
  }

  private checkStaticAssetsCaching(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const staticAssets = requests.filter((r) => {
      const url = r.url.split("?")[0] ?? "";
      return this.staticAssetExtensions.some((ext) =>
        url.toLowerCase().endsWith(ext),
      );
    });

    if (staticAssets.length === 0) {
      return findings;
    }

    const cachedAssets = staticAssets.filter((r) => r.cached === true);
    const uncachedAssets = staticAssets.filter((r) => r.cached !== true);

    if (uncachedAssets.length > 5) {
      const examples = uncachedAssets.slice(0, 5).map((r) => r.url);

      const baseSeverity: Severity = "warning";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "cache",
      );

      findings.push({
        id: "cache-static-assets-not-cached",
        title: `${uncachedAssets.length} static assets not served from cache`,
        description: this.buildUncachedDescription(
          uncachedAssets.length,
          environment,
        ),
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "caching",
        evidence: [
          {
            type: "code-snippet",
            label: "Uncached static assets (sample)",
            data: examples.join("\n"),
          },
          {
            type: "metric",
            label: "Statistics",
            data: {
              uncachedCount: uncachedAssets.length,
              cachedCount: cachedAssets.length,
              totalStatic: staticAssets.length,
            },
          },
        ],
        impact: "Slower repeat visits, higher bandwidth usage, CDN costs",
        recommendation:
          "Set `Cache-Control: public, max-age=31536000, immutable` for static assets with versioned filenames",
        frameworkRecommendation:
          this.getFrameworkCacheRecommendation(environment),
        impactScore: Math.min(uncachedAssets.length * 3, 40),
        confidence: getConfidenceForEnvironment(context, "cache"),
        environmentLimited: isEnvironmentLimited(context, "cache"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "cache", severityResult.note)
          : undefined,
        learnMoreUrl: "https://web.dev/http-cache/",
        ownership: this.getInfraOwnership(
          "Server or CDN configuration typically controls caching headers",
        ),
        analyzer: this.name,
      });
    } else if (uncachedAssets.length > 0) {
      const severityResult = adjustSeverityForEnvironment(
        "info",
        context,
        "cache",
      );

      findings.push({
        id: "cache-some-assets-not-cached",
        title: `${uncachedAssets.length} static assets not cached`,
        description: `Found ${uncachedAssets.length} static assets without cache headers.`,
        severity: severityResult.severity,
        category: "caching",
        evidence: [
          {
            type: "code-snippet",
            label: "Uncached assets",
            data: uncachedAssets.map((r) => r.url).join("\n"),
          },
        ],
        impact: "Suboptimal caching strategy",
        recommendation: "Enable long-term caching for static assets",
        confidence: getConfidenceForEnvironment(context, "cache"),
        environmentLimited: isEnvironmentLimited(context, "cache"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "cache", severityResult.note)
          : undefined,
        learnMoreUrl: "https://web.dev/http-cache/",
        ownership: this.getInfraOwnership(
          "Server configuration controls caching",
        ),
        analyzer: this.name,
      });
    }

    if (cachedAssets.length > 0 && uncachedAssets.length === 0) {
      findings.push({
        id: "cache-static-assets-cached",
        title: "All static assets use caching",
        description: `${cachedAssets.length} static assets are properly cached.`,
        severity: "success",
        category: "caching",
        evidence: [
          {
            type: "metric",
            label: "Cached Assets",
            data: { value: cachedAssets.length },
          },
        ],
        impact: "Fast repeat visits, reduced bandwidth",
        recommendation: "Continue using cache headers for static assets",
        confidence: "high",
        analyzer: this.name,
      });
    }

    return findings;
  }

  private buildUncachedDescription(
    count: number,
    environment: ReturnType<typeof getEnvironment>,
  ): string {
    let description = `Found ${count} static assets that were not served from cache. Static assets should use long-term caching with Cache-Control max-age.`;

    if (environment.isLocalDev) {
      description +=
        " Note: Local development servers often don't implement production-like caching.";
    } else if (!environment.cacheHeadersReliable) {
      description +=
        " Note: Cache behavior in this environment may differ from production.";
    }

    return description;
  }

  private getFrameworkCacheRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) {
      return undefined;
    }

    const recommendations: Record<string, string> = {
      "next.js":
        "Next.js automatically handles caching for /_next/static/ assets. " +
        "For public/ folder assets, configure caching in your deployment platform (Vercel, etc.) or next.config.js headers.",
      nuxt:
        "Nuxt handles caching for /_nuxt/ assets automatically. " +
        "Configure custom cache headers in nuxt.config.js under nitro.routeRules.",
      vite:
        "Vite produces hashed filenames for production builds. " +
        "Configure your server to cache *.js and *.css files with long max-age.",
      gatsby:
        "Gatsby generates hashed filenames. Configure caching headers in your hosting platform " +
        "or gatsby-plugin-netlify/gatsby-plugin-s3 for automatic cache headers.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
  }

  private checkETagUsage(context: AnalyzerContext): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    if (environment.isLocalDev) {
      return findings;
    }

    findings.push({
      id: "cache-etag-info",
      title: "ETag validation recommended",
      description:
        "ETag headers enable efficient cache revalidation. When combined with Cache-Control, ETags allow browsers to validate cached resources without re-downloading.",
      severity: "info",
      category: "caching",
      evidence: [
        {
          type: "custom",
          label: "Best Practice",
          data: "Use ETag header for cache validation",
        },
      ],
      impact: "Better cache efficiency with validation",
      recommendation:
        "Ensure server sends ETag headers for cacheable resources. Use strong ETags for versioned assets.",
      confidence: "high",
      learnMoreUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag",
      ownership: this.getInfraOwnership(
        "Server configuration determines ETag generation",
      ),
      analyzer: this.name,
    });

    return findings;
  }

  private checkUncachedResources(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const apiRequests = requests.filter(
      (r) =>
        r.resourceType === "fetch" ||
        r.resourceType === "xhr" ||
        r.url.includes("/api/"),
    );

    if (apiRequests.length > 10) {
      const severityResult = adjustSeverityForEnvironment(
        "info",
        context,
        "cache",
      );

      const description = environment.isLocalDev
        ? `Found ${apiRequests.length} API requests. In local development, some of these may be from dev tooling (HMR, etc.). In production, consider implementing cache strategies for frequently accessed endpoints.`
        : `Found ${apiRequests.length} API requests. Consider implementing cache strategies for frequently accessed API endpoints.`;

      findings.push({
        id: "cache-many-api-requests",
        title: `${apiRequests.length} API/XHR requests detected`,
        description,
        severity: severityResult.severity,
        category: "caching",
        evidence: [
          {
            type: "metric",
            label: "API Request Count",
            data: { value: apiRequests.length },
          },
        ],
        impact: "Higher server load, slower page load on repeat visits",
        recommendation:
          "Implement API response caching with appropriate Cache-Control headers or use HTTP caching proxies",
        confidence: getConfidenceForEnvironment(context, "cache"),
        environmentLimited: isEnvironmentLimited(context, "cache"),
        environmentNotes: environment.isLocalDev
          ? [
              "API request count in local dev may include HMR and dev tooling requests",
            ]
          : undefined,
        learnMoreUrl: "https://web.dev/stale-while-revalidate/",
        ownership: this.getAppOwnership(
          "API caching strategy is determined by application and server code",
        ),
        analyzer: this.name,
      });
    }

    return findings;
  }

  private createFrameworkAssetsNote(
    frameworkRequests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding | null {
    const environment = getEnvironment(context);

    if (frameworkRequests.length < 5) {
      return null;
    }

    const frameworkName = environment.detectedFramework || "the framework";

    const staticAssets = frameworkRequests.filter((r) => {
      const url = r.url.split("?")[0] ?? "";
      return this.staticAssetExtensions.some((ext) =>
        url.toLowerCase().endsWith(ext),
      );
    });

    return {
      id: "cache-framework-managed-assets",
      title: `${frameworkRequests.length} assets managed by ${frameworkName}`,
      description:
        `${frameworkRequests.length} requests are for assets managed by ${frameworkName}. ` +
        `These typically have optimized caching configured automatically by the framework's build process.`,
      severity: "info",
      category: "caching",
      evidence: [
        {
          type: "metric",
          label: "Framework Assets",
          data: {
            total: frameworkRequests.length,
            staticAssets: staticAssets.length,
            framework: frameworkName,
          },
        },
        {
          type: "code-snippet",
          label: "Sample URLs",
          data: frameworkRequests
            .slice(0, 3)
            .map((r) => r.url)
            .join("\n"),
        },
      ],
      impact: "Framework handles caching optimization automatically",
      recommendation: `Review ${frameworkName} documentation if you need to customize caching behavior for framework assets.`,
      confidence: "high",
      ownership: {
        type: "framework-owned",
        confidence: "high",
        reason: `Managed by ${frameworkName} build system`,
      },
      analyzer: this.name,
    };
  }

  // ============================================
  // Ownership Helper Methods
  // ============================================

  private getInfraOwnership(reason: string): OwnershipHint {
    return {
      type: "infra-owned",
      confidence: "high",
      reason,
    };
  }

  private getAppOwnership(reason: string): OwnershipHint {
    return {
      type: "app-owned",
      confidence: "medium",
      reason,
    };
  }
}
