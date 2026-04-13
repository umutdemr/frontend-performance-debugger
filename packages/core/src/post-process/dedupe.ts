import type {
  Finding,
  Evidence,
  EvidenceSummary,
  EvidenceGroup,
  Confidence,
  OwnershipType,
  OwnershipHint,
} from "@fpd/shared-types";

export interface DedupeOptions {
  maxEvidenceItems?: number;
  groupSimilarUrls?: boolean;
  preserveCounts?: boolean;
  mergeSimilarFindings?: boolean;
  groupByOwnership?: boolean;
}

const DEFAULT_OPTIONS: DedupeOptions = {
  maxEvidenceItems: 10,
  groupSimilarUrls: true,
  preserveCounts: true,
  mergeSimilarFindings: true,
  groupByOwnership: true,
};

/**
 * Confidence level ordering for comparison
 */
const CONFIDENCE_ORDER: Record<Confidence, number> = {
  high: 3,
  medium: 2,
  low: 1,
};

/**
 * Ownership type ordering for sorting
 */
const OWNERSHIP_ORDER: Record<OwnershipType, number> = {
  "app-owned": 0,
  "config-owned": 1,
  "infra-owned": 2,
  "third-party": 3,
  "framework-owned": 4,
  unknown: 5,
};

export function dedupeFindings(
  findings: Finding[],
  options: DedupeOptions = {},
): Finding[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const uniqueFindings = dedupeFindingList(findings, opts);

  return uniqueFindings.map((finding) =>
    dedupeEvidenceInFinding(finding, opts),
  );
}

/**
 * Remove duplicate findings and merge evidence from duplicates.
 */
function dedupeFindingList(
  findings: Finding[],
  options: DedupeOptions,
): Finding[] {
  const seen = new Map<string, Finding>();

  for (const finding of findings) {
    const key = finding.id;

    if (!seen.has(key)) {
      seen.set(key, { ...finding });
    } else if (options.mergeSimilarFindings) {
      const existing = seen.get(key)!;
      mergeFindings(existing, finding);
    }
  }

  return Array.from(seen.values());
}

/**
 * Merge a duplicate finding into an existing one.
 */
function mergeFindings(existing: Finding, incoming: Finding): void {
  existing.evidence = [...existing.evidence, ...incoming.evidence];

  if (existing.aggregation) {
    existing.aggregation.count += incoming.aggregation?.count || 1;
  } else if (incoming.aggregation) {
    existing.aggregation = { ...incoming.aggregation };
  }

  if (compareSeverity(incoming.severity, existing.severity) > 0) {
    existing.severity = incoming.severity;
  }

  if (incoming.confidence && existing.confidence) {
    if (compareConfidence(incoming.confidence, existing.confidence) > 0) {
      existing.confidence = incoming.confidence;
    }
  } else if (incoming.confidence && !existing.confidence) {
    existing.confidence = incoming.confidence;
  }

  if (incoming.environmentNotes) {
    existing.environmentNotes = [
      ...new Set([
        ...(existing.environmentNotes || []),
        ...incoming.environmentNotes,
      ]),
    ];
  }

  if (incoming.ownership && !existing.ownership) {
    existing.ownership = incoming.ownership;
  } else if (incoming.ownership && existing.ownership) {
    existing.ownership = mergeOwnership(existing.ownership, incoming.ownership);
  }

  if (incoming.metadata) {
    existing.metadata = {
      ...(existing.metadata || {}),
      ...incoming.metadata,
    };
  }

  if (incoming.actionType && !existing.actionType) {
    existing.actionType = incoming.actionType;
  }
}

function mergeOwnership(a: OwnershipHint, b: OwnershipHint): OwnershipHint {
  const aType = a.type || "unknown";
  const bType = b.type || "unknown";

  return OWNERSHIP_ORDER[aType] <= OWNERSHIP_ORDER[bType] ? a : b;
}

function compareSeverity(
  a: Finding["severity"],
  b: Finding["severity"],
): number {
  const order: Record<Finding["severity"], number> = {
    critical: 4,
    warning: 3,
    info: 2,
    success: 1,
  };
  return (order[a] || 0) - (order[b] || 0);
}

