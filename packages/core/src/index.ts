// ===========================================
// Engine
// ===========================================
export { Engine, createEngine } from "./engine/engine.js";
export type { EngineConfig, AnalyzeOptions } from "./engine/engine.js";

// ===========================================
// Analyzer Interface
// ===========================================
export type {
  Analyzer,
  AnalyzerContext,
  AnalyzerOptions,
  AnalyzerResult,
  AnalyzerConstructor,
} from "./analyzers/analyzer.interface.js";

// ===========================================
// Analyzers
// ===========================================
export { BasicUrlAnalyzer } from "./analyzers/basic-url.analyzer.js";
export { SecurityAnalyzer } from "./analyzers/security.analyzer.js";
export { SeoAnalyzer } from "./analyzers/seo.analyzer.js";
export { PerformanceAnalyzer } from "./analyzers/performance.analyzer.js";
export { NetworkAnalyzer } from "./analyzers/network.analyzer.js";
export { AssetsAnalyzer } from "./analyzers/assets.analyzer.js";
export { CacheAnalyzer } from "./analyzers/cache.analyzer.js";
export { RenderBlockingAnalyzer } from "./analyzers/render-blocking.analyzer.js";
export { FileSystemAnalyzer } from "./utils/file-system.analyzer.js";

// ===========================================
// Browser
// ===========================================
export {
  PlaywrightClient,
  createPlaywrightClient,
} from "./browser/playwright-client.js";
export type {
  BrowserOptions,
  PageMetrics,
  NetworkRequest,
  ImageInfo,
  IframeInfo,
  HeadScriptInfo,
  HeadStylesheetInfo,
} from "./browser/playwright-client.js";

// ===========================================
// Reporter
// ===========================================
export { createReport } from "./report/reporter.js";
export type { CreateReportInput } from "./report/reporter.js";

// ===========================================
// Post-Processing
// ===========================================
export { dedupeFindings } from "./post-process/dedupe.js";
export { assignPriority, assignConfidence } from "./post-process/enrich.js";
export { extractRootCauses } from "./post-process/root-causes.js";
export { aggregateFindings } from "./post-process/aggregate-findings.js";

// ===========================================
// Scoring
// ===========================================
export { calculateFinalScore } from "./scoring/scoring.engine.js";
export type {
  ScoringRule,
  ScoreCluster,
  ScoreBreakdown,
  HardFailAssessment,
  FinalScoreResult,
  ImpactLevel,
  ConfidenceLevel,
  ScoreCategory,
} from "./scoring/scoring.types.js";

// ===========================================
// Framework Detection
// ===========================================
export {
  FrameworkDetector,
  detectFramework,
  detectFrameworkSync,
} from "./frameworks/framework.detector.js";
export type { FrameworkDetectionResult } from "./frameworks/framework.detector.js";

// ===========================================
// Correlation
// ===========================================
export {
  SourceLocator,
  createSourceLocator,
} from "./correlation/source-locator.js";
export type { SearchMatch } from "./correlation/source-locator.js";

export {
  CorrelationEngine,
  createCorrelationEngine,
  correlateFindings,
} from "./correlation/correlation.engine.js";
export type { CorrelationEngineOptions } from "./correlation/correlation.engine.js";
