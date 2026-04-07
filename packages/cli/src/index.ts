import { analyzeCommand } from "./commands/analyze.js";
import { analyzersCommand } from "./commands/analyzers.js";
import type { OutputFormat } from "./commands/analyze.js";
import { scanCommand } from "./commands/scan.js";

/**
 * CLI version
 */
const VERSION = "1.0.3";

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Frontend Performance Debugger (fpd) v${VERSION}

Developer-first CLI for frontend performance analysis, root cause detection,
source code correlation, and local report viewing.

USAGE
  fpd analyze <url> [options]
  fpd scan <path> [options]
  fpd analyzers
  fpd --help
  fpd --version

COMMANDS
  analyze <url>
      Analyze a live URL in a real browser session.
      Reports performance, network, rendering, assets, caching,
      and correlates results with local source code.

  scan <path>
      Statically analyze a local project path for performance patterns.
      Does not require a running browser session.

  analyzers
      List all available analyzers and their specific checks.

OPTIONS
  --format, -f <format>
      Output format: terminal | json | markdown (Default: terminal)

  --output, -o <file>
      Write the report output to a specified file.

  --project, -p <path>
      Local project path for source code correlation.
      Maps runtime findings to your components and routes.

  --open
      Start the local report viewer after analysis and expose the report
      on a local HTTP server.

  --verbose, -v
      Show detailed logs (browser launch, framework detection, etc.)

  --help, -h
      Show this help message.

  --version
      Show CLI version.

COMMON WORKFLOWS

  Analyze a live site:
    fpd analyze https://example.com

  Analyze with verbose logs:
    fpd analyze https://example.com --verbose

  Analyze localhost with source correlation:
    fpd analyze http://localhost:3000 --project . --verbose

  Analyze and open local report viewer:
    fpd analyze http://localhost:3000 --project . --open

  Analyze and export results:
    fpd analyze https://example.com --format json --output report.json
    fpd analyze https://example.com --format markdown --output report.md

  Scan a local project:
    fpd scan .
    fpd scan ./src

NOTES
  - Use --project with "analyze" to enable framework-aware mapping.
  - Use --open to start a local viewer for the generated report.
  - Localhost URLs (e.g., http://localhost:3000) are fully supported.
  - If no protocol is provided, FPD defaults to https:// (or http:// for localhost).
  - Source correlation is currently optimized for React and Next.js projects.

MORE INFO
  Documentation & Repository:
    https://github.com/umutdemr/frontend-performance-debugger
`);
}

/**
 * Print version
 */
function printVersion(): void {
  console.log(`fpd v${VERSION}`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args: string[]): {
  command?: string;
  url?: string;
  format: OutputFormat;
  output?: string;
  project?: string;
  open: boolean;
  verbose: boolean;
  help: boolean;
  version: boolean;
} {
  const result = {
    command: undefined as string | undefined,
    url: undefined as string | undefined,
    format: "terminal" as OutputFormat,
    output: undefined as string | undefined,
    project: undefined as string | undefined,
    open: false,
    verbose: false,
    help: false,
    version: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i] as string;
    const nextArg = args[i + 1];

    switch (arg) {
      case "--help":
      case "-h":
        result.help = true;
        break;

      case "--version":
        result.version = true;
        break;

      case "--verbose":
      case "-v":
        result.verbose = true;
        break;

      case "--open":
        result.open = true;
        break;

      case "--format":
      case "-f":
        if (nextArg && ["terminal", "json", "markdown"].includes(nextArg)) {
          result.format = nextArg as OutputFormat;
          i++;
        }
        break;

      case "--output":
      case "-o":
        if (nextArg && !nextArg.startsWith("-")) {
          result.output = nextArg;
          i++;
        }
        break;

      case "--project":
      case "-p":
        if (nextArg && !nextArg.startsWith("-")) {
          result.project = nextArg;
          i++;
        }
        break;

      default:
        if (!arg.startsWith("-")) {
          if (!result.command) {
            result.command = arg;
          } else if (!result.url) {
            result.url = arg;
          }
        }
        break;
    }
  }

  return result;
}

/**
 * Main CLI entry point
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const parsed = parseArgs(args);

  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.version) {
    printVersion();
    process.exit(0);
  }

  if (parsed.command === "analyze") {
    if (!parsed.url) {
      console.error("Error: URL is required. Usage: fpd analyze <url>");
      process.exit(1);
    }

    await analyzeCommand(parsed.url, {
      format: parsed.format,
      output: parsed.output,
      project: parsed.project,
      open: parsed.open,
      verbose: parsed.verbose,
    });
    return;
  }

  if (parsed.command === "scan") {
    if (!parsed.url) {
      console.error("Error: Path is required. Usage: fpd scan <path>");
      process.exit(1);
    }

    await scanCommand(parsed.url, {
      format: parsed.format,
      output: parsed.output,
      verbose: parsed.verbose,
    });
    return;
  }

  if (parsed.command === "analyzers") {
    analyzersCommand();
    return;
  }

  if (!parsed.command) {
    printHelp();
    process.exit(0);
  }

  console.error(`Unknown command: ${parsed.command}`);
  console.error('Run "fpd --help" for usage information.');
  process.exit(1);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