function compareConfidence(a: Confidence, b: Confidence): number {
  return (CONFIDENCE_ORDER[a] || 0) - (CONFIDENCE_ORDER[b] || 0);
}

function dedupeEvidenceInFinding(
  finding: Finding,
  options: DedupeOptions,
): Finding {
  if (!finding.evidence || finding.evidence.length === 0) {
    return finding;
  }

  const totalCount = finding.evidence.length;

  const groups = groupEvidence(finding.evidence, options);

  groups.sort((a, b) => {
    const countDiff = b.count - a.count;
    if (countDiff !== 0) return countDiff;

    const aOwnership = a.ownership || "unknown";
    const bOwnership = b.ownership || "unknown";
    return OWNERSHIP_ORDER[aOwnership] - OWNERSHIP_ORDER[bOwnership];
  });

  const maxItems = options.maxEvidenceItems || 10;
  const truncated = groups.length > maxItems;
  const displayGroups = groups.slice(0, maxItems);

  const deduplicatedEvidence = displayGroups.map((g) => g.representative);

  const ownershipBreakdown = calculateOwnershipBreakdown(groups);

  const evidenceSummary: EvidenceSummary = {
    totalCount,
    uniqueCount: groups.length,
    groups: displayGroups,
    truncated,
    truncatedCount: truncated ? groups.length - maxItems : undefined,
    ownershipBreakdown:
      Object.keys(ownershipBreakdown).length > 0
        ? ownershipBreakdown
        : undefined,
  };

  return {
    ...finding,
    evidence: deduplicatedEvidence,
    evidenceSummary,
  };
}

function calculateOwnershipBreakdown(
  groups: EvidenceGroup[],
): Partial<Record<OwnershipType, number>> {
  const breakdown: Partial<Record<OwnershipType, number>> = {};

  for (const group of groups) {
    const ownership: OwnershipType = group.ownership || "unknown";
    breakdown[ownership] = (breakdown[ownership] || 0) + group.count;
  }

  return breakdown;
}

function groupEvidence(
  evidence: Evidence[],
  options: DedupeOptions,
): EvidenceGroup[] {
  const groups = new Map<string, EvidenceGroup>();

  for (const item of evidence) {
    const key = getEvidenceKey(item, options);
    const ownership = detectEvidenceOwnership(item);

    if (groups.has(key)) {
      const group = groups.get(key)!;
      group.count++;

      const url = extractUrlFromEvidence(item);
      if (url && group.sampleUrls && group.sampleUrls.length < 5) {
        if (!group.sampleUrls.includes(url)) {
          group.sampleUrls.push(url);
        }
      }
    } else {
      const url = extractUrlFromEvidence(item);
      groups.set(key, {
        representative: item,
        count: 1,
        sampleUrls: url ? [url] : undefined,
        ownership,
      });
    }
  }

  return Array.from(groups.values());
}

function detectEvidenceOwnership(evidence: Evidence): OwnershipType {
  const url = extractUrlFromEvidence(evidence);

  if (!url) {
    return "unknown";
  }

  const thirdPartyPatterns = [
    /fonts\.googleapis\.com/,
    /fonts\.gstatic\.com/,
    /google-analytics\.com/,
    /googletagmanager\.com/,
    /cdn\.jsdelivr\.net/,
    /unpkg\.com/,
    /cdnjs\.cloudflare\.com/,
  ];

  for (const pattern of thirdPartyPatterns) {
    if (pattern.test(url)) {
      return "third-party";
    }
  }

  const frameworkPatterns = [
    /_next\/static\//,
    /\/__webpack/,
    /\/node_modules\//,
    /polyfill/i,
    /runtime/i,
    /framework/i,
    /vendor/i,
    /chunks\/.*(?:react|next|webpack)/i,
  ];

  for (const pattern of frameworkPatterns) {
    if (pattern.test(url)) {
      return "framework-owned";
    }
  }

  const infraPatterns = [
    /cdn\./,
    /cloudflare/,
    /cloudfront/,
    /fastly/,
    /akamai/,
  ];

  for (const pattern of infraPatterns) {
    if (pattern.test(url)) {
      return "infra-owned";
    }
  }

  const appPatterns = [
    /\/app\//,
    /\/src\//,
    /\/components\//,
    /\/features\//,
    /\/pages\//,
    /\/images\//,
    /\/assets\//,
    /\/public\//,
  ];

  for (const pattern of appPatterns) {
    if (pattern.test(url)) {
      return "app-owned";
    }
  }

  return "unknown";
}

