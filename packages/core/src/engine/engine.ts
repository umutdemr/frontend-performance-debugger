import type { Report, Metrics, Category, Severity } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "../analyzers/analyzer.interface.js";
import { createReport } from "../report/reporter.js";
import type { PageMetrics } from "../browser/playwright-client.js";
import { dedupeFindings } from "../post-process/dedupe.js";
import { aggregateFindings } from "../post-process/aggregate-findings.js";
import { assignPriority, assignConfidence } from "../post-process/enrich.js";

export interface EngineConfig {
  /** Analyzers to run */
  analyzers?: Analyzer[];

  /** Enable verbose logging */
  verbose?: boolean;

  /** Analysis timeout (ms) */
  timeout?: number;
}

export interface AnalyzeOptions {
  /** Filter by categories */
  categories?: Category[];

  /** Minimum severity to include */
  minSeverity?: Severity;

  /** Local scan path (for file system analyzer) */
  scanPath?: string;
}

/**
 * Core analysis engine
 * Orchestrates analyzers and produces reports
 */
export class Engine {
  private analyzers: Analyzer[] = [];
  private config: EngineConfig;

  constructor(config: EngineConfig = {}) {
    this.config = config;
    this.analyzers = config.analyzers ?? [];
  }

  addAnalyzer(analyzer: Analyzer): void {
    this.analyzers.push(analyzer);
  }

  addAnalyzers(analyzers: Analyzer[]): void {
    this.analyzers.push(...analyzers);
  }

  getAnalyzers(): readonly Analyzer[] {
    return this.analyzers;
  }

  /**
   * Run analysis on a URL
   * @param url - URL to analyze
   * @param options - Analysis options
   * @returns Complete analysis report
   */
  async analyze(url: string, options: AnalyzeOptions = {}): Promise<Report> {
    const startTime = Date.now();

    // Skip URL validation for local scans
    if (url !== "local-scan") {
      this.validateUrl(url);
    }

    // Create context for analyzers
    const context: AnalyzerContext = {
      url,
      options: {
        verbose: this.config.verbose,
        timeout: this.config.timeout,
        ...options,
      },
    };

    let pageMetrics: PageMetrics | null = null;

    // Playwright integration (skip for local scans)
    if (url !== "local-scan") {
      try {
        const { createPlaywrightClient } =
          await import("../browser/playwright-client.js");
        const client = createPlaywrightClient();

        if (this.config.verbose) {
          console.log("Launching browser...");
        }

        await client.launch({ headless: true });

        if (this.config.verbose) {
          console.log("Loading page...");
        }

        pageMetrics = await client.collectMetrics(url);
        context.pageData = { metrics: pageMetrics };

        await client.close();

        if (this.config.verbose) {
          console.log(`Page loaded in ${pageMetrics.timing.loadComplete}ms`);
        }
      } catch (error) {
        if (this.config.verbose) {
          console.warn(
            "Playwright failed, continuing without browser metrics:",
            error,
          );
        }
      }
    }

    // Run all analyzers
    const results = await this.runAnalyzers(context, options);

    // Collect all raw findings
    let allFindings = results.flatMap((r) => r.findings);

    allFindings = dedupeFindings(allFindings);
    allFindings = aggregateFindings(allFindings);
    allFindings = allFindings.map(assignPriority).map(assignConfidence);

    // Calculate duration
    const duration = Date.now() - startTime;

    // Convert PageMetrics to Metrics format
    const metrics: Metrics = this.convertToMetrics(pageMetrics);

    // Create and return report
    return createReport({
      url,
      findings: allFindings,
      metrics,
      duration,
      options: {
        minSeverity: options.minSeverity,
        categories: options.categories,
      },
    });
  }

  /**
   * Convert Playwright PageMetrics to shared-types Metrics
   */
  private convertToMetrics(pageMetrics: PageMetrics | null): Metrics {
    if (!pageMetrics) {
      return {
        coreWebVitals: {},
        extended: {},
      };
    }

    return {
      coreWebVitals: {
        lcp: pageMetrics.webVitals.lcp,
        fid: pageMetrics.webVitals.fid,
        cls: pageMetrics.webVitals.cls,
        inp: pageMetrics.webVitals.inp,
        ttfb: pageMetrics.webVitals.ttfb,
        fcp:
          pageMetrics.webVitals.fcp ?? pageMetrics.timing.firstContentfulPaint,
      },
      extended: {
        loadTime: pageMetrics.timing.loadComplete,
        domContentLoaded: pageMetrics.timing.domContentLoaded,
        requestCount: pageMetrics.size.resourceCount,
        transferSize: pageMetrics.size.totalBytes,
      },
      raw: {
        timing: pageMetrics.timing,
        requests: pageMetrics.requests,
        dom: pageMetrics.dom,
      },
    };
  }

  /**
   * Run all applicable analyzers
   */
  private async runAnalyzers(
    context: AnalyzerContext,
    options: AnalyzeOptions,
  ): Promise<AnalyzerResult[]> {
    // Filter analyzers by category if specified
    let analyzersToRun = this.analyzers;

    if (options.categories && options.categories.length > 0) {
      analyzersToRun = this.analyzers.filter((a) =>
        a.categories.some((c) => options.categories!.includes(c)),
      );
    }

    // Run analyzers in parallel
    const results = await Promise.all(
      analyzersToRun.map((analyzer) =>
        this.runSingleAnalyzer(analyzer, context),
      ),
    );

    return results;
  }

  /**
   * Run a single analyzer with error handling
   */
  private async runSingleAnalyzer(
    analyzer: Analyzer,
    context: AnalyzerContext,
  ): Promise<AnalyzerResult> {
    const startTime = Date.now();

    try {
      const result = await analyzer.analyze(context);
      return result;
    } catch (error) {
      // Non-fatal: return empty result with error
      return {
        analyzerName: analyzer.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  }

  private validateUrl(url: string): void {
    try {
      new URL(url);
    } catch {
      throw new Error(`Invalid URL: ${url}`);
    }
  }
}

export function createEngine(config: EngineConfig = {}): Engine {
  return new Engine(config);
}
