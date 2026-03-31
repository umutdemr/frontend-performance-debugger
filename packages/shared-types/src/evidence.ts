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

  /**
   * The actual evidence data
   * - code-snippet: string (code)
   * - screenshot: string (base64 or URL)
   * - network-request: object with url, method, timing
   * - metric: object with name, value, unit
   * - stack-trace: string
   * - url: string
   * - custom: any
   */
  data: unknown;

  /** Optional: where in the page this evidence was found */
  location?: {
    url?: string;
    line?: number;
    column?: number;
    selector?: string;
  };
}
