import type { Severity } from "./severity.js";
import type { Category } from "./category.js";
import type { Evidence } from "./evidence.js";

/**
 * Finding ID type (string alias for clarity)
 */
export type FindingId = string;

/**
 * Re-export Category as FindingCategory for semantic clarity
 */
export type FindingCategory = Category;

/**
 * Priority levels for actionable insights
 */
export type Priority =
  | "quick-win"
  | "high-impact"
  | "investigate"
  | "monitor"
  | "none";

/**
 * Confidence level of the finding
 */
export type Confidence = "high" | "medium" | "low";

/**
 * Metadata about how this finding was aggregated
 */
export interface AggregationMeta {
  /** How many individual findings were grouped into this one */
  count: number;
}

/**
 * A single performance finding
 * This is the core unit of analysis output
 */
export interface Finding {
  /** Unique identifier (e.g., "network-large-image-001") */
  id: FindingId;

  /** Short, descriptive title */
  title: string;

  /** Detailed explanation of the issue */
  description: string;

  /** How severe is this issue */
  severity: Severity;

  /** Which category does this belong to */
  category: FindingCategory;

  /** Evidence supporting this finding */
  evidence: Evidence[];

  /**
   * Estimated impact description
   * e.g., "Saves ~500ms on LCP"
   */
  impact: string;

  /**
   * Actionable recommendation to fix
   * e.g., "Compress images using WebP format"
   */
  recommendation: string;

  /**
   * Additional metadata
   * Analyzer-specific data that doesn't fit elsewhere
   */
  metadata?: Record<string, unknown>;

  /**
   * Documentation or reference URL
   * e.g., link to web.dev article
   */
  learnMoreUrl?: string;

  /**
   * Post-processing: Action priority
   */
  priority?: Priority;

  /**
   * Post-processing: Confidence score
   */
  confidence?: Confidence;

  /**
   * Post-processing: Aggregation metadata
   */
  aggregation?: AggregationMeta;
}

/**
 * Minimal finding for quick creation
 * All required fields only
 */
export type FindingInput = Pick<
  Finding,
  | "id"
  | "title"
  | "description"
  | "severity"
  | "category"
  | "impact"
  | "recommendation"
> &
  Partial<
    Pick<
      Finding,
      | "evidence"
      | "metadata"
      | "learnMoreUrl"
      | "priority"
      | "confidence"
      | "aggregation"
    >
  >;
