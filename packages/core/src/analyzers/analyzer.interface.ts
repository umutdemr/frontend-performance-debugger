import type { Finding, Category } from "@fpd/shared-types";

export interface AnalyzerContext {
  /** URL being analyzed */
  url: string;

  /** Raw page data (will be expanded when Playwright is added) */
  pageData?: Record<string, unknown>;

  /** Analysis options */
  options?: AnalyzerOptions;
}

// Options that can be passed to analyzers
export interface AnalyzerOptions {
  /** Enable verbose logging */
  verbose?: boolean;

  /** Timeout in milliseconds */
  timeout?: number;

  /** Local scan path (for file system analyzer) */
  scanPath?: string;
}

// Result from a single analyzer

export interface AnalyzerResult {
  /** Which analyzer produced this result */
  analyzerName: string;

  /** Findings discovered by this analyzer */
  findings: Finding[];

  /** How long this analyzer took (ms) */
  duration: number;

  /** Any errors encountered (non-fatal) */
  errors?: string[];
}

//Interface that all analyzers must implement

export interface Analyzer {
  /** Unique name for this analyzer */
  readonly name: string;

  /** Human-readable description */
  readonly description: string;

  /** Which categories this analyzer covers */
  readonly categories: Category[];

  /**
   * Run the analysis
   * @param context - Analysis context with URL and page data
   * @returns Analysis result with findings
   */
  analyze(context: AnalyzerContext): Promise<AnalyzerResult>;
}

export type AnalyzerConstructor = new () => Analyzer;
