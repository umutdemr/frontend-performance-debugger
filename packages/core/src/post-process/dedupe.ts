import type { Finding } from "@fpd/shared-types";

/**
 * Removes exact duplicate findings to reduce noise.
 * Two findings are considered duplicates if they share the exact same
 * ID and the exact same evidence data.
 *
 * @param findings Raw array of findings from all analyzers
 * @returns Cleaned array of unique findings
 */
export function dedupeFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const uniqueFindings: Finding[] = [];

  for (const finding of findings) {
    // ID ve Evidence data'sını kullanarak eşsiz bir imza (signature) oluşturuyoruz.
    // JSON.stringify kullanarak evidence içindeki değerleri text'e çeviriyoruz.
    const evidenceSignature = finding.evidence
      .map((e) => JSON.stringify(e.data))
      .join("|");

    const signature = `${finding.id}::${evidenceSignature}`;

    if (!seen.has(signature)) {
      seen.add(signature);
      uniqueFindings.push(finding);
    }
  }

  return uniqueFindings;
}
