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
  PageMetrics,
  HeadScriptInfo,
  HeadStylesheetInfo,
} from "../browser/playwright-client.js";
import { isFrameworkOwnedUrl } from "../engine/environment-detector.js";

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

    const stylesheetFindings = this.checkBlockingStylesheets(
      metrics.dom.headStylesheets,
      context,
    );
    findings.push(...stylesheetFindings);

    const scriptFindings = this.checkBlockingScripts(
      metrics.dom.headScripts,
      context,
    );
    findings.push(...scriptFindings);

    const criticalCSSFinding = this.checkCriticalCSS(
      metrics.dom.headStylesheets,
      context,
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
    context: AnalyzerContext,
  ): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const externalStylesheets = stylesheets.filter((s) => !s.inline && s.href);

    const { appOwned, frameworkOwned } = this.categorizeStylesheets(
      externalStylesheets,
      context,
    );

    const blockingAppStylesheets = appOwned.filter(
      (s) => !s.media || s.media === "all" || s.media === "",
    );
    const blockingFrameworkStylesheets = frameworkOwned.filter(
      (s) => !s.media || s.media === "all" || s.media === "",
    );

    const totalBlockingCount =
      blockingAppStylesheets.length + blockingFrameworkStylesheets.length;

    if (totalBlockingCount > 3) {
      const baseSeverity: Severity = "critical";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "rendering",
      );

      const examples = [
        ...blockingAppStylesheets.slice(0, 3).map((s) => s.href),
        ...blockingFrameworkStylesheets
          .slice(0, 2)
          .map((s) => `${s.href} [framework]`),
      ];

      findings.push({
        id: "render-blocking-many-stylesheets",
        title: `${totalBlockingCount} render-blocking stylesheets in <head>`,
        description: this.buildStylesheetDescription(
          blockingAppStylesheets.length,
          blockingFrameworkStylesheets.length,
          environment,
        ),
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Blocking stylesheets",
            data: examples.join("\n"),
          },
          {
            type: "metric",
            label: "Breakdown",
            data: {
              appOwned: blockingAppStylesheets.length,
              frameworkOwned: blockingFrameworkStylesheets.length,
              total: totalBlockingCount,
            },
          },
        ],
        impact:
          "Significantly delays First Contentful Paint (FCP) and Largest Contentful Paint (LCP)",
        recommendation: this.getStylesheetRecommendation(
          blockingAppStylesheets.length,
        ),
        frameworkRecommendation:
          this.getFrameworkCSSRecommendation(environment),
        impactScore: Math.min(totalBlockingCount * 10, 50),
        confidence: getConfidenceForEnvironment(context, "rendering"),
        environmentLimited: isEnvironmentLimited(context, "rendering"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "rendering", severityResult.note)
          : undefined,
        learnMoreUrl: "https://web.dev/defer-non-critical-css/",
        ownership: this.determineStylesheetOwnership(
          blockingAppStylesheets.length,
          blockingFrameworkStylesheets.length,
          environment,
        ),
        analyzer: this.name,
      });
    } else if (totalBlockingCount > 1) {
      // Some blocking stylesheets
      const baseSeverity: Severity = "warning";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "rendering",
      );

      findings.push({
        id: "render-blocking-stylesheets",
        title: `${totalBlockingCount} render-blocking stylesheets`,
        description: `Found ${totalBlockingCount} external CSS files that block rendering.`,
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Stylesheets",
            data: [...blockingAppStylesheets, ...blockingFrameworkStylesheets]
              .map((s) => s.href)
              .join("\n"),
          },
        ],
        impact: "Delays initial paint",
        recommendation:
          "Consider inlining critical CSS and deferring non-critical CSS",
        frameworkRecommendation:
          this.getFrameworkCSSRecommendation(environment),
        confidence: getConfidenceForEnvironment(context, "rendering"),
        environmentLimited: isEnvironmentLimited(context, "rendering"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "rendering", severityResult.note)
          : undefined,
        learnMoreUrl: "https://web.dev/defer-non-critical-css/",
        ownership: this.determineStylesheetOwnership(
          blockingAppStylesheets.length,
          blockingFrameworkStylesheets.length,
          environment,
        ),
        analyzer: this.name,
      });
    }

    return findings;
  }

  /**
   * Categorize stylesheets by ownership
   */
  private categorizeStylesheets(
    stylesheets: HeadStylesheetInfo[],
    context: AnalyzerContext,
  ): { appOwned: HeadStylesheetInfo[]; frameworkOwned: HeadStylesheetInfo[] } {
    const environment = getEnvironment(context);
    const appOwned: HeadStylesheetInfo[] = [];
    const frameworkOwned: HeadStylesheetInfo[] = [];

    for (const stylesheet of stylesheets) {
      if (
        stylesheet.href &&
        isFrameworkOwnedUrl(stylesheet.href, environment.frameworkPatterns)
      ) {
        frameworkOwned.push(stylesheet);
      } else {
        appOwned.push(stylesheet);
      }
    }

    return { appOwned, frameworkOwned };
  }

  /**
   * Build description based on ownership breakdown
   */
  private buildStylesheetDescription(
    appCount: number,
    frameworkCount: number,
    environment: ReturnType<typeof getEnvironment>,
  ): string {
    const total = appCount + frameworkCount;
    let description = `Found ${total} external CSS files in <head> that block rendering. Each stylesheet must be downloaded and parsed before the page can render.`;

    if (appCount > 0 && frameworkCount > 0) {
      description += ` ${appCount} are application stylesheets that you can optimize, and ${frameworkCount} are managed by ${environment.detectedFramework || "the framework"}.`;
    } else if (frameworkCount > 0) {
      description += ` All are managed by ${environment.detectedFramework || "the framework"}. Check framework configuration for optimization options.`;
    }

    if (!environment.productionLikeBuild) {
      description +=
        " Note: Development builds may include additional stylesheets for debugging.";
    }

    return description;
  }

  private getStylesheetRecommendation(appCount: number): string {
    if (appCount > 0) {
      return "1. Inline critical CSS in <head>\n2. Defer non-critical CSS with media='print' and JavaScript swap\n3. Combine CSS files to reduce requests";
    }
    return "Framework-managed stylesheets are typically optimized automatically. Check framework documentation for advanced CSS optimization options.";
  }

  /**
   * Determine ownership for the finding
   */
  private determineStylesheetOwnership(
    appCount: number,
    frameworkCount: number,
    environment: ReturnType<typeof getEnvironment>,
  ): OwnershipHint {
    if (appCount > frameworkCount) {
      return {
        type: "app-owned",
        confidence: "high",
        reason: "Application stylesheets determine CSS loading strategy",
      };
    }
    if (frameworkCount > 0) {
      return {
        type: "framework-owned",
        confidence: "high",
        reason: `Stylesheets managed by ${environment.detectedFramework || "framework"}`,
      };
    }
    return {
      type: "config-owned",
      confidence: "medium",
      reason: "Build configuration determines stylesheet loading",
    };
  }

  private checkBlockingScripts(
    scripts: HeadScriptInfo[],
    context: AnalyzerContext,
  ): Finding[] {
    const findings: Finding[] = [];
    const environment = getEnvironment(context);

    const externalScripts = scripts.filter((s) => !s.inline && s.src);

    // Categorize by ownership
    const { appOwned, frameworkOwned } = this.categorizeScripts(
      externalScripts,
      context,
    );

    // Blocking scripts (no async/defer)
    const blockingAppScripts = appOwned.filter((s) => !s.async && !s.defer);
    const blockingFrameworkScripts = frameworkOwned.filter(
      (s) => !s.async && !s.defer,
    );

    const totalBlockingCount =
      blockingAppScripts.length + blockingFrameworkScripts.length;

    if (totalBlockingCount > 0) {
      const baseSeverity: Severity =
        blockingAppScripts.length > 3
          ? "critical"
          : totalBlockingCount > 3
            ? "warning"
            : "info";

      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "rendering",
      );

      const evidence: Finding["evidence"] = [];

      if (blockingAppScripts.length > 0) {
        evidence.push({
          type: "code-snippet",
          label: `Application scripts (${blockingAppScripts.length}) - actionable`,
          data: blockingAppScripts
            .slice(0, 5)
            .map((s) => s.src)
            .join("\n"),
        });
      }

      if (blockingFrameworkScripts.length > 0) {
        evidence.push({
          type: "code-snippet",
          label: `Framework scripts (${blockingFrameworkScripts.length}) - ${environment.detectedFramework || "framework"}-managed`,
          data:
            blockingFrameworkScripts
              .slice(0, 3)
              .map((s) => s.src)
              .join("\n") + "\n(These may require configuration changes)",
        });
      }

      evidence.push({
        type: "metric",
        label: "Breakdown",
        data: {
          appOwned: blockingAppScripts.length,
          frameworkOwned: blockingFrameworkScripts.length,
          total: totalBlockingCount,
        },
      });

      findings.push({
        id: "render-blocking-scripts",
        title: `${totalBlockingCount} blocking JavaScript files in <head>`,
        description: this.buildScriptDescription(
          blockingAppScripts.length,
          blockingFrameworkScripts.length,
          environment,
        ),
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "javascript",
        evidence,
        impact: "Blocks DOM construction, delays FCP and interactivity",
        recommendation: this.getScriptRecommendation(blockingAppScripts.length),
        frameworkRecommendation:
          this.getFrameworkScriptRecommendation(environment),
        impactScore: Math.min(
          blockingAppScripts.length * 10 + blockingFrameworkScripts.length * 3,
          50,
        ),
        confidence: getConfidenceForEnvironment(context, "rendering"),
        environmentLimited: isEnvironmentLimited(context, "rendering"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "rendering", severityResult.note)
          : undefined,
        learnMoreUrl:
          "https://web.dev/efficiently-load-third-party-javascript/",
        ownership: this.determineScriptOwnership(
          blockingAppScripts.length,
          blockingFrameworkScripts.length,
          environment,
        ),
        analyzer: this.name,
      });
    }

    const deferredScripts = externalScripts.filter((s) => s.defer || s.async);
    if (externalScripts.length > 0 && totalBlockingCount === 0) {
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
        confidence: "high",
        analyzer: this.name,
      });
    }

    return findings;
  }

  /**
   * Categorize scripts by ownership
   */
  private categorizeScripts(
    scripts: HeadScriptInfo[],
    context: AnalyzerContext,
  ): { appOwned: HeadScriptInfo[]; frameworkOwned: HeadScriptInfo[] } {
    const environment = getEnvironment(context);
    const appOwned: HeadScriptInfo[] = [];
    const frameworkOwned: HeadScriptInfo[] = [];

    for (const script of scripts) {
      if (
        script.src &&
        isFrameworkOwnedUrl(script.src, environment.frameworkPatterns)
      ) {
        frameworkOwned.push(script);
      } else {
        appOwned.push(script);
      }
    }

    return { appOwned, frameworkOwned };
  }

  /**
   * Build script description based on ownership
   */
  private buildScriptDescription(
    appCount: number,
    frameworkCount: number,
    environment: ReturnType<typeof getEnvironment>,
  ): string {
    const total = appCount + frameworkCount;
    let description = `Found ${total} JavaScript files in <head> without 'async' or 'defer' attributes. These scripts block HTML parsing.`;

    if (appCount > 0 && frameworkCount > 0) {
      description += ` ${appCount} are application scripts that you can optimize, and ${frameworkCount} are managed by ${environment.detectedFramework || "the framework"}.`;
    } else if (frameworkCount > 0 && appCount === 0) {
      description += ` All are managed by ${environment.detectedFramework || "the framework"}. Check framework configuration for optimization options.`;
    }

    if (!environment.productionLikeBuild) {
      description +=
        " Note: Development builds may include additional blocking scripts for HMR and debugging.";
    }

    return description;
  }

  /**
   * Get script recommendation based on ownership
   */
  private getScriptRecommendation(appCount: number): string {
    if (appCount > 0) {
      return "Add 'defer' attribute to scripts that don't need to run immediately, or 'async' for independent scripts";
    }
    return "Framework-managed scripts may require configuration changes. Check framework documentation for script optimization options.";
  }

  /**
   * Determine ownership for script finding
   */
  private determineScriptOwnership(
    appCount: number,
    frameworkCount: number,
    environment: ReturnType<typeof getEnvironment>,
  ): OwnershipHint {
    if (appCount > frameworkCount) {
      return {
        type: "app-owned",
        confidence: "high",
        reason: "Application code determines script loading strategy",
      };
    }
    if (frameworkCount > 0) {
      return {
        type: "framework-owned",
        confidence: "high",
        reason: `Scripts managed by ${environment.detectedFramework || "framework"}`,
      };
    }
    return {
      type: "config-owned",
      confidence: "medium",
      reason: "Build configuration determines script loading",
    };
  }

  private checkCriticalCSS(
    stylesheets: HeadStylesheetInfo[],
    context: AnalyzerContext,
  ): Finding | null {
    const environment = getEnvironment(context);
    const inlineStyles = stylesheets.filter((s) => s.inline);

    if (inlineStyles.length === 0) {
      const baseSeverity: Severity = "warning";
      const severityResult = adjustSeverityForEnvironment(
        baseSeverity,
        context,
        "rendering",
      );

      return {
        id: "render-blocking-no-critical-css",
        title: "No critical CSS inlined",
        description:
          "No inline <style> tags found in <head>. Inlining critical CSS (styles needed for above-the-fold content) can significantly improve FCP.",
        severity: severityResult.severity,
        originalSeverity: severityResult.downgraded ? baseSeverity : undefined,
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "Inline styles count",
            data: { value: 0 },
          },
        ],
        impact: "Slower First Contentful Paint due to external CSS blocking",
        recommendation:
          "Extract and inline critical CSS (typically 10-14KB) for above-the-fold content in <head>",
        frameworkRecommendation:
          this.getFrameworkCriticalCSSRecommendation(environment),
        confidence: getConfidenceForEnvironment(context, "rendering"),
        environmentLimited: isEnvironmentLimited(context, "rendering"),
        environmentNotes: severityResult.downgraded
          ? createEnvironmentNotes(context, "rendering", severityResult.note)
          : undefined,
        learnMoreUrl: "https://web.dev/extract-critical-css/",
        ownership: {
          type: "config-owned",
          confidence: "medium",
          reason:
            "Build configuration and framework determine critical CSS extraction",
        },
        analyzer: this.name,
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
            data: {
              value: (totalInlineSize / 1024).toFixed(1),
              unit: "KB",
              threshold: 50,
            },
          },
        ],
        impact: "Bloated HTML size, slower initial HTML download",
        recommendation:
          "Move non-critical CSS to external files and defer them",
        frameworkRecommendation:
          this.getFrameworkCriticalCSSRecommendation(environment),
        impactScore: Math.min((totalInlineSize / 1024 - 50) * 0.5, 30),
        confidence: "high",
        learnMoreUrl: "https://web.dev/extract-critical-css/",
        ownership: {
          type: "config-owned",
          confidence: "medium",
          reason: "Build configuration determines CSS inlining",
        },
        analyzer: this.name,
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
        confidence: "high",
        analyzer: this.name,
      };
    }

    return null;
  }

  // ============================================
  // Framework-Specific Recommendations
  // ============================================

  private getFrameworkCSSRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) return undefined;

    const recommendations: Record<string, string> = {
      "next.js":
        "Next.js automatically handles CSS optimization. For third-party CSS, consider using next/dynamic " +
        "or loading CSS asynchronously with a custom Document.",
      nuxt: "Nuxt handles CSS optimization automatically. Use extractCSS option in nuxt.config.js for production builds.",
      vite: "Vite handles CSS optimization during build. Consider using vite-plugin-critical for critical CSS extraction.",
      gatsby:
        "Use gatsby-plugin-critical for automatic critical CSS extraction.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
  }

  private getFrameworkScriptRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) return undefined;

    const recommendations: Record<string, string> = {
      "next.js":
        "Use next/script with strategy='lazyOnload' for third-party scripts. " +
        "Critical scripts can use strategy='beforeInteractive'. Framework scripts are optimized automatically.",
      nuxt:
        "Use Nuxt's useHead() composable with defer:true for non-critical scripts, " +
        "or the @nuxt/scripts module for third-party script management.",
      vite:
        "Vite automatically adds type='module' to scripts which has defer-like behavior. " +
        "For third-party scripts, use dynamic imports or manual defer attributes.",
      gatsby:
        "Use gatsby-plugin-google-gtag or similar plugins for third-party scripts. " +
        "They handle loading optimization automatically.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
  }

  private getFrameworkCriticalCSSRecommendation(
    environment: ReturnType<typeof getEnvironment>,
  ): string | undefined {
    if (!environment.detectedFramework) return undefined;

    const recommendations: Record<string, string> = {
      "next.js":
        "Next.js handles critical CSS automatically with styled-jsx and CSS Modules. " +
        "For other CSS solutions, consider using critters-webpack-plugin or @fullhuman/postcss-purgecss.",
      nuxt: "Enable critical CSS extraction with the @nuxt/critters module for automatic critical CSS inlining.",
      vite: "Use vite-plugin-critical or critters for automatic critical CSS extraction in production builds.",
      gatsby:
        "Use gatsby-plugin-critical for automatic critical CSS extraction and inlining.",
    };

    return recommendations[environment.detectedFramework.toLowerCase()];
  }
}