/**
 * Generate a key for grouping similar evidence.
 */
function getEvidenceKey(evidence: Evidence, options: DedupeOptions): string {
  const { type, data } = evidence;

  if (type === "code-snippet" && data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (d.resourceType) {
      return `${type}:resourceType:${d.resourceType}`;
    }
    if (d.statusCode) {
      return `${type}:status:${d.statusCode}`;
    }
  }

  if (type === "url") {
    const url = extractUrlFromEvidence(evidence);
    if (url && options.groupSimilarUrls) {
      const ownership = detectEvidenceOwnership(evidence);
      if (options.groupByOwnership) {
        return `${type}:${ownership}:${normalizeUrlForGrouping(url)}`;
      }
      return `${type}:${normalizeUrlForGrouping(url)}`;
    }
    return `${type}:${String(data)}`;
  }

  if (type === "metric") {
    const label = evidence.label || "unknown";
    return `${type}:${label}`;
  }

  if (type === "custom") {
    const label = evidence.label || "unknown";
    return `${type}:${label}`;
  }

  return `${type}:${JSON.stringify(data)}`;
}

function extractUrlFromEvidence(evidence: Evidence): string | undefined {
  const { data, type } = evidence;

  if (evidence.url) {
    return evidence.url;
  }

  if (type === "url" && typeof data === "string") {
    return data;
  }

  if (typeof data === "string") {
    try {
      new URL(data);
      return data;
    } catch {
      const urlMatch = data.match(/https?:\/\/[^\s<>"']+/);
      if (urlMatch) {
        return urlMatch[0];
      }
      return undefined;
    }
  }

  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;
    if (typeof d.url === "string") return d.url;
    if (typeof d.href === "string") return d.href;
    if (typeof d.src === "string") return d.src;
  }

  return undefined;
}

function normalizeUrlForGrouping(url: string): string {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split("/");

    const normalizedParts = pathParts.map((part) => {
      if (/^[a-f0-9]{8,}$/i.test(part)) return "[hash]";
      if (/^v?\d+\.\d+(\.\d+)?$/i.test(part)) return "[version]";
      if (/^\d{4,}$/.test(part)) return "[id]";
      if (
        /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(
          part,
        )
      )
        return "[uuid]";
      if (part.includes(".") && /[A-Za-z0-9_-]{20,}/.test(part)) {
        const ext = part.split(".").pop();
        return `[chunkhash].${ext}`;
      }
      if (/^[a-f0-9]{6,}_[a-f0-9]{6,}/.test(part)) return "[nextchunk]";
      return part;
    });

    return `${parsed.host}${normalizedParts.join("/")}`;
  } catch {
    return url;
  }
}

/**
 * Ownership labels for display
 */
const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  "app-owned": "App",
  "framework-owned": "Framework",
  "config-owned": "Config",
  "infra-owned": "Infra",
  "third-party": "3rd Party",
  unknown: "",
};

export function formatEvidenceGroup(group: EvidenceGroup): string {
  const { representative, count, sampleUrls, ownership } = group;

  let result = "";

  if (ownership && ownership !== "unknown") {
    result += `[${OWNERSHIP_LABELS[ownership]}] `;
  }

  if (count === 1) {
    return result + formatEvidence(representative);
  }

  const baseText = formatEvidence(representative);
  result += `${baseText} (×${count})`;

  if (sampleUrls && sampleUrls.length > 1) {
    const additionalUrls = sampleUrls.slice(1, 3);
    result += `\n  Similar: ${additionalUrls.join(", ")}`;
    if (sampleUrls.length > 3) {
      result += `, and ${sampleUrls.length - 3} more`;
    }
  }

  return result;
}

