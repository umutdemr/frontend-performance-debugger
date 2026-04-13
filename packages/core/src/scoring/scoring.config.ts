import type { ScoringRule, ScoreCategory } from "./scoring.types.js";

export const CATEGORY_BUDGETS: Record<ScoreCategory, number> = {
  performance: 40,
  network: 25,
  architecture: 20,
  seoSecurity: 15,
};

export const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 1.0,
  warning: 0.45,
  info: 0.15,
  success: 0.0,
};

export const IMPACT_WEIGHTS: Record<string, number> = {
  blocker: 1.0,
  high: 0.8,
  medium: 0.5,
  low: 0.25,
  cosmetic: 0.1,
};

export const CONFIDENCE_WEIGHTS: Record<string, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

export const MAX_BONUS = 8;

export const CATEGORY_COLLAPSE_THRESHOLD = 0.2;
/**
 * Category collapse penalty factor - applied to remaining score
 */
export const CATEGORY_COLLAPSE_PENALTY_FACTOR = 0.15;

export const MAX_COLLAPSE_PENALTY = 25;

export const CRITICAL_PENALTY_PER_ISSUE = 5;

export const MAX_CRITICAL_PENALTY = 25;

/**
 * Environment adjustment factor for local dev
 */
export const LOCAL_DEV_PENALTY_REDUCTION = 0.5;

export const UNRELIABLE_CACHE_PENALTY_REDUCTION = 0.6;

/**
 * Fallback scoring rule for unknown finding IDs
 */
export const FALLBACK_RULE: ScoringRule = {
  basePenalty: 2,
  scoreCategory: "architecture",
  impact: "low",
  confidence: "medium",
  canBeClustered: false,
  reducedInLocalDev: false,
  dependsOnCacheHeaders: false,
  isCriticalIssue: false,
};

