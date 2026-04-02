import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";

export class BasicUrlAnalyzer implements Analyzer {
  readonly name = "basic-url";
  readonly description = "Analyzes URL structure for common issues";
  readonly categories: Category[] = ["general", "network", "seo", "caching"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const url = new URL(context.url);

    // Check 1: HTTP instead of HTTPS (only for non-local/public URLs)
    const httpFinding = this.checkHttps(url);
    if (httpFinding) {
      findings.push(httpFinding);
    }

    // Check 2: URL length
    const lengthFinding = this.checkUrlLength(context.url);
    if (lengthFinding) {
      findings.push(lengthFinding);
    }

    // Check 3: Trailing slash consistency
    const trailingSlashFinding = this.checkTrailingSlash(url);
    if (trailingSlashFinding) {
      findings.push(trailingSlashFinding);
    }

    // Check 4: WWW consistency hint
    const wwwFinding = this.checkWwwUsage(url);
    if (wwwFinding) {
      findings.push(wwwFinding);
    }

    // Check 5: Query string complexity
    const queryFinding = this.checkQueryString(url);
    if (queryFinding) {
      findings.push(queryFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkHttps(url: URL): Finding | null {
    // Local development URLs should not be flagged as critical for HTTP usage
    if (this.isLocalUrl(url)) {
      return null;
    }

    if (url.protocol === "http:") {
      return {
        id: "basic-url-no-https",
        title: "Site is not using HTTPS",
        description:
          "The URL uses HTTP instead of HTTPS. This impacts security, SEO rankings, and prevents HTTP/2 and HTTP/3 performance benefits.",
        severity: "critical",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Current URL",
            data: url.href,
          },
        ],
        impact:
          "No HTTP/2 multiplexing, no Brotli compression, SEO penalty, security risks",
        recommendation:
          "Migrate to HTTPS and set up proper redirects from HTTP to HTTPS",
        learnMoreUrl: "https://web.dev/why-https-matters/",
      };
    }

    return null;
  }

  private checkUrlLength(urlString: string): Finding | null {
    const length = urlString.length;

    if (length > 2000) {
      return {
        id: "basic-url-too-long",
        title: "URL exceeds recommended length",
        description: `The URL is ${length} characters long. URLs over 2000 characters may cause issues with some browsers and servers.`,
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "URL Length",
            data: { value: length, unit: "characters", threshold: 2000 },
          },
        ],
        impact:
          "Potential compatibility issues, harder to share, may be truncated",
        recommendation:
          "Shorten URL by reducing query parameters or using URL shortening for sharing",
      };
    }

    if (length > 1000) {
      return {
        id: "basic-url-long",
        title: "URL is longer than recommended",
        description: `The URL is ${length} characters long. While functional, shorter URLs are easier to share and maintain.`,
        severity: "info",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "URL Length",
            data: { value: length, unit: "characters", threshold: 1000 },
          },
        ],
        impact: "Minor usability concern",
        recommendation: "Consider shortening URL for better usability",
      };
    }

    return null;
  }

  private checkTrailingSlash(url: URL): Finding | null {
    const path = url.pathname;

    // Skip root path
    if (path === "/" || path === "") {
      return null;
    }

    // Check if path has file extension (likely a file, not a route)
    const hasExtension = /\.[a-z0-9]+$/i.test(path);
    if (hasExtension) {
      return null;
    }

    // No trailing slash on what looks like a route
    if (!path.endsWith("/")) {
      return {
        id: "basic-url-no-trailing-slash",
        title: "URL path has no trailing slash",
        description:
          "The URL path does not end with a trailing slash. This may cause redirect overhead if your server normalizes URLs.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Current Path",
            data: path,
          },
        ],
        impact: "Potential 301 redirect overhead, minor SEO consideration",
        recommendation:
          "Ensure consistent trailing slash policy across your site. Configure server to avoid redirects.",
        learnMoreUrl:
          "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
      };
    }

    return null;
  }

  private checkWwwUsage(url: URL): Finding | null {
    const hostname = url.hostname;

    // Only flag if using www (informational)
    if (hostname.startsWith("www.")) {
      return {
        id: "basic-url-www-usage",
        title: "Site uses www subdomain",
        description:
          "The URL uses the www subdomain. This is fine, but ensure you have proper redirects from non-www to www (or vice versa) to avoid duplicate content.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Hostname",
            data: hostname,
          },
        ],
        impact: "Potential duplicate content if both www and non-www resolve",
        recommendation:
          "Set up 301 redirects to canonicalize to your preferred version (www or non-www)",
      };
    }

    return null;
  }

  private checkQueryString(url: URL): Finding | null {
    const queryString = url.search;
    const paramCount = url.searchParams.size;

    if (queryString.length > 500) {
      return {
        id: "basic-url-complex-query",
        title: "URL has complex query string",
        description: `The URL has a query string of ${queryString.length} characters with ${paramCount} parameters. Complex query strings can impact caching and analytics.`,
        severity: "warning",
        category: "caching",
        evidence: [
          {
            type: "metric",
            label: "Query String",
            data: {
              length: queryString.length,
              paramCount,
            },
          },
        ],
        impact: "May bypass CDN cache, complicates analytics tracking",
        recommendation:
          "Consider moving state to POST body, localStorage, or shortening parameter names",
      };
    }

    if (paramCount > 10) {
      return {
        id: "basic-url-many-params",
        title: "URL has many query parameters",
        description: `The URL has ${paramCount} query parameters. Many parameters can complicate caching strategies.`,
        severity: "info",
        category: "caching",
        evidence: [
          {
            type: "metric",
            label: "Parameter Count",
            data: { value: paramCount },
          },
        ],
        impact: "May reduce cache hit rate",
        recommendation: "Review if all parameters are necessary in the URL",
      };
    }

    return null;
  }

  /**
   * Detect whether the URL is a local/dev URL
   */
  private isLocalUrl(url: URL): boolean {
    const hostname = url.hostname.toLowerCase();

    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "::1" ||
      hostname.endsWith(".local")
    );
  }
}
