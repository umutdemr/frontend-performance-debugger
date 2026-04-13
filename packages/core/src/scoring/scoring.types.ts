import type { Finding } from "@fpd/shared-types";

export type ImpactLevel = "blocker" | "high" | "medium" | "low" | "cosmetic";

export type ConfidenceLevel = "high" | "medium" | "low";

export type ScoreCategory =
  | "performance"
  | "network"
  | "architecture"
  | "seoSecurity";

export type RootCauseFamily =
  | "render-blocking"
  | "large-assets"
  | "network-issues"
  | "caching"
  | "javascript"
  | "security"
  | "seo"
  | "general";

export type AnalysisMode = "runtime" | "filesystem";

export interface ScoringRule {
  basePenalty: number;
  scoreCategory: ScoreCategory;
  impact: ImpactLevel;
  confidence: ConfidenceLevel;
  rootCauseFamily?: RootCauseFamily;
  canBeClustered?: boolean;
  positiveCredit?: number;
  hardFailContribution?: number;

  reducedInLocalDev?: boolean;
  dependsOnCacheHeaders?: boolean;
  isCriticalIssue?: boolean;
}

export interface ScoreCluster {
  ruleId: string;
  rule: ScoringRule;
  count: number;
  findings: Finding[];
  totalPenalty: number;
  metricFactorAverage: number;

  environmentReduced?: boolean;
  originalPenalty?: number;
  adjustmentReason?: string;
}

export interface CategoryBreakdown {
  max: number;
  current: number;

  collapsed?: boolean;
  collapsePenalty?: number;
  findingCount?: number;
  notes?: string[];
}

export interface ScoreBreakdown {
  performance: CategoryBreakdown;
  network: CategoryBreakdown;
  architecture: CategoryBreakdown;
  seoSecurity: CategoryBreakdown;
}

export interface HardFailAssessment {
  triggered: boolean;
  multiplier: number;
  reasons: string[];
}

export interface ScoringEnvironmentContext {
  isLocalDev: boolean;
  cacheHeadersReliable: boolean;
  productionLikeBuild: boolean;
  runtimeEnvironment:
    | "local-dev"
    | "preview"
    | "staging"
    | "production"
    | "unknown";
}

export interface CriticalPenaltyAssessment {
  criticalCount: number;
  penalty: number;
  triggeringFindings: string[];
}

export interface CategoryCollapseAssessment {
  collapsedCategories: ScoreCategory[];
  penalty: number;
  details: Record<ScoreCategory, { ratio: number; penalty: number }>;
}

export interface EnvironmentAdjustmentSummary {
  adjusted: boolean;
  reducedFindings: number;
  penaltyReduction: number;
  notes: string[];
}

export interface ScoreExplanation {
  baseScore: number;
  findingDeductions: number;
  bonusApplied: number;
  criticalPenalty: CriticalPenaltyAssessment;
  collapsePenalty: CategoryCollapseAssessment;
  hardFail: HardFailAssessment;
  environmentAdjustment: EnvironmentAdjustmentSummary;
  finalScore: number;
  explanationLines: string[];
}

/**
 * Final score result with all details
 */
export interface FinalScoreResult {
  finalScore: number;
  baseScore: number;
  breakdown: ScoreBreakdown;
  topRootCauses: string[];
  clusters: ScoreCluster[];
  hardFail: HardFailAssessment;
  totalBonusApplied: number;

  criticalPenalty?: CriticalPenaltyAssessment;
  collapsePenalty?: CategoryCollapseAssessment;
  environmentAdjustment?: EnvironmentAdjustmentSummary;
  explanation?: ScoreExplanation;

  label?: string;
  color?: string;
}

/**
 * Scoring options for customization
 */
export interface ScoringOptions {
  applyCriticalPenalty?: boolean;
  applyCollapsePenalty?: boolean;
  applyEnvironmentAdjustments?: boolean;
  environmentContext?: ScoringEnvironmentContext;
  includeExplanation?: boolean;

  analysisMode?: AnalysisMode;
}
