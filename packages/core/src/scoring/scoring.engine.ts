import type { Finding, EnvironmentContext } from "@fpd/shared-types";
import {
  CATEGORY_BUDGETS,
  SEVERITY_WEIGHTS,
  IMPACT_WEIGHTS,
  CONFIDENCE_WEIGHTS,
  MAX_BONUS,
  CATEGORY_COLLAPSE_THRESHOLD,
  CATEGORY_COLLAPSE_PENALTY_FACTOR,
  MAX_COLLAPSE_PENALTY,
  CRITICAL_PENALTY_PER_ISSUE,
  MAX_CRITICAL_PENALTY,
  LOCAL_DEV_PENALTY_REDUCTION,
  UNRELIABLE_CACHE_PENALTY_REDUCTION,
  getScoringRule,
  getScoreLabel,
  getScoreColor,
} from "./scoring.config.js";
import type {
  ScoreCluster,
  ScoreBreakdown,
  FinalScoreResult,
  HardFailAssessment,
  CriticalPenaltyAssessment,
  CategoryCollapseAssessment,
  EnvironmentAdjustmentSummary,
  ScoreExplanation,
  ScoringOptions,
  ScoringEnvironmentContext,
  ScoreCategory,
} from "./scoring.types.js";

// ============================================
// Local Types
// ============================================

type AnalysisMode = "runtime" | "filesystem";
type ExtendedScoringOptions = ScoringOptions & {
  analysisMode?: AnalysisMode;
};

// ============================================
// Helper Functions
// ============================================

const clamp = (val: number, min: number, max: number): number =>
  Math.min(Math.max(val, min), max);

const repetitionFactor = (count: number): number => {
  return clamp(1 + Math.log2(Math.max(count, 1)), 1.0, 3.5);
};

const getMetricFactor = (finding: Finding): number => {
  const metricEvidence = finding.evidence?.find((e) => e.type === "metric");
  if (
    metricEvidence &&
    metricEvidence.data &&
    typeof metricEvidence.data === "object"
  ) {
    const data = metricEvidence.data as Record<string, unknown>;
    if (
      typeof data.value === "number" &&
      typeof data.threshold === "number" &&
      data.threshold > 0
    ) {
      return clamp(data.value / data.threshold, 1.0, 2.5);
    }
  }
  return 1.0;
};

function toScoringEnvironment(
  env?: EnvironmentContext,
): ScoringEnvironmentContext {
  if (!env) {
    return {
      isLocalDev: false,
      cacheHeadersReliable: true,
      productionLikeBuild: true,
      runtimeEnvironment: "unknown",
    };
  }

  return {
    isLocalDev: env.isLocalDev,
    cacheHeadersReliable: env.cacheHeadersReliable,
    productionLikeBuild: env.productionLikeBuild,
    runtimeEnvironment: env.runtimeEnvironment,
  };
}

/**
 * Derive score label with critical-awareness
 */
function deriveFinalLabel(
  finalScore: number,
  criticalCount: number,
  analysisMode: AnalysisMode,
): string {
  if (criticalCount > 0) {
    if (analysisMode === "filesystem") {
      return finalScore <= 35 ? "Critical" : "Needs Attention";
    }
    return finalScore <= 45 ? "Critical" : "Needs Attention";
  }

  return getScoreLabel(finalScore);
}

// ============================================
// Cluster Building
// ============================================

