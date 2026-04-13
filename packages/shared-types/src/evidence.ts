import type { OwnershipType } from "./ownership";

/**
 * Evidence types that can be attached to findings
 */
export type EvidenceType =
  | "code-snippet"
  | "screenshot"
  | "network-request"
  | "metric"
  | "stack-trace"
  | "url"
  | "header"
  | "custom";

/**
 * Evidence attached to a finding
 * Proves why the finding was generated
 */
export interface Evidence {
  /** Type of evidence */
  type: EvidenceType;

  /** Human-readable label */
  label: string;

  /** Evidence data - varies by type */
  data: unknown;

  /** Direct URL reference (for quick access) */
  url?: string;

  /** Optional: where in the page this evidence was found */
  location?: {
    url?: string;
    line?: number;
    column?: number;
    selector?: string;
  };
}

/**
 * Group of similar evidence items after deduplication
 */
export interface EvidenceGroup {
  /** Representative evidence item for display */
  representative: Evidence;

  /** Number of similar items in this group */
  count: number;

  /** Sample URLs from this group (max 5) */
  sampleUrls?: string[];

  /** Ownership type detected for this group */
  ownership?: OwnershipType;
}

/**
 * Summary of evidence after deduplication
 */
export interface EvidenceSummary {
  /** Total evidence items before deduplication */
  totalCount: number;

  /** Unique evidence items after deduplication */
  uniqueCount: number;

  /** Grouped evidence for display */
  groups: EvidenceGroup[];

  /** Whether the list was truncated due to size limits */
  truncated: boolean;

  /** Number of items that were truncated */
  truncatedCount?: number;

  /** Breakdown of evidence by ownership type */
  ownershipBreakdown?: Partial<Record<OwnershipType, number>>;
}
