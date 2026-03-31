import { createEngine, FileSystemAnalyzer } from "@fpd/core";
import type { Report } from "@fpd/shared-types";
import { formatAsJson } from "../formatters/json.js";
import { formatAsTerminal } from "../formatters/terminal.js";
import { formatAsMarkdown } from "../formatters/markdown.js";

/**
 * Output format options
 */
export type ScanOutputFormat = "terminal" | "json" | "markdown";

/**
 * Scan command options
 */
export interface ScanCommandOptions {
  format?: ScanOutputFormat;
  output?: string;
  verbose?: boolean;
}

/**
 * Run the scan command (local static analysis)
 */
export async function scanCommand(
  path: string,
  options: ScanCommandOptions = {},
): Promise<void> {
  const { format = "terminal", verbose = false } = options;

  if (!path) {
    console.error("Error: Path is required");
    console.error("Usage: fpd scan <path>");
    process.exit(1);
  }

  try {
    const engine = createEngine({ verbose });

    // Only register FileSystemAnalyzer
    engine.addAnalyzer(new FileSystemAnalyzer());

    const report = await engine.analyze("local-scan", {
      scanPath: path,
    });

    const output = formatReport(report, format);

    if (options.output) {
      await writeToFile(options.output, output);
      console.log(`Report saved to: ${options.output}`);
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error(
      "Scan failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

/**
 * Format report
 */
function formatReport(report: Report, format: ScanOutputFormat): string {
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
