/**
 * Severity levels for performance findings
 * Ordered from most to least severe
 */
export type Severity = "critical" | "warning" | "info" | "success";

/**
 * Numeric weight for severity (useful for sorting/scoring)
 */
export const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 4,
  warning: 3,
  info: 2,
  success: 1,
} as const;

/**
 * Human-readable labels
 */
export const SEVERITY_LABEL: Record<Severity, string> = {
  critical: "Critical",
  warning: "Warning",
  info: "Info",
  success: "Success",
} as const;
