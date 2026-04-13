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

  --skip-env-adjustments
      Disable environment-aware severity adjustments.
      By default, FPD reduces severity and adds caveats for findings
      that are unreliable in local dev or preview environments (e.g.,
      cache findings in localhost). Use this flag for strict audits
      or CI pipelines where you want unmodified severities.

  --force-env <environment>
      Force a specific environment type, overriding auto-detection.
      Valid values: local-dev | preview | staging | production
      Example: --force-env staging

  --no-score-breakdown
      Omit the detailed score breakdown from the report.
      By default, FPD includes score details: base score, deductions,
      critical penalty, and collapse penalty.

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

  Strict audit mode (no environment adjustments):
    fpd analyze https://example.com --skip-env-adjustments

  Force staging environment for local server:
    fpd analyze http://localhost:3000 --force-env staging

  Scan a local project:
    fpd scan .
    fpd scan ./src

ENVIRONMENT AWARENESS 

  FPD automatically detects your environment and adjusts findings:

  • localhost / 127.0.0.1    → Local Development mode
    - Cache findings are downgraded (headers don't reflect production)
    - HTTP on localhost is noted, not flagged as critical
    - Common dev ports (3000, 4200, 5173...) are not reported
    - Network timings are noted as potentially unrepresentative

  • *.vercel.app, *.netlify.app, etc. → Preview mode
    - Cache findings have reduced confidence
    - Some optimizations may differ from production

  • Public domain with production signals → Production mode
    - Full severity for all findings
    - Cache headers are trusted
    - All findings reported at face value

  Use --skip-env-adjustments to disable this behavior.

OWNERSHIP HINTS 

  Each finding is tagged with who is responsible for fixing it:

  [app]         Application code (your components, routes)
  [framework]   Framework-managed (Next.js, Nuxt, Vite internals)
  [config]      Build or framework configuration
  [infra]       Server, CDN, or hosting configuration
  [3rd-party]   External services (analytics, fonts, etc.)

SCORE CALIBRATION 

  The overall score now accounts for:
  • Critical penalty  — extra deduction for critical severity findings
  • Collapse penalty  — extra deduction when a category scores near 0
  • Env. adjustment   — reduced penalty for environment-limited findings

  Run with --verbose to see score adjustment details in the report.

NOTES
  - Use --project with "analyze" to enable framework-aware mapping.
  - Use --open to start a local viewer for the generated report.
  - Localhost URLs (e.g., http://localhost:3000) are fully supported.
  - If no protocol is provided, FPD defaults to https:// (or http:// for localhost).
  - Source correlation is currently optimized for React and Next.js projects.
  - Environment awareness works automatically with no configuration needed.

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
  skipEnvAdjustments: boolean;
  forceEnvironment?: string;
  includeScoreBreakdown: boolean;
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
    skipEnvAdjustments: false,
    forceEnvironment: undefined as string | undefined,
    includeScoreBreakdown: true,
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

      case "--skip-env-adjustments":
        result.skipEnvAdjustments = true;
        break;

      case "--force-env":
        if (nextArg && !nextArg.startsWith("-")) {
          result.forceEnvironment = nextArg;
          i++;
        }
        break;

      case "--no-score-breakdown":
        result.includeScoreBreakdown = false;
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
      skipEnvAdjustments: parsed.skipEnvAdjustments,
      forceEnvironment: parsed.forceEnvironment,
      includeScoreBreakdown: parsed.includeScoreBreakdown,
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
