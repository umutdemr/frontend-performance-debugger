import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";
import type {
  NetworkRequest,
  PageMetrics,
} from "../browser/playwright-client.js";

//Cache Headers Analyzer Analyzes HTTP cache headers for optimization opportunities

export class CacheAnalyzer implements Analyzer {
  readonly name = "cache";
  readonly description = "Analyzes HTTP cache headers and caching strategies";
  readonly categories: Category[] = ["caching", "network"];

  /** Static asset extensions that should be cached long-term */
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

    // Get response headers for each request
    const requests = metrics.requests;

    // Check HTML document caching
    const htmlFinding = this.checkHtmlCaching(requests);
    if (htmlFinding) {
      findings.push(htmlFinding);
    }

    // Check static assets caching
    const staticAssetFindings = this.checkStaticAssetsCaching(requests);
    findings.push(...staticAssetFindings);

    // Check ETag usage
    const etagFindings = this.checkETagUsage();
    findings.push(...etagFindings);

    // Check for cacheable but uncached resources
    const uncachedFindings = this.checkUncachedResources(requests);
    findings.push(...uncachedFindings);

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkHtmlCaching(requests: NetworkRequest[]): Finding | null {
    const htmlRequest = requests.find((r) => r.resourceType === "document");

    if (!htmlRequest) {
      return null;
    }

    // TEMP: We don't have response headers in NetworkRequest yet
    // This is a limitation - we'll add a note
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
      learnMoreUrl: "https://web.dev/http-cache/",
    };
  }

  private checkStaticAssetsCaching(requests: NetworkRequest[]): Finding[] {
    const findings: Finding[] = [];

    const staticAssets = requests.filter((r) => {
      const url = r.url.split("?")[0] ?? "";
      return this.staticAssetExtensions.some((ext) =>
        url.toLowerCase().endsWith(ext),
      );
    });

    if (staticAssets.length === 0) {
      return findings;
    }

    // TEMP: Without response headers, we can only check if resources were cached
    const cachedAssets = staticAssets.filter((r) => r.cached === true);
    const uncachedAssets = staticAssets.filter((r) => r.cached !== true);

    if (uncachedAssets.length > 5) {
      const examples = uncachedAssets.slice(0, 5).map((r) => r.url);

      findings.push({
        id: "cache-static-assets-not-cached",
        title: `${uncachedAssets.length} static assets not served from cache`,
        description: `Found ${uncachedAssets.length} static assets that were not served from cache. Static assets should use long-term caching with Cache-Control max-age.`,
        severity: "warning",
        category: "caching",
        evidence: [
          {
            type: "code-snippet",
            label: "Uncached static assets",
            data: examples.join("\n"),
          },
        ],
        impact: "Slower repeat visits, higher bandwidth usage, CDN costs",
        recommendation:
          "Set `Cache-Control: public, max-age=31536000, immutable` for static assets with versioned filenames",
        learnMoreUrl: "https://web.dev/http-cache/",
      });
    } else if (uncachedAssets.length > 0) {
      findings.push({
        id: "cache-some-assets-not-cached",
        title: `${uncachedAssets.length} static assets not cached`,
        description: `Found ${uncachedAssets.length} static assets without cache headers.`,
        severity: "info",
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
        learnMoreUrl: "https://web.dev/http-cache/",
      });
    }

    // Success: assets are cached
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
      });
    }

    return findings;
  }

  private checkETagUsage(): Finding[] {
    const findings: Finding[] = [];

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
      learnMoreUrl:
        "https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/ETag",
    });

    return findings;
  }

  // Check for resources that should be cached but aren't

  private checkUncachedResources(requests: NetworkRequest[]): Finding[] {
    const findings: Finding[] = [];

    // Check for API responses or JSON that might benefit from caching
    const apiRequests = requests.filter(
      (r) =>
        r.resourceType === "fetch" ||
        r.resourceType === "xhr" ||
        r.url.includes("/api/"),
    );

    if (apiRequests.length > 10) {
      findings.push({
        id: "cache-many-api-requests",
        title: `${apiRequests.length} API/XHR requests detected`,
        description: `Found ${apiRequests.length} API requests. Consider implementing cache strategies for frequently accessed API endpoints.`,
        severity: "info",
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
        learnMoreUrl: "https://web.dev/stale-while-revalidate/",
      });
    }

    return findings;
  }
}
