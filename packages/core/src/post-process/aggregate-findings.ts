import type { Finding, Evidence } from "@fpd/shared-types";

/**
 * Groups similar findings together to prevent terminal noise.
 * Instead of showing 50 "Slow Network Request" lines, it sh
 * ows 1 line
 * with the top 3 examples and a summary.
 *
 * @param findings Deduplicated array of findings
 * @returns Aggregated, clean array of findings
 */
export function aggregateFindings(findings: Finding[]): Finding[] {
  const grouped = new Map<string, Finding[]>();

  for (const finding of findings) {
    const key = finding.id;
    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key)!.push(finding);
  }

  const aggregated: Finding[] = [];

  for (const group of grouped.values()) {
    if (group.length === 1) {
      const single = group[0]!;
      single.aggregation = { count: 1 };
      aggregated.push(single);
      continue;
    }

    const baseFinding: Finding = { ...group[0]! };
    baseFinding.aggregation = { count: group.length };

    const allEvidence: Evidence[] = [];
    for (const f of group) {
      if (f.evidence) {
        allEvidence.push(...f.evidence);
      }
    }

    const topEvidence = allEvidence.slice(0, 3);
    const hiddenCount = allEvidence.length - 3;

    if (hiddenCount > 0) {
      topEvidence.push({
        type: "custom",
        label: "Additional Items",
        data: `... and ${hiddenCount} more instances detected.`,
      });
    }

    baseFinding.evidence = topEvidence;
    baseFinding.title = `${baseFinding.title} (${group.length} instances)`;
    aggregated.push(baseFinding);
  }

  return aggregated;
}
