import * as fs from "fs";
import * as path from "path";
import type {
  Report,
  Finding,
  Severity,
  RootCause,
  FindingCorrelations,
  ProjectStack,
  EnvironmentContext,
  OwnershipHint,
  CategoryScore,
} from "@fpd/shared-types";
import { SEVERITY_LABEL, CATEGORY_LABEL } from "@fpd/shared-types";

const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  italic: "\x1b[3m",

  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  bgRed: "\x1b[41m",
  bgGreen: "\x1b[42m",
  bgYellow: "\x1b[43m",
} as const;

const SEVERITY_COLOR: Record<Severity, string> = {
  critical: COLORS.red,
  warning: COLORS.yellow,
  info: COLORS.blue,
  success: COLORS.green,
};

export function formatAsTerminal(report: Report): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(
    `${COLORS.bold}${COLORS.cyan}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`,
  );
  lines.push(
    `${COLORS.bold}${COLORS.cyan}║${COLORS.reset}  ${COLORS.bold}Frontend Performance Debugger${COLORS.reset}                           ${COLORS.cyan}║${COLORS.reset}`,
  );
  lines.push(
    `${COLORS.bold}${COLORS.cyan}╚════════════════════════════════════════════════════════════╝${COLORS.reset}`,
  );
  lines.push("");

  lines.push(`${COLORS.dim}URL:${COLORS.reset}       ${report.url}`);
  lines.push(
    `${COLORS.dim}Analyzed:${COLORS.reset}  ${new Date(report.timestamp).toLocaleString()}`,
  );
  lines.push(`${COLORS.dim}Duration:${COLORS.reset}  ${report.duration}ms`);

  const analysisMode = (report as Report & { analysisMode?: string })
    .analysisMode;
  if (analysisMode) {
    lines.push(
      `${COLORS.dim}Mode:${COLORS.reset}      ${analysisMode === "filesystem" ? `${COLORS.yellow}filesystem${COLORS.reset}` : `${COLORS.cyan}runtime${COLORS.reset}`}`,
    );
  }

  if (report.environment) {
    const envLine = formatEnvironmentLine(report.environment);
    if (envLine) {
      lines.push(envLine);
    }
  }

  if (report.framework) {
    lines.push(
      `${COLORS.dim}Framework:${COLORS.reset} ${COLORS.green}${formatFrameworkInfo(report.framework)}${COLORS.reset}`,
    );
  } else {
    const projectStack = getDetectedProjectStack(report);
    if (projectStack && projectStack.metaFramework !== "unknown") {
      const stackLabel = formatStackLabel(projectStack);
      lines.push(
        `${COLORS.dim}Framework:${COLORS.reset} ${COLORS.green}${stackLabel}${COLORS.reset}`,
      );
    }
  }

  const routeFile = detectRouteFile(report, getDetectedProjectStack(report));
  if (routeFile) {
    lines.push(
      `${COLORS.dim}Route:${COLORS.reset}     ${COLORS.cyan}${routeFile}${COLORS.reset}`,
    );
  }

  if (report.correlationResult) {
    const cr = report.correlationResult;
    const correlationColor =
      cr.highConfidenceCount > 0 ? COLORS.green : COLORS.yellow;

    lines.push(
      `${COLORS.dim}Correlated:${COLORS.reset} ${correlationColor}${cr.highConfidenceCount}${COLORS.reset} source locations found ${COLORS.dim}(${Math.round(cr.correlationRate * 100)}% match rate)${COLORS.reset}`,
    );
  }

  lines.push("");

  if (report.summary.score !== undefined) {
    const scoreLabel = getScoreLabel(report);
    const scoreColor = getScoreColor(report, scoreLabel);

    lines.push(
      `${COLORS.bold}Score:${COLORS.reset} ${scoreColor}${report.summary.score}/100${COLORS.reset} ${COLORS.dim}(${scoreLabel})${COLORS.reset}`,
    );

    if (report.categoryScores) {
      lines.push(formatCategoryScores(report.categoryScores));
    } else if (report.summary.breakdown) {
      lines.push(
        `${COLORS.dim}  ├─ Performance:  ${report.summary.breakdown.performance}${COLORS.reset}`,
      );
      lines.push(
        `${COLORS.dim}  ├─ Network:      ${report.summary.breakdown.network}${COLORS.reset}`,
      );
      lines.push(
        `${COLORS.dim}  ├─ Architecture: ${report.summary.breakdown.architecture}${COLORS.reset}`,
      );
      lines.push(
        `${COLORS.dim}  └─ SEO/Security: ${report.summary.breakdown.seoSecurity}${COLORS.reset}`,
      );
    }
    lines.push("");

    if (report.scoreBreakdown && report.scoreBreakdown.explanation) {
      const significantExplanations = report.scoreBreakdown.explanation.filter(
        (e) =>
          e.includes("penalty") ||
          e.includes("Critical") ||
          e.includes("collapse") ||
          e.includes("capped"),
      );
      if (significantExplanations.length > 0) {
        lines.push(`${COLORS.dim}Score adjustments:${COLORS.reset}`);
        for (const exp of significantExplanations.slice(0, 4)) {
          lines.push(`  ${COLORS.dim}• ${exp}${COLORS.reset}`);
        }
        lines.push("");
      }
    }
  }

  if (report.summary.topRootCauses && report.summary.topRootCauses.length > 0) {
    lines.push(`${COLORS.bold}${COLORS.red}Top Root Causes:${COLORS.reset}`);
    report.summary.topRootCauses.forEach((cause: RootCause, idx: number) => {
      lines.push(`  ${idx + 1}. [${cause.group}] ${cause.description}`);
    });
    lines.push("");
  }

  lines.push(`${COLORS.bold}${report.summary.headline}${COLORS.reset}`);
  lines.push("");

  lines.push(
    `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
  );
  lines.push(`${COLORS.bold}Summary${COLORS.reset}`);
  lines.push(
    `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
  );

  const { bySeverity } = report.summary;
  if (bySeverity.critical > 0) {
    lines.push(
      `  ${COLORS.red}●${COLORS.reset} Critical: ${bySeverity.critical}`,
    );
  }
  if (bySeverity.warning > 0) {
    lines.push(
      `  ${COLORS.yellow}●${COLORS.reset} Warnings: ${bySeverity.warning}`,
    );
  }
  if (bySeverity.info > 0) {
    lines.push(`  ${COLORS.blue}●${COLORS.reset} Info:     ${bySeverity.info}`);
  }
  if (bySeverity.success > 0) {
    lines.push(
      `  ${COLORS.green}●${COLORS.reset} Success:  ${bySeverity.success}`,
    );
  }

  if (report.findingsSummary) {
    if (report.findingsSummary.environmentLimited > 0) {
      lines.push("");
      lines.push(
        `  ${COLORS.gray}⚠ ${report.findingsSummary.environmentLimited} finding(s) have reduced confidence due to environment${COLORS.reset}`,
      );
    }
    if (report.findingsSummary.downgraded > 0) {
      lines.push(
        `  ${COLORS.gray}↓ ${report.findingsSummary.downgraded} finding(s) were downgraded from original severity${COLORS.reset}`,
      );
    }
  }

  lines.push("");

  if (
    report.correlationResult &&
    report.correlationResult.findingCorrelations &&
    report.correlationResult.findingCorrelations.length > 0
  ) {
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );
    lines.push(
      `${COLORS.bold}${COLORS.cyan}Source Correlations${COLORS.reset} ${COLORS.dim}(${report.correlationResult.findingCorrelations.length} findings mapped to source)${COLORS.reset}`,
    );
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );

    for (const fc of report.correlationResult.findingCorrelations) {
      const finding = report.findings.find((f) => f.id === fc.findingId);
      if (!finding) continue;

      const severityLabel = SEVERITY_LABEL[finding.severity];
      const color = SEVERITY_COLOR[finding.severity];

      lines.push(
        `${color}[${severityLabel.toUpperCase()}]${COLORS.reset} ${finding.title}`,
      );

      for (const corr of fc.correlations.slice(0, 2)) {
        let locationLabel = `  • ${corr.location.filePath}`;
        if (corr.location.lineNumber) {
          locationLabel += `:${corr.location.lineNumber}`;
        }

        const confidenceBadge =
          corr.confidence === "high" || corr.confidence === "definite"
            ? ` ${COLORS.green}[${corr.confidence}]${COLORS.reset}`
            : ` ${COLORS.yellow}[${corr.confidence}]${COLORS.reset}`;

        lines.push(
          `${COLORS.dim}${locationLabel}${COLORS.reset}${confidenceBadge}`,
        );
      }

      if (fc.totalLocations > 2) {
        lines.push(
          `${COLORS.dim}  ... and ${fc.totalLocations - 2} more locations${COLORS.reset}`,
        );
      }
      lines.push("");
    }
  }

  if (report.findings.length > 0) {
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );
    lines.push(
      `${COLORS.bold}Findings (${report.findings.length})${COLORS.reset}`,
    );
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );
    lines.push("");

    for (const finding of report.findings) {
      lines.push(formatFinding(finding, report));
      lines.push("");
    }
  } else {
    lines.push(`${COLORS.green}✓ No issues found!${COLORS.reset}`);
    lines.push("");
  }

  if (report.environment && report.environment.analysisNotes.length > 0) {
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );
    lines.push(`${COLORS.bold}Analysis Notes${COLORS.reset}`);
    lines.push(
      `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
    );
    for (const note of report.environment.analysisNotes) {
      lines.push(`  ${COLORS.gray}• ${note}${COLORS.reset}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function formatEnvironmentLine(env: EnvironmentContext): string {
  const parts: string[] = [];

  if (env.isLocalDev) {
    parts.push(`${COLORS.yellow}[LOCAL DEV]${COLORS.reset}`);
  } else if (env.runtimeEnvironment === "preview") {
    parts.push(`${COLORS.cyan}[PREVIEW]${COLORS.reset}`);
  } else if (env.runtimeEnvironment === "staging") {
    parts.push(`${COLORS.cyan}[STAGING]${COLORS.reset}`);
  } else if (env.runtimeEnvironment === "production") {
    parts.push(`${COLORS.green}[PRODUCTION]${COLORS.reset}`);
  }

  if (env.hostType === "private-ip") {
    parts.push(`${COLORS.dim}(private network)${COLORS.reset}`);
  }

  if (!env.cacheHeadersReliable) {
    parts.push(
      `${COLORS.dim}(cache headers may not reflect production)${COLORS.reset}`,
    );
  }

  if (!env.productionLikeBuild && !env.isLocalDev) {
    parts.push(`${COLORS.dim}(development build)${COLORS.reset}`);
  }

  if (parts.length === 0) {
    return "";
  }

  return `${COLORS.dim}Env:${COLORS.reset}       ${parts.join(" ")}`;
}

function formatFrameworkInfo(framework: {
  name: string;
  version?: string;
  confidence: string;
}): string {
  let label = formatFrameworkName(framework.name);
  if (framework.version) {
    label += ` v${framework.version}`;
  }
  if (framework.confidence !== "high") {
    label += ` ${COLORS.dim}(${framework.confidence} confidence)${COLORS.reset}${COLORS.green}`;
  }
  return label;
}

function formatCategoryScores(
  categoryScores: Record<string, CategoryScore>,
): string {
  const lines: string[] = [];

  const categories = [
    { key: "performance", label: "Performance" },
    { key: "network", label: "Network" },
    { key: "architecture", label: "Architecture" },
    { key: "seoSecurity", label: "SEO/Security" },
  ];

  for (let i = 0; i < categories.length; i++) {
    const category = categories[i];
    if (!category) continue;

    const { key, label } = category;
    const score = categoryScores[key];
    if (!score) continue;

    const isLast = i === categories.length - 1;
    const prefix = isLast ? "└─" : "├─";
    const paddedLabel = label.padEnd(12);

    let scoreLine = `${COLORS.dim}  ${prefix} ${paddedLabel} ${score.score}/${score.maxScore}${COLORS.reset}`;

    if (score.collapsed) {
      scoreLine += ` ${COLORS.red}[SEVERELY IMPACTED]${COLORS.reset}`;
    }

    lines.push(scoreLine);
  }

  return lines.join("\n");
}

function formatFinding(finding: Finding, report: Report): string {
  const lines: string[] = [];
  const color = SEVERITY_COLOR[finding.severity];
  const severityLabel = SEVERITY_LABEL[finding.severity];
  const categoryLabel = CATEGORY_LABEL[finding.category];

  let titleLine = `${color}[${severityLabel.toUpperCase()}]${COLORS.reset} ${COLORS.bold}${finding.title}${COLORS.reset}`;

  if (finding.ownership && finding.ownership.type !== "unknown") {
    titleLine += ` ${COLORS.dim}[${formatOwnershipType(finding.ownership.type)}]${COLORS.reset}`;
  }

  if (finding.priority && finding.priority !== "none") {
    const pColor =
      finding.priority === "high-impact" || finding.priority === "quick-win"
        ? COLORS.magenta
        : COLORS.dim;
    titleLine += ` ${pColor}(${finding.priority})${COLORS.reset}`;
  }
  lines.push(titleLine);

  if (finding.originalSeverity) {
    lines.push(
      `${COLORS.gray}  ↓ Downgraded from ${SEVERITY_LABEL[finding.originalSeverity]} due to environment${COLORS.reset}`,
    );
  }

  const confText = finding.confidence ? ` | Conf: ${finding.confidence}` : "";
  lines.push(
    `${COLORS.dim}Category: ${categoryLabel} | ID: ${finding.id}${confText}${COLORS.reset}`,
  );

  lines.push(`${finding.description}`);

  if (
    finding.environmentLimited &&
    finding.environmentNotes &&
    finding.environmentNotes.length > 0
  ) {
    lines.push("");
    lines.push(
      `  ${COLORS.gray}⚠ ${finding.environmentNotes[0]}${COLORS.reset}`,
    );
  }

  if (finding.evidence && finding.evidence.length > 0) {
    lines.push("");
    for (const e of finding.evidence) {
      if (e.type === "custom" && e.label === "Additional Items") {
        lines.push(`  ${COLORS.dim}${String(e.data)}${COLORS.reset}`);
      } else {
        const dataStr = formatEvidenceData(e.data);
        lines.push(`  ${COLORS.dim}• ${e.label}: ${dataStr}${COLORS.reset}`);
      }
    }

    if (finding.evidenceSummary && finding.evidenceSummary.truncated) {
      const hiddenCount =
        finding.evidenceSummary.totalCount -
        finding.evidenceSummary.uniqueCount;
      if (hiddenCount > 0) {
        lines.push(
          `  ${COLORS.dim}... and ${hiddenCount} more similar items${COLORS.reset}`,
        );
      }
    }
  }

  const correlation = findCorrelationForFinding(finding, report);
  if (correlation && correlation.correlations.length > 0) {
    lines.push("");
    lines.push(`  📍 ${COLORS.cyan}Source locations:${COLORS.reset}`);

    const topLocations = correlation.correlations.slice(0, 3);

    for (const loc of topLocations) {
      let locationLabel = `    • ${loc.location.filePath}`;
      if (loc.location.lineNumber) {
        locationLabel += `:${loc.location.lineNumber}`;
      }

      let confidenceBadge = "";
      if (loc.confidence === "definite" || loc.confidence === "high") {
        confidenceBadge = ` ${COLORS.green}[${loc.confidence}]${COLORS.reset}`;
      } else {
        confidenceBadge = ` ${COLORS.yellow}[${loc.confidence}]${COLORS.reset}`;
      }

      lines.push(`${locationLabel}${confidenceBadge}`);

      if (loc.location.codeSnippet) {
        lines.push(
          `${COLORS.dim}      ${truncateSnippet(loc.location.codeSnippet)}${COLORS.reset}`,
        );
      }
    }

    if (correlation.totalLocations > 3) {
      lines.push(
        `${COLORS.dim}    ... and ${correlation.totalLocations - 3} more${COLORS.reset}`,
      );
    }
  }

  lines.push("");
  lines.push(`${COLORS.cyan}Impact:${COLORS.reset} ${finding.impact}`);
  lines.push(`${COLORS.green}Fix:${COLORS.reset} ${finding.recommendation}`);

  if (finding.frameworkRecommendation) {
    lines.push(
      `${COLORS.magenta}Framework tip:${COLORS.reset} ${finding.frameworkRecommendation}`,
    );
  }

  if (
    finding.ownership &&
    finding.ownership.reason &&
    finding.ownership.type !== "unknown"
  ) {
    lines.push(
      `${COLORS.dim}Owner hint: ${finding.ownership.reason}${COLORS.reset}`,
    );
  }

  if (finding.learnMoreUrl) {
    lines.push(
      `${COLORS.dim}Learn more: ${finding.learnMoreUrl}${COLORS.reset}`,
    );
  }

  return lines.join("\n");
}

function formatOwnershipType(type: string): string {
  const labels: Record<string, string> = {
    "app-owned": "app",
    "framework-owned": "framework",
    "config-owned": "config",
    "infra-owned": "infra",
    "third-party": "3rd-party",
    unknown: "unknown",
  };
  return labels[type] || type;
}

function getScoreColor(report: Report, label: string): string {
  const score = report.summary.score ?? 0;

  if (label === "Critical") return COLORS.red;
  if (label === "Needs Attention") return COLORS.yellow;
  if (score >= 90) return COLORS.green;
  if (score >= 70) return COLORS.yellow;
  if (score >= 50) return COLORS.yellow;
  return COLORS.red;
}

function getScoreLabel(report: Report): string {
  const score = report.summary.score ?? 0;
  const criticalCount = report.summary.bySeverity?.critical ?? 0;
  const criticalPenalty = report.scoreBreakdown?.criticalPenalty ?? 0;
  const analysisMode = (report as Report & { analysisMode?: string })
    .analysisMode;

  if (criticalCount > 0 || criticalPenalty > 0) {
    if (analysisMode === "filesystem") {
      return score <= 35 ? "Critical" : "Needs Attention";
    }
    return score <= 45 ? "Critical" : "Needs Attention";
  }

  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  if (score >= 30) return "Poor";
  return "Critical";
}

function truncateSnippet(snippet: string): string {
  const maxLength = 60;
  if (snippet.length <= maxLength) return snippet;
  return snippet.slice(0, maxLength) + "...";
}

function formatStackLabel(stack: ProjectStack): string {
  let label = "";

  if (stack.uiLibrary && stack.uiLibrary !== "unknown") {
    label += capitalizeFirst(stack.uiLibrary);
  }

  if (stack.metaFramework && stack.metaFramework !== "unknown") {
    if (label) label += " + ";
    label += formatFrameworkName(stack.metaFramework);

    if (stack.metaFrameworkVersion) {
      label += ` v${stack.metaFrameworkVersion}`;
    }
  }

  if (stack.routing && stack.routing !== "unknown") {
    label += ` (${formatRoutingType(stack.routing)})`;
  }

  return label || "Unknown";
}

function formatFrameworkName(framework: string): string {
  const names: Record<string, string> = {
    nextjs: "Next.js",
    "next.js": "Next.js",
    nuxt: "Nuxt",
    remix: "Remix",
    gatsby: "Gatsby",
    vite: "Vite",
    "vite-react": "Vite + React",
    "vite-vue": "Vite + Vue",
    cra: "Create React App",
    "create-react-app": "Create React App",
    sveltekit: "SvelteKit",
    astro: "Astro",
    "angular-cli": "Angular CLI",
    "vue-cli": "Vue CLI",
  };
  return names[framework.toLowerCase()] || capitalizeFirst(framework);
}

function formatRoutingType(routing: string): string {
  const types: Record<string, string> = {
    "app-router": "App Router",
    "pages-router": "Pages Router",
    "file-based": "File-based",
    "config-based": "Config-based",
  };
  return types[routing] || routing;
}

function capitalizeFirst(str: string): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getDetectedProjectStack(report: Report): ProjectStack | null {
  if (report.correlationResult) {
    const cr = report.correlationResult as unknown as Record<string, unknown>;
    if (cr.detectedStack && typeof cr.detectedStack === "object") {
      return cr.detectedStack as ProjectStack;
    }
  }

  if (
    report.correlationResult &&
    report.correlationResult.routeMaps &&
    report.correlationResult.routeMaps.length > 0
  ) {
    const pageFile = report.correlationResult.routeMaps[0]?.pageFile || "";

    if (
      pageFile.includes("app/") &&
      (pageFile.includes("page.") || pageFile.includes("layout."))
    ) {
      return buildNextjsStack("app-router", pageFile);
    }

    if (pageFile.includes("pages/")) {
      return buildNextjsStack("pages-router", pageFile);
    }
  }

  if (report.correlationResult && report.correlationResult.projectRoot) {
    return detectFromFilesystem(report.correlationResult.projectRoot);
  }

  return null;
}

function detectFromFilesystem(projectRoot: string): ProjectStack | null {
  try {
    const pkgPath = path.join(projectRoot, "package.json");
    if (!fs.existsSync(pkgPath)) return null;

    const raw = fs.readFileSync(pkgPath, "utf-8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const allDeps: Record<string, string> = {
      ...(pkg.dependencies || {}),
      ...(pkg.devDependencies || {}),
    };

    const hasTS = fs.existsSync(path.join(projectRoot, "tsconfig.json"));

    // ── Next.js ──
    if (allDeps["next"]) {
      const version = cleanVersion(allDeps["next"]);
      const hasAppDir =
        fs.existsSync(path.join(projectRoot, "app")) ||
        fs.existsSync(path.join(projectRoot, "src", "app"));
      const hasPagesDir =
        fs.existsSync(path.join(projectRoot, "pages")) ||
        fs.existsSync(path.join(projectRoot, "src", "pages"));

      let routing: ProjectStack["routing"] =
        "unknown" as ProjectStack["routing"];
      if (hasAppDir) routing = "app-router" as ProjectStack["routing"];
      else if (hasPagesDir) routing = "pages-router" as ProjectStack["routing"];

      return {
        uiLibrary: "react",
        uiLibraryVersion: cleanVersion(allDeps["react"]) || null,
        metaFramework: "nextjs",
        metaFrameworkVersion: version || null,
        bundler: "webpack",
        packageManager: detectPackageManager(projectRoot),
        routing,
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: true,
          scriptOptimization: true,
          fontOptimization: true,
          ssr: true,
          ssg: true,
          isr: true,
          edgeRuntime: routing === "app-router",
          middleware: true,
          apiRoutes: true,
          streaming: routing === "app-router",
          serverComponents: routing === "app-router",
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json", "filesystem"],
      } as ProjectStack;
    }

    // ── Nuxt ──
    if (allDeps["nuxt"] || allDeps["nuxt3"]) {
      const nuxtDep = allDeps["nuxt"] || allDeps["nuxt3"] || "";
      return {
        uiLibrary: "vue",
        uiLibraryVersion: cleanVersion(allDeps["vue"]) || null,
        metaFramework: "nuxt",
        metaFrameworkVersion: cleanVersion(nuxtDep) || null,
        bundler: "vite",
        packageManager: detectPackageManager(projectRoot),
        routing: "file-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: true,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: true,
          ssg: true,
          isr: false,
          edgeRuntime: false,
          middleware: true,
          apiRoutes: true,
          streaming: false,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // ── Remix ──
    if (allDeps["@remix-run/react"] || allDeps["@remix-run/node"]) {
      return {
        uiLibrary: "react",
        uiLibraryVersion: cleanVersion(allDeps["react"]) || null,
        metaFramework: "remix",
        metaFrameworkVersion: cleanVersion(allDeps["@remix-run/react"]) || null,
        bundler: "vite",
        packageManager: detectPackageManager(projectRoot),
        routing: "file-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: false,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: true,
          ssg: false,
          isr: false,
          edgeRuntime: true,
          middleware: false,
          apiRoutes: true,
          streaming: true,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // ── SvelteKit ──
    if (allDeps["@sveltejs/kit"]) {
      return {
        uiLibrary: "svelte",
        uiLibraryVersion: cleanVersion(allDeps["svelte"]) || null,
        metaFramework: "sveltekit",
        metaFrameworkVersion: cleanVersion(allDeps["@sveltejs/kit"]) || null,
        bundler: "vite",
        packageManager: detectPackageManager(projectRoot),
        routing: "file-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: false,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: true,
          ssg: true,
          isr: false,
          edgeRuntime: true,
          middleware: true,
          apiRoutes: true,
          streaming: true,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // ── Astro ──
    if (allDeps["astro"]) {
      const uiLib: ProjectStack["uiLibrary"] = (
        allDeps["react"] ? "react" : allDeps["vue"] ? "vue" : "unknown"
      ) as ProjectStack["uiLibrary"];
      return {
        uiLibrary: uiLib,
        uiLibraryVersion: null,
        metaFramework: "astro",
        metaFrameworkVersion: cleanVersion(allDeps["astro"]) || null,
        bundler: "vite",
        packageManager: detectPackageManager(projectRoot),
        routing: "file-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: true,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: true,
          ssg: true,
          isr: false,
          edgeRuntime: false,
          middleware: true,
          apiRoutes: true,
          streaming: false,
          serverComponents: false,
          partialHydration: true,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // ── Gatsby ──
    if (allDeps["gatsby"]) {
      return {
        uiLibrary: "react",
        uiLibraryVersion: cleanVersion(allDeps["react"]) || null,
        metaFramework: "gatsby",
        metaFrameworkVersion: cleanVersion(allDeps["gatsby"]) || null,
        bundler: "webpack",
        packageManager: detectPackageManager(projectRoot),
        routing: "file-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: true,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: false,
          ssg: true,
          isr: false,
          edgeRuntime: false,
          middleware: false,
          apiRoutes: false,
          streaming: false,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // ── Vite (generic) ──
    if (allDeps["vite"]) {
      const isReact = !!allDeps["react"];
      const isVue = !!allDeps["vue"];
      const isSvelte = !!allDeps["svelte"];

      let fw: ProjectStack["metaFramework"] =
        "vite" as ProjectStack["metaFramework"];
      let ui: ProjectStack["uiLibrary"] =
        "unknown" as ProjectStack["uiLibrary"];

      if (isReact) {
        fw = "vite-react" as ProjectStack["metaFramework"];
        ui = "react" as ProjectStack["uiLibrary"];
      } else if (isVue) {
        fw = "vite-vue" as ProjectStack["metaFramework"];
        ui = "vue" as ProjectStack["uiLibrary"];
      } else if (isSvelte) {
        fw = "vite" as ProjectStack["metaFramework"];
        ui = "svelte" as ProjectStack["uiLibrary"];
      }

      return {
        uiLibrary: ui,
        uiLibraryVersion: null,
        metaFramework: fw,
        metaFrameworkVersion: cleanVersion(allDeps["vite"]) || null,
        bundler: "vite",
        packageManager: detectPackageManager(projectRoot),
        routing: "unknown",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: false,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: false,
          ssg: false,
          isr: false,
          edgeRuntime: false,
          middleware: false,
          apiRoutes: false,
          streaming: false,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "medium",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // React App
    if (allDeps["react-scripts"]) {
      return {
        uiLibrary: "react",
        uiLibraryVersion: cleanVersion(allDeps["react"]) || null,
        metaFramework: "cra",
        metaFrameworkVersion: cleanVersion(allDeps["react-scripts"]) || null,
        bundler: "webpack",
        packageManager: detectPackageManager(projectRoot),
        routing: "unknown",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: hasTS,
        monorepo: false,
        features: {
          imageOptimization: false,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: false,
          ssg: false,
          isr: false,
          edgeRuntime: false,
          middleware: false,
          apiRoutes: false,
          streaming: false,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }

    // Angular
    if (allDeps["@angular/core"]) {
      return {
        uiLibrary: "angular",
        uiLibraryVersion: cleanVersion(allDeps["@angular/core"]) || null,
        metaFramework: "angular-cli",
        metaFrameworkVersion: cleanVersion(allDeps["@angular/cli"]) || null,
        bundler: "webpack",
        packageManager: detectPackageManager(projectRoot),
        routing: "config-based",
        styling: detectStyling(allDeps),
        stateManagement: detectStateManagement(allDeps),
        typescript: true,
        monorepo: false,
        features: {
          imageOptimization: false,
          scriptOptimization: false,
          fontOptimization: false,
          ssr: !!allDeps["@angular/ssr"],
          ssg: false,
          isr: false,
          edgeRuntime: false,
          middleware: false,
          apiRoutes: false,
          streaming: false,
          serverComponents: false,
          partialHydration: false,
        },
        confidence: "high",
        detectedFrom: ["package.json"],
      } as ProjectStack;
    }
  } catch {}

  return null;
}

function buildNextjsStack(routing: string, pageFile: string): ProjectStack {
  const isTS = pageFile.endsWith(".tsx") || pageFile.endsWith(".ts");
  const isAppRouter = routing === "app-router";

  return {
    uiLibrary: "react" as ProjectStack["uiLibrary"],
    uiLibraryVersion: null,
    metaFramework: "nextjs" as ProjectStack["metaFramework"],
    metaFrameworkVersion: null,
    bundler: "webpack" as ProjectStack["bundler"],
    packageManager: "unknown" as ProjectStack["packageManager"],
    routing: routing as ProjectStack["routing"],
    styling: [] as unknown as ProjectStack["styling"],
    stateManagement: [] as unknown as ProjectStack["stateManagement"],
    typescript: isTS,
    monorepo: false,
    features: {
      imageOptimization: true,
      scriptOptimization: true,
      fontOptimization: true,
      ssr: true,
      ssg: true,
      isr: true,
      edgeRuntime: isAppRouter,
      middleware: true,
      apiRoutes: true,
      streaming: isAppRouter,
      serverComponents: isAppRouter,
      partialHydration: false,
    },
    confidence: "high",
    detectedFrom: ["route-pattern"],
  } as ProjectStack;
}

function detectRouteFile(
  report: Report,
  projectStack: ProjectStack | null,
): string | null {
  if (
    report.correlationResult &&
    report.correlationResult.routeMaps &&
    report.correlationResult.routeMaps.length > 0
  ) {
    const routeMap = report.correlationResult.routeMaps[0];
    if (routeMap && routeMap.pageFile) {
      return routeMap.pageFile;
    }
  }

  if (
    !report.correlationResult ||
    !report.correlationResult.projectRoot ||
    !projectStack
  ) {
    return null;
  }

  const projectRoot = report.correlationResult.projectRoot;

  try {
    const urlPath = new URL(report.url).pathname;

    if (projectStack.metaFramework === "nextjs") {
      return findNextjsRouteFile(projectRoot, urlPath, projectStack.routing);
    }

    if (projectStack.metaFramework === "nuxt") {
      return findFileWithExtensions(
        projectRoot,
        urlPath === "/" ? "pages/index" : `pages${urlPath}`,
        ["vue"],
      );
    }

    if (projectStack.metaFramework === "sveltekit") {
      const routeDir = urlPath === "/" ? "src/routes" : `src/routes${urlPath}`;
      return findFileWithExtensions(projectRoot, `${routeDir}/+page`, [
        "svelte",
        "ts",
      ]);
    }

    if (projectStack.metaFramework === "astro") {
      return findFileWithExtensions(
        projectRoot,
        urlPath === "/" ? "src/pages/index" : `src/pages${urlPath}`,
        ["astro", "tsx", "jsx"],
      );
    }

    if (projectStack.metaFramework === "remix") {
      const routeName =
        urlPath === "/" ? "_index" : urlPath.slice(1).replace(/\//g, ".");
      return findFileWithExtensions(projectRoot, `app/routes/${routeName}`, [
        "tsx",
        "jsx",
        "ts",
        "js",
      ]);
    }
  } catch {}

  return null;
}

function findNextjsRouteFile(
  projectRoot: string,
  urlPath: string,
  routing: string,
): string | null {
  const extensions = ["tsx", "jsx", "ts", "js"];

  if (routing === "app-router") {
    const routeDir = urlPath === "/" ? "app" : `app${urlPath}`;

    return (
      findFileWithExtensions(projectRoot, `${routeDir}/page`, extensions) ||
      findFileWithExtensions(projectRoot, `src/${routeDir}/page`, extensions)
    );
  }

  if (routing === "pages-router") {
    const routeBase = urlPath === "/" ? "pages/index" : `pages${urlPath}`;

    return (
      findFileWithExtensions(projectRoot, routeBase, extensions) ||
      findFileWithExtensions(projectRoot, `src/${routeBase}`, extensions)
    );
  }

  return null;
}

function findFileWithExtensions(
  projectRoot: string,
  basePath: string,
  extensions: string[],
): string | null {
  for (const ext of extensions) {
    const abs = path.join(projectRoot, `${basePath}.${ext}`);
    if (fs.existsSync(abs)) {
      return normalizeProjectRelative(projectRoot, abs);
    }
  }
  return null;
}

function normalizeProjectRelative(
  projectRoot: string,
  filePath: string,
): string {
  const rel = path.relative(projectRoot, filePath);
  return rel.split(path.sep).join("/");
}

function findCorrelationForFinding(
  finding: Finding,
  report: Report,
): FindingCorrelations | null {
  if (
    !report.correlationResult ||
    !report.correlationResult.findingCorrelations ||
    report.correlationResult.findingCorrelations.length === 0
  ) {
    return null;
  }

  return (
    report.correlationResult.findingCorrelations.find(
      (fc) => fc.findingId === finding.id,
    ) || null
  );
}

function cleanVersion(version?: string | null): string | null {
  if (!version) return null;
  return version.replace(/^[^\d]*/, "").trim() || null;
}

function detectPackageManager(
  projectRoot: string,
): ProjectStack["packageManager"] {
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) return "bun";
  if (
    fs.existsSync(path.join(projectRoot, "package-lock.json")) ||
    fs.existsSync(path.join(projectRoot, "npm-shrinkwrap.json"))
  ) {
    return "npm";
  }
  return "unknown";
}

function detectStyling(deps: Record<string, string>): ProjectStack["styling"] {
  const styles: string[] = [];

  if (deps["tailwindcss"]) styles.push("tailwind");
  if (deps["styled-components"]) styles.push("styled-components");
  if (deps["@emotion/react"] || deps["@emotion/styled"]) styles.push("emotion");
  if (deps["sass"] || deps["node-sass"]) styles.push("sass");
  if (deps["less"]) styles.push("less");
  if (deps["@mui/material"]) styles.push("mui");
  if (deps["@chakra-ui/react"]) styles.push("chakra-ui");

  return styles.length > 0
    ? (styles as unknown as ProjectStack["styling"])
    : ([] as unknown as ProjectStack["styling"]);
}

function detectStateManagement(
  deps: Record<string, string>,
): ProjectStack["stateManagement"] {
  const state: string[] = [];

  if (deps["@reduxjs/toolkit"] || deps["redux"]) state.push("redux");
  if (deps["zustand"]) state.push("zustand");
  if (deps["mobx"]) state.push("mobx");
  if (deps["recoil"]) state.push("recoil");
  if (deps["jotai"]) state.push("jotai");
  if (deps["@tanstack/react-query"] || deps["react-query"]) {
    state.push("react-query");
  }
  if (deps["xstate"]) state.push("xstate");

  return state.length > 0
    ? (state as unknown as ProjectStack["stateManagement"])
    : ([] as unknown as ProjectStack["stateManagement"]);
}

function formatEvidenceData(data: unknown): string {
  if (data === null || data === undefined) {
    return String(data);
  }

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "number" || typeof data === "boolean") {
    return String(data);
  }

  if (typeof data === "object" && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>;

    if ("value" in obj) {
      const unit = obj.unit ? String(obj.unit) : "";
      let result = `${obj.value}${unit ? ` ${unit}` : ""}`;

      if ("threshold" in obj) {
        result += ` (threshold: ${obj.threshold}${unit ? ` ${unit}` : ""})`;
      }
      return result;
    }

    if ("note" in obj && typeof obj.note === "string") {
      return obj.note;
    }

    const entries = Object.entries(obj).filter(([k]) => !k.startsWith("_"));
    if (entries.length <= 4) {
      return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
    }

    return JSON.stringify(data);
  }

  if (Array.isArray(data)) {
    if (data.length <= 3) {
      return data.map(String).join(", ");
    }
    return `${data.slice(0, 3).map(String).join(", ")} ... and ${data.length - 3} more`;
  }

  return JSON.stringify(data);
}
