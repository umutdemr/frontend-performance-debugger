import type { Severity } from "./severity.js";
import type { Category } from "./category.js";
import type { Evidence, EvidenceSummary } from "./evidence.js";
import type { OwnershipHint } from "./ownership.js";

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
 * Action type for prioritizing work
 */
export type ActionType =
  | "quick-win" // Easy fix, high impact
  | "high-impact" // Complex but important
  | "investigate" // Needs investigation
  | "monitor" // Just observe
  | "framework-limitation" // Framework constraints apply
  | null;

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
   * Post-processing: Action type
   */
  actionType?: ActionType;

  /**
   * Post-processing: Confidence score
   */
  confidence?: Confidence;

  /**
   * Post-processing: Aggregation metadata
   */
  aggregation?: AggregationMeta;

  // ============================================
  //  Environment Awareness Fields
  // ============================================

  /**
   * Deduplicated evidence with occurrence counts
   * Populated during post-processing
   */
  evidenceSummary?: EvidenceSummary;

  /**
   * Framework-specific recommendation if detected
   * e.g., "Use next/image for automatic optimization"
   */
  frameworkRecommendation?: string;

  /**
   * Numeric impact score (0-100) for scoring calculations
   * Higher = more impactful issue
   */
  impactScore?: number;

  /**
   * Whether finding reliability is limited by environment
   * True when analyzing localhost/dev where behavior differs from production
   */
  environmentLimited?: boolean;

  /**
   * Caveats/notes about environment limitations
   * Displayed in reports to explain reduced confidence
   */
  environmentNotes?: string[];

  /**
   * Original severity before environment-based downgrade
   * Preserved for transparency in reports
   */
  originalSeverity?: Severity;

  // ============================================
  // Ownership Fields
  // ============================================

  /**
   * Who is likely responsible for this issue
   * Helps users understand who should fix it
   */
  ownership?: OwnershipHint;

  // ============================================
  // Source Correlation Fields
  // ============================================

  /**
   * File paths where issue may originate (legacy field)
   * @deprecated Use sourceLocations instead
   */
  sourceHints?: string[];

  /**
   * Line numbers if known (legacy field)
   * @deprecated Use sourceLocations instead
   */
  lineHints?: number[];

  /**
   * Analyzer that produced this finding
   */
  analyzer?: string;
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
      | "actionType"
      | "confidence"
      | "aggregation"
      | "evidenceSummary"
      | "frameworkRecommendation"
      | "impactScore"
      | "environmentLimited"
      | "environmentNotes"
      | "originalSeverity"
      | "ownership"
      | "sourceHints"
      | "lineHints"
      | "analyzer"
    >
  >;

export function createFinding(input: FindingInput): Finding {
  return {
    ...input,
    evidence: input.evidence || [],
  };
}

/**
 * Check if a finding has been downgraded due to environment
 */
export function isDowngraded(finding: Finding): boolean {
  return (
    finding.originalSeverity !== undefined &&
    finding.originalSeverity !== finding.severity
  );
}

/**
 * Check if a finding has environment limitations
 */
export function hasEnvironmentLimitations(finding: Finding): boolean {
  return (
    finding.environmentLimited === true ||
    (finding.environmentNotes !== undefined &&
      finding.environmentNotes.length > 0)
  );
}
