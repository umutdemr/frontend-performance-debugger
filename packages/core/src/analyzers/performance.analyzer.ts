import type { Finding, Category } from "@fpd/shared-types";
import { CWV_THRESHOLDS } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";
import type { PageMetrics } from "../browser/playwright-client.js";

// Performance Analyzer Analyzes Core Web Vitals and page performance metrics

export class PerformanceAnalyzer implements Analyzer {
  readonly name = "performance";
  readonly description =
    "Analyzes Core Web Vitals and page performance metrics";
  readonly categories: Category[] = ["rendering", "network"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Get metrics from context (Playwright data)
    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [
          "No page metrics available. Playwright integration may not be active.",
        ],
      };
    }

    // Check TTFB
    const ttfbFinding = this.checkTTFB(metrics);
    if (ttfbFinding) {
      findings.push(ttfbFinding);
    }

    // Check LCP
    const lcpFinding = this.checkLCP(metrics);
    if (lcpFinding) {
      findings.push(lcpFinding);
    }

    // Check CLS
    const clsFinding = this.checkCLS(metrics);
    if (clsFinding) {
      findings.push(clsFinding);
    }

    // Check FCP
    const fcpFinding = this.checkFCP(metrics);
    if (fcpFinding) {
      findings.push(fcpFinding);
    }

    // Check DOM Content Loaded
    const dclFinding = this.checkDOMContentLoaded(metrics);
    if (dclFinding) {
      findings.push(dclFinding);
    }

    // Check Load Complete
    const loadFinding = this.checkLoadComplete(metrics);
    if (loadFinding) {
      findings.push(loadFinding);
    }

    // Add success findings for good metrics
    const successFindings = this.checkSuccessMetrics(metrics);
    findings.push(...successFindings);

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkTTFB(metrics: PageMetrics): Finding | null {
    const ttfb = metrics.webVitals.ttfb;
    if (!ttfb) return null;

    const thresholds = CWV_THRESHOLDS.ttfb;

    if (ttfb > thresholds.poor) {
      return {
        id: "perf-ttfb-poor",
        title: "Time to First Byte (TTFB) is poor",
        description: `TTFB is ${Math.round(ttfb)}ms, which exceeds the ${thresholds.poor}ms threshold.`,
        severity: "critical",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "TTFB",
            data: {
              value: Math.round(ttfb),
              unit: "ms",
              threshold: thresholds.poor,
            },
          },
        ],
        impact: "Slow server response delays all subsequent page loading",
        recommendation:
          "Optimize server-side processing, use CDN, enable caching",
        learnMoreUrl: "https://web.dev/ttfb/",
      };
    }

    if (ttfb > thresholds.good) {
      return {
        id: "perf-ttfb-needs-improvement",
        title: "Time to First Byte (TTFB) needs improvement",
        description: `TTFB is ${Math.round(ttfb)}ms. Aim for under ${thresholds.good}ms for optimal performance.`,
        severity: "warning",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "TTFB",
            data: {
              value: Math.round(ttfb),
              unit: "ms",
              threshold: thresholds.good,
            },
          },
        ],
        impact: "Slightly slower initial response time",
        recommendation: "Consider server-side optimizations or CDN usage",
        learnMoreUrl: "https://web.dev/ttfb/",
      };
    }

    return null;
  }

  private checkLCP(metrics: PageMetrics): Finding | null {
    const lcp = metrics.webVitals.lcp;
    if (!lcp) return null;

    const thresholds = CWV_THRESHOLDS.lcp;

    if (lcp > thresholds.poor) {
      return {
        id: "perf-lcp-poor",
        title: "Largest Contentful Paint (LCP) is poor",
        description: `LCP is ${Math.round(lcp)}ms, exceeding the ${thresholds.poor}ms threshold. This is a Core Web Vital.`,
        severity: "critical",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "LCP",
            data: {
              value: Math.round(lcp),
              unit: "ms",
              threshold: thresholds.poor,
            },
          },
        ],
        impact:
          "Poor user experience, SEO penalty, affects Core Web Vitals score",
        recommendation:
          "Optimize largest content element: compress images, preload critical resources, reduce render-blocking",
        learnMoreUrl: "https://web.dev/lcp/",
      };
    }

    if (lcp > thresholds.good) {
      return {
        id: "perf-lcp-needs-improvement",
        title: "Largest Contentful Paint (LCP) needs improvement",
        description: `LCP is ${Math.round(lcp)}ms. Target is under ${thresholds.good}ms for good Core Web Vitals score.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "LCP",
            data: {
              value: Math.round(lcp),
              unit: "ms",
              threshold: thresholds.good,
            },
          },
        ],
        impact: "Suboptimal user experience, may affect SEO",
        recommendation: "Optimize images, reduce JavaScript blocking, use CDN",
        learnMoreUrl: "https://web.dev/lcp/",
      };
    }

    return null;
  }

  private checkCLS(metrics: PageMetrics): Finding | null {
    const cls = metrics.webVitals.cls;
    if (cls === undefined) return null;

    const thresholds = CWV_THRESHOLDS.cls;

    if (cls > thresholds.poor) {
      return {
        id: "perf-cls-poor",
        title: "Cumulative Layout Shift (CLS) is poor",
        description: `CLS is ${cls.toFixed(3)}, exceeding the ${thresholds.poor} threshold. This is a Core Web Vital.`,
        severity: "critical",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "CLS",
            data: { value: cls.toFixed(3), threshold: thresholds.poor },
          },
        ],
        impact: "Frustrating user experience, accidental clicks, SEO penalty",
        recommendation:
          "Add size attributes to images/videos, avoid inserting content above existing content",
        learnMoreUrl: "https://web.dev/cls/",
      };
    }

    if (cls > thresholds.good) {
      return {
        id: "perf-cls-needs-improvement",
        title: "Cumulative Layout Shift (CLS) needs improvement",
        description: `CLS is ${cls.toFixed(3)}. Target is under ${thresholds.good} for good Core Web Vitals score.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "CLS",
            data: { value: cls.toFixed(3), threshold: thresholds.good },
          },
        ],
        impact: "Some layout instability may frustrate users",
        recommendation:
          "Reserve space for dynamic content, use CSS aspect-ratio",
        learnMoreUrl: "https://web.dev/cls/",
      };
    }

    return null;
  }

  private checkFCP(metrics: PageMetrics): Finding | null {
    const fcp = metrics.webVitals.fcp ?? metrics.timing.firstContentfulPaint;
    if (!fcp) return null;

    const thresholds = CWV_THRESHOLDS.fcp;

    if (fcp > thresholds.poor) {
      return {
        id: "perf-fcp-poor",
        title: "First Contentful Paint (FCP) is poor",
        description: `FCP is ${Math.round(fcp)}ms, exceeding the ${thresholds.poor}ms threshold.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "FCP",
            data: {
              value: Math.round(fcp),
              unit: "ms",
              threshold: thresholds.poor,
            },
          },
        ],
        impact: "Users see blank screen for too long",
        recommendation:
          "Eliminate render-blocking resources, optimize critical rendering path",
        learnMoreUrl: "https://web.dev/fcp/",
      };
    }

    if (fcp > thresholds.good) {
      return {
        id: "perf-fcp-needs-improvement",
        title: "First Contentful Paint (FCP) needs improvement",
        description: `FCP is ${Math.round(fcp)}ms. Target is under ${thresholds.good}ms.`,
        severity: "info",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "FCP",
            data: {
              value: Math.round(fcp),
              unit: "ms",
              threshold: thresholds.good,
            },
          },
        ],
        impact: "Slightly delayed first paint",
        recommendation: "Reduce render-blocking CSS, inline critical styles",
        learnMoreUrl: "https://web.dev/fcp/",
      };
    }

    return null;
  }

  private checkDOMContentLoaded(metrics: PageMetrics): Finding | null {
    const dcl = metrics.timing.domContentLoaded;
    if (!dcl) return null;

    if (dcl > 3000) {
      return {
        id: "perf-dcl-slow",
        title: "DOM Content Loaded is slow",
        description: `DOM Content Loaded fired at ${Math.round(dcl)}ms. This indicates slow HTML parsing or render-blocking resources.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "DOM Content Loaded",
            data: { value: Math.round(dcl), unit: "ms" },
          },
        ],
        impact: "Delayed script execution, slower interactivity",
        recommendation:
          "Reduce HTML size, defer non-critical scripts, minimize render-blocking CSS",
      };
    }

    return null;
  }

  private checkLoadComplete(metrics: PageMetrics): Finding | null {
    const load = metrics.timing.loadComplete;
    if (!load) return null;

    if (load > 5000) {
      return {
        id: "perf-load-slow",
        title: "Page Load Complete is slow",
        description: `Page fully loaded at ${Math.round(load)}ms. This is slower than the recommended 3-5 seconds.`,
        severity: "info",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "Load Complete",
            data: { value: Math.round(load), unit: "ms" },
          },
        ],
        impact: "Longer wait time for all resources to finish loading",
        recommendation:
          "Lazy load non-critical resources, optimize asset delivery",
      };
    }

    return null;
  }

  private checkSuccessMetrics(metrics: PageMetrics): Finding[] {
    const findings: Finding[] = [];

    // Good LCP
    const lcp = metrics.webVitals.lcp;
    if (lcp && lcp <= CWV_THRESHOLDS.lcp.good) {
      findings.push({
        id: "perf-lcp-good",
        title: "Largest Contentful Paint (LCP) is good",
        description: `LCP is ${Math.round(lcp)}ms, which is within the good threshold of ${CWV_THRESHOLDS.lcp.good}ms.`,
        severity: "success",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "LCP",
            data: {
              value: Math.round(lcp),
              unit: "ms",
              threshold: CWV_THRESHOLDS.lcp.good,
            },
          },
        ],
        impact: "Good user experience for content visibility",
        recommendation: "Keep optimizing to maintain this performance",
      });
    }

    // Good CLS
    const cls = metrics.webVitals.cls;
    if (cls !== undefined && cls <= CWV_THRESHOLDS.cls.good) {
      findings.push({
        id: "perf-cls-good",
        title: "Cumulative Layout Shift (CLS) is good",
        description: `CLS is ${cls.toFixed(3)}, which is within the good threshold of ${CWV_THRESHOLDS.cls.good}.`,
        severity: "success",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "CLS",
            data: { value: cls.toFixed(3), threshold: CWV_THRESHOLDS.cls.good },
          },
        ],
        impact: "Stable layout provides good user experience",
        recommendation: "Maintain size attributes and avoid layout shifts",
      });
    }

    // Good TTFB
    const ttfb = metrics.webVitals.ttfb;
    if (ttfb && ttfb <= CWV_THRESHOLDS.ttfb.good) {
      findings.push({
        id: "perf-ttfb-good",
        title: "Time to First Byte (TTFB) is good",
        description: `TTFB is ${Math.round(ttfb)}ms, which is within the good threshold of ${CWV_THRESHOLDS.ttfb.good}ms.`,
        severity: "success",
        category: "network",
        evidence: [
          {
            type: "metric",
            label: "TTFB",
            data: {
              value: Math.round(ttfb),
              unit: "ms",
              threshold: CWV_THRESHOLDS.ttfb.good,
            },
          },
        ],
        impact: "Fast server response enables quick page load",
        recommendation: "Continue monitoring server performance",
      });
    }

    return findings;
  }
}
