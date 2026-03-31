import type { ScoringRule } from "./scoring.types.js";

export const SCORING_RULES: Record<string, ScoringRule> = {
  // --- PERFORMANCE ---
  "perf-lcp-poor": {
    basePenalty: 15,
    impact: "blocker",
    confidence: "high",
    scoreCategory: "performance",
    canBeClustered: false,
    rootCauseFamily: "Largest Contentful Paint is severely delayed",
    hardFailContribution: 0.85,
  },
  "perf-cls-poor": {
    basePenalty: 12,
    impact: "high",
    confidence: "high",
    scoreCategory: "performance",
    canBeClustered: false,
    rootCauseFamily: "High layout instability (CLS)",
  },
  "perf-ttfb-good": {
    basePenalty: 0,
    impact: "low",
    confidence: "high",
    scoreCategory: "performance",
    canBeClustered: false,
    positiveCredit: 2,
  },
  "render-blocking-stylesheets": {
    basePenalty: 6,
    impact: "high",
    confidence: "high",
    scoreCategory: "performance",
    canBeClustered: true,
    rootCauseFamily:
      "Multiple render-blocking stylesheets delaying first paint",
  },
  "render-blocking-scripts": {
    basePenalty: 8,
    impact: "high",
    confidence: "high",
    scoreCategory: "performance",
    canBeClustered: true,
    rootCauseFamily: "Synchronous JavaScript blocking DOM parsing",
  },

  // --- NETWORK ---
  "network-request-5xx": {
    basePenalty: 10,
    impact: "blocker",
    confidence: "high",
    scoreCategory: "network",
    canBeClustered: true,
    rootCauseFamily: "Server errors (5xx) affecting reliability",
    hardFailContribution: 0.8,
  },
  "network-total-size-large": {
    basePenalty: 12,
    impact: "high",
    confidence: "high",
    scoreCategory: "network",
    canBeClustered: false,
    rootCauseFamily: "Massive total page payload",
  },
  "network-request-very-slow": {
    basePenalty: 3,
    impact: "medium",
    confidence: "medium",
    scoreCategory: "network",
    canBeClustered: true,
    rootCauseFamily: "Slow individual network requests",
  },
  "network-resource-very-large": {
    basePenalty: 4,
    impact: "medium",
    confidence: "high",
    scoreCategory: "network",
    canBeClustered: true,
    rootCauseFamily: "Unoptimized, overly large resources",
  },

  // --- ARCHITECTURE (Assets & Cache & Local) ---
  "cache-static-assets-not-cached": {
    basePenalty: 2,
    impact: "medium",
    confidence: "high",
    scoreCategory: "architecture",
    canBeClustered: true,
    rootCauseFamily: "Static assets missing long-term cache headers",
  },
  "assets-images-no-dimensions": {
    basePenalty: 1.5,
    impact: "low",
    confidence: "high",
    scoreCategory: "architecture",
    canBeClustered: true,
    rootCauseFamily: "Images missing dimensions causing layout shifts",
  },
  "fs-node-modules-committed": {
    basePenalty: 15,
    impact: "blocker",
    confidence: "high",
    scoreCategory: "architecture",
    canBeClustered: false,
    rootCauseFamily: "node_modules committed to repository",
    hardFailContribution: 0.7,
  },

  // --- SEO & SECURITY ---
  "basic-url-no-https": {
    basePenalty: 15,
    impact: "blocker",
    confidence: "high",
    scoreCategory: "seoSecurity",
    canBeClustered: false,
    rootCauseFamily: "Missing HTTPS encryption",
    hardFailContribution: 0.75,
  },
  "security-sensitive-params": {
    basePenalty: 15,
    impact: "blocker",
    confidence: "high",
    scoreCategory: "seoSecurity",
    canBeClustered: true,
    rootCauseFamily: "Sensitive secrets leaked in URL",
    hardFailContribution: 0.6, // Catastrophic
  },
};

export const FALLBACK_RULE: ScoringRule = {
  basePenalty: 1,
  impact: "low",
  confidence: "medium",
  scoreCategory: "performance",
  canBeClustered: true,
};