const buildScoreClusters = (
  findings: Finding[],
  envContext: ScoringEnvironmentContext,
  applyEnvAdjustments: boolean,
): ScoreCluster[] => {
  const clusterMap = new Map<string, ScoreCluster>();

  for (const finding of findings) {
    if (finding.severity === "success") continue;

    const rule = getScoringRule(finding.id);
    const clusterKey = rule.canBeClustered
      ? finding.id
      : `${finding.id}-${Math.random()}`;

    if (!clusterMap.has(clusterKey)) {
      clusterMap.set(clusterKey, {
        ruleId: finding.id,
        rule,
        count: 0,
        findings: [],
        totalPenalty: 0,
        metricFactorAverage: 0,
      });
    }

    const cluster = clusterMap.get(clusterKey)!;
    const actualCount = finding.aggregation?.count || 1;
    cluster.count += actualCount;
    cluster.findings.push(finding);
    cluster.metricFactorAverage += getMetricFactor(finding);
  }

  for (const cluster of clusterMap.values()) {
    const avgMetricFactor =
      cluster.metricFactorAverage / Math.max(cluster.findings.length, 1);

    const sevWeight =
      SEVERITY_WEIGHTS[cluster.findings[0]?.severity ?? "info"] ?? 0.15;
    const impWeight = IMPACT_WEIGHTS[cluster.rule.impact] ?? 0.5;
    const confWeight = CONFIDENCE_WEIGHTS[cluster.rule.confidence] ?? 0.75;
    const repFactor = repetitionFactor(cluster.count);

    let basePenalty =
      cluster.rule.basePenalty *
      sevWeight *
      impWeight *
      confWeight *
      repFactor *
      avgMetricFactor;

    if (applyEnvAdjustments) {
      const adjustment = calculateEnvironmentAdjustment(cluster, envContext);
      if (adjustment.reduced) {
        cluster.originalPenalty = basePenalty;
        cluster.environmentReduced = true;
        cluster.adjustmentReason = adjustment.reason;
        basePenalty *= adjustment.factor;
      }
    }

    cluster.totalPenalty = basePenalty;
  }

  return Array.from(clusterMap.values());
};

/**
 * Calculate environment-based adjustment for a cluster
 */
function calculateEnvironmentAdjustment(
  cluster: ScoreCluster,
  envContext: ScoringEnvironmentContext,
): { reduced: boolean; factor: number; reason?: string } {
  const rule = cluster.rule;

  // Check if finding was already marked as environment-limited
  const hasEnvLimitedFinding = cluster.findings.some(
    (f) => f.environmentLimited,
  );

  // Local dev adjustments
  if (envContext.isLocalDev && rule.reducedInLocalDev) {
    return {
      reduced: true,
      factor: LOCAL_DEV_PENALTY_REDUCTION,
      reason: "Reduced in local development environment",
    };
  }

  // Cache header reliability adjustments
  if (!envContext.cacheHeadersReliable && rule.dependsOnCacheHeaders) {
    return {
      reduced: true,
      factor: UNRELIABLE_CACHE_PENALTY_REDUCTION,
      reason: "Cache headers may not reflect production configuration",
    };
  }

  // Finding already marked as environment-limited
  if (hasEnvLimitedFinding && rule.reducedInLocalDev) {
    return {
      reduced: true,
      factor: 0.7,
      reason: "Finding has environment limitations",
    };
  }

  // Non-production build adjustments for performance findings
  if (!envContext.productionLikeBuild && rule.scoreCategory === "performance") {
    return {
      reduced: true,
      factor: 0.75,
      reason: "Development build may not reflect production performance",
    };
  }

  return { reduced: false, factor: 1.0 };
}

// ============================================
// Positive Credits (Success Findings)
// ============================================

const calculatePositiveCredits = (findings: Finding[]): number => {
  let bonus = 0;
  for (const finding of findings) {
    if (finding.severity === "success") {
      const rule = getScoringRule(finding.id);
      if (rule.positiveCredit) {
        bonus += rule.positiveCredit;
      }
    }
  }
  return Math.min(bonus, MAX_BONUS);
};

// ============================================
// Hard Fail Assessment
// ============================================

const assessHardFail = (clusters: ScoreCluster[]): HardFailAssessment => {
  const assessment: HardFailAssessment = {
    triggered: false,
    multiplier: 1.0,
    reasons: [],
  };

  for (const cluster of clusters) {
    if (
      cluster.rule.hardFailContribution &&
      cluster.rule.hardFailContribution < 1.0
    ) {
      if (!cluster.environmentReduced) {
        assessment.triggered = true;
        assessment.multiplier *= cluster.rule.hardFailContribution;
        assessment.reasons.push(cluster.rule.rootCauseFamily || cluster.ruleId);
      }
    }
  }

  assessment.multiplier = clamp(assessment.multiplier, 0.5, 1.0);
  return assessment;
};

