/**
 * Environment context model for analysis-aware findings.
 * Detected centrally and passed through the analysis pipeline.
 */

export type RuntimeEnvironment =
  | "local-dev" // localhost, 127.0.0.1, ::1
  | "preview" // Vercel preview, Netlify deploy previews, etc.
  | "staging" // staging.*, *.staging.*, etc.
  | "production" // Public production domain
  | "unknown";

export type HostType =
  | "localhost" // localhost, 127.0.0.1, ::1
  | "private-ip" // 10.x, 172.16-31.x, 192.168.x
  | "public" // Public domain or IP
  | "unknown";

export type ConfidenceLevel = "high" | "medium" | "low";

export interface FrameworkAssetPatterns {
  frameworkName: string;
  /** Patterns for framework-managed static assets */
  ownedPathPatterns: RegExp[];
  /** Patterns for runtime/polyfill/framework chunks */
  runtimeChunkPatterns: RegExp[];
  /** Patterns for framework config files */
  configPatterns: RegExp[];
}

export interface EnvironmentContext {
  // === Core Classification ===
  runtimeEnvironment: RuntimeEnvironment;
  hostType: HostType;

  // === Network Details ===
  hostname: string;
  port?: number;
  isHttps: boolean;
  isLocalDev: boolean;
  isNonStandardPort: boolean;

  // === Reliability Indicators ===
  /** Whether cache headers likely reflect production behavior */
  cacheHeadersReliable: boolean;
  /** Whether CDN is likely present based on headers/domain */
  cdnLikelyPresent: boolean;
  /** Whether this appears to be a production build (not dev mode) */
  productionLikeBuild: boolean;

  // === Framework Detection ===
  detectedFramework?: string;
  frameworkVersion?: string;
  frameworkPatterns?: FrameworkAssetPatterns;

  // === Meta ===
  detectionConfidence: ConfidenceLevel;
  /** Analysis notes/caveats to include in report */
  analysisNotes: string[];
}

/** Default context when detection hasn't run or fails */
export const DEFAULT_ENVIRONMENT_CONTEXT: EnvironmentContext = {
  runtimeEnvironment: "unknown",
  hostType: "unknown",
  hostname: "",
  isHttps: false,
  isLocalDev: false,
  isNonStandardPort: false,
  cacheHeadersReliable: true,
  cdnLikelyPresent: false,
  productionLikeBuild: true,
  detectionConfidence: "low",
  analysisNotes: [],
};

/** Standard ports that don't indicate "custom port" issues */
export const STANDARD_PORTS = new Set([80, 443, undefined]);

/** Common local development ports */
export const COMMON_DEV_PORTS = new Set([
  3000,
  3001,
  3002,
  3003, // React, Next.js, common
  4000,
  4200, // Angular
  5000,
  5173,
  5174, // Vite, Flask
  8000,
  8080,
  8888, // Generic dev servers
  9000, // Various
]);

/** Preview/staging domain patterns */
export const PREVIEW_DOMAIN_PATTERNS = [
  /\.vercel\.app$/i,
  /\.netlify\.app$/i,
  /\.pages\.dev$/i,
  /\.amplifyapp\.com$/i,
  /\.herokuapp\.com$/i,
  /\.ngrok\.io$/i,
  /\.ngrok-free\.app$/i,
  /\.loca\.lt$/i,
  /\.localtunnel\.me$/i,
  /preview\./i,
  /deploy-preview-/i,
];

export const STAGING_DOMAIN_PATTERNS = [
  /^staging\./i,
  /\.staging\./i,
  /^stage\./i,
  /\.stage\./i,
  /^uat\./i,
  /\.uat\./i,
  /^preprod\./i,
];
