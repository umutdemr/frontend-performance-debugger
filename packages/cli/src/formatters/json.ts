import type { Report } from "@fpd/shared-types";

/**
 * JSON formatting options
 */
export interface JsonFormatOptions {
  pretty?: boolean;
  indent?: number;
  includeDebug?: boolean;
  includeFullEvidence?: boolean;
  includeEnvironment?: boolean;
  includeScoreBreakdown?: boolean;
  includeCorrelation?: boolean;
}

export function formatAsJson(
  report: Report,
  options: JsonFormatOptions = {},
): string {
  const opts: Required<JsonFormatOptions> = {
    pretty: options.pretty ?? true,
    indent: options.indent ?? 2,
    includeDebug: options.includeDebug ?? true,
    includeFullEvidence: options.includeFullEvidence ?? true,
    includeEnvironment: options.includeEnvironment ?? true,
    includeScoreBreakdown: options.includeScoreBreakdown ?? true,
    includeCorrelation: options.includeCorrelation ?? true,
  };

  const output = createCleanOutput(report, opts);

  if (opts.pretty) {
    return JSON.stringify(output, null, opts.indent);
  }

  return JSON.stringify(output);
}

/**
 * Create a clean output object based on options
 */
function createCleanOutput(
  report: Report,
  options: Required<JsonFormatOptions>,
): Record<string, unknown> {
  const output: Record<string, unknown> = {
    // Core metadata
    version: report.version,
    url: report.url,
    timestamp: report.timestamp,
    duration: report.duration,

    tool: report.tool,
    metrics: report.metrics,

    summary: {
      ...report.summary,
      totalFindings: report.summary.totalFindings,
      bySeverity: report.summary.bySeverity,
      byCategory: report.summary.byCategory,
      headline: report.summary.headline,
      score: report.summary.score,
      breakdown: report.summary.breakdown,
      topRootCauses: report.summary.topRootCauses,
    },

    findings: options.includeFullEvidence
      ? report.findings
      : report.findings.map((f) => ({
          ...f,
          evidence: f.evidence.slice(0, 3),
          evidenceTruncated: f.evidence.length > 3,
        })),
  };

  if (options.includeEnvironment && report.environment) {
    output.environment = {
      runtimeEnvironment: report.environment.runtimeEnvironment,
      hostType: report.environment.hostType,
      hostname: report.environment.hostname,
      port: report.environment.port,
      isHttps: report.environment.isHttps,
      isLocalDev: report.environment.isLocalDev,
      isNonStandardPort: report.environment.isNonStandardPort,
      cacheHeadersReliable: report.environment.cacheHeadersReliable,
      cdnLikelyPresent: report.environment.cdnLikelyPresent,
      productionLikeBuild: report.environment.productionLikeBuild,
      detectedFramework: report.environment.detectedFramework,
      frameworkVersion: report.environment.frameworkVersion,
      detectionConfidence: report.environment.detectionConfidence,
      analysisNotes: report.environment.analysisNotes,
    };
  }

  if (report.framework) {
    output.framework = report.framework;
  }

  if (report.findingsSummary) {
    output.findingsSummary = report.findingsSummary;
  }

  if (report.categoryScores) {
    output.categoryScores = report.categoryScores;
  }

  if (options.includeScoreBreakdown && report.scoreBreakdown) {
    output.scoreBreakdown = {
      baseScore: report.scoreBreakdown.baseScore,
      findingDeductions: report.scoreBreakdown.findingDeductions,
      criticalPenalty: report.scoreBreakdown.criticalPenalty,
      categoryCollapsePenalty: report.scoreBreakdown.categoryCollapsePenalty,
      environmentAdjustment: report.scoreBreakdown.environmentAdjustment,
      finalScore: report.scoreBreakdown.finalScore,
      explanation: report.scoreBreakdown.explanation,
    };
  }

  if (options.includeCorrelation && report.correlationResult) {
    output.correlationResult = report.correlationResult;
  }

  if (options.includeDebug && report.debug) {
    output.debug = report.debug;
  }

  return output;
}

