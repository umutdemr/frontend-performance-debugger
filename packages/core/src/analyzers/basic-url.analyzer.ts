import type { Finding, Category, OwnershipHint } from "@fpd/shared-types";
import { COMMON_DEV_PORTS } from "@fpd/shared-types";
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

export class BasicUrlAnalyzer implements Analyzer {
  readonly name = "basic-url";
  readonly description = "Analyzes URL structure for common issues";
  readonly categories: Category[] = ["general", "network", "seo", "caching"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    let url: URL;
    try {
      url = new URL(context.url);
    } catch {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: ["Invalid URL provided"],
      };
    }

    const httpFinding = this.checkHttps(url, context);
    if (httpFinding) {
      findings.push(httpFinding);
    }

    const portFinding = this.checkPort(url, context);
    if (portFinding) {
      findings.push(portFinding);
    }

    const lengthFinding = this.checkUrlLength(context.url);
    if (lengthFinding) {
      findings.push(lengthFinding);
    }

    const trailingSlashFinding = this.checkTrailingSlash(url, context);
    if (trailingSlashFinding) {
      findings.push(trailingSlashFinding);
    }

    const wwwFinding = this.checkWwwUsage(url, context);
    if (wwwFinding) {
      findings.push(wwwFinding);
    }

    const queryFinding = this.checkQueryString(url, context);
    if (queryFinding) {
      findings.push(queryFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkHttps(url: URL, context: AnalyzerContext): Finding | null {
    if (url.protocol === "https:") {
      return null;
    }

    const environment = getEnvironment(context);

    if (
      environment.hostType === "localhost" ||
      environment.hostType === "private-ip"
    ) {
      return {
        id: "basic-url-http-local",
        title: "Site using HTTP (local development)",
        description:
          "Site is served over HTTP. This is expected for local development but would be a critical issue in production.",
        severity: "info",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Current URL",
            data: url.href,
          },
          {
            type: "custom",
            label: "Environment",
            data: { note: "HTTP is acceptable for local development" },
          },
        ],
        impact: "No impact in local development",
        recommendation: "Ensure HTTPS is configured for production deployment.",
        confidence: "high",
        environmentLimited: true,
        environmentNotes: ["HTTP is acceptable for local development"],
        ownership: this.getInfraOwnership(
          "Server/hosting configuration determines protocol",
        ),
        analyzer: this.name,
      };
    }

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
        "Migrate to HTTPS and set up proper redirects from HTTP to HTTPS. Most hosting providers offer free SSL certificates via Let's Encrypt.",
      impactScore: 95,
      confidence: "high",
      learnMoreUrl: "https://web.dev/why-https-matters/",
      ownership: this.getInfraOwnership(
        "Server/hosting configuration determines protocol",
      ),
      analyzer: this.name,
    };
  }

  private checkPort(url: URL, context: AnalyzerContext): Finding | null {
    const port = url.port ? parseInt(url.port, 10) : undefined;

    if (!port || port === 80 || port === 443) {
      return null;
    }

    const environment = getEnvironment(context);

    if (environment.isLocalDev) {
      if (COMMON_DEV_PORTS.has(port)) {
        return null;
      }

      return {
        id: "basic-url-port-local-unusual",
        title: "Unusual local development port",
        description: `Site is running on port ${port}, which is not a commonly used development port. This is not an issue, just noted for reference.`,
        severity: "info",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "Port",
            data: {
              value: port,
              note: "Non-standard but acceptable for local development",
            },
          },
        ],
        impact: "No impact for local development",
        recommendation: "No action needed for local development.",
        confidence: "high",
        environmentLimited: true,
        environmentNotes: ["Port configuration is a local development choice"],
        analyzer: this.name,
      };
    }

    if (environment.runtimeEnvironment === "preview") {
      return {
        id: "basic-url-port-preview",
        title: "Non-standard port (preview environment)",
        description: `Site is served on port ${port}. This may be expected for preview deployments but should not occur in production.`,
        severity: "info",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Port",
            data: { value: port },
          },
        ],
        impact: "May indicate non-production configuration",
        recommendation:
          "Verify production deployment uses standard ports (80/443).",
        confidence: "medium",
        environmentLimited: true,
        environmentNotes: ["Preview environments may use non-standard ports"],
        ownership: this.getInfraOwnership(
          "Hosting configuration determines port",
        ),
        analyzer: this.name,
      };
    }

    return {
      id: "basic-url-port-production",
      title: "Non-standard port in production",
      description: `Site is served on port ${port} instead of standard ports (80/443). This can cause accessibility issues, may be blocked by corporate firewalls, and indicates non-standard hosting configuration.`,
      severity: "warning",
      category: "network",
      evidence: [
        {
          type: "metric",
          label: "Port",
          data: { value: port },
        },
      ],
      impact:
        "May be blocked by firewalls, harder to access, indicates non-standard setup",
      recommendation:
        "Configure your server to serve traffic on standard ports (80 for HTTP, 443 for HTTPS). Use a reverse proxy like nginx or Cloudflare if needed.",
      impactScore: 30,
      confidence: "high",
      ownership: this.getInfraOwnership(
        "Server/hosting configuration determines port",
      ),
      analyzer: this.name,
    };
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
        impactScore: 20,
        confidence: "high",
        ownership: this.getAppOwnership(
          "Application routing and query parameters determine URL length",
        ),
        analyzer: this.name,
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
        confidence: "high",
        ownership: this.getAppOwnership(
          "Application routing determines URL structure",
        ),
        analyzer: this.name,
      };
    }

    return null;
  }

  private checkTrailingSlash(
    url: URL,
    context: AnalyzerContext,
  ): Finding | null {
    const path = url.pathname;

    if (path === "/" || path === "") {
      return null;
    }

    const hasExtension = /\.[a-z0-9]+$/i.test(path);
    if (hasExtension) {
      return null;
    }

    if (!path.endsWith("/")) {
      const environment = getEnvironment(context);

      let frameworkNote: string | undefined;
      if (environment.detectedFramework === "next.js") {
        frameworkNote =
          "Next.js handles trailing slashes via next.config.js trailingSlash option.";
      } else if (environment.detectedFramework === "nuxt") {
        frameworkNote =
          "Nuxt handles trailing slashes via nuxt.config.js router.trailingSlash option.";
      }

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
        frameworkRecommendation: frameworkNote,
        confidence: "medium",
        learnMoreUrl:
          "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
        ownership: this.getConfigOwnership(
          "Server or framework configuration determines trailing slash behavior",
        ),
        analyzer: this.name,
      };
    }

    return null;
  }

  private checkWwwUsage(url: URL, context: AnalyzerContext): Finding | null {
    const hostname = url.hostname;
    const environment = getEnvironment(context);

    if (environment.isLocalDev) {
      return null;
    }

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
        confidence: "high",
        ownership: this.getInfraOwnership(
          "DNS and server configuration determine www handling",
        ),
        analyzer: this.name,
      };
    }

    return null;
  }

  private checkQueryString(url: URL, context: AnalyzerContext): Finding | null {
    const queryString = url.search;
    const paramCount = url.searchParams.size;

    if (queryString.length > 500) {
      const severityResult = adjustSeverityForEnvironment(
        "warning",
        context,
        "cache",
      );

      return {
        id: "basic-url-complex-query",
        title: "URL has complex query string",
        description: `The URL has a query string of ${queryString.length} characters with ${paramCount} parameters. Complex query strings can impact caching and analytics.`,
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? "warning" : undefined,
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
        impactScore: 25,
        confidence: getConfidenceForEnvironment(context, "cache"),
        environmentLimited: isEnvironmentLimited(context, "cache"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "cache", severityResult.note)
          : undefined,
        ownership: this.getAppOwnership(
          "Application code determines query parameters",
        ),
        analyzer: this.name,
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
        confidence: getConfidenceForEnvironment(context, "cache"),
        environmentLimited: isEnvironmentLimited(context, "cache"),
        ownership: this.getAppOwnership(
          "Application code determines query parameters",
        ),
        analyzer: this.name,
      };
    }

    return null;
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
      confidence: "high",
      reason,
    };
  }

  private getConfigOwnership(reason: string): OwnershipHint {
    return {
      type: "config-owned",
      confidence: "medium",
      reason,
    };
  }
}
