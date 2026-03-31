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

export class NetworkAnalyzer implements Analyzer {
  readonly name = "network";
  readonly description = "Analyzes network requests and resource loading";
  readonly categories: Category[] = ["network", "assets", "caching"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Get metrics from context
    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [
          "No network metrics available. Playwright integration may not be active.",
        ],
      };
    }

    // Check total page size
    const sizeFinding = this.checkTotalSize(metrics);
    if (sizeFinding) {
      findings.push(sizeFinding);
    }

    // Check individual requests
    for (const request of metrics.requests) {
      // Check large resources
      const largeResourceFinding = this.checkLargeResource(request);
      if (largeResourceFinding) {
        findings.push(largeResourceFinding);
      }

      // Check slow requests
      const slowRequestFinding = this.checkSlowRequest(request);
      if (slowRequestFinding) {
        findings.push(slowRequestFinding);
      }

      // Check 4xx/5xx errors
      const errorFinding = this.checkErrorResponse(request);
      if (errorFinding) {
        findings.push(errorFinding);
      }
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkTotalSize(metrics: PageMetrics): Finding | null {
    const totalMB = metrics.size.totalBytes / 1024 / 1024;

    if (totalMB > 10) {
      return {
        id: "network-total-size-large",
        title: "Total page size is very large",
        description: `Total page size is ${totalMB.toFixed(1)}MB. This will cause very slow load times on mobile networks.`,
        severity: "critical",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Total Page Size",
            data: { value: totalMB.toFixed(1), unit: "MB", threshold: 10 },
          },
        ],
        impact: "Extremely slow load times on mobile, high data usage",
        recommendation:
          "Optimize images, lazy load non-critical resources, remove unused scripts",
      };
    }

    if (totalMB > 3) {
      return {
        id: "network-total-size-medium",
        title: "Total page size is larger than recommended",
        description: `Total page size is ${totalMB.toFixed(1)}MB. Recommended maximum is 3MB for good mobile performance.`,
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Total Page Size",
            data: { value: totalMB.toFixed(1), unit: "MB", threshold: 3 },
          },
        ],
        impact: "Slower load times on mobile networks",
        recommendation: "Optimize images and reduce unnecessary JavaScript",
      };
    }

    return null;
  }

  private checkLargeResource(request: NetworkRequest): Finding | null {
    if (!request.size) return null;

    const sizeKB = request.size / 1024;

    if (sizeKB > 500) {
      return {
        id: "network-resource-very-large",
        title: "Very large resource",
        description: `${request.resourceType} resource is ${sizeKB.toFixed(0)}KB. This will significantly impact load time.`,
        severity: "warning",
        category: "assets",
        evidence: [
          {
            type: "url",
            label: "Resource URL",
            data: request.url,
          },
          {
            type: "metric",
            label: "Size",
            data: { value: sizeKB.toFixed(0), unit: "KB", threshold: 500 },
          },
        ],
        impact: "Slower load time, high data usage",
        recommendation: "Compress and optimize this resource",
      };
    }

    if (sizeKB > 200 && request.resourceType === "image") {
      return {
        id: "network-image-large",
        title: "Large image resource",
        description: `Image is ${sizeKB.toFixed(0)}KB. Consider using modern formats like WebP or AVIF.`,
        severity: "info",
        category: "assets",
        evidence: [
          {
            type: "url",
            label: "Image URL",
            data: request.url,
          },
          {
            type: "metric",
            label: "Size",
            data: { value: sizeKB.toFixed(0), unit: "KB", threshold: 200 },
          },
        ],
        impact: "Slower image load time",
        recommendation: "Convert image to WebP or AVIF format",
      };
    }

    return null;
  }

  private checkSlowRequest(request: NetworkRequest): Finding | null {
    if (!request.duration) return null;

    if (request.duration > 2000) {
      return {
        id: "network-request-very-slow",
        title: "Very slow network request",
        description: `${request.resourceType} request took ${request.duration.toFixed(0)}ms to complete.`,
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Resource URL",
            data: request.url,
          },
          {
            type: "metric",
            label: "Duration",
            data: {
              value: request.duration.toFixed(0),
              unit: "ms",
              threshold: 2000,
            },
          },
        ],
        impact: "Delays page load and interactivity",
        recommendation:
          "Optimize server response, use CDN, or cache this resource",
      };
    }

    return null;
  }

  private checkErrorResponse(request: NetworkRequest): Finding | null {
    if (!request.status) return null;

    if (request.status >= 400 && request.status < 500) {
      return {
        id: "network-request-4xx",
        title: "Failed network request",
        description: `Request returned ${request.status} client error.`,
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Resource URL",
            data: request.url,
          },
          {
            type: "metric",
            label: "Status Code",
            data: { value: request.status },
          },
        ],
        impact: "Missing resources may break page functionality",
        recommendation: "Fix or remove the broken resource",
      };
    }

    if (request.status >= 500) {
      return {
        id: "network-request-5xx",
        title: "Server error on network request",
        description: `Request returned ${request.status} server error.`,
        severity: "critical",
        category: "network",
        evidence: [
          {
            type: "url",
            label: "Resource URL",
            data: request.url,
          },
          {
            type: "metric",
            label: "Status Code",
            data: { value: request.status },
          },
        ],
        impact: "Missing resources will break page functionality",
        recommendation: "Fix server error for this resource",
      };
    }

    return null;
  }
}