/**
 * Format report as compact JSON (single line)
 */
export function formatAsCompactJson(report: Report): string {
  return formatAsJson(report, {
    pretty: false,
    includeDebug: false,
    includeFullEvidence: false,
    includeCorrelation: false,
  });
}

/**
 * Format only findings as JSON array
 * Useful for piping or integration with other tools
 */
export function formatFindingsAsJson(
  report: Report,
  options: JsonFormatOptions = {},
): string {
  const opts: Required<JsonFormatOptions> = {
    pretty: options.pretty ?? true,
    indent: options.indent ?? 2,
    includeDebug: true,
    includeFullEvidence: options.includeFullEvidence ?? true,
    includeEnvironment: true,
    includeScoreBreakdown: true,
    includeCorrelation: true,
  };

  const findings = options.includeFullEvidence
    ? report.findings
    : report.findings.map((f) => ({
        ...f,
        evidence: f.evidence.slice(0, 3),
        evidenceTruncated: f.evidence.length > 3,
      }));

  if (opts.pretty) {
    return JSON.stringify(findings, null, opts.indent);
  }

  return JSON.stringify(findings);
}

/**
 * Format only summary as JSON
 * Useful for dashboards or quick overview
 */
export function formatSummaryAsJson(
  report: Report,
  options: Pick<JsonFormatOptions, "pretty" | "indent"> = {},
): string {
  const summary = {
    url: report.url,
    timestamp: report.timestamp,
    score: report.summary.score,
    totalFindings: report.summary.totalFindings,
    bySeverity: report.summary.bySeverity,
    byCategory: report.summary.byCategory,
    headline: report.summary.headline,
    breakdown: report.summary.breakdown,
    topRootCauses: report.summary.topRootCauses,
    environment: report.environment?.runtimeEnvironment,
    framework: report.framework?.name,
    environmentLimited: report.findingsSummary?.environmentLimited,
    downgraded: report.findingsSummary?.downgraded,
  };

  const pretty = options.pretty ?? true;
  const indent = options.indent ?? 2;

  if (pretty) {
    return JSON.stringify(summary, null, indent);
  }

  return JSON.stringify(summary);
}

/**
 * Format report with custom field filtering
 * Useful for creating custom integrations
 */
export function formatCustomJson(
  report: Report,
  fields: {
    includeMeta?: boolean;
    includeMetrics?: boolean;
    includeSummary?: boolean;
    includeFindings?: boolean;
    includeEnvironment?: boolean;
    includeFramework?: boolean;
    includeCategoryScores?: boolean;
    includeScoreBreakdown?: boolean;
    includeCorrelation?: boolean;
    includeDebug?: boolean;
  },
  options: Pick<JsonFormatOptions, "pretty" | "indent"> = {},
): string {
  const output: Record<string, unknown> = {};

  if (fields.includeMeta !== false) {
    output.meta = {
      version: report.version,
      url: report.url,
      timestamp: report.timestamp,
      duration: report.duration,
      tool: report.tool,
    };
  }

  if (fields.includeMetrics) {
    output.metrics = report.metrics;
  }

  if (fields.includeSummary !== false) {
    output.summary = report.summary;
  }

  if (fields.includeFindings !== false) {
    output.findings = report.findings;
  }

  if (fields.includeEnvironment && report.environment) {
    output.environment = report.environment;
  }

  if (fields.includeFramework && report.framework) {
    output.framework = report.framework;
  }

  if (fields.includeCategoryScores && report.categoryScores) {
    output.categoryScores = report.categoryScores;
  }

  if (fields.includeScoreBreakdown && report.scoreBreakdown) {
    output.scoreBreakdown = report.scoreBreakdown;
  }

  if (fields.includeCorrelation && report.correlationResult) {
    output.correlationResult = report.correlationResult;
  }

  if (fields.includeDebug && report.debug) {
    output.debug = report.debug;
  }

  const pretty = options.pretty ?? true;
  const indent = options.indent ?? 2;

  if (pretty) {
    return JSON.stringify(output, null, indent);
  }

  return JSON.stringify(output);
}
