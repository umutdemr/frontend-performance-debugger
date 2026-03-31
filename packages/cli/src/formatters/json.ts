import type { Report } from "../../../shared-types";

/**
 * Format report as JSON string
 */
export function formatAsJson(report: Report): string {
  return JSON.stringify(report, null, 2);
}
