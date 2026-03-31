import type { Finding, RootCause } from "@fpd/shared-types";
import { SEVERITY_WEIGHT } from "@fpd/shared-types";

/**
 * Extracts the top root causes from the aggregated findings.
 * It calculates an "Impact Score" based on severity and frequency,
 * then sorts them to highlight the biggest bottlenecks.
 *
 * @param findings Array of post-processed (aggregated) findings
 * @returns Array of the most critical RootCauses (max 4)
 */
export function extractRootCauses(findings: Finding[]): RootCause[] {
  const causes: RootCause[] = [];
  const negativeFindings = findings.filter(
    (f) => f.severity === "critical" || f.severity === "warning",
  );

  const sortedFindings = negativeFindings.sort((a, b) => {
    const countA = a.aggregation?.count || 1;
    const countB = b.aggregation?.count || 1;
    const scoreA = SEVERITY_WEIGHT[a.severity] * (1 + Math.log2(countA));
    const scoreB = SEVERITY_WEIGHT[b.severity] * (1 + Math.log2(countB));

    return scoreB - scoreA;
  });

  const topIssues = sortedFindings.slice(0, 4);

  for (const issue of topIssues) {
    let group: RootCause["group"] = "general";

    if (issue.category === "rendering" || issue.id.includes("perf")) {
      group = "performance";
    } else if (
      issue.category === "network" ||
      issue.category === "assets" ||
      issue.category === "caching"
    ) {
      group = "network";
    } else if (issue.category === "seo" || issue.id.includes("security")) {
      group = "security";
    }

    causes.push({
      group,
      description: issue.title,
      impactScore:
        SEVERITY_WEIGHT[issue.severity] * (issue.aggregation?.count || 1),
    });
  }

  return causes;
}
