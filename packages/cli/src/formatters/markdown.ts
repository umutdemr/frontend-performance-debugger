import type {
  Report,
  Finding,
  EnvironmentContext,
  CategoryScore,
  OwnershipHint,
} from "@fpd/shared-types";
import { SEVERITY_LABEL, CATEGORY_LABEL } from "@fpd/shared-types";

const SEVERITY_EMOJI: Record<string, string> = {
  critical: "🔴",
  warning: "🟡",
  info: "🔵",
  success: "🟢",
};

const OWNERSHIP_EMOJI: Record<string, string> = {
  "app-owned": "📱",
  "framework-owned": "🔧",
  "config-owned": "⚙️",
  "infra-owned": "🏗️",
  "third-party": "📦",
  unknown: "❓",
};

const ENVIRONMENT_BADGE: Record<string, string> = {
  "local-dev": "🏠 Local Development",
  preview: "👁️ Preview",
  staging: "🎭 Staging",
  production: "🚀 Production",
  unknown: "❔ Unknown",
};

export interface MarkdownFormatOptions {
  includeEnvironment?: boolean;
  includeScoreBreakdown?: boolean;
  includeCategoryScores?: boolean;
  includeFrameworkRecommendations?: boolean;
  includeOwnership?: boolean;
  includeAnalysisNotes?: boolean;
  maxEvidenceItems?: number;
}

