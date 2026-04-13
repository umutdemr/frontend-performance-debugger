import type { ConfidenceLevel } from "./environment";

/**
 * Ownership category (short form)
 */
export type OwnershipCategory =
  | "app"
  | "framework"
  | "config"
  | "infra"
  | "third-party"
  | "unknown";

/**
 * Ownership type (hyphenated form for backward compatibility)
 */
export type OwnershipType =
  | "app-owned"
  | "framework-owned"
  | "config-owned"
  | "infra-owned"
  | "third-party"
  | "unknown";

/**
 * Convert between formats
 */
export function categoryToType(category: OwnershipCategory): OwnershipType {
  const mapping: Record<OwnershipCategory, OwnershipType> = {
    app: "app-owned",
    framework: "framework-owned",
    config: "config-owned",
    infra: "infra-owned",
    "third-party": "third-party",
    unknown: "unknown",
  };
  return mapping[category];
}

export function typeToCategory(type: OwnershipType): OwnershipCategory {
  const mapping: Record<OwnershipType, OwnershipCategory> = {
    "app-owned": "app",
    "framework-owned": "framework",
    "config-owned": "config",
    "infra-owned": "infra",
    "third-party": "third-party",
    unknown: "unknown",
  };
  return mapping[type];
}

/**
 * Ownership hint with full details
 */
export interface OwnershipHint {
  /** Owner type (OwnershipType format) */
  type: OwnershipType;
  /** Confidence level */
  confidence: ConfidenceLevel;
  /** Human-readable reason */
  reason?: string;
  /** Suggested owner/team */
  suggestedOwner?: string;
}

/** Default ownership */
export const UNKNOWN_OWNERSHIP: OwnershipHint = {
  type: "unknown",
  confidence: "low",
};

/**
 * URL patterns for ownership detection
 */
export interface OwnershipPattern {
  type: OwnershipType;
  patterns: RegExp[];
  reason: string;
}

export const COMMON_OWNERSHIP_PATTERNS: OwnershipPattern[] = [
  {
    type: "third-party",
    patterns: [
      /^https?:\/\/(www\.)?google-analytics\.com/i,
      /^https?:\/\/(www\.)?googletagmanager\.com/i,
      /^https?:\/\/fonts\.googleapis\.com/i,
      /^https?:\/\/fonts\.gstatic\.com/i,
      /^https?:\/\/cdn\.jsdelivr\.net/i,
    ],
    reason: "External third-party service",
  },
  {
    type: "framework-owned",
    patterns: [
      /\/_next\/static\/chunks\/(webpack|framework|main|polyfills)/i,
      /\/_next\/static\/runtime\//i,
      /\/_nuxt\//i,
      /\/@vite\//i,
    ],
    reason: "Framework-managed asset",
  },
  {
    type: "app-owned",
    patterns: [/\/images\//i, /\/assets\//i, /\/public\//i, /\/components\//i],
    reason: "Application source",
  },
];

export function createOwnership(
  type: OwnershipType,
  reason?: string,
): OwnershipHint {
  return {
    type,
    confidence: "high",
    reason,
  };
}
