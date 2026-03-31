import type { Finding } from "./finding.js";
import type { Metrics } from "./metrics.js";
import type { Severity } from "./severity.js";
import type { Category } from "./category.js";
import type { CorrelationResult } from "./correlation.js";

/**
 * A structured root cause identified by the scoring engine
 */
export interface RootCause {
  /** Which high-level group this cause belongs to */
  group: "performance" | "network" | "rendering" | "security" | "general";

  /** Human-readable description of the root cause */
  description: string;

  /** How much this issue impacted the final score */
  impactScore: number;
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
  correlationResult?: CorrelationResult;

  /** Optional: raw data for debugging */
  debug?: Record<string, unknown>;
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
}
