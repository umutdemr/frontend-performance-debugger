// ===========================================
// Severity
// ===========================================
export type { Severity } from "./severity.js";
export { SEVERITY_WEIGHT, SEVERITY_LABEL } from "./severity.js";

// ===========================================
// Category
// ===========================================
export type { Category } from "./category.js";
export { CATEGORY_LABEL, CATEGORY_DESCRIPTION } from "./category.js";

// ===========================================
// Evidence
// ===========================================
export type {
  Evidence,
  EvidenceType,
  EvidenceGroup,
  EvidenceSummary,
} from "./evidence.js";

// ===========================================
// Metrics
// ===========================================
export type { CoreWebVitals, ExtendedMetrics, Metrics } from "./metrics.js";
export { CWV_THRESHOLDS } from "./metrics.js";

// ===========================================
// Finding
// ===========================================
export type {
  Finding,
  FindingInput,
  FindingId,
  FindingCategory,
  Priority,
  Confidence,
  AggregationMeta,
  ActionType,
} from "./finding.js";

export {
  createFinding,
  isDowngraded,
  hasEnvironmentLimitations as hasEnvironmentLimitationsOnFinding,
} from "./finding.js";

// ===========================================
// Report
// ===========================================
export type {
  Report,
  ReportSummary,
  ReportOptions,
  RootCause,
  CategoryScore,
  ScoreBreakdown,
  FrameworkInfo,
  FindingsSummary,
} from "./report.js";

export {
  isLocalDevReport,
  hasEnvironmentLimitations,
  getEnvironmentWarning,
} from "./report.js";

// ===========================================
// Framework
// ===========================================
export type {
  UILibrary,
  MetaFramework,
  Bundler,
  PackageManager,
  RoutingType,
  StylingType,
  StateManagement,
  ProjectStack,
  FrameworkFeatures,
  FrameworkRecommendation,
} from "./framework.js";

export {
  DEFAULT_FRAMEWORK_FEATURES,
  UNKNOWN_PROJECT_STACK,
  FRAMEWORK_SIGNATURES,
  UI_LIBRARY_SIGNATURES,
  BUNDLER_SIGNATURES,
  STYLING_SIGNATURES,
} from "./framework.js";

// ===========================================
// Correlation
// ===========================================
export type {
  SourceLocation,
  CorrelationConfidence,
  CorrelationMethod,
  SourceCorrelation,
  FindingCorrelations,
  AssetSourceMap,
  RouteSourceMap,
  CorrelationResult,
  CorrelationPattern,
  CorrelationSearchOptions,
} from "./correlation.js";

export {
  DEFAULT_EXCLUDE_DIRS,
  DEFAULT_SOURCE_EXTENSIONS,
  IMAGE_EXTENSIONS,
  DEFAULT_CORRELATION_OPTIONS,
} from "./correlation.js";

// ===========================================
//  Environment Awareness
// ===========================================
export type {
  RuntimeEnvironment,
  HostType,
  ConfidenceLevel,
  FrameworkAssetPatterns,
  EnvironmentContext,
} from "./environment.js";

export {
  DEFAULT_ENVIRONMENT_CONTEXT,
  STANDARD_PORTS,
  COMMON_DEV_PORTS,
  PREVIEW_DOMAIN_PATTERNS,
  STAGING_DOMAIN_PATTERNS,
} from "./environment.js";

export type {
  OwnershipType,
  OwnershipCategory,
  OwnershipHint,
  OwnershipPattern,
} from "./ownership.js";

export {
  UNKNOWN_OWNERSHIP,
  COMMON_OWNERSHIP_PATTERNS,
  categoryToType,
  typeToCategory,
  createOwnership,
} from "./ownership.js";
