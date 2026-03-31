import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";
import type {
  PageMetrics,
  HeadScriptInfo,
  HeadStylesheetInfo,
} from "../browser/playwright-client.js";

//Render-Blocking Resources Analyzer Analyzes render-blocking CSS and JavaScript that delay FCP and LCP

export class RenderBlockingAnalyzer implements Analyzer {
  readonly name = "render-blocking";
  readonly description =
    "Analyzes render-blocking CSS and JavaScript resources";
  readonly categories: Category[] = ["rendering", "javascript"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics || !metrics.dom) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [
          "No DOM metrics available. Playwright integration may not be active.",
        ],
      };
    }

    // Check blocking stylesheets
    const stylesheetFindings = this.checkBlockingStylesheets(
      metrics.dom.headStylesheets,
    );
    findings.push(...stylesheetFindings);

    // Check blocking scripts
    const scriptFindings = this.checkBlockingScripts(metrics.dom.headScripts);
    findings.push(...scriptFindings);

    // Check for critical CSS
    const criticalCSSFinding = this.checkCriticalCSS(
      metrics.dom.headStylesheets,
    );
    if (criticalCSSFinding) {
      findings.push(criticalCSSFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkBlockingStylesheets(
    stylesheets: HeadStylesheetInfo[],
  ): Finding[] {
    const findings: Finding[] = [];

    // External stylesheets with href
    const externalStylesheets = stylesheets.filter((s) => !s.inline && s.href);

    // Blocking = not print, not preload (media="all" or undefined is blocking)
    const blockingStylesheets = externalStylesheets.filter(
      (s) => !s.media || s.media === "all" || s.media === "",
    );

    if (blockingStylesheets.length > 3) {
      const examples = blockingStylesheets.slice(0, 5).map((s) => s.href);

      findings.push({
        id: "render-blocking-many-stylesheets",
        title: `${blockingStylesheets.length} render-blocking stylesheets in <head>`,
        description: `Found ${blockingStylesheets.length} external CSS files in <head> that block rendering. Each stylesheet must be downloaded and parsed before the page can render.`,
        severity: "critical",
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Blocking stylesheets",
            data: examples.join("\n"),
          },
        ],
        impact:
          "Significantly delays First Contentful Paint (FCP) and Largest Contentful Paint (LCP)",
        recommendation:
          "1. Inline critical CSS in <head>\n2. Defer non-critical CSS with media='print' and JavaScript swap\n3. Combine CSS files to reduce requests",
        learnMoreUrl: "https://web.dev/defer-non-critical-css/",
      });
    } else if (blockingStylesheets.length > 1) {
      findings.push({
        id: "render-blocking-stylesheets",
        title: `${blockingStylesheets.length} render-blocking stylesheets`,
        description: `Found ${blockingStylesheets.length} external CSS files that block rendering.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Stylesheets",
            data: blockingStylesheets.map((s) => s.href).join("\n"),
          },
        ],
        impact: "Delays initial paint",
        recommendation:
          "Consider inlining critical CSS and deferring non-critical CSS",
        learnMoreUrl: "https://web.dev/defer-non-critical-css/",
      });
    }

    return findings;
  }

  private checkBlockingScripts(scripts: HeadScriptInfo[]): Finding[] {
    const findings: Finding[] = [];

    const externalScripts = scripts.filter((s) => !s.inline && s.src);
    const blockingScripts = externalScripts.filter((s) => !s.async && !s.defer);

    if (blockingScripts.length > 0) {
      const examples = blockingScripts.slice(0, 5).map((s) => s.src);
      const remaining = blockingScripts.length - 5;

      findings.push({
        id: "render-blocking-scripts",
        title: `${blockingScripts.length} blocking JavaScript files in <head>`,
        description: `Found ${blockingScripts.length} JavaScript files in <head> without 'async' or 'defer' attributes. These scripts block HTML parsing.`,
        severity: blockingScripts.length > 3 ? "critical" : "warning",
        category: "javascript",
        evidence: [
          {
            type: "code-snippet",
            label: "Blocking scripts",
            data:
              examples.join("\n") +
              (remaining > 0 ? `\n... and ${remaining} more` : ""),
          },
        ],
        impact: "Blocks DOM construction, delays FCP and interactivity",
        recommendation:
          "Add 'defer' attribute to scripts that don't need to run immediately, or 'async' for independent scripts",
        learnMoreUrl:
          "https://web.dev/efficiently-load-third-party-javascript/",
      });
    }

    // Success: all scripts are deferred/async
    const deferredScripts = externalScripts.filter((s) => s.defer || s.async);
    if (externalScripts.length > 0 && blockingScripts.length === 0) {
      findings.push({
        id: "render-blocking-scripts-optimized",
        title: "All JavaScript is non-blocking",
        description: `${deferredScripts.length} external scripts use 'async' or 'defer' attributes.`,
        severity: "success",
        category: "javascript",
        evidence: [
          {
            type: "metric",
            label: "Non-blocking scripts",
            data: { value: deferredScripts.length },
          },
        ],
        impact: "Faster DOM parsing and FCP",
        recommendation:
          "Continue using async/defer for all non-critical scripts",
      });
    }

    return findings;
  }

  private checkCriticalCSS(stylesheets: HeadStylesheetInfo[]): Finding | null {
    const inlineStyles = stylesheets.filter((s) => s.inline);

    if (inlineStyles.length === 0) {
      return {
        id: "render-blocking-no-critical-css",
        title: "No critical CSS inlined",
        description:
          "No inline <style> tags found in <head>. Inlining critical CSS (styles needed for above-the-fold content) can significantly improve FCP.",
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "custom",
            label: "Inline styles count",
            data: 0,
          },
        ],
        impact: "Slower First Contentful Paint due to external CSS blocking",
        recommendation:
          "Extract and inline critical CSS (typically 10-14KB) for above-the-fold content in <head>",
        learnMoreUrl: "https://web.dev/extract-critical-css/",
      };
    }

    const totalInlineSize = inlineStyles.reduce(
      (sum, s) => sum + (s.size || 0),
      0,
    );

    if (totalInlineSize > 50000) {
      return {
        id: "render-blocking-too-much-inline-css",
        title: "Excessive inline CSS",
        description: `${(totalInlineSize / 1024).toFixed(1)}KB of inline CSS found. Inline CSS should be limited to critical styles only (typically 10-14KB).`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "Inline CSS size",
            data: { value: (totalInlineSize / 1024).toFixed(1), unit: "KB" },
          },
        ],
        impact: "Bloated HTML size, slower initial HTML download",
        recommendation:
          "Move non-critical CSS to external files and defer them",
        learnMoreUrl: "https://web.dev/extract-critical-css/",
      };
    }

    // Success: reasonable amount of critical CSS
    if (totalInlineSize > 0 && totalInlineSize <= 50000) {
      return {
        id: "render-blocking-critical-css-good",
        title: "Critical CSS is inlined",
        description: `${(totalInlineSize / 1024).toFixed(1)}KB of critical CSS is inlined in <head>, which is within recommended limits.`,
        severity: "success",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "Inline CSS size",
            data: { value: (totalInlineSize / 1024).toFixed(1), unit: "KB" },
          },
        ],
        impact: "Faster First Contentful Paint",
        recommendation:
          "Continue inlining critical CSS, defer non-critical styles",
      };
    }

    return null;
  }
}