function assessCriticalPenalty(
  clusters: ScoreCluster[],
): CriticalPenaltyAssessment {
  const assessment: CriticalPenaltyAssessment = {
    criticalCount: 0,
    penalty: 0,
    triggeringFindings: [],
  };

  for (const cluster of clusters) {
    if (cluster.environmentReduced) continue;

    if (!cluster.rule.isCriticalIssue) continue;

    const criticalFindings = cluster.findings.filter(
      (f) => f.severity === "critical",
    );

    if (criticalFindings.length === 0) continue;

    assessment.criticalCount += criticalFindings.length;
    assessment.triggeringFindings.push(cluster.ruleId);

    let findingPenalty = CRITICAL_PENALTY_PER_ISSUE;

    if (cluster.ruleId === "fs-env-exposed") {
      findingPenalty *= 2.5;
    } else if (
      cluster.ruleId === "fs-node-modules-committed" ||
      cluster.ruleId === "fs-node-modules-detected"
    ) {
      findingPenalty *= 1.5;
    } else if (cluster.ruleId === "fs-images-large") {
      findingPenalty *= 1.2;
    }

    assessment.penalty += findingPenalty * criticalFindings.length;
  }

  assessment.penalty = Math.min(assessment.penalty, MAX_CRITICAL_PENALTY);

  return assessment;
}

function assessCategoryCollapse(
  breakdown: ScoreBreakdown,
): CategoryCollapseAssessment {
  const assessment: CategoryCollapseAssessment = {
    collapsedCategories: [],
    penalty: 0,
    details: {} as Record<ScoreCategory, { ratio: number; penalty: number }>,
  };

  const categories: ScoreCategory[] = [
    "performance",
    "network",
    "architecture",
    "seoSecurity",
  ];

  for (const category of categories) {
    const catBreakdown = breakdown[category];
    const ratio = catBreakdown.current / catBreakdown.max;

    if (ratio < CATEGORY_COLLAPSE_THRESHOLD) {
      assessment.collapsedCategories.push(category);

      const collapseSeverity = 1 - ratio / CATEGORY_COLLAPSE_THRESHOLD;
      const categoryPenalty =
        collapseSeverity * CATEGORY_COLLAPSE_PENALTY_FACTOR * 100;

      assessment.details[category] = {
        ratio,
        penalty: categoryPenalty,
      };

      assessment.penalty += categoryPenalty;

      catBreakdown.collapsed = true;
      catBreakdown.collapsePenalty = categoryPenalty;
      catBreakdown.notes = catBreakdown.notes || [];
      catBreakdown.notes.push(
        `Category severely impacted (${Math.round(ratio * 100)}% remaining)`,
      );
    }
  }

  assessment.penalty = Math.min(assessment.penalty, MAX_COLLAPSE_PENALTY);

  return assessment;
}

function summarizeEnvironmentAdjustments(
  clusters: ScoreCluster[],
  envContext: ScoringEnvironmentContext,
): EnvironmentAdjustmentSummary {
  const summary: EnvironmentAdjustmentSummary = {
    adjusted: false,
    reducedFindings: 0,
    penaltyReduction: 0,
    notes: [],
  };

  for (const cluster of clusters) {
    if (cluster.environmentReduced && cluster.originalPenalty !== undefined) {
      summary.adjusted = true;
      summary.reducedFindings += cluster.findings.length;
      summary.penaltyReduction +=
        cluster.originalPenalty - cluster.totalPenalty;

      if (
        cluster.adjustmentReason &&
        !summary.notes.includes(cluster.adjustmentReason)
      ) {
        summary.notes.push(cluster.adjustmentReason);
      }
    }
  }

  if (envContext.isLocalDev) {
    summary.notes.unshift(
      "Analysis ran in local development environment - some penalties reduced",
    );
  } else if (!envContext.cacheHeadersReliable) {
    summary.notes.unshift(
      "Cache-related penalties reduced - headers may not reflect production",
    );
  }

  return summary;
}

// ============================================
// Main Scoring Function
// ============================================