export function formatAsMarkdown(
  report: Report,
  options: MarkdownFormatOptions = {},
): string {
  const opts: Required<MarkdownFormatOptions> = {
    includeEnvironment: options.includeEnvironment ?? true,
    includeScoreBreakdown: options.includeScoreBreakdown ?? true,
    includeCategoryScores: options.includeCategoryScores ?? true,
    includeFrameworkRecommendations:
      options.includeFrameworkRecommendations ?? true,
    includeOwnership: options.includeOwnership ?? true,
    includeAnalysisNotes: options.includeAnalysisNotes ?? true,
    maxEvidenceItems: options.maxEvidenceItems ?? 5,
  };

  const lines: string[] = [];

  lines.push("# Frontend Performance Report");
  lines.push("");

  lines.push("## Overview");
  lines.push("");
  lines.push(`| Property | Value |`);
  lines.push(`|----------|-------|`);
  lines.push(`| **URL** | ${report.url} |`);
  lines.push(
    `| **Analyzed** | ${new Date(report.timestamp).toLocaleString()} |`,
  );
  lines.push(`| **Duration** | ${report.duration}ms |`);

  if (report.environment) {
    const envBadge = getEnvironmentBadge(report.environment);
    lines.push(`| **Environment** | ${envBadge} |`);
  }

  if (report.framework) {
    const frameworkLabel = formatFrameworkLabel(report.framework);
    lines.push(`| **Framework** | ${frameworkLabel} |`);
  }

  if (report.summary.score !== undefined) {
    const scoreLabel = getScoreLabel(report.summary.score);
    const scoreEmoji = getScoreEmoji(report.summary.score);
    lines.push(
      `| **Score** | ${scoreEmoji} ${report.summary.score}/100 (${scoreLabel}) |`,
    );
  }

  lines.push("");

  if (report.environment && report.environment.isLocalDev) {
    lines.push("> ⚠️ **Local Development Environment**");
    lines.push(">");
    lines.push(
      "> This analysis was performed against a local development environment.",
    );
    lines.push(
      "> Some findings may not reflect production behavior. Cache and performance",
    );
    lines.push(
      "> findings should be verified in a production-like environment.",
    );
    lines.push("");
  } else if (report.environment && !report.environment.cacheHeadersReliable) {
    lines.push("> ℹ️ **Environment Note**");
    lines.push(">");
    lines.push(
      "> Cache-related findings may not reflect production configuration.",
    );
    lines.push("");
  }

  lines.push(`> ${report.summary.headline}`);
  lines.push("");

  if (opts.includeScoreBreakdown && report.scoreBreakdown) {
    lines.push("### Score Breakdown");
    lines.push("");
    lines.push("| Component | Value |");
    lines.push("|-----------|-------|");
    lines.push(`| Base Score | ${report.scoreBreakdown.baseScore} |`);
    lines.push(
      `| Finding Deductions | -${report.scoreBreakdown.findingDeductions.toFixed(1)} |`,
    );

    if (report.scoreBreakdown.criticalPenalty > 0) {
      lines.push(
        `| Critical Penalty | -${report.scoreBreakdown.criticalPenalty} |`,
      );
    }
    if (report.scoreBreakdown.categoryCollapsePenalty > 0) {
      lines.push(
        `| Category Collapse Penalty | -${report.scoreBreakdown.categoryCollapsePenalty.toFixed(1)} |`,
      );
    }
    if (report.scoreBreakdown.environmentAdjustment > 0) {
      lines.push(
        `| Environment Adjustment | +${report.scoreBreakdown.environmentAdjustment.toFixed(1)} (reduced penalties) |`,
      );
    }
    lines.push(`| **Final Score** | **${report.scoreBreakdown.finalScore}** |`);
    lines.push("");
  }

  if (opts.includeCategoryScores && report.categoryScores) {
    lines.push("### Category Scores");
    lines.push("");
    lines.push("| Category | Score | Status |");
    lines.push("|----------|-------|--------|");

    const categories = [
      { key: "performance", label: "Performance" },
      { key: "network", label: "Network" },
      { key: "architecture", label: "Architecture" },
      { key: "seoSecurity", label: "SEO & Security" },
    ];

    for (const { key, label } of categories) {
      const score = report.categoryScores[key];
      if (score) {
        const status = getCategoryStatus(score);
        lines.push(
          `| ${label} | ${score.score}/${score.maxScore} | ${status} |`,
        );
      }
    }
    lines.push("");
  }

  lines.push("## Summary");
  lines.push("");
  lines.push(`| Severity | Count |`);
  lines.push(`|----------|-------|`);

  const { bySeverity } = report.summary;
  lines.push(
    `| ${SEVERITY_EMOJI.critical} Critical | ${bySeverity.critical} |`,
  );
  lines.push(`| ${SEVERITY_EMOJI.warning} Warning | ${bySeverity.warning} |`);
  lines.push(`| ${SEVERITY_EMOJI.info} Info | ${bySeverity.info} |`);
  lines.push(`| ${SEVERITY_EMOJI.success} Success | ${bySeverity.success} |`);
  lines.push("");

  if (report.findingsSummary) {
    if (
      report.findingsSummary.environmentLimited > 0 ||
      report.findingsSummary.downgraded > 0
    ) {
      lines.push("**Notes:**");
      if (report.findingsSummary.environmentLimited > 0) {
        lines.push(
          `- ⚠️ ${report.findingsSummary.environmentLimited} finding(s) have reduced confidence due to environment limitations`,
        );
      }
      if (report.findingsSummary.downgraded > 0) {
        lines.push(
          `- ↓ ${report.findingsSummary.downgraded} finding(s) were downgraded from original severity`,
        );
      }
      lines.push("");
    }
  }

  if (report.summary.topRootCauses && report.summary.topRootCauses.length > 0) {
    lines.push("### Top Root Causes");
    lines.push("");
    for (let i = 0; i < report.summary.topRootCauses.length; i++) {
      const cause = report.summary.topRootCauses[i];
      if (cause) {
        lines.push(`${i + 1}. **[${cause.group}]** ${cause.description}`);
      }
    }
    lines.push("");
  }

  if (report.findings.length > 0) {
    lines.push("## Findings");
    lines.push("");

    const severityOrder = ["critical", "warning", "info", "success"];

    for (const severity of severityOrder) {
      const severityFindings = report.findings.filter(
        (f) => f.severity === severity,
      );

      if (severityFindings.length > 0) {
        const emoji = SEVERITY_EMOJI[severity];
        const label = SEVERITY_LABEL[severity as keyof typeof SEVERITY_LABEL];
        lines.push(`### ${emoji} ${label} (${severityFindings.length})`);
        lines.push("");

        for (const finding of severityFindings) {
          lines.push(formatFinding(finding, opts));
          lines.push("");
        }
      }
    }
  } else {
    lines.push("## Findings");
    lines.push("");
    lines.push("✅ No issues found!");
    lines.push("");
  }

  if (
    opts.includeAnalysisNotes &&
    report.environment &&
    report.environment.analysisNotes.length > 0
  ) {
    lines.push("## Analysis Notes");
    lines.push("");
    for (const note of report.environment.analysisNotes) {
      lines.push(`- ${note}`);
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(`*Generated by ${report.tool.name} v${report.tool.version}*`);

  return lines.join("\n");
}

function formatFinding(
  finding: Finding,
  options: Required<MarkdownFormatOptions>,
): string {
  const lines: string[] = [];
  const emoji = SEVERITY_EMOJI[finding.severity] ?? "⚪";
  const severityLabel = SEVERITY_LABEL[finding.severity];
  const categoryLabel = CATEGORY_LABEL[finding.category];

  let title = `#### ${emoji} ${finding.title}`;
  if (
    options.includeOwnership &&
    finding.ownership &&
    finding.ownership.type !== "unknown"
  ) {
    const ownershipEmoji = OWNERSHIP_EMOJI[finding.ownership.type] || "❓";
    title += ` ${ownershipEmoji}`;
  }
  lines.push(title);
  lines.push("");

  if (finding.originalSeverity) {
    lines.push(
      `> ↓ *Severity downgraded from ${SEVERITY_LABEL[finding.originalSeverity]} due to environment*`,
    );
    lines.push("");
  }

  let metadata = `**Severity:** ${severityLabel} | **Category:** ${categoryLabel}`;

  if (finding.confidence) {
    metadata += ` | **Confidence:** ${finding.confidence}`;
  }

  if (finding.priority && finding.priority !== "none") {
    metadata += ` | **Priority:** ${finding.priority}`;
  }

  lines.push(metadata);
  lines.push("");

  lines.push(finding.description);
  lines.push("");

  if (
    finding.environmentLimited &&
    finding.environmentNotes &&
    finding.environmentNotes.length > 0
  ) {
    lines.push(`> ⚠️ **Environment Note:** ${finding.environmentNotes[0]}`);
    lines.push("");
  }

  if (finding.evidence && finding.evidence.length > 0) {
    lines.push("<details>");
    lines.push("<summary>Evidence</summary>");
    lines.push("");

    const evidenceToShow = finding.evidence.slice(0, options.maxEvidenceItems);

    for (const e of evidenceToShow) {
      const dataStr =
        typeof e.data === "object"
          ? "```json\n" + JSON.stringify(e.data, null, 2) + "\n```"
          : `\`${e.data}\``;
      lines.push(`- **${e.label || e.type}:** ${dataStr}`);
    }

    if (finding.evidence.length > options.maxEvidenceItems) {
      lines.push("");
      lines.push(
        `*... and ${finding.evidence.length - options.maxEvidenceItems} more evidence items*`,
      );
    }

    if (finding.evidenceSummary) {
      lines.push("");
      lines.push(
        `*Total: ${finding.evidenceSummary.totalCount} items, ${finding.evidenceSummary.uniqueCount} unique*`,
      );
    }

    lines.push("");
    lines.push("</details>");
    lines.push("");
  }

  lines.push(`**Impact:** ${finding.impact}`);
  lines.push("");

  lines.push(`**Recommendation:** ${finding.recommendation}`);
  lines.push("");

  if (
    options.includeFrameworkRecommendations &&
    finding.frameworkRecommendation
  ) {
    lines.push(`**Framework Tip:** ${finding.frameworkRecommendation}`);
    lines.push("");
  }

  if (
    options.includeOwnership &&
    finding.ownership &&
    finding.ownership.reason
  ) {
    const ownershipLabel = formatOwnershipType(finding.ownership.type);
    lines.push(`**Owner:** ${ownershipLabel} — ${finding.ownership.reason}`);
    lines.push("");
  }

  if (finding.learnMoreUrl) {
    lines.push(`📚 [Learn more](${finding.learnMoreUrl})`);
  }

  return lines.join("\n");
}

// ============================================
// Helper Functions
// ============================================

function getEnvironmentBadge(env: EnvironmentContext): string {
  const badge: string =
    ENVIRONMENT_BADGE[env.runtimeEnvironment] ??
    ENVIRONMENT_BADGE["unknown"] ??
    "❔ Unknown";

  const warnings: string[] = [];
  if (!env.cacheHeadersReliable) {
    warnings.push("cache headers unreliable");
  }
  if (!env.productionLikeBuild) {
    warnings.push("dev build");
  }

  if (warnings.length > 0) {
    return `${badge} *(${warnings.join(", ")})*`;
  }

  return badge;
}

function formatFrameworkLabel(framework: {
  name: string;
  version?: string;
  confidence: string;
}): string {
  let label = formatFrameworkName(framework.name);

  if (framework.version) {
    label += ` v${framework.version}`;
  }

  if (framework.confidence !== "high") {
    label += ` *(${framework.confidence} confidence)*`;
  }

  return label;
}

function formatFrameworkName(framework: string): string {
  const names: Record<string, string> = {
    "next.js": "Next.js",
    nextjs: "Next.js",
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

  return (
    names[framework.toLowerCase()] ||
    framework.charAt(0).toUpperCase() + framework.slice(1)
  );
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "Good";
  if (score >= 50) return "Needs Improvement";
  if (score >= 30) return "Poor";
  return "Critical";
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return "🟢";
  if (score >= 70) return "🟡";
  if (score >= 50) return "🟠";
  return "🔴";
}

function getCategoryStatus(score: CategoryScore): string {
  if (score.collapsed) {
    return "🔴 **Severely Impacted**";
  }

  const ratio = score.score / score.maxScore;
  if (ratio >= 0.9) return "✅ Excellent";
  if (ratio >= 0.7) return "👍 Good";
  if (ratio >= 0.5) return "⚠️ Needs Work";
  return "❗ Poor";
}

function formatOwnershipType(type: string): string {
  const labels: Record<string, string> = {
    "app-owned": "📱 Application",
    "framework-owned": "🔧 Framework",
    "config-owned": "⚙️ Configuration",
    "infra-owned": "🏗️ Infrastructure",
    "third-party": "📦 Third-party",
    unknown: "❓ Unknown",
  };
  return labels[type] || type;
}

export function formatAsSimpleMarkdown(report: Report): string {
  return formatAsMarkdown(report, {
    includeEnvironment: true,
    includeScoreBreakdown: false,
    includeCategoryScores: false,
    includeFrameworkRecommendations: false,
    includeOwnership: false,
    includeAnalysisNotes: false,
    maxEvidenceItems: 2,
  });
}

export function formatAsDetailedMarkdown(report: Report): string {
  return formatAsMarkdown(report, {
    includeEnvironment: true,
    includeScoreBreakdown: true,
    includeCategoryScores: true,
    includeFrameworkRecommendations: true,
    includeOwnership: true,
    includeAnalysisNotes: true,
    maxEvidenceItems: 10,
  });
}
