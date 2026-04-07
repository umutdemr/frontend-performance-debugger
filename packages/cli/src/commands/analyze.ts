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
import { startViewerServer } from "../viewer/viewer-server.js";

export type OutputFormat = "terminal" | "json" | "markdown";

export interface AnalyzeCommandOptions {
  format?: OutputFormat;
  output?: string;
  verbose?: boolean;
  project?: string;
  open?: boolean;
}

const ANALYZERS = [
  BasicUrlAnalyzer,
  SecurityAnalyzer,
  SeoAnalyzer,
  PerformanceAnalyzer,
  NetworkAnalyzer,
  AssetsAnalyzer,
  CacheAnalyzer,
  RenderBlockingAnalyzer,
] as const;

const FORMATTERS: Record<OutputFormat, (report: Report) => string> = {
  json: formatAsJson,
  markdown: formatAsMarkdown,
  terminal: formatAsTerminal,
};

const BROWSER_COMMANDS: Record<string, (url: string) => string> = {
  win32: (url) => `start "" "${url}"`,
  darwin: (url) => `open "${url}"`,
  linux: (url) =>
    `xdg-open "${url}" 2>/dev/null || sensible-browser "${url}" 2>/dev/null || echo "Open ${url} in your browser"`,
};

export async function analyzeCommand(
  url: string,
  options: AnalyzeCommandOptions = {},
): Promise<void> {
  const {
    format = "terminal",
    verbose = false,
    project,
    open = false,
  } = options;

  if (!url) {
    console.error("Error: URL is required\nUsage: fpd analyze <url>");
    process.exit(1);
  }

  const normalizedUrl = normalizeUrl(url);

  if (verbose) {
    console.log(`Analyzing: ${normalizedUrl}\n`);
    if (project)
      console.log(
        `Project root: ${project}\nSource correlation mode enabled\n`,
      );
  }

  try {
    const engine = createEngine({ verbose });

    ANALYZERS.forEach((Analyzer) => engine.addAnalyzer(new Analyzer()));

    let report: Report = await engine.analyze(normalizedUrl);

    if (project) {
      report = await runCorrelation(report, normalizedUrl, project, verbose);
    }

    const formattedOutput = formatReport(report, format);

    if (options.output) {
      await writeToFile(options.output, formattedOutput);
      console.log(`Report saved to: ${options.output}`);
    } else {
      console.log(formattedOutput);
    }

    if (open) {
      await launchViewer(report, verbose);
    }
  } catch (error) {
    console.error(
      "Analysis failed:",
      error instanceof Error ? error.message : error,
    );
    process.exit(1);
  }
}

async function runCorrelation(
  report: Report,
  url: string,
  project: string,
  verbose: boolean,
): Promise<Report> {
  if (verbose) console.log("Running source code correlation...");

  const correlationResult: CorrelationResult = await correlateFindings(
    report.findings,
    url,
    project,
  );

  if (verbose) {
    console.log(
      `Correlation complete: ${correlationResult.highConfidenceCount} high confidence matches found`,
    );
    console.log(
      `Success rate: ${Math.round(correlationResult.correlationRate * 100)}%\n`,
    );
  }

  return { ...report, correlationResult };
}

async function launchViewer(report: Report, verbose: boolean): Promise<void> {
  if (verbose) console.log("Starting local viewer...");

  const viewer = await startViewerServer(report);

  console.log(`\nViewer available at: ${viewer.url}`);
  console.log("Press Ctrl+C to stop the local viewer.");

  await openBrowser(viewer.url);

  await waitForExitSignal(async () => {
    if (verbose) console.log("\nShutting down viewer...");
    await viewer.close();
  });
}

async function openBrowser(url: string): Promise<void> {
  try {
    const { exec } = await import("node:child_process");
    const command = BROWSER_COMMANDS[process.platform];

    if (command) {
      exec(command(url));
    } else {
      console.log(`Open ${url} in your browser`);
    }
  } catch {
    console.log(`Open ${url} in your browser`);
  }
}

const LOCAL_PATTERN = /^(\d+\.\d+\.\d+\.\d+:|localhost:)/;

function normalizeUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;

  const protocol = LOCAL_PATTERN.test(url) ? "http" : "https";
  return `${protocol}://${url}`;
}

function formatReport(report: Report, format: OutputFormat): string {
  return (FORMATTERS[format] ?? FORMATTERS.terminal)(report);
}

async function writeToFile(filePath: string, content: string): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  await writeFile(filePath, content, "utf-8");
}

async function waitForExitSignal(onExit: () => Promise<void>): Promise<void> {
  await new Promise<void>((resolve) => {
    let shuttingDown = false;

    const shutdown = async (): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;

      try {
        await onExit();
      } finally {
        resolve();
      }
    };

    process.once("SIGINT", () => void shutdown());
    process.once("SIGTERM", () => void shutdown());
  });
}
