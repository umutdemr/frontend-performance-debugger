import type { Finding } from "@fpd/shared-types";

export type ImpactLevel = "blocker" | "high" | "medium" | "low" | "cosmetic";
export type ConfidenceLevel = "high" | "medium" | "low";
export type ScoreCategory =
  | "performance"
  | "network"
  | "architecture"
  | "seoSecurity";

export interface ScoringRule {
  basePenalty: number;
  impact: ImpactLevel;
  confidence: ConfidenceLevel;
  scoreCategory: ScoreCategory;
  canBeClustered: boolean;
  rootCauseFamily?: string;
  hardFailContribution?: number;
  positiveCredit?: number;
}

export interface ScoreCluster {
  ruleId: string;
  rule: ScoringRule;
  count: number;
  findings: Finding[];
  totalPenalty: number;
  metricFactorAverage: number;
}

export interface ScoreBreakdown {
  performance: { max: number; current: number };
  network: { max: number; current: number };
  architecture: { max: number; current: number };
  seoSecurity: { max: number; current: number };
}

export interface HardFailAssessment {
  triggered: boolean;
  multiplier: number;
  reasons: string[];
}

export interface FinalScoreResult {
  finalScore: number;
  baseScore: number;
  breakdown: ScoreBreakdown;
  topRootCauses: string[];
  clusters: ScoreCluster[];
  hardFail: HardFailAssessment;
  totalBonusApplied: number;
}
