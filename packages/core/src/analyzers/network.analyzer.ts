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

export class NetworkAnalyzer implements Analyzer {
  readonly name = "network";
  readonly description = "Analyzes network requests and resource loading";
  readonly categories: Category[] = ["network", "assets", "caching"];

  private readonly TOTAL_SIZE_CRITICAL_MB = 10;
  private readonly TOTAL_SIZE_WARNING_MB = 3;
  private readonly LARGE_RESOURCE_KB = 500;
  private readonly LARGE_IMAGE_KB = 200;
  private readonly SLOW_REQUEST_MS = 2000;
  private readonly SLOW_REQUEST_LOCAL_MS = 5000;

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics) {
      return {
        analyzerName: this.name,
        findings: this.handleNoMetrics(context),
        duration: Date.now() - startTime,
        errors: [
          "No network metrics available. Playwright integration may not be active.",
        ],
      };
    }

    const { appRequests, frameworkRequests } = this.categorizeRequests(
      metrics.requests,
      context,
    );

    const sizeFinding = this.checkTotalSize(metrics, context);
    if (sizeFinding) {
      findings.push(sizeFinding);
    }

    const requestCountFinding = this.checkRequestCount(
      metrics.requests,
      context,
    );
    if (requestCountFinding) {
      findings.push(requestCountFinding);
    }

    const largeResources = this.collectLargeResources(appRequests);
    if (largeResources.length > 0) {
      findings.push(this.createLargeResourcesFinding(largeResources, context));
    }

    const slowRequests = this.collectSlowRequests(appRequests, context);
    if (slowRequests.length > 0) {
      findings.push(this.createSlowRequestsFinding(slowRequests, context));
    }

    const errorRequests = this.collectErrorResponses(metrics.requests);
    if (errorRequests.client.length > 0 || errorRequests.server.length > 0) {
      const errorFindings = this.createErrorFindings(errorRequests, context);
      findings.push(...errorFindings);
    }

    if (frameworkRequests.length > 10 && !environment.isLocalDev) {
      const frameworkNote = this.createFrameworkResourceNote(
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

  /**
   * Handle case when no metrics are available
   */
  private handleNoMetrics(context: AnalyzerContext): Finding[] {
    const environment = getEnvironment(context);
    const isLikelyCritical =
      environment.runtimeEnvironment === "production" &&
      !environment.isLocalDev;

    return [
      {
        id: "network-no-metrics",
        title: "No network metrics captured",
        description:
          "The analysis did not capture any network metrics. " +
          "This could indicate a problem with the site or the analysis process.",
        severity: isLikelyCritical ? "critical" : "warning",
        category: "network",
        evidence: [
          {
            type: "custom",
            label: "Status",
            data: { metricsAvailable: false },
          },
        ],
        impact: "Cannot analyze network performance",
        recommendation:
          "Verify the site loads correctly and try running the analysis again.",
        confidence: "medium",
        environmentLimited: environment.isLocalDev,
        environmentNotes: environment.isLocalDev
          ? ["Local development servers may behave differently during analysis"]
          : undefined,
        ownership: {
          type: "unknown",
          confidence: "low",
          reason: "Unable to determine without metrics",
        },
        analyzer: this.name,
      },
    ];
  }

  /**
   * Categorize requests into app-owned and framework-owned
   */
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

  private checkTotalSize(
    metrics: PageMetrics,
    context: AnalyzerContext,
  ): Finding | null {
    const totalMB = metrics.size.totalBytes / 1024 / 1024;
    const environment = getEnvironment(context);

    if (totalMB > this.TOTAL_SIZE_CRITICAL_MB) {
      const baseSeverity: Severity = "critical";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "performance",
      );

      return {
        id: "network-total-size-large",
        title: "Total page size is very large",
        description: this.buildSizeDescription(
          totalMB,
          "critical",
          environment,
        ),
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Total Page Size",
            data: {
              value: totalMB.toFixed(1),
              unit: "MB",
              threshold: this.TOTAL_SIZE_CRITICAL_MB,
            },
          },
          {
            type: "metric",
            label: "Size Breakdown",
            data: metrics.size,
          },
        ],
        impact: "Extremely slow load times on mobile, high data usage",
        recommendation:
          "Optimize images, lazy load non-critical resources, remove unused scripts",
        frameworkRecommendation:
          this.getFrameworkSizeRecommendation(environment),
        impactScore: 80,
        confidence: getConfidenceForEnvironment(context, "performance"),
        environmentLimited: isEnvironmentLimited(context, "performance"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "performance", severityResult.note)
          : undefined,
        ownership: this.getAppOwnership(
          "Application code and assets determine total page size",
        ),
        analyzer: this.name,
      };
    }

    if (totalMB > this.TOTAL_SIZE_WARNING_MB) {
      const baseSeverity: Severity = "warning";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "performance",
      );

      return {
        id: "network-total-size-medium",
        title: "Total page size is larger than recommended",
        description: this.buildSizeDescription(totalMB, "warning", environment),
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Total Page Size",
            data: {
              value: totalMB.toFixed(1),
              unit: "MB",
              threshold: this.TOTAL_SIZE_WARNING_MB,
            },
          },
        ],
        impact: "Slower load times on mobile networks",
        recommendation: "Optimize images and reduce unnecessary JavaScript",
        frameworkRecommendation:
          this.getFrameworkSizeRecommendation(environment),
        impactScore: 40,
        confidence: getConfidenceForEnvironment(context, "performance"),
        environmentLimited: isEnvironmentLimited(context, "performance"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "performance", severityResult.note)
          : undefined,
        ownership: this.getAppOwnership(
          "Application code and assets determine page size",
        ),
        analyzer: this.name,
      };
    }

    return null;
  }

  /**
   * Build size description with environment awareness
   */
  private buildSizeDescription(
    totalMB: number,
    level: "critical" | "warning",
    environment: ReturnType<typeof getEnvironment>,
  ): string {
    let description =
      level === "critical"
        ? `Total page size is ${totalMB.toFixed(1)}MB. This will cause very slow load times on mobile networks.`
        : `Total page size is ${totalMB.toFixed(1)}MB. Recommended maximum is ${this.TOTAL_SIZE_WARNING_MB}MB for good mobile performance.`;

    if (!environment.productionLikeBuild) {
      description +=
        " Note: Development builds are typically larger than production due to lack of minification.";
    }

    return description;
  }

  private checkRequestCount(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding | null {
    const count = requests.length;
    const environment = getEnvironment(context);

    const WARNING_THRESHOLD = 50;
    const CRITICAL_THRESHOLD = 100;

    if (count < WARNING_THRESHOLD) {
      return null;
    }

    const isCritical = count >= CRITICAL_THRESHOLD;
    const baseSeverity: Severity = isCritical ? "warning" : "info";
    const severityResult = adjustSeverityForEnvironment(
      baseSeverity,
      context,
      "network",
    );

    let description = `The page made ${count} network requests. `;
    if (isCritical) {
      description +=
        "This is significantly impacting load time and should be addressed.";
    } else {
      description +=
        "Consider reducing requests through bundling, lazy loading, or removing unused resources.";
    }

    if (environment.isLocalDev) {
      description +=
        " Note: Local development often has more requests due to HMR, source maps, and dev tooling.";
    } else if (!environment.productionLikeBuild) {
      description +=
        " Note: Development builds typically have more requests than production.";
    }

    return {
      id: "network-request-count",
      title: `High number of network requests (${count})`,
      description,
      severity: severityResult.severity,
      originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
      category: "network",
      evidence: [
        {
          type: "metric",
          label: "Request Count",
          data: {
            value: count,
            warningThreshold: WARNING_THRESHOLD,
            criticalThreshold: CRITICAL_THRESHOLD,
          },
        },
      ],
      impact: "More requests mean longer load times and higher server load",
      recommendation:
        "Bundle JavaScript and CSS files. Lazy load below-the-fold content. " +
        "Use resource hints for critical resources. Remove unused dependencies.",
      impactScore: Math.min((count - WARNING_THRESHOLD) * 0.5, 50),
      confidence: getConfidenceForEnvironment(context, "network"),
      environmentLimited: isEnvironmentLimited(context, "network"),
      environmentNotes: severityResult.downgraded
        ? createEnvironmentNotes(context, "network", severityResult.note)
        : undefined,
      ownership: this.getAppOwnership(
        "Application structure and bundling determine request count",
      ),
      analyzer: this.name,
    };
  }

  private collectLargeResources(requests: NetworkRequest[]): NetworkRequest[] {
    return requests.filter((request) => {
      if (!request.size) return false;
      const sizeKB = request.size / 1024;

      if (request.resourceType === "image") {
        return sizeKB > this.LARGE_IMAGE_KB;
      }
      return sizeKB > this.LARGE_RESOURCE_KB;
    });
  }

  /**
   * Create grouped finding for large resources
   */
  private createLargeResourcesFinding(
    largeResources: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding {
    const environment = getEnvironment(context);

    const byType = new Map<string, NetworkRequest[]>();
    for (const resource of largeResources) {
      const type = resource.resourceType || "other";
      const list = byType.get(type) || [];
      list.push(resource);
      byType.set(type, list);
    }

    const totalSizeKB = largeResources.reduce(
      (sum, r) => sum + (r.size || 0) / 1024,
      0,
    );

    const baseSeverity: Severity =
      largeResources.length > 3 ? "warning" : "info";
    const severityResult = adjustSeverityForEnvironment(
      baseSeverity,
      context,
      "performance",
    );

    const evidence: Finding["evidence"] = [];
    for (const [type, resources] of byType) {
      evidence.push({
        type: "code-snippet",
        label: `Large ${type} resources (${resources.length})`,
        data: resources
          .slice(0, 3)
          .map((r) => `${r.url} (${((r.size || 0) / 1024).toFixed(0)}KB)`)
          .join("\n"),
      });
    }

    evidence.push({
      type: "metric",
      label: "Total Large Resources Size",
      data: { value: totalSizeKB.toFixed(0), unit: "KB" },
    });

    let description = `Found ${largeResources.length} large resources totaling ${totalSizeKB.toFixed(0)}KB. `;
    description +=
      "Large resources slow down page load, especially on slow connections.";

    if (!environment.productionLikeBuild) {
      description += " Note: Development builds may include unminified code.";
    }

    return {
      id: "network-large-resources",
      title: `${largeResources.length} large resources detected (${totalSizeKB.toFixed(0)}KB)`,
      description,
      severity: severityResult.severity,
      originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
      category: "assets",
      evidence,
      impact: "Slower load time, high data usage",
      recommendation:
        "Compress and optimize resources. Use modern formats like WebP/AVIF for images. " +
        "Code-split JavaScript. Enable gzip/brotli compression.",
      frameworkRecommendation:
        this.getFrameworkAssetRecommendation(environment),
      impactScore: Math.min(totalSizeKB / 50, 50),
      confidence: getConfidenceForEnvironment(context, "performance"),
      environmentLimited: isEnvironmentLimited(context, "performance"),
      environmentNotes: severityResult.downgraded
        ? createEnvironmentNotes(context, "performance", severityResult.note)
        : undefined,
      ownership: this.getAppOwnership(
        "Application code and assets determine resource sizes",
      ),
      analyzer: this.name,
    };
  }

  /**
   * Collect all slow requests for grouped finding
   */
  private collectSlowRequests(
    requests: NetworkRequest[],
    context: AnalyzerContext,
  ): NetworkRequest[] {
    const environment = getEnvironment(context);

    // Use more lenient threshold for local dev
    const threshold = environment.isLocalDev
      ? this.SLOW_REQUEST_LOCAL_MS
      : this.SLOW_REQUEST_MS;

    return requests.filter((request) => {
      if (!request.duration) return false;
      return request.duration > threshold;
    });
  }

  /**
   * Create grouped finding for slow requests
   */
  private createSlowRequestsFinding(
    slowRequests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding {
    const environment = getEnvironment(context);

    const byType = new Map<string, NetworkRequest[]>();
    for (const request of slowRequests) {
      const type = request.resourceType || "other";
      const list = byType.get(type) || [];
      list.push(request);
      byType.set(type, list);
    }

    const baseSeverity: Severity = slowRequests.length > 5 ? "warning" : "info";
    const severityResult = adjustSeverityForEnvironment(
      baseSeverity,
      context,
      "network",
    );

    const evidence: Finding["evidence"] = [];
    for (const [type, resources] of byType) {
      evidence.push({
        type: "code-snippet",
        label: `Slow ${type} requests (${resources.length})`,
        data: resources
          .slice(0, 3)
          .map((r) => `${r.url} (${(r.duration || 0).toFixed(0)}ms)`)
          .join("\n"),
      });
    }

    let description = `${slowRequests.length} requests took longer than ${this.SLOW_REQUEST_MS}ms. `;
    description += "Slow responses impact user experience and Core Web Vitals.";

    const envNotes: string[] = [];
    if (environment.isLocalDev) {
      envNotes.push(
        "Local development servers are typically slower than production. " +
          "Test in a production-like environment for accurate timing.",
      );
    }

    return {
      id: "network-slow-requests",
      title: `${slowRequests.length} slow network requests`,
      description,
      severity: severityResult.severity,
      originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
      category: "network",
      evidence,
      impact: "Delays page load and interactivity",
      recommendation:
        "Optimize server response times. Use CDN for static assets. " +
        "Consider edge computing for dynamic content.",
      impactScore: Math.min(slowRequests.length * 5, 40),
      confidence: getConfidenceForEnvironment(context, "network"),
      environmentLimited: isEnvironmentLimited(context, "network"),
      environmentNotes: envNotes.length > 0 ? envNotes : undefined,
      ownership: this.getInfraOwnership(
        "Server and CDN configuration affect response times",
      ),
      analyzer: this.name,
    };
  }

  /**
   * Collect error responses grouped by type
   */
  private collectErrorResponses(requests: NetworkRequest[]): {
    client: NetworkRequest[];
    server: NetworkRequest[];
  } {
    const client: NetworkRequest[] = [];
    const server: NetworkRequest[] = [];

    for (const request of requests) {
      if (!request.status) continue;

      if (request.status >= 400 && request.status < 500) {
        client.push(request);
      } else if (request.status >= 500) {
        server.push(request);
      }
    }

    return { client, server };
  }

  /**
   * Create findings for error responses
   */
  private createErrorFindings(
    errors: { client: NetworkRequest[]; server: NetworkRequest[] },
    context: AnalyzerContext,
  ): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    // Server errors (5xx) - always important
    if (errors.server.length > 0) {
      // Group by status code
      const byStatus = new Map<number, NetworkRequest[]>();
      for (const req of errors.server) {
        const status = req.status || 500;
        const list = byStatus.get(status) || [];
        list.push(req);
        byStatus.set(status, list);
      }

      const evidence: Finding["evidence"] = [];
      for (const [status, requests] of byStatus) {
        evidence.push({
          type: "code-snippet",
          label: `${status} errors (${requests.length})`,
          data: requests
            .slice(0, 3)
            .map((r) => r.url)
            .join("\n"),
        });
      }

      findings.push({
        id: "network-server-errors",
        title: `${errors.server.length} server errors (5xx)`,
        description: `${errors.server.length} requests returned server errors. Server errors indicate infrastructure or application problems that need immediate attention.`,
        severity: "critical",
        category: "network",
        evidence,
        impact: "Missing resources may break page functionality",
        recommendation:
          "Fix server errors immediately. Check server logs for details.",
        impactScore: 80,
        confidence: "high",
        ownership: this.getInfraOwnership(
          "Server errors typically indicate infrastructure issues",
        ),
        analyzer: this.name,
      });
    }

    // Client errors (4xx)
    if (errors.client.length > 0) {
      // In local dev, 404s for things like favicons are common
      const baseSeverity: Severity =
        errors.client.length > 3 ? "warning" : "info";
      const severityResult =
        environment.isLocalDev && errors.client.length < 5
          ? {
              severity: "info" as Severity,
              downgraded: true,
              note: "Minor 404s are common in local development",
            }
          : adjustSeverityForEnvironment(baseSeverity, context, "network");

      // Group by status code
      const byStatus = new Map<number, NetworkRequest[]>();
      for (const req of errors.client) {
        const status = req.status || 400;
        const list = byStatus.get(status) || [];
        list.push(req);
        byStatus.set(status, list);
      }

      const evidence: Finding["evidence"] = [];
      for (const [status, requests] of byStatus) {
        evidence.push({
          type: "code-snippet",
          label: `${status} errors (${requests.length})`,
          data: requests
            .slice(0, 3)
            .map((r) => r.url)
            .join("\n"),
        });
      }

      findings.push({
        id: "network-client-errors",
        title: `${errors.client.length} client errors (4xx)`,
        description: `${errors.client.length} requests returned client errors (404, 403, etc.). These indicate missing or inaccessible resources.`,
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "network",
        evidence,
        impact: "Missing resources may break page functionality or visuals",
        recommendation: "Fix or remove references to missing resources.",
        impactScore: Math.min(errors.client.length * 10, 40),
        confidence: "high",
        environmentLimited: severityResult.downgraded,
        environmentNotes: severityResult.downgraded
          ? [severityResult.note || ""]
          : undefined,
        ownership: this.getAppOwnership(
          "Client errors often indicate application code issues",
        ),
        analyzer: this.name,
      });
    }

    return findings;
  }

  /**
   * Create a note about framework-managed resources
   */
  private createFrameworkResourceNote(
    frameworkRequests: NetworkRequest[],
    context: AnalyzerContext,
  ): Finding | null {
    const environment = getEnvironment(context);
    const frameworkName = environment.detectedFramework || "the framework";

    const scripts = frameworkRequests.filter(
      (r) => r.resourceType === "script",
    );
    const styles = frameworkRequests.filter(
      (r) => r.resourceType === "stylesheet",
    );

    return {
      id: "network-framework-resources",
      title: `${frameworkRequests.length} requests from ${frameworkName}`,
      description:
        `${frameworkRequests.length} network requests are managed by ${frameworkName}. ` +
        "These are typically optimized by the framework build process.",
      severity: "info",
      category: "network",
      evidence: [
        {
          type: "metric",
          label: "Framework Resources",
          data: {
            total: frameworkRequests.length,
            scripts: scripts.length,
            styles: styles.length,
            framework: frameworkName,
          },
        },
      ],
      impact: "Framework handles optimization automatically",
      recommendation:
        "Framework-managed requests are typically optimized automatically. " +
        "Focus optimization efforts on application-specific resources.",
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
  // Framework-Specific Recommendations
  // ============================================

  private getFrameworkSizeRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) return undefined;

    const recommendations: Record<string, string> = {
      "next.js":
        "Use next/dynamic for code splitting. Enable SWC minification in next.config.js. " +
        "Consider using next/image for automatic image optimization.",
      nuxt:
        "Use Nuxt's built-in lazy loading with defineAsyncComponent. " +
        "Enable build optimization in nuxt.config.js.",
      vite: "Use dynamic imports for code splitting. Configure build.rollupOptions in vite.config.js for manual chunking.",
      gatsby:
        "Use gatsby-plugin-image for optimized images. Enable PurgeCSS for unused CSS removal.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
  }

  private getFrameworkAssetRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) return undefined;

    const recommendations: Record<string, string> = {
      "next.js":
        "Use next/image for automatic image optimization and WebP/AVIF conversion. " +
        "Images in /public are not optimized - use next/image instead.",
      nuxt: "Use @nuxt/image module for automatic image optimization.",
      vite: "Consider vite-plugin-imagemin for image optimization during build.",
      gatsby:
        "Use gatsby-plugin-image with StaticImage or GatsbyImage components.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
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
}
