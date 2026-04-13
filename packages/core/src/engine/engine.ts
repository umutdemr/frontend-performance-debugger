import type {
  Report,
  Metrics,
  Category,
  Severity,
  Finding,
  EnvironmentContext,
  FindingsSummary,
} from "@fpd/shared-types";
import { DEFAULT_ENVIRONMENT_CONTEXT } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "../analyzers/analyzer.interface.js";
import { createReport } from "../report/reporter.js";
import type { PageMetrics } from "../browser/playwright-client.js";
import { dedupeFindings } from "../post-process/dedupe.js";
import { aggregateFindings } from "../post-process/aggregate-findings.js";
import { enrichFindings } from "../post-process/enrich.js";
import { detectEnvironment } from "./environment-detector.js";
import { calculateFinalScore } from "../scoring/scoring.engine.js";
import { extractRootCauses } from "../post-process/root-causes.js";

export interface EngineConfig {
  analyzers?: Analyzer[];
  verbose?: boolean;
  timeout?: number;
  skipEnvironmentAdjustments?: boolean;
  forceEnvironment?: EnvironmentContext;
}

export interface AnalyzeOptions {
  categories?: Category[];
  minSeverity?: Severity;
  scanPath?: string;
  skipEnvironmentAdjustments?: boolean;
  includeScoreBreakdown?: boolean;
  includeEnvironment?: boolean;
}

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

  async analyze(url: string, options: AnalyzeOptions = {}): Promise<Report> {
    const startTime = Date.now();

    if (url !== "local-scan") {
      this.validateUrl(url);
    }

    let pageMetrics: PageMetrics | null = null;

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

    const environment = this.detectEnvironmentContext(url, pageMetrics);

    if (this.config.verbose && environment.runtimeEnvironment !== "unknown") {
      console.log(
        `Environment detected: ${environment.runtimeEnvironment} (${environment.hostType})`,
      );
      if (environment.detectedFramework) {
        console.log(`Framework detected: ${environment.detectedFramework}`);
      }
    }

    const context: AnalyzerContext = {
      url,
      options: {
        verbose: this.config.verbose,
        timeout: this.config.timeout,
        scanPath: options.scanPath,
        skipEnvironmentAdjustments:
          options.skipEnvironmentAdjustments ??
          this.config.skipEnvironmentAdjustments,
      },
      pageData: pageMetrics ? { metrics: pageMetrics } : undefined,
      environment,
      resources: pageMetrics?.requests?.map((r) => ({
        url: r.url,
        type: r.resourceType as any,
        size: r.size,
        duration: r.duration,
        status: r.status,
        cached: r.cached,
      })),
    };

    const results = await this.runAnalyzers(context, options);

    let allFindings = results.flatMap((r) => r.findings);

    allFindings = this.postProcessFindings(allFindings, environment);

    const duration = Date.now() - startTime;

    const metrics: Metrics = this.convertToMetrics(pageMetrics);

    const analysisMode =
      url === "local-scan" || options.scanPath ? "filesystem" : "runtime";

    const scoreResult = calculateFinalScore(
      allFindings,
      {
        applyEnvironmentAdjustments: !options.skipEnvironmentAdjustments,
        includeExplanation: options.includeScoreBreakdown ?? true,
        analysisMode,
      },
      environment,
    );

    const findingsSummary = this.buildFindingsSummary(allFindings);

    // Build framework info
    const frameworkInfo = environment.detectedFramework
      ? {
          name: environment.detectedFramework,
          version: environment.frameworkVersion,
          confidence: environment.detectionConfidence,
        }
      : undefined;

    const rootCauses = extractRootCauses(
      allFindings,
      environment.detectedFramework,
    );

    const report = createReport({
      url,
      findings: allFindings,
      metrics,
      duration,
      options: {
        minSeverity: options.minSeverity,
        categories: options.categories,
      },
      framework: frameworkInfo,
      environment,
    });

    return this.enhanceReport(report, {
      environment,
      scoreResult,
      findingsSummary,
      rootCauses,
      includeEnvironment: options.includeEnvironment ?? true,
      includeScoreBreakdown: options.includeScoreBreakdown ?? true,
    });
  }

  private detectEnvironmentContext(
    url: string,
    pageMetrics: PageMetrics | null,
  ): EnvironmentContext {
    if (this.config.forceEnvironment) {
      return this.config.forceEnvironment;
    }

    if (url === "local-scan") {
      return {
        ...DEFAULT_ENVIRONMENT_CONTEXT,
        runtimeEnvironment: "local-dev",
        hostType: "localhost",
        isLocalDev: true,
        cacheHeadersReliable: false,
        analysisNotes: ["Local file system scan - no network analysis"],
      };
    }

    const resourceUrls = pageMetrics?.requests?.map((r) => r.url);

    return detectEnvironment({
      url,
      resourceUrls,
    });
  }

  private postProcessFindings(
    findings: Finding[],
    environment: EnvironmentContext,
  ): Finding[] {
    let processed = dedupeFindings(findings);
    processed = aggregateFindings(processed);
    processed = enrichFindings(processed, { environment });
    return processed;
  }

  private buildFindingsSummary(findings: Finding[]): FindingsSummary {
    const bySeverity: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let environmentLimited = 0;
    let downgraded = 0;

    for (const finding of findings) {
      bySeverity[finding.severity] = (bySeverity[finding.severity] || 0) + 1;
      byCategory[finding.category] = (byCategory[finding.category] || 0) + 1;

      if (finding.environmentLimited) environmentLimited++;
      if (finding.originalSeverity) downgraded++;
    }

    return {
      total: findings.length,
      bySeverity,
      byCategory,
      environmentLimited,
      downgraded,
    };
  }

  private enhanceReport(
    report: Report,
    enhancements: {
      environment: EnvironmentContext;
      scoreResult: ReturnType<typeof calculateFinalScore>;
      findingsSummary: FindingsSummary;
      rootCauses: ReturnType<typeof extractRootCauses>;
      includeEnvironment: boolean;
      includeScoreBreakdown: boolean;
    },
  ): Report {
    const {
      environment,
      scoreResult,
      findingsSummary,
      rootCauses,
      includeEnvironment,
      includeScoreBreakdown,
    } = enhancements;

    const enhancedReport: Report = {
      ...report,
      summary: {
        ...report.summary,
        score: scoreResult.finalScore,
        breakdown: {
          performance: `${Math.round(scoreResult.breakdown.performance.current)}/${scoreResult.breakdown.performance.max}`,
          network: `${Math.round(scoreResult.breakdown.network.current)}/${scoreResult.breakdown.network.max}`,
          architecture: `${Math.round(scoreResult.breakdown.architecture.current)}/${scoreResult.breakdown.architecture.max}`,
          seoSecurity: `${Math.round(scoreResult.breakdown.seoSecurity.current)}/${scoreResult.breakdown.seoSecurity.max}`,
        },
        // Use inferred root causes instead of scoring engine strings
        topRootCauses: rootCauses,
        environmentLimited: findingsSummary.environmentLimited,
        downgraded: findingsSummary.downgraded,
      },
      findingsSummary,
    };

    if (includeEnvironment) {
      enhancedReport.environment = environment;
    }

    if (environment.detectedFramework) {
      enhancedReport.framework = {
        name: environment.detectedFramework,
        version: environment.frameworkVersion,
        confidence: environment.detectionConfidence,
      };
    }

    enhancedReport.categoryScores = {
      performance: {
        score: Math.round(scoreResult.breakdown.performance.current),
        maxScore: scoreResult.breakdown.performance.max,
        findings: scoreResult.breakdown.performance.findingCount || 0,
        collapsed: scoreResult.breakdown.performance.collapsed,
        notes: scoreResult.breakdown.performance.notes,
      },
      network: {
        score: Math.round(scoreResult.breakdown.network.current),
        maxScore: scoreResult.breakdown.network.max,
        findings: scoreResult.breakdown.network.findingCount || 0,
        collapsed: scoreResult.breakdown.network.collapsed,
        notes: scoreResult.breakdown.network.notes,
      },
      architecture: {
        score: Math.round(scoreResult.breakdown.architecture.current),
        maxScore: scoreResult.breakdown.architecture.max,
        findings: scoreResult.breakdown.architecture.findingCount || 0,
        collapsed: scoreResult.breakdown.architecture.collapsed,
        notes: scoreResult.breakdown.architecture.notes,
      },
      seoSecurity: {
        score: Math.round(scoreResult.breakdown.seoSecurity.current),
        maxScore: scoreResult.breakdown.seoSecurity.max,
        findings: scoreResult.breakdown.seoSecurity.findingCount || 0,
        collapsed: scoreResult.breakdown.seoSecurity.collapsed,
        notes: scoreResult.breakdown.seoSecurity.notes,
      },
    };

    if (includeScoreBreakdown && scoreResult.explanation) {
      enhancedReport.scoreBreakdown = {
        baseScore: scoreResult.explanation.baseScore,
        findingDeductions: scoreResult.explanation.findingDeductions,
        criticalPenalty: scoreResult.explanation.criticalPenalty.penalty,
        categoryCollapsePenalty:
          scoreResult.explanation.collapsePenalty.penalty,
        environmentAdjustment:
          scoreResult.explanation.environmentAdjustment.penaltyReduction,
        finalScore: scoreResult.explanation.finalScore,
        explanation: scoreResult.explanation.explanationLines,
      };
    }

    (enhancedReport as any).analysisMode =
      environment.isLocalDev && !environment.cacheHeadersReliable
        ? "filesystem"
        : "runtime";

    return enhancedReport;
  }

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

  private async runAnalyzers(
    context: AnalyzerContext,
    options: AnalyzeOptions,
  ): Promise<AnalyzerResult[]> {
    let analyzersToRun = this.analyzers;

    if (options.categories && options.categories.length > 0) {
      analyzersToRun = this.analyzers.filter((a) =>
        a.categories.some((c) => options.categories!.includes(c)),
      );
    }

    analyzersToRun = analyzersToRun.filter((analyzer) => {
      if (analyzer.shouldRun) {
        return analyzer.shouldRun(context);
      }
      return true;
    });

    const results = await Promise.all(
      analyzersToRun.map((analyzer) =>
        this.runSingleAnalyzer(analyzer, context),
      ),
    );

    return results;
  }

  private async runSingleAnalyzer(
    analyzer: Analyzer,
    context: AnalyzerContext,
  ): Promise<AnalyzerResult> {
    const startTime = Date.now();

    try {
      if (this.config.verbose) {
        console.log(`Running analyzer: ${analyzer.name}`);
      }

      const result = await analyzer.analyze(context);

      if (this.config.verbose) {
        console.log(
          `  ${analyzer.name}: ${result.findings.length} findings in ${result.duration}ms`,
        );
      }

      return result;
    } catch (error) {
      if (this.config.verbose) {
        console.warn(`  ${analyzer.name}: Failed -`, error);
      }

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