export const calculateFinalScore = (
  findings: Finding[],
  options: ExtendedScoringOptions = {},
  environmentContext?: EnvironmentContext,
): FinalScoreResult => {
  const opts: Required<ScoringOptions> & { analysisMode: AnalysisMode } = {
    applyCriticalPenalty: options.applyCriticalPenalty ?? true,
    applyCollapsePenalty: options.applyCollapsePenalty ?? true,
    applyEnvironmentAdjustments: options.applyEnvironmentAdjustments ?? true,
    environmentContext:
      options.environmentContext ?? toScoringEnvironment(environmentContext),
    includeExplanation: options.includeExplanation ?? true,
    analysisMode: options.analysisMode ?? "runtime",
  };

  const envContext = opts.environmentContext;

  const clusters = buildScoreClusters(
    findings,
    envContext,
    opts.applyEnvironmentAdjustments,
  );

  const penalties: Record<ScoreCategory, number> = {
    performance: 0,
    network: 0,
    architecture: 0,
    seoSecurity: 0,
  };

  const findingCounts: Record<ScoreCategory, number> = {
    performance: 0,
    network: 0,
    architecture: 0,
    seoSecurity: 0,
  };

  for (const cluster of clusters) {
    penalties[cluster.rule.scoreCategory] += cluster.totalPenalty;
    findingCounts[cluster.rule.scoreCategory] += cluster.findings.length;
  }

  const breakdown: ScoreBreakdown = {
    performance: {
      max: CATEGORY_BUDGETS.performance,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.performance - penalties.performance,
      ),
      findingCount: findingCounts.performance,
    },
    network: {
      max: CATEGORY_BUDGETS.network,
      current: Math.max(0, CATEGORY_BUDGETS.network - penalties.network),
      findingCount: findingCounts.network,
    },
    architecture: {
      max: CATEGORY_BUDGETS.architecture,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.architecture - penalties.architecture,
      ),
      findingCount: findingCounts.architecture,
    },
    seoSecurity: {
      max: CATEGORY_BUDGETS.seoSecurity,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.seoSecurity - penalties.seoSecurity,
      ),
      findingCount: findingCounts.seoSecurity,
    },
  };

  const baseScore = Math.round(
    breakdown.performance.current +
      breakdown.network.current +
      breakdown.architecture.current +
      breakdown.seoSecurity.current,
  );

  const bonus = calculatePositiveCredits(findings);
  let scoreWithBonus = clamp(baseScore + bonus, 0, 100);

  const hardFail = assessHardFail(clusters);

  let criticalPenalty: CriticalPenaltyAssessment | undefined;
  if (opts.applyCriticalPenalty) {
    criticalPenalty = assessCriticalPenalty(clusters);
    scoreWithBonus -= criticalPenalty.penalty;
  }

  let collapsePenalty: CategoryCollapseAssessment | undefined;
  if (opts.applyCollapsePenalty) {
    collapsePenalty = assessCategoryCollapse(breakdown);
    scoreWithBonus -= collapsePenalty.penalty;
  }

  let finalScore = Math.round(scoreWithBonus * hardFail.multiplier);
  finalScore = clamp(finalScore, 0, 100);

  const criticalCount = criticalPenalty?.criticalCount ?? 0;
  const isFilesystemMode = opts.analysisMode === "filesystem";

  if (criticalCount > 0) {
    finalScore = Math.min(finalScore, isFilesystemMode ? 70 : 75);
  }

  if (criticalCount >= 2) {
    finalScore = Math.min(finalScore, isFilesystemMode ? 50 : 60);
  }

  if (criticalCount >= 3) {
    finalScore = Math.min(finalScore, isFilesystemMode ? 35 : 45);
  }

  const environmentAdjustment = opts.applyEnvironmentAdjustments
    ? summarizeEnvironmentAdjustments(clusters, envContext)
    : undefined;

  const topRootCauses = Array.from(
    new Set(
      clusters
        .filter((c) => !c.environmentReduced)
        .sort((a, b) => b.totalPenalty - a.totalPenalty)
        .filter((c) => c.totalPenalty > 1)
        .map((c) => c.rule.rootCauseFamily || `Issues with ${c.ruleId}`),
    ),
  ).slice(0, 4);

  let explanation: ScoreExplanation | undefined;
  if (opts.includeExplanation) {
    explanation = buildExplanation({
      baseScore,
      bonus,
      hardFail,
      criticalPenalty,
      collapsePenalty,
      environmentAdjustment,
      finalScore,
      analysisMode: opts.analysisMode,
    });
  }

  const label = deriveFinalLabel(finalScore, criticalCount, opts.analysisMode);

  return {
    finalScore,
    baseScore,
    breakdown,
    topRootCauses,
    clusters,
    hardFail,
    totalBonusApplied: bonus,
    criticalPenalty,
    collapsePenalty,
    environmentAdjustment,
    explanation,
    label,
    color: getScoreColor(finalScore),
  };
};

