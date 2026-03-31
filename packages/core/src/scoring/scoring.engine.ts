import type { Finding } from "@fpd/shared-types";
import { SCORING_RULES, FALLBACK_RULE } from "./scoring.config.js";
import type {
  ScoreCluster,
  ScoreBreakdown,
  FinalScoreResult,
  ImpactLevel,
  ConfidenceLevel,
  HardFailAssessment,
} from "./scoring.types.js";

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  warning: 0.45,
  info: 0.15,
  success: 0.0,
};

const IMPACT_WEIGHTS: Record<ImpactLevel, number> = {
  blocker: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.25,
  cosmetic: 0.1,
};

const CONFIDENCE_WEIGHTS: Record<ConfidenceLevel, number> = {
  high: 1.0,
  medium: 0.75,
  low: 0.45,
};

const MAX_BONUS = 8;
const CATEGORY_BUDGETS = {
  performance: 40,
  network: 25,
  architecture: 20,
  seoSecurity: 15,
};

const clamp = (val: number, min: number, max: number) =>
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
    const data = metricEvidence.data as any;
    if (data.value && data.threshold && data.threshold > 0) {
      return clamp(data.value / data.threshold, 1.0, 2.5);
    }
  }
  return 1.0;
};

const buildScoreClusters = (findings: Finding[]): ScoreCluster[] => {
  const clusterMap = new Map<string, ScoreCluster>();

  for (const finding of findings) {
    if (finding.severity === "success") continue;

    const rule = SCORING_RULES[finding.id] || FALLBACK_RULE;
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
    const impWeight = IMPACT_WEIGHTS[cluster.rule.impact];
    const confWeight = CONFIDENCE_WEIGHTS[cluster.rule.confidence];
    const repFactor = repetitionFactor(cluster.count);

    cluster.totalPenalty =
      cluster.rule.basePenalty *
      sevWeight *
      impWeight *
      confWeight *
      repFactor *
      avgMetricFactor;
  }

  return Array.from(clusterMap.values());
};

const calculatePositiveCredits = (findings: Finding[]): number => {
  let bonus = 0;
  for (const finding of findings) {
    if (finding.severity === "success") {
      const rule = SCORING_RULES[finding.id];
      if (rule && rule.positiveCredit) {
        bonus += rule.positiveCredit;
      }
    }
  }
  return Math.min(bonus, MAX_BONUS);
};

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
      assessment.triggered = true;
      assessment.multiplier *= cluster.rule.hardFailContribution;
      assessment.reasons.push(cluster.rule.rootCauseFamily || cluster.ruleId);
    }
  }

  assessment.multiplier = clamp(assessment.multiplier, 0.5, 1.0);
  return assessment;
};

export const calculateFinalScore = (findings: Finding[]): FinalScoreResult => {
  const clusters = buildScoreClusters(findings);

  const penalties = {
    performance: 0,
    network: 0,
    architecture: 0,
    seoSecurity: 0,
  };

  for (const cluster of clusters) {
    penalties[cluster.rule.scoreCategory] += cluster.totalPenalty;
  }

  const breakdown: ScoreBreakdown = {
    performance: {
      max: CATEGORY_BUDGETS.performance,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.performance - penalties.performance,
      ),
    },
    network: {
      max: CATEGORY_BUDGETS.network,
      current: Math.max(0, CATEGORY_BUDGETS.network - penalties.network),
    },
    architecture: {
      max: CATEGORY_BUDGETS.architecture,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.architecture - penalties.architecture,
      ),
    },
    seoSecurity: {
      max: CATEGORY_BUDGETS.seoSecurity,
      current: Math.max(
        0,
        CATEGORY_BUDGETS.seoSecurity - penalties.seoSecurity,
      ),
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
  const finalScore = Math.round(scoreWithBonus * hardFail.multiplier);

  const topRootCauses = clusters
    .sort((a, b) => b.totalPenalty - a.totalPenalty)
    .filter((c) => c.totalPenalty > 1)
    .slice(0, 4)
    .map((c) => c.rule.rootCauseFamily || `Issues with ${c.ruleId}`);

  return {
    finalScore,
    baseScore,
    breakdown,
    topRootCauses,
    clusters,
    hardFail,
    totalBonusApplied: bonus,
  };
};
