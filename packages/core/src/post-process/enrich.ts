import type { Finding } from "@fpd/shared-types";

/**
 * Assigns an actionable priority to the finding based on category and rules.
 * Helps the developer know what to fix first.
 *
 * @param finding A single aggregated finding
 * @returns The finding enriched with a priority level
 */
export function assignPriority(finding: Finding): Finding {
  const id = finding.id;
  const category = finding.category;

  if (category === "rendering" && finding.severity === "critical") {
    finding.priority = "high-impact";
  } else if (id.includes("render-blocking") || id.includes("total-size")) {
    finding.priority = "high-impact";
  } else if (
    category === "accessibility" ||
    id.includes("alt") ||
    id.includes("lazy-loading") ||
    id.includes("dimensions")
  ) {
    finding.priority = "quick-win";
  } else if (
    id.includes("unused") ||
    id.includes("cache") ||
    id.includes("estimation")
  ) {
    finding.priority = "monitor";
  } else if (finding.severity === "warning") {
    finding.priority = "investigate";
  } else {
    finding.priority = "none";
  }

  return finding;
}

/**
 * Assigns a confidence score to the finding.
 * Helps the user understand if this is a hard fact or a heuristic guess.
 *
 * @param finding A single aggregated finding
 * @returns The finding enriched with a confidence level
 */
export function assignConfidence(finding: Finding): Finding {
  const id = finding.id;

  if (
    id.startsWith("perf-") ||
    id.startsWith("network-") ||
    id.includes("render-blocking")
  ) {
    finding.confidence = "high";
  } else if (
    id.includes("heuristic") ||
    id.includes("unused") ||
    id.includes("heavy")
  ) {
    finding.confidence = "medium";
  } else if (id.includes("limitation") || id.includes("estimation")) {
    finding.confidence = "low";
  } else {
    finding.confidence = "high";
  }

  return finding;
}
