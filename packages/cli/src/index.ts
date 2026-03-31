import { analyzeCommand } from "./commands/analyze.js";
import { analyzersCommand } from "./commands/analyzers.js";
import type { OutputFormat } from "./commands/analyze.js";
import { scanCommand } from "./commands/scan.js";

/**
 * CLI version
 */
const VERSION = "0.1.0";

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
Frontend Performance Debugger (fpd) v${VERSION}

Developer-first CLI for frontend performance analysis, root cause detection,
and source code correlation.

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
      SEO/security issues, score breakdown, and root causes.

  scan <path>
      Analyze a local project/code path for static issues.
      Useful when you want local inspection without runtime browser analysis.

  analyzers
      List all available analyzers and the checks they perform.

OPTIONS
  --format, -f <format>
      Output format: terminal | json | markdown
      Default: terminal

  --output, -o <file>
      Write the report output to a file instead of stdout.

  --project, -p <path>
      Local project path used for source code correlation.
      When combined with "analyze", FPD attempts to map runtime findings
      to likely route files and source files.

  --verbose, -v
      Show detailed logs such as browser launch, page load timing,
      framework detection, route detection, and correlation steps.

  --help, -h
      Show this help message.

  --version
      Show CLI version.

COMMON WORKFLOWS

  Analyze a production site
    fpd analyze https://github.com

  Analyze a production site with verbose logs
    fpd analyze https://github.com --verbose

  Analyze and export JSON
    fpd analyze https://github.com --format json --output report.json

  Analyze and export Markdown
    fpd analyze https://github.com --format markdown --output report.md

  Analyze localhost
    fpd analyze http://localhost:3000

  Analyze localhost with source correlation
    fpd analyze http://localhost:3000 --project . --verbose

  Analyze a different local dev port
    fpd analyze http://localhost:5173 --project . --verbose

  Analyze a live site and map findings to a local project
    fpd analyze https://example.com --project ./my-project --verbose

  Analyze with an absolute Windows project path
    fpd analyze http://localhost:3000 --project C:\\Users\\UMUT\\Desktop\\my-project --verbose

  Export JSON for CI / automation
    fpd analyze https://example.com -f json -o report.json

  Export Markdown for documentation
    fpd analyze https://example.com -f markdown -o report.md

  Scan the current project
    fpd scan .

  Scan a specific source directory
    fpd scan ./src

  Scan and export Markdown
    fpd scan . --format markdown --output local-scan.md

  List all analyzers
    fpd analyzers

NOTES
  - Use --project with "analyze" to enable framework detection,
    route mapping, and source correlation.
  - Localhost URLs such as http://localhost:3000 are supported.
  - If no protocol is provided, FPD defaults to:
      https:// for normal domains
      http:// for localhost / local IPs
  - JSON output is useful for automation and CI workflows.
  - Markdown output is useful for reports, documentation, and sharing results.
  - Source correlation is best-effort and currently MVP-oriented.

MORE INFO
  Repository:
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

  // Handle flags
  if (parsed.help) {
    printHelp();
    process.exit(0);
  }

  if (parsed.version) {
    printVersion();
    process.exit(0);
  }

  // Handle commands
  if (parsed.command === "analyze") {
    if (!parsed.url) {
      console.error("Error: URL is required");
      console.error("Usage: fpd analyze <url>");
      process.exit(1);
    }

    await analyzeCommand(parsed.url, {
      format: parsed.format,
      output: parsed.output,
      project: parsed.project,
      verbose: parsed.verbose,
    });
    return;
  }

  if (parsed.command === "scan") {
    if (!parsed.url) {
      console.error("Error: Path is required");
      console.error("Usage: fpd scan <path>");
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

  // No command or unknown command
  if (!parsed.command) {
    printHelp();
    process.exit(0);
  }

  console.error(`Unknown command: ${parsed.command}`);
  console.error('Run "fpd --help" for usage information.');
  process.exit(1);
}

// Run CLI
main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
