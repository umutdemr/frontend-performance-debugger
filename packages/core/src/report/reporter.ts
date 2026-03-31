import type {
  Report,
  ReportSummary,
  ReportOptions,
  Finding,
  Metrics,
  Severity,
  Category,
  RootCause,
} from "@fpd/shared-types";
import { SEVERITY_WEIGHT } from "@fpd/shared-types";
import { calculateFinalScore } from "../scoring/scoring.engine.js";
import type { FinalScoreResult } from "../scoring/scoring.types.js";
import { extractRootCauses } from "../post-process/root-causes.js";

export interface CreateReportInput {
  url: string;
  findings: Finding[];
  metrics: Metrics;
  duration: number;
  options?: ReportOptions;
}

/**
 * Create a complete analysis report
 */
export function createReport(input: CreateReportInput): Report {
  const { url, findings, metrics, duration, options } = input;

  // Filter findings if options specified
  let filteredFindings = findings;

  if (options?.minSeverity) {
    const minWeight = SEVERITY_WEIGHT[options.minSeverity];
    filteredFindings = filteredFindings.filter(
      (f) => SEVERITY_WEIGHT[f.severity] >= minWeight,
    );
  }

  if (options?.categories && options.categories.length > 0) {
    filteredFindings = filteredFindings.filter((f) =>
      options.categories!.includes(f.category),
    );
  }

  // Sort findings by severity (most severe first)
  filteredFindings = [...filteredFindings].sort(
    (a, b) => SEVERITY_WEIGHT[b.severity] - SEVERITY_WEIGHT[a.severity],
  );

  const scoringResult = calculateFinalScore(filteredFindings);
  const rootCauses = extractRootCauses(filteredFindings);
  const summary = createSummary(filteredFindings, scoringResult, rootCauses);

  const report: Report = {
    version: "1.0",
    url,
    timestamp: new Date().toISOString(),
    duration,
    metrics,
    findings: filteredFindings,
    summary,
    tool: {
      name: "fpd",
      version: "0.1.0",
    },
  };

  if (options?.includeDebug) {
    report.debug = {
      originalFindingsCount: findings.length,
      filteredFindingsCount: filteredFindings.length,
      options,
    };
  }

  return report;
}

/**
 * Create summary statistics from findings
 */
function createSummary(
  findings: Finding[],
  scoringResult: FinalScoreResult,
  rootCauses: RootCause[],
): ReportSummary {
  // Count by severity
  const bySeverity: Record<Severity, number> = {
    critical: 0,
    warning: 0,
    info: 0,
    success: 0,
  };

  const byCategory: Record<Category, number> = {
    network: 0,
    rendering: 0,
    javascript: 0,
    assets: 0,
    caching: 0,
    accessibility: 0,
    seo: 0,
    general: 0,
  };

  for (const finding of findings) {
    bySeverity[finding.severity]++;
    byCategory[finding.category]++;
  }

  // Generate headline
  const headline = generateHeadline(findings, bySeverity);

  return {
    totalFindings: findings.length,
    bySeverity,
    byCategory,
    score: scoringResult.finalScore,
    headline,
    breakdown: {
      performance: `${Math.round(scoringResult.breakdown.performance.current)}/${scoringResult.breakdown.performance.max}`,
      network: `${Math.round(scoringResult.breakdown.network.current)}/${scoringResult.breakdown.network.max}`,
      architecture: `${Math.round(scoringResult.breakdown.architecture.current)}/${scoringResult.breakdown.architecture.max}`,
      seoSecurity: `${Math.round(scoringResult.breakdown.seoSecurity.current)}/${scoringResult.breakdown.seoSecurity.max}`,
    },
    topRootCauses: rootCauses,
  };
}

/**
 * Generate a one-line summary headline
 */
function generateHeadline(
  findings: Finding[],
  bySeverity: Record<Severity, number>,
): string {
  if (findings.length === 0) {
    return "No issues found. Great job!";
  }

  if (bySeverity.critical > 0) {
    return `Found ${bySeverity.critical} critical issue${bySeverity.critical > 1 ? "s" : ""} requiring immediate attention`;
  }

  if (bySeverity.warning > 0) {
    return `Found ${bySeverity.warning} warning${bySeverity.warning > 1 ? "s" : ""} that should be addressed`;
  }

  return `Found ${findings.length} suggestion${findings.length > 1 ? "s" : ""} for improvement`;
}
