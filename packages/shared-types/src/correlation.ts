import type { FindingId, FindingCategory } from "./finding";

export interface SourceLocation {
  filePath: string;
  lineNumber?: number;
  columnNumber?: number;
  lineRange?: {
    start: number;
    end: number;
  };
  codeSnippet?: string;
  highlight?: {
    start: number;
    end: number;
  };
}

export type CorrelationConfidence =
  | "definite"
  | "high"
  | "medium"
  | "low"
  | "guess";

/**
 * How the correlation was detected
 */
export type CorrelationMethod =
  | "exact-match"
  | "pattern-match"
  | "ast-analysis"
  | "import-trace"
  | "filename-match"
  | "content-search"
  | "heuristic";
/**
 * Single correlation between runtime finding and source
 */
export interface SourceCorrelation {
  id: string;
  findingId: FindingId;
  location: SourceLocation;
  confidence: CorrelationConfidence;
  method: CorrelationMethod;
  reason: string;
  componentName?: string;
  resourceUrl?: string;
}

/**
 * Grouped correlations for a finding
 */
export interface FindingCorrelations {
  /** Finding ID */
  findingId: FindingId;

  /** Finding category */
  category: FindingCategory;
  correlations: SourceCorrelation[];
  primaryCorrelation?: SourceCorrelation;
  totalLocations: number;
  affectedFiles: number;
}

export interface AssetSourceMap {
  assetUrl: string;
  assetType: "image" | "script" | "stylesheet" | "font" | "video" | "other";
  sourceFile?: string;
  usedIn: SourceLocation[];
  publicPath?: string;
  outputPath?: string;
}

export interface RouteSourceMap {
  urlPath: string;
  pageFile: string;
  layoutFiles: string[];
  components: SourceLocation[];
  routeType: "page" | "api" | "middleware" | "layout" | "error" | "loading";
  dynamicParams?: string[];
}

export interface CorrelationResult {
  analyzedUrl: string;
  projectRoot: string;
  timestamp: string;
  findingCorrelations: FindingCorrelations[];
  assetMaps: AssetSourceMap[];
  routeMaps: RouteSourceMap[];
  totalCorrelations: number;
  highConfidenceCount: number;
  correlationRate: number;
}

/**
 * Search pattern for source correlation
 */
export interface CorrelationPattern {
  type: "url" | "path" | "filename" | "content" | "import" | "component";
  pattern: string | RegExp;
  caseSensitive: boolean;
  fileExtensions: string[];
  excludeDirs: string[];
}

/**
 * Default exclude directories for source scanning
 */
export const DEFAULT_EXCLUDE_DIRS: string[] = [
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".git",
  "coverage",
  ".turbo",
  ".cache",
  "out",
  ".svelte-kit",
  ".astro",
];

/**
 * Default file extensions for source scanning
 */
export const DEFAULT_SOURCE_EXTENSIONS: string[] = [
  // JavaScript/TypeScript
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",

  // Vue
  ".vue",

  // Svelte
  ".svelte",

  // Astro
  ".astro",

  // Styles
  ".css",
  ".scss",
  ".sass",
  ".less",

  // Config
  ".json",
  ".yaml",
  ".yml",
];

export const IMAGE_EXTENSIONS: string[] = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".bmp",
];

export interface CorrelationSearchOptions {
  projectRoot: string;
  extensions: string[];
  excludeDirs: string[];
  maxDepth: number;
  maxFileSize: number;
  concurrency: number;
  timeout: number;
}

export const DEFAULT_CORRELATION_OPTIONS: CorrelationSearchOptions = {
  projectRoot: ".",
  extensions: DEFAULT_SOURCE_EXTENSIONS,
  excludeDirs: DEFAULT_EXCLUDE_DIRS,
  maxDepth: 5,
  maxFileSize: 256 * 1024,
  concurrency: 1,
  timeout: 10000,
};