function formatEvidence(evidence: Evidence): string {
  const { data, label } = evidence;
  const prefix = label ? `${label}: ` : "";

  if (typeof data === "string") {
    const truncated = data.length > 100 ? data.substring(0, 100) + "..." : data;
    return `${prefix}${truncated}`;
  }

  if (data && typeof data === "object") {
    const d = data as Record<string, unknown>;

    if (d.url) return `${prefix}${String(d.url)}`;
    if (d.href) return `${prefix}${String(d.href)}`;
    if (d.src) return `${prefix}${String(d.src)}`;

    if (d.value !== undefined) {
      const unit = d.unit ? `${d.unit}` : "";
      let result = `${prefix}${d.value}${unit}`;
      if (d.threshold !== undefined) {
        result += ` (threshold: ${d.threshold}${unit})`;
      }
      return result;
    }

    if (d.resourceType && d.totalCount) {
      return `${prefix}${d.resourceType}: ${d.totalCount} items`;
    }

    const entries = Object.entries(d)
      .filter(([k]) => !k.startsWith("_"))
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(", ");
    return `${prefix}${entries}`;
  }

  return `${prefix}${JSON.stringify(data)}`;
}

export function getEvidenceSummaryText(finding: Finding): string {
  if (!finding.evidenceSummary) {
    return `${finding.evidence.length} evidence items`;
  }

  const { totalCount, uniqueCount, truncated, ownershipBreakdown } =
    finding.evidenceSummary;

  const parts: string[] = [];

  if (totalCount === uniqueCount) {
    parts.push(`${totalCount} evidence items`);
  } else {
    parts.push(`${uniqueCount} unique items (${totalCount} total)`);
  }

  if (ownershipBreakdown) {
    const breakdownParts: string[] = [];
    const appOwned = ownershipBreakdown["app-owned"];
    const frameworkOwned = ownershipBreakdown["framework-owned"];

    if (appOwned) {
      breakdownParts.push(`${appOwned} app-owned`);
    }
    if (frameworkOwned) {
      breakdownParts.push(`${frameworkOwned} framework-owned`);
    }
    if (breakdownParts.length > 0) {
      parts.push(`[${breakdownParts.join(", ")}]`);
    }
  }

  if (truncated) {
    parts.push("[truncated]");
  }

  return parts.join(" ");
}

export function getDedupeStats(findings: Finding[]): {
  totalFindings: number;
  totalEvidence: number;
  uniqueEvidence: number;
  dedupeRatio: number;
  ownershipBreakdown: Record<OwnershipType, number>;
} {
  let totalEvidence = 0;
  let uniqueEvidence = 0;
  const ownershipBreakdown: Record<OwnershipType, number> = {
    "app-owned": 0,
    "framework-owned": 0,
    "config-owned": 0,
    "infra-owned": 0,
    "third-party": 0,
    unknown: 0,
  };

  for (const finding of findings) {
    if (finding.evidenceSummary) {
      totalEvidence += finding.evidenceSummary.totalCount;
      uniqueEvidence += finding.evidenceSummary.uniqueCount;

      if (finding.evidenceSummary.ownershipBreakdown) {
        for (const [key, value] of Object.entries(
          finding.evidenceSummary.ownershipBreakdown,
        )) {
          if (typeof value === "number" && key in ownershipBreakdown) {
            ownershipBreakdown[key as OwnershipType] += value;
          }
        }
      }
    } else {
      totalEvidence += finding.evidence.length;
      uniqueEvidence += finding.evidence.length;
    }
  }

  return {
    totalFindings: findings.length,
    totalEvidence,
    uniqueEvidence,
    dedupeRatio:
      totalEvidence > 0 ? (totalEvidence - uniqueEvidence) / totalEvidence : 0,
    ownershipBreakdown,
  };
}
