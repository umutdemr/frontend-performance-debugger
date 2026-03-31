import {
  createEngine,
  BasicUrlAnalyzer,
  SecurityAnalyzer,
  SeoAnalyzer,
  PerformanceAnalyzer,
  NetworkAnalyzer,
  AssetsAnalyzer,
  CacheAnalyzer,
  RenderBlockingAnalyzer,
  correlateFindings,
} from "@fpd/core";
import type { Report, CorrelationResult } from "@fpd/shared-types";
import { formatAsJson } from "../formatters/json.js";
import { formatAsTerminal } from "../formatters/terminal.js";
import { formatAsMarkdown } from "../formatters/markdown.js";

/**
 * Output format options
 */
export type OutputFormat = "terminal" | "json" | "markdown";

/**
 * Analyze command options
 */
export interface AnalyzeCommandOptions {
  /** Output format */
  format?: OutputFormat;

  /** Output to file instead of stdout */
  output?: string;

  /** Show verbose output */
  verbose?: boolean;

  /** Local project root directory for source correlation */
  project?: string;
}

/**
 * Run the analyze command
 */
export async function analyzeCommand(
  url: string,
  options: AnalyzeCommandOptions = {},
): Promise<void> {
  const { format = "terminal", verbose = false, project } = options;

  // Validate URL
  if (!url) {
    console.error("Error: URL is required");
    console.error("Usage: fpd analyze <url>");
    process.exit(1);
  }

  // Normalize URL
  const normalizedUrl = normalizeUrl(url);

  if (verbose) {
    console.log(`Analyzing: ${normalizedUrl}\n`);
    if (project) {
      console.log(`Project root: ${project}`);
      console.log(`Source correlation mode enabled\n`);
    }
  }

  try {
    // Create engine and register analyzers
    const engine = createEngine({ verbose });

    // Register all analyzers
    engine.addAnalyzer(new BasicUrlAnalyzer());
    engine.addAnalyzer(new SecurityAnalyzer());
    engine.addAnalyzer(new SeoAnalyzer());
    engine.addAnalyzer(new PerformanceAnalyzer());
    engine.addAnalyzer(new NetworkAnalyzer());
    engine.addAnalyzer(new AssetsAnalyzer());
    engine.addAnalyzer(new CacheAnalyzer());
    engine.addAnalyzer(new RenderBlockingAnalyzer());

    let report: Report = await engine.analyze(normalizedUrl);

    // Source Correlation
    if (project) {
      if (verbose) {
        console.log("Running source code correlation...");
      }

      const correlationResult: CorrelationResult = await correlateFindings(
        report.findings,
        normalizedUrl,
        project,
      );
      report = {
        ...report,
        correlationResult,
      };

      if (verbose) {
        console.log(
          `Correlation complete: ${correlationResult.highConfidenceCount} high confidence matches found`,
        );
        console.log(
          `Success rate: ${Math.round(correlationResult.correlationRate * 100)}%\n`,
        );
      }
    }

    // Format and output
    const output = formatReport(report, format);

    if (options.output) {
      await writeToFile(options.output, output);
      console.log(`Report saved to: ${options.output}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error(
      "Analysis failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

/**
 * Normalize URL (add https:// if missing)
 */
function normalizeUrl(url: string): string {
  // Local addresses (localhost, 127.0.0.1) should use http
  if (
    (url.includes("localhost:") || url.match(/^\d+\.\d+\.\d+\.\d+:/)) &&
    !url.startsWith("http://") &&
    !url.startsWith("https://")
  ) {
    return `http://${url}`;
  }

  // Regular URLs use https by default
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

/**
 * Format report based on output format
 */
function formatReport(report: Report, format: OutputFormat): string {
  switch (format) {
    case "json":
      return formatAsJson(report);
    case "markdown":
      return formatAsMarkdown(report);
    case "terminal":
    default:
      return formatAsTerminal(report);
  }
}

/**
 * Write output to file
 */
async function writeToFile(filePath: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, content, "utf-8");
}