// ============================================
// Explanation Builder
// ============================================

interface ExplanationInput {
  baseScore: number;
  bonus: number;
  hardFail: HardFailAssessment;
  criticalPenalty?: CriticalPenaltyAssessment;
  collapsePenalty?: CategoryCollapseAssessment;
  environmentAdjustment?: EnvironmentAdjustmentSummary;
  finalScore: number;
  analysisMode: AnalysisMode;
}

function buildExplanation(input: ExplanationInput): ScoreExplanation {
  const lines: string[] = [];
  const criticalCount = input.criticalPenalty?.criticalCount ?? 0;
  const label = deriveFinalLabel(
    input.finalScore,
    criticalCount,
    input.analysisMode,
  );

  if (criticalCount > 0) {
    lines.push(
      "Critical issues detected - overall score capped until these are resolved",
    );
  } else if (input.finalScore >= 90) {
    lines.push("Excellent performance with minimal issues");
  } else if (input.finalScore >= 70) {
    lines.push("Good performance with some opportunities for improvement");
  } else if (input.finalScore >= 50) {
    lines.push("Moderate performance issues detected");
  } else if (input.finalScore >= 30) {
    lines.push("Significant performance problems requiring attention");
  } else {
    lines.push(
      "Critical performance issues detected - immediate action recommended",
    );
  }

  lines.push(`Base score: ${input.baseScore}/100`);

  if (input.bonus > 0) {
    lines.push(`Bonus for optimizations: +${input.bonus} points`);
  }

  if (input.criticalPenalty && input.criticalPenalty.penalty > 0) {
    lines.push(
      `Critical issue penalty: -${Math.round(input.criticalPenalty.penalty)} points ` +
        `(${input.criticalPenalty.criticalCount} critical issue${
          input.criticalPenalty.criticalCount > 1 ? "s" : ""
        })`,
    );
  }

  if (input.collapsePenalty && input.collapsePenalty.penalty > 0) {
    lines.push(
      `Category collapse penalty: -${Math.round(input.collapsePenalty.penalty)} points ` +
        `(${input.collapsePenalty.collapsedCategories.join(", ")} severely impacted)`,
    );
  }

  if (input.hardFail.triggered) {
    const reduction = Math.round((1 - input.hardFail.multiplier) * 100);
    lines.push(
      `Hard fail penalty: -${reduction}% ` +
        `(${input.hardFail.reasons.slice(0, 2).join(", ")})`,
    );
  }

  if (input.environmentAdjustment && input.environmentAdjustment.adjusted) {
    lines.push(
      `Environment adjustment: ${input.environmentAdjustment.reducedFindings} finding(s) ` +
        `had reduced impact due to environment limitations`,
    );
  }

  lines.push(`Final score: ${input.finalScore}/100 (${label})`);

  return {
    baseScore: input.baseScore,
    findingDeductions: 100 - input.baseScore,
    bonusApplied: input.bonus,
    criticalPenalty: input.criticalPenalty || {
      criticalCount: 0,
      penalty: 0,
      triggeringFindings: [],
    },
    collapsePenalty: input.collapsePenalty || {
      collapsedCategories: [],
      penalty: 0,
      details: {} as Record<ScoreCategory, { ratio: number; penalty: number }>,
    },
    hardFail: input.hardFail,
    environmentAdjustment: input.environmentAdjustment || {
      adjusted: false,
      reducedFindings: 0,
      penaltyReduction: 0,
      notes: [],
    },
    finalScore: input.finalScore,
    explanationLines: lines,
  };
}

export { getScoreLabel, getScoreColor };