export const SCORING_RULES: Record<string, ScoringRule> = {
  // ==========================================
  // Render-Blocking Resources
  // ==========================================
  "render-blocking-many-stylesheets": {
    basePenalty: 12,
    scoreCategory: "performance",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    hardFailContribution: 0.85,
    isCriticalIssue: true,
    reducedInLocalDev: true,
  },
  "render-blocking-stylesheets": {
    basePenalty: 6,
    scoreCategory: "performance",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "render-blocking-scripts": {
    basePenalty: 10,
    scoreCategory: "performance",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    hardFailContribution: 0.9,
    isCriticalIssue: true,
    reducedInLocalDev: true,
  },
  "render-blocking-scripts-optimized": {
    basePenalty: 0,
    scoreCategory: "performance",
    impact: "cosmetic",
    confidence: "high",
    positiveCredit: 2,
    canBeClustered: false,
  },
  "render-blocking-no-critical-css": {
    basePenalty: 5,
    scoreCategory: "performance",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "render-blocking-too-much-inline-css": {
    basePenalty: 4,
    scoreCategory: "performance",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
  },
  "render-blocking-critical-css-good": {
    basePenalty: 0,
    scoreCategory: "performance",
    impact: "cosmetic",
    confidence: "high",
    positiveCredit: 2,
    canBeClustered: false,
  },

  // ==========================================
  // Network & Page Size
  // ==========================================
  "network-total-size-large": {
    basePenalty: 15,
    scoreCategory: "network",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: false,
    hardFailContribution: 0.8,
    isCriticalIssue: true,
    reducedInLocalDev: true,
  },
  "network-total-size-medium": {
    basePenalty: 8,
    scoreCategory: "network",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "network-large-resources": {
    basePenalty: 6,
    scoreCategory: "network",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-resource-very-large": {
    basePenalty: 5,
    scoreCategory: "network",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-image-large": {
    basePenalty: 3,
    scoreCategory: "network",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-request-count": {
    basePenalty: 5,
    scoreCategory: "network",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "network-slow-requests": {
    basePenalty: 4,
    scoreCategory: "network",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "network-issues",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-request-very-slow": {
    basePenalty: 4,
    scoreCategory: "network",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "network-issues",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-server-errors": {
    basePenalty: 15,
    scoreCategory: "network",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: false,
    hardFailContribution: 0.75,
    isCriticalIssue: true,
    reducedInLocalDev: false,
  },
  "network-client-errors": {
    basePenalty: 6,
    scoreCategory: "network",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-request-4xx": {
    basePenalty: 4,
    scoreCategory: "network",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "network-request-5xx": {
    basePenalty: 10,
    scoreCategory: "network",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: true,
    isCriticalIssue: true,
    reducedInLocalDev: false,
  },
  "network-no-metrics": {
    basePenalty: 8,
    scoreCategory: "network",
    impact: "high",
    confidence: "medium",
    rootCauseFamily: "network-issues",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "network-framework-resources": {
    basePenalty: 0,
    scoreCategory: "network",
    impact: "cosmetic",
    confidence: "high",
    canBeClustered: false,
  },

  // ==========================================
  // Caching
  // ==========================================
  "cache-static-assets-not-cached": {
    basePenalty: 6,
    scoreCategory: "network",
    impact: "high",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
    dependsOnCacheHeaders: true,
    reducedInLocalDev: true,
  },
  "cache-some-assets-not-cached": {
    basePenalty: 3,
    scoreCategory: "network",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
    dependsOnCacheHeaders: true,
    reducedInLocalDev: true,
  },
  "cache-static-assets-cached": {
    basePenalty: 0,
    scoreCategory: "network",
    impact: "cosmetic",
    confidence: "high",
    positiveCredit: 2,
    canBeClustered: false,
  },
  "cache-html-check-limitation": {
    basePenalty: 1,
    scoreCategory: "network",
    impact: "low",
    confidence: "low",
    rootCauseFamily: "caching",
    canBeClustered: false,
    dependsOnCacheHeaders: true,
    reducedInLocalDev: true,
  },
  "cache-etag-info": {
    basePenalty: 1,
    scoreCategory: "network",
    impact: "low",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
    dependsOnCacheHeaders: true,
    reducedInLocalDev: true,
  },
  "cache-many-api-requests": {
    basePenalty: 2,
    scoreCategory: "network",
    impact: "low",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "cache-framework-managed-assets": {
    basePenalty: 0,
    scoreCategory: "network",
    impact: "cosmetic",
    confidence: "high",
    canBeClustered: false,
  },

  // ==========================================
  // URL & Security
  // ==========================================
  "basic-url-no-https": {
    basePenalty: 15,
    scoreCategory: "seoSecurity",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "security",
    canBeClustered: false,
    hardFailContribution: 0.7,
    isCriticalIssue: true,
    reducedInLocalDev: true,
  },
  "basic-url-http-local": {
    basePenalty: 0,
    scoreCategory: "seoSecurity",
    impact: "cosmetic",
    confidence: "high",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "basic-url-port-production": {
    basePenalty: 5,
    scoreCategory: "seoSecurity",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "security",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "basic-url-port-preview": {
    basePenalty: 1,
    scoreCategory: "seoSecurity",
    impact: "low",
    confidence: "medium",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "basic-url-port-local-unusual": {
    basePenalty: 0,
    scoreCategory: "seoSecurity",
    impact: "cosmetic",
    confidence: "high",
    canBeClustered: false,
  },
  "basic-url-too-long": {
    basePenalty: 3,
    scoreCategory: "seoSecurity",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "seo",
    canBeClustered: false,
  },
  "basic-url-long": {
    basePenalty: 1,
    scoreCategory: "seoSecurity",
    impact: "low",
    confidence: "high",
    rootCauseFamily: "seo",
    canBeClustered: false,
  },
  "basic-url-no-trailing-slash": {
    basePenalty: 1,
    scoreCategory: "seoSecurity",
    impact: "low",
    confidence: "medium",
    rootCauseFamily: "seo",
    canBeClustered: false,
  },
  "basic-url-www-usage": {
    basePenalty: 1,
    scoreCategory: "seoSecurity",
    impact: "low",
    confidence: "high",
    rootCauseFamily: "seo",
    canBeClustered: false,
  },
  "basic-url-complex-query": {
    basePenalty: 3,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
    dependsOnCacheHeaders: true,
  },
  "basic-url-many-params": {
    basePenalty: 2,
    scoreCategory: "architecture",
    impact: "low",
    confidence: "medium",
    rootCauseFamily: "caching",
    canBeClustered: false,
  },

  // ==========================================
  // Performance Metrics
  // ==========================================
  "perf-fcp-slow": {
    basePenalty: 8,
    scoreCategory: "performance",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "perf-lcp-slow": {
    basePenalty: 10,
    scoreCategory: "performance",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: false,
    hardFailContribution: 0.85,
    isCriticalIssue: true,
    reducedInLocalDev: true,
  },
  "perf-cls-high": {
    basePenalty: 6,
    scoreCategory: "performance",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "render-blocking",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "perf-ttfb-slow": {
    basePenalty: 6,
    scoreCategory: "network",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "network-issues",
    canBeClustered: false,
    reducedInLocalDev: true,
  },

  // ==========================================
  // Architecture & General
  // ==========================================
  "arch-bundle-too-large": {
    basePenalty: 8,
    scoreCategory: "architecture",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "javascript",
    canBeClustered: false,
    reducedInLocalDev: true,
  },
  "arch-unused-code": {
    basePenalty: 4,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "javascript",
    canBeClustered: true,
    reducedInLocalDev: true,
  },

  // ==========================================
  // Filesystem / Local Scan
  // ==========================================
  "fs-js-files-critical": {
    basePenalty: 8,
    scoreCategory: "architecture",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "javascript",
    canBeClustered: true,
    isCriticalIssue: true,
  },
  "fs-js-files-warning": {
    basePenalty: 4,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "javascript",
    canBeClustered: true,
  },
  "fs-images-large": {
    basePenalty: 8,
    scoreCategory: "performance",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "large-assets",
    canBeClustered: true,
    isCriticalIssue: true,
  },
  "fs-node-modules-detected": {
    basePenalty: 6,
    scoreCategory: "architecture",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "general",
    canBeClustered: false,
    isCriticalIssue: true,
  },
  "fs-node-modules-committed": {
    basePenalty: 6,
    scoreCategory: "architecture",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "general",
    canBeClustered: false,
    isCriticalIssue: true,
  },
  "fs-env-file-detected": {
    basePenalty: 12,
    scoreCategory: "seoSecurity",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "security",
    canBeClustered: false,
    isCriticalIssue: true,
  },
  "fs-env-exposed": {
    basePenalty: 12,
    scoreCategory: "seoSecurity",
    impact: "blocker",
    confidence: "high",
    rootCauseFamily: "security",
    canBeClustered: false,
    isCriticalIssue: true,
  },
  "fs-build-artifacts-detected": {
    basePenalty: 3,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "general",
    canBeClustered: false,
  },
  "fs-build-artifacts-committed": {
    basePenalty: 3,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "general",
    canBeClustered: false,
  },
  "fs-no-gitignore": {
    basePenalty: 3,
    scoreCategory: "seoSecurity",
    impact: "medium",
    confidence: "high",
    rootCauseFamily: "security",
    canBeClustered: false,
  },
  "fs-deps-too-many-critical": {
    basePenalty: 10,
    scoreCategory: "architecture",
    impact: "high",
    confidence: "high",
    rootCauseFamily: "javascript",
    canBeClustered: false,
    isCriticalIssue: true,
  },
  "fs-deps-many": {
    basePenalty: 4,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "javascript",
    canBeClustered: false,
  },
  "fs-deps-unused": {
    basePenalty: 2,
    scoreCategory: "architecture",
    impact: "low",
    confidence: "low",
    rootCauseFamily: "javascript",
    canBeClustered: true,
    reducedInLocalDev: true,
  },
  "fs-deps-heavy": {
    basePenalty: 2,
    scoreCategory: "architecture",
    impact: "low",
    confidence: "medium",
    rootCauseFamily: "javascript",
    canBeClustered: true,
  },
  "fs-pkg-missing-scripts": {
    basePenalty: 1,
    scoreCategory: "architecture",
    impact: "low",
    confidence: "high",
    rootCauseFamily: "general",
    canBeClustered: false,
  },
  "fs-imports-heavy": {
    basePenalty: 3,
    scoreCategory: "architecture",
    impact: "medium",
    confidence: "medium",
    rootCauseFamily: "javascript",
    canBeClustered: true,
  },
  "fs-bundle-estimation": {
    basePenalty: 1,
    scoreCategory: "architecture",
    impact: "low",
    confidence: "low",
    rootCauseFamily: "javascript",
    canBeClustered: false,
  },
};

/**
 * Get scoring rule for a finding ID
 */
export function getScoringRule(findingId: string): ScoringRule {
  if (SCORING_RULES[findingId]) {
    return SCORING_RULES[findingId];
  }

  for (const [ruleId, rule] of Object.entries(SCORING_RULES)) {
    if (findingId.startsWith(ruleId)) {
      return rule;
    }
  }

  return FALLBACK_RULE;
}

/**
 * Get score label based on final score
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  if (score >= 30) return "Poor";
  return "Critical";
}

/**
 * Get score color for UI
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return "#0cce6b"; // Green
  if (score >= 70) return "#ffa400"; // Orange
  if (score >= 50) return "#ff8c00"; // Dark orange
  return "#ff4e42"; // Red
}
