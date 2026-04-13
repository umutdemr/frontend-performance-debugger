import type { Finding } from "./finding.js";
import type { Metrics } from "./metrics.js";
import type { Severity } from "./severity.js";
import type { Category } from "./category.js";
import type { CorrelationResult } from "./correlation.js";
import type { EnvironmentContext } from "./environment.js";
import type { ConfidenceLevel } from "./environment.js";

/**
 * A structured root cause identified by the scoring engine
 */
export interface RootCause {
  /** Which high-level group this cause belongs to */
  group:
    | "performance"
    | "network"
    | "rendering"
    | "architecture"
    | "security"
    | "general";

  /** Human-readable description of the root cause */
  description: string;

  /** How much this issue impacted the final score */
  impactScore: number;
  relatedFindings?: string[];
  /** Confidence level */
  confidence?: "high" | "medium" | "low";
  /** Fix suggestion */
  fixSuggestion?: string;
  /** Framework-specific hint */
  frameworkHint?: string;
}

/**
 * Summary statistics for a report
 */
export interface ReportSummary {
  /** Total number of findings */
  totalFindings: number;

  /** Breakdown by severity */
  bySeverity: Record<Severity, number>;

  /** Breakdown by category */
  byCategory: Record<Category, number>;

  /** Overall score (0-100, optional) */
  score?: number;

  /** One-line summary */
  headline: string;

  /** Scoring engine category breakdown (e.g., "11/40") */
  breakdown?: {
    performance: string;
    network: string;
    architecture: string;
    seoSecurity: string;
  };

  /** Scoring engine top root causes list (structured) */
  topRootCauses?: RootCause[];

  // ============================================
  // Environment-Aware Summary Fields
  // ============================================

  /** Findings with reduced confidence due to environment */
  environmentLimited?: number;

  /** Findings that were downgraded due to environment */
  downgraded?: number;
}

/**
 * Score result for a single category
 */
export interface CategoryScore {
  /** Current score for this category */
  score: number;

  /** Maximum possible score for this category */
  maxScore: number;

  /** Number of findings in this category */
  findings: number;

  /** Whether this category had catastrophic failures */
  collapsed?: boolean;

  /** Notes about category scoring */
  notes?: string[];
}

/**
 * Detailed score breakdown for transparency
 */
export interface ScoreBreakdown {
  /** Base score before adjustments (typically 100) */
  baseScore: number;

  /** Total deductions from findings */
  findingDeductions: number;

  /** Additional penalty for critical issues */
  criticalPenalty: number;

  /** Additional penalty when categories collapse */
  categoryCollapsePenalty: number;

  /** Adjustment due to environment limitations (positive = less penalty) */
  environmentAdjustment: number;

  /** Final calculated score */
  finalScore: number;

  /** Human-readable explanation of major score factors */
  explanation: string[];
}

/**
 * Framework detection information
 */
export interface FrameworkInfo {
  /** Framework name (e.g., "next.js", "nuxt", "vite") */
  name: string;

  /** Framework version if detected */
  version?: string;

  /** Confidence in detection */
  confidence: ConfidenceLevel;
}

/**
 * The complete analysis report
 */
export interface Report {
  /** Report format version for future compatibility */
  version: "1.0";

  /** Analyzed URL */
  url: string;

  /** When the analysis was performed */
  timestamp: string;

  /** How long the analysis took (ms) */
  duration: number;

  /** Collected performance metrics */
  metrics: Metrics;

  /** All findings from analyzers */
  findings: Finding[];

  /** Aggregated summary */
  summary: ReportSummary;

  /** Tool metadata */
  tool: {
    name: "fpd";
    version: string;
  };

  /** Correlation result from source analysis */
  correlationResult?: CorrelationResult;

  /** Optional: raw data for debugging */
  debug?: Record<string, unknown>;

  // ============================================
  // Environment Awareness Fields
  // ============================================

  /**
   * Environment context detected for this analysis
   * Contains runtime environment, host type, reliability indicators
   */
  environment?: EnvironmentContext;

  /**
   * Category-level scores with detailed breakdown
   */
  categoryScores?: Record<string, CategoryScore>;

  /**
   * Detailed score calculation breakdown
   * Shows how the final score was computed
   */
  scoreBreakdown?: ScoreBreakdown;

  /**
   * Detected framework information
   */
  framework?: FrameworkInfo;

  /**
   * Findings summary with environment-aware counts
   * Alternative/extended view of summary data
   */
  findingsSummary?: FindingsSummary;
}

export interface FindingsSummary {
  /** Total number of findings */
  total: number;

  /** Breakdown by severity */
  bySeverity: Record<string, number>;

  /** Breakdown by category */
  byCategory: Record<string, number>;

  /** Findings with reduced confidence due to environment */
  environmentLimited: number;

  /** Findings that were downgraded */
  downgraded: number;
}

/**
 * Report generation options
 */
export interface ReportOptions {
  /** Include debug data in report */
  includeDebug?: boolean;

  /** Filter findings by minimum severity */
  minSeverity?: Severity;

  /** Filter findings by categories */
  categories?: Category[];

  // ============================================
  // Environment-Aware Options
  // ============================================

  /** Include detailed score breakdown */
  includeScoreBreakdown?: boolean;

  /** Include environment context in report */
  includeEnvironment?: boolean;

  /** Include category-level scores */
  includeCategoryScores?: boolean;
}

/**
 * Helper to check if report was analyzed in local development
 */
export function isLocalDevReport(report: Report): boolean {
  return report.environment?.isLocalDev === true;
}

/**
 * Helper to check if report has environment limitations
 */
export function hasEnvironmentLimitations(report: Report): boolean {
  if (!report.environment) return false;
  return (
    report.environment.isLocalDev ||
    !report.environment.cacheHeadersReliable ||
    report.environment.runtimeEnvironment === "preview"
  );
}

/**
 * Helper to get environment warning message if applicable
 */
export function getEnvironmentWarning(report: Report): string | null {
  if (!report.environment) return null;

  if (report.environment.isLocalDev) {
    return "This analysis was performed against a local development environment. Some findings may not reflect production behavior.";
  }

  if (report.environment.runtimeEnvironment === "preview") {
    return "This analysis was performed against a preview environment. Some optimizations may differ from production.";
  }

  if (!report.environment.cacheHeadersReliable) {
    return "Cache-related findings may not reflect production configuration in this environment.";
  }

  return null;
}
