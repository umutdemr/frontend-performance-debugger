import type {
  Report,
  Finding,
  RootCause,
  EnvironmentContext,
  CategoryScore,
} from "@fpd/shared-types";
import { getViewerStyles } from "./viewer-styles";

export function generateReportHTML(report: Report): string {
  const reportJson = JSON.stringify(report)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  const score = report.summary.score ?? 0;
  const findings = Array.isArray(report.findings) ? report.findings : [];
  const analyzedAt = safeDate(report.timestamp);
  const correlationRate = Math.round(
    (report.correlationResult?.correlationRate ?? 0) * 100,
  );

  const scoreAngle = Math.max(
    0,
    Math.min(360, Math.round((score / 100) * 360)),
  );

  const envLabel = report.environment
    ? formatEnvironmentLabel(report.environment)
    : null;
  const envClass = report.environment?.isLocalDev
    ? "meta-chip-warning"
    : report.environment?.runtimeEnvironment === "production"
      ? "meta-chip-success"
      : "meta-chip-info";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FPD Report — ${escapeHtml(report.url)}</title>
  <meta name="color-scheme" content="dark" />
  <style>${getViewerStyles(scoreAngle)}</style>
</head>
<body>
  <div id="app">
    <header class="shell-header">
      <div class="container shell-header-inner">
        <div class="brand-block">
          <div class="brand-mark" aria-hidden="true">
            <span>FPD</span>
          </div>
          <div class="brand-copy">
            <p class="eyebrow">Performance Analysis Report</p>
            <h1 class="brand-title">Frontend Performance Debugger</h1>
            <p class="brand-subtitle">${escapeHtml(report.url)}</p>
          </div>
        </div>

        <div class="header-meta">
          ${
            envLabel
              ? `
          <div class="meta-chip ${envClass}">
            <span class="meta-chip-label">Environment</span>
            <span class="meta-chip-value">${escapeHtml(envLabel)}</span>
          </div>
          `
              : ""
          }
          ${
            report.framework
              ? `
          <div class="meta-chip">
            <span class="meta-chip-label">Framework</span>
            <span class="meta-chip-value">${escapeHtml(formatFrameworkLabel(report.framework))}</span>
          </div>
          `
              : ""
          }
          <div class="meta-chip">
            <span class="meta-chip-label">Generated</span>
            <span class="meta-chip-value">${escapeHtml(analyzedAt)}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="container page-content">
      ${
        report.environment?.isLocalDev
          ? `
      <div class="env-banner">
        <span class="env-banner-icon">⚠</span>
        <span class="env-banner-text">
          <strong>Local Development Analysis</strong> — Some findings may not reflect production behavior. 
          Cache and header-based findings have reduced confidence.
        </span>
      </div>
      `
          : report.environment?.runtimeEnvironment === "preview"
            ? `
      <div class="env-banner">
        <span class="env-banner-icon">👁️</span>
        <span class="env-banner-text">
          <strong>Preview Environment Analysis</strong> — Some optimizations may differ from production.
        </span>
      </div>
      `
            : ""
      }

      <section class="hero card glass-card">
        <div class="hero-main">
          <div class="hero-score ${getScoreClass(score)}">
            <div class="hero-score-shell">
              <div class="hero-score-ring">
                <div class="hero-score-center">
                  <div class="hero-score-value">${score}</div>
                  <div class="hero-score-label">Overall Score</div>
                </div>
              </div>
              <div class="hero-score-caption">
                <span class="hero-score-caption-dot"></span>
                ${getScoreLabel(score)}
              </div>
            </div>
          </div>

          <div class="hero-summary">
            <div class="hero-headline-wrap">
              <p class="eyebrow">Executive Summary</p>
              <h2 class="hero-headline">${escapeHtml(report.summary.headline || "No summary headline available")}</h2>
            </div>

            <div class="hero-stats">
              ${renderStat("Findings", String(findings.length), "Detected issues and opportunities")}
              ${renderStat("Duration", formatDuration(report.duration), "Analysis runtime")}
              ${renderStat("Correlated", String(report.correlationResult?.highConfidenceCount ?? 0), correlationRate ? `${correlationRate}% match rate` : "No correlation rate")}
              ${renderStat("Route", report.correlationResult?.routeMaps?.[0]?.pageFile ?? "—", "Primary mapped source")}
            </div>
          </div>
        </div>
      </section>

      <section class="grid grid-12 section-gap">
        <div class="card col-7">
          <div class="section-head">
            <div>
              <p class="section-kicker">Overview</p>
              <h2 class="section-title">Report Context</h2>
            </div>
          </div>

          <div class="kv-list refined">
            ${renderKV("URL", report.url)}
            ${renderKV("Analyzed", analyzedAt)}
            ${renderKV("Duration", formatDuration(report.duration))}
            ${report.environment ? renderKV("Environment", formatEnvironmentLabel(report.environment)) : ""}
            ${report.framework ? renderKV("Framework", formatFrameworkLabel(report.framework)) : ""}
            ${report.correlationResult?.routeMaps?.[0] ? renderKV("Route", report.correlationResult.routeMaps[0].pageFile) : ""}
            ${renderKV("Findings", String(findings.length))}
            ${report.findingsSummary?.environmentLimited ? renderKV("Env-Limited", `${report.findingsSummary.environmentLimited} findings`) : ""}
            ${report.findingsSummary?.downgraded ? renderKV("Downgraded", `${report.findingsSummary.downgraded} findings`) : ""}
          </div>
        </div>

        <div class="card col-5">
          <div class="section-head">
            <div>
              <p class="section-kicker">Scoring</p>
              <h2 class="section-title">Score Breakdown</h2>
            </div>
          </div>

          ${
            report.categoryScores
              ? `
            <div class="breakdown-stack">
              ${renderBreakdownBar("Performance", report.summary.breakdown?.performance ?? `${report.categoryScores.performance?.score ?? 0}/${report.categoryScores.performance?.maxScore ?? 0}`, report.categoryScores.performance)}
              ${renderBreakdownBar("Network", report.summary.breakdown?.network ?? `${report.categoryScores.network?.score ?? 0}/${report.categoryScores.network?.maxScore ?? 0}`, report.categoryScores.network)}
              ${renderBreakdownBar("Architecture", report.summary.breakdown?.architecture ?? `${report.categoryScores.architecture?.score ?? 0}/${report.categoryScores.architecture?.maxScore ?? 0}`, report.categoryScores.architecture)}
              ${renderBreakdownBar("SEO / Security", report.summary.breakdown?.seoSecurity ?? `${report.categoryScores.seoSecurity?.score ?? 0}/${report.categoryScores.seoSecurity?.maxScore ?? 0}`, report.categoryScores.seoSecurity)}
            </div>
          `
              : `<div class="empty-state compact">No score breakdown available.</div>`
          }

          ${
            report.scoreBreakdown
              ? `
            <div class="score-breakdown-details">
              <h3 class="breakdown-details-title">Score Calculation</h3>
              <div class="breakdown-details-list">
                ${renderScoreBreakdownItem("Base Score", report.scoreBreakdown.baseScore)}
                ${renderScoreBreakdownItem("Finding Deductions", -report.scoreBreakdown.findingDeductions, true)}
                ${report.scoreBreakdown.criticalPenalty > 0 ? renderScoreBreakdownItem("Critical Penalty", -report.scoreBreakdown.criticalPenalty, true) : ""}
                ${report.scoreBreakdown.categoryCollapsePenalty > 0 ? renderScoreBreakdownItem("Collapse Penalty", -report.scoreBreakdown.categoryCollapsePenalty, true) : ""}
                ${report.scoreBreakdown.environmentAdjustment > 0 ? renderScoreBreakdownItem("Environment Adjustment", report.scoreBreakdown.environmentAdjustment, false, "positive") : ""}
                <div class="breakdown-details-divider"></div>
                ${renderScoreBreakdownItem("Final Score", report.scoreBreakdown.finalScore, false, "final")}
              </div>
            </div>
          `
              : ""
          }
        </div>
      </section>

      <section class="grid grid-12 section-gap">
        <div class="card col-4">
          <div class="section-head">
            <div>
              <p class="section-kicker">Severity</p>
              <h2 class="section-title">Distribution</h2>
            </div>
          </div>

          <div class="severity-stack">
            ${renderSeverityBadge("Critical", report.summary.bySeverity.critical, "critical")}
            ${renderSeverityBadge("Warning", report.summary.bySeverity.warning, "warning")}
            ${renderSeverityBadge("Info", report.summary.bySeverity.info, "info")}
            ${renderSeverityBadge("Success", report.summary.bySeverity.success, "success")}
          </div>

          ${
            report.findingsSummary
              ? `
          <div class="findings-summary-note">
            ${
              report.findingsSummary.environmentLimited > 0
                ? `
              <div class="summary-note-item">
                <span class="summary-note-icon">⚠</span>
                <span>${report.findingsSummary.environmentLimited} findings have reduced confidence</span>
              </div>
            `
                : ""
            }
            ${
              report.findingsSummary.downgraded > 0
                ? `
              <div class="summary-note-item">
                <span class="summary-note-icon">↓</span>
                <span>${report.findingsSummary.downgraded} findings were downgraded</span>
              </div>
            `
                : ""
            }
          </div>
          `
              : ""
          }
        </div>

        <div class="card col-8">
          <div class="section-head">
            <div>
              <p class="section-kicker">Diagnostics</p>
              <h2 class="section-title">Top Root Causes</h2>
            </div>
          </div>

          ${
            report.summary.topRootCauses &&
            report.summary.topRootCauses.length > 0
              ? `
            <div class="root-cause-list">
              ${report.summary.topRootCauses
                .map((cause: RootCause, i: number) => renderRootCause(cause, i))
                .join("")}
            </div>
          `
              : `<div class="empty-state compact">No root causes were identified.</div>`
          }
        </div>
      </section>

      ${
        report.correlationResult &&
        report.correlationResult.findingCorrelations.length > 0
          ? `
        <section class="card section-gap">
          <div class="section-head section-head-spread">
            <div>
              <p class="section-kicker">Source Mapping</p>
              <h2 class="section-title">Correlations</h2>
            </div>
            <div class="section-head-note">
              ${report.correlationResult.findingCorrelations.length} findings mapped · ${report.correlationResult.totalCorrelations} locations
            </div>
          </div>

          <div class="correlation-list">
            ${report.correlationResult.findingCorrelations
              .map((fc) => {
                const finding = findings.find((f) => f.id === fc.findingId);
                if (!finding) return "";

                const ownershipBadge =
                  finding.ownership && finding.ownership.type !== "unknown"
                    ? `<span class="ownership-badge ownership-${escapeAttr(finding.ownership.type)}">${escapeHtml(formatOwnershipLabel(finding.ownership.type))}</span>`
                    : "";

                return `
                  <article class="correlation-item">
                    <div class="correlation-header">
                      <div class="correlation-header-main">
                        <span class="badge badge-${escapeAttr(finding.severity)}">${escapeHtml(finding.severity.toUpperCase())}</span>
                        <h3 class="correlation-title">${escapeHtml(finding.title)}</h3>
                        ${ownershipBadge}
                      </div>
                      <span class="muted">${fc.totalLocations} location${fc.totalLocations > 1 ? "s" : ""}</span>
                    </div>

                    <div class="correlation-locations">
                      ${fc.correlations
                        .slice(0, 3)
                        .map(
                          (c) => `
                        <div class="location-card">
                          <div class="location-topline">
                            <code class="code-path">${escapeHtml(c.location.filePath)}${c.location.lineNumber ? `:${c.location.lineNumber}` : ""}</code>
                            <span class="confidence-badge confidence-${escapeAttr(normalizeConfidence(c.confidence))}">${escapeHtml(String(c.confidence))}</span>
                            <button
                              type="button"
                              class="icon-btn copy-btn"
                              data-copy="${escapeAttr(`${c.location.filePath}${c.location.lineNumber ? `:${c.location.lineNumber}` : ""}`)}"
                              aria-label="Copy source location"
                              title="Copy source location"
                            >
                              Copy
                            </button>
                          </div>
                          ${
                            c.location.codeSnippet
                              ? `<pre class="snippet">${escapeHtml(c.location.codeSnippet)}</pre>`
                              : `<div class="empty-inline">No code snippet available.</div>`
                          }
                        </div>
                      `,
                        )
                        .join("")}
                      ${
                        fc.totalLocations > 3
                          ? `<div class="muted more-locations">+ ${fc.totalLocations - 3} more location${fc.totalLocations - 3 > 1 ? "s" : ""}</div>`
                          : ""
                      }
                    </div>
                  </article>
                `;
              })
              .join("")}
          </div>
        </section>
      `
          : ""
      }

      <section class="card findings-shell section-gap">
        <div class="section-head section-head-spread findings-head">
          <div>
            <p class="section-kicker">Actionable Findings</p>
            <h2 class="section-title">Findings</h2>
          </div>
          <div class="section-head-note"><span id="resultsCount">${findings.length}</span> visible</div>
        </div>

        <div class="toolbar" aria-label="Findings controls">
          <div class="toolbar-row">
            <div class="search-wrap">
              <label class="sr-only" for="findingSearch">Search findings</label>
              <input
                id="findingSearch"
                class="search-input"
                type="search"
                placeholder="Search by title, category, ID, impact, recommendation..."
                autocomplete="off"
              />
            </div>

            <div class="toolbar-actions">
              <div class="select-wrap">
                <label class="sr-only" for="sortSelect">Sort findings</label>
                <select id="sortSelect" class="control-select" aria-label="Sort findings">
                  <option value="severity-desc">Sort: Severity</option>
                  <option value="priority-desc">Sort: Priority</option>
                  <option value="title-asc">Sort: Title A–Z</option>
                  <option value="title-desc">Sort: Title Z–A</option>
                </select>
                <span class="select-icon" aria-hidden="true">⌄</span>
              </div>

              <button type="button" id="expandAllBtn" class="secondary-btn">Expand all</button>
              <button type="button" id="collapseAllBtn" class="secondary-btn">Collapse all</button>
            </div>
          </div>

          <div class="filter-row" role="tablist" aria-label="Filter findings by severity">
            <button type="button" class="filter-chip filter-chip-all active" data-severity="all" role="tab" aria-selected="true">All <span>${findings.length}</span></button>
            <button type="button" class="filter-chip filter-chip-critical" data-severity="critical" role="tab" aria-selected="false">Critical <span>${report.summary.bySeverity.critical}</span></button>
            <button type="button" class="filter-chip filter-chip-warning" data-severity="warning" role="tab" aria-selected="false">Warning <span>${report.summary.bySeverity.warning}</span></button>
            <button type="button" class="filter-chip filter-chip-info" data-severity="info" role="tab" aria-selected="false">Info <span>${report.summary.bySeverity.info}</span></button>
            <button type="button" class="filter-chip filter-chip-success" data-severity="success" role="tab" aria-selected="false">Success <span>${report.summary.bySeverity.success}</span></button>
          </div>
        </div>

        <div id="findingsList" class="findings-list">
          ${
            findings.length > 0
              ? findings
                  .map((finding: Finding, index: number) =>
                    renderFinding(finding, report, index),
                  )
                  .join("")
              : `<div class="empty-state">No findings available in this report.</div>`
          }
        </div>

        <div id="noResults" class="empty-state hidden">
          No findings match the current search and filter criteria.
        </div>
      </section>

      ${
        report.environment?.analysisNotes &&
        report.environment.analysisNotes.length > 0
          ? `
      <section class="card section-gap">
        <div class="section-head">
          <div>
            <p class="section-kicker">Context</p>
            <h2 class="section-title">Analysis Notes</h2>
          </div>
        </div>
        <div class="analysis-notes-list">
          ${report.environment.analysisNotes
            .map(
              (note) => `
            <div class="analysis-note-item">
              <span class="analysis-note-icon">•</span>
              <span class="analysis-note-text">${escapeHtml(note)}</span>
            </div>
          `,
            )
            .join("")}
        </div>
      </section>
      `
          : ""
      }
    </main>

    <footer class="shell-footer">
      <div class="container shell-footer-inner">
        <p>Generated by Frontend Performance Debugger</p>
        <p>${escapeHtml(analyzedAt)}</p>
      </div>
    </footer>
  </div>

  <script>
    window.__FPD_REPORT__ = ${reportJson};

    (() => {
      const findingsList = document.getElementById("findingsList");
      const searchInput = document.getElementById("findingSearch");
      const sortSelect = document.getElementById("sortSelect");
      const resultsCount = document.getElementById("resultsCount");
      const noResults = document.getElementById("noResults");
      const filterChips = Array.from(document.querySelectorAll(".filter-chip"));
      const expandAllBtn = document.getElementById("expandAllBtn");
      const collapseAllBtn = document.getElementById("collapseAllBtn");
      const copyButtons = Array.from(document.querySelectorAll(".copy-btn"));

      let currentSeverity = "all";

      const severityOrder = { critical: 4, warning: 3, info: 2, success: 1 };
      const priorityOrder = { highest: 5, high: 4, medium: 3, low: 2, lowest: 1, none: 0 };

      function getCards() { return Array.from(document.querySelectorAll(".finding-card")); }
      function normalizeText(value) { return String(value ?? "").toLowerCase().trim(); }

      function setExpanded(card, expanded) {
        const button = card.querySelector(".finding-toggle");
        const body = card.querySelector(".finding-body");
        if (!button || !body) return;
        button.setAttribute("aria-expanded", String(Boolean(expanded)));
        card.dataset.expanded = expanded ? "true" : "false";
        body.hidden = !expanded;
      }

      function updateVisibilityAndSort() {
        const query = normalizeText(searchInput?.value);
        const sortValue = sortSelect?.value || "severity-desc";
        const cards = getCards();

        cards.forEach((card) => {
          const severity = normalizeText(card.dataset.severity);
          const haystack = normalizeText(card.dataset.search);
          const severityMatch = currentSeverity === "all" || severity === currentSeverity;
          const queryMatch = !query || haystack.includes(query);
          card.classList.toggle("hidden", !(severityMatch && queryMatch));
        });

        const visibleCards = cards.filter((card) => !card.classList.contains("hidden"));

        visibleCards.sort((a, b) => {
          const aSev = severityOrder[normalizeText(a.dataset.severity)] || 0;
          const bSev = severityOrder[normalizeText(b.dataset.severity)] || 0;
          const aPri = priorityOrder[normalizeText(a.dataset.priority)] || 0;
          const bPri = priorityOrder[normalizeText(b.dataset.priority)] || 0;
          const aT = normalizeText(a.dataset.title);
          const bT = normalizeText(b.dataset.title);

          switch (sortValue) {
            case "priority-desc": return bPri - aPri || bSev - aSev || aT.localeCompare(bT);
            case "title-asc": return aT.localeCompare(bT);
            case "title-desc": return bT.localeCompare(aT);
            default: return bSev - aSev || bPri - aPri || aT.localeCompare(bT);
          }
        });

        visibleCards.forEach((card) => findingsList?.appendChild(card));
        if (resultsCount) resultsCount.textContent = String(visibleCards.length);
        if (noResults) noResults.classList.toggle("hidden", visibleCards.length > 0);
      }

      filterChips.forEach((btn) => {
        btn.addEventListener("click", () => {
          currentSeverity = btn.dataset.severity || "all";
          filterChips.forEach((chip) => { chip.classList.remove("active"); chip.setAttribute("aria-selected", "false"); });
          btn.classList.add("active");
          btn.setAttribute("aria-selected", "true");
          updateVisibilityAndSort();
        });
      });

      document.querySelectorAll(".finding-toggle").forEach((button) => {
        button.addEventListener("click", () => {
          const card = button.closest(".finding-card");
          if (!card) return;
          setExpanded(card, button.getAttribute("aria-expanded") !== "true");
        });
      });

      expandAllBtn?.addEventListener("click", () => { getCards().filter((c) => !c.classList.contains("hidden")).forEach((c) => setExpanded(c, true)); });
      collapseAllBtn?.addEventListener("click", () => { getCards().filter((c) => !c.classList.contains("hidden")).forEach((c) => setExpanded(c, false)); });
      searchInput?.addEventListener("input", updateVisibilityAndSort);
      sortSelect?.addEventListener("change", updateVisibilityAndSort);

      copyButtons.forEach((btn) => {
        btn.addEventListener("click", async () => {
          const value = btn.getAttribute("data-copy") || "";
          if (!value) return;
          const original = btn.textContent;
          try { await navigator.clipboard.writeText(value); btn.textContent = "Copied"; btn.classList.add("is-copied"); }
          catch { btn.textContent = "Failed"; }
          finally { setTimeout(() => { btn.textContent = original; btn.classList.remove("is-copied"); }, 1200); }
        });
      });

      updateVisibilityAndSort();
    })();
  </script>
</body>
</html>`;
}

// ═══════════════════════════════════════
// Render Helpers
// ═══════════════════════════════════════

function renderStat(title: string, value: string, subtitle: string): string {
  return `
    <div class="stat-card">
      <div class="stat-title">${escapeHtml(title)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      <div class="stat-subtitle">${escapeHtml(subtitle)}</div>
    </div>
  `;
}

function renderKV(key: string, value: string): string {
  return `
    <div class="kv-row">
      <span class="kv-key">${escapeHtml(key)}</span>
      <span class="kv-value" title="${escapeHtml(value)}">${escapeHtml(value)}</span>
    </div>
  `;
}

function renderBreakdownBar(
  label: string,
  value: string,
  categoryScore?: CategoryScore,
): string {
  const parts = String(value).split("/");
  const current = Number(parts[0]?.trim() ?? 0);
  const max = Number(parts[1]?.trim() ?? 0);
  const percent =
    max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const barClass =
    percent >= 80 ? "bar-good" : percent >= 50 ? "bar-ok" : "bar-bad";

  const collapsedIndicator = categoryScore?.collapsed
    ? '<span class="breakdown-collapsed">[SEVERELY IMPACTED]</span>'
    : "";

  return `
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-label">${escapeHtml(label)}${collapsedIndicator}</span>
        <span class="breakdown-value">${escapeHtml(value)}</span>
      </div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill ${barClass}" style="width:${percent}%"></div>
      </div>
      <div class="breakdown-caption">${percent}% completion</div>
    </div>
  `;
}

function renderScoreBreakdownItem(
  label: string,
  value: number,
  isNegative = false,
  type = "normal",
): string {
  const valueClass = isNegative
    ? "value-negative"
    : type === "positive"
      ? "value-positive"
      : type === "final"
        ? "value-final"
        : "";
  const valueDisplay = isNegative ? `-${Math.abs(value)}` : String(value);

  return `
    <div class="breakdown-details-item">
      <span class="breakdown-details-label">${escapeHtml(label)}</span>
      <span class="breakdown-details-value ${valueClass}">${escapeHtml(valueDisplay)}</span>
    </div>
  `;
}

function renderSeverityBadge(
  label: string,
  count: number,
  severity: string,
): string {
  return `
    <div class="severity-item severity-item-${escapeAttr(severity)}">
      <div class="severity-item-left">
        <span class="severity-dot severity-${escapeAttr(severity)}"></span>
        <span class="severity-label">${escapeHtml(label)}</span>
      </div>
      <span class="severity-count">${count}</span>
    </div>
  `;
}

function renderRootCause(cause: RootCause, index: number): string {
  return `
    <div class="root-cause-item">
      <div class="root-cause-index">${index + 1}</div>
      <div class="root-cause-content">
        <div class="root-cause-group">${escapeHtml(cause.group)}</div>
        <p class="root-cause-description">${escapeHtml(cause.description)}</p>
      </div>
    </div>
  `;
}

function renderFinding(
  finding: Finding,
  report: Report,
  index: number,
): string {
  const correlation = report.correlationResult?.findingCorrelations?.find(
    (fc) => fc.findingId === finding.id,
  );

  const evidence = Array.isArray(finding.evidence) ? finding.evidence : [];
  const searchIndex = [
    finding.title,
    finding.category,
    finding.id,
    finding.description,
    finding.impact,
    finding.recommendation,
    finding.priority,
    finding.actionType ?? "",
    finding.ownership?.type ?? "",
    evidence
      .slice(0, 8)
      .map(
        (e) =>
          `${e.label} ${typeof e.data === "object" ? JSON.stringify(e.data) : String(e.data)}`,
      )
      .join(" "),
  ]
    .filter(Boolean)
    .join(" ");

  const panelId = `finding-panel-${index}`;
  const buttonId = `finding-trigger-${index}`;
  const initialExpanded = index < 3;

  const ownershipBadge =
    finding.ownership && finding.ownership.type !== "unknown"
      ? `<span class="ownership-badge ownership-${escapeAttr(finding.ownership.type)}">${escapeHtml(formatOwnershipLabel(finding.ownership.type))}</span>`
      : "";

  const actionBadge =
    finding.priority && finding.priority !== "none"
      ? `<span class="action-badge priority-${escapeAttr(finding.priority)}">${escapeHtml(formatPriorityLabel(finding.priority))}</span>`
      : "";

  const downgradedIndicator = finding.originalSeverity
    ? `<span class="downgraded-badge" title="Downgraded from ${finding.originalSeverity} due to environment">↓ ${escapeHtml(finding.originalSeverity.toUpperCase())}</span>`
    : "";

  const envNote =
    finding.environmentLimited &&
    finding.environmentNotes &&
    finding.environmentNotes.length > 0 &&
    finding.environmentNotes[0]
      ? finding.environmentNotes[0]
      : null;

  return `
    <article
      class="finding-card ${finding.environmentLimited ? "env-limited" : ""}"
      data-severity="${escapeAttr(finding.severity)}"
      data-priority="${escapeAttr(finding.priority || "none")}"
      data-title="${escapeAttr(finding.title)}"
      data-search="${escapeAttr(searchIndex)}"
      data-expanded="${initialExpanded ? "true" : "false"}"
    >
      <button
        id="${buttonId}"
        type="button"
        class="finding-toggle"
        aria-expanded="${initialExpanded ? "true" : "false"}"
        aria-controls="${panelId}"
      >
        <span class="finding-header-left">
          <span class="badge badge-${escapeAttr(finding.severity)}">${escapeHtml(finding.severity.toUpperCase())}</span>
          ${downgradedIndicator}
          <span class="finding-heading-block">
            <span class="finding-title">${escapeHtml(finding.title)}</span>
            <span class="finding-meta">
              ${escapeHtml(finding.category)} · ${escapeHtml(finding.id)}
              ${finding.confidence ? ` · conf: ${escapeHtml(String(finding.confidence))}` : ""}
            </span>
          </span>
          <span class="finding-badges">
            ${ownershipBadge}
            ${actionBadge}
          </span>
        </span>
        <span class="toggle-icon" aria-hidden="true">⌄</span>
      </button>

      <div
        id="${panelId}"
        class="finding-body"
        role="region"
        aria-labelledby="${buttonId}"
        ${initialExpanded ? "" : "hidden"}
      >
        <div class="finding-section">
          <p class="finding-description">${escapeHtml(finding.description)}</p>
          
          ${
            envNote
              ? `
            <div class="env-note-box">
              <span class="env-note-icon">⚠</span>
              <span class="env-note-text">${escapeHtml(envNote)}</span>
            </div>
          `
              : ""
          }
        </div>

        ${
          evidence.length > 0
            ? `
          <div class="finding-section">
            <div class="block-title">Evidence</div>
            <div class="evidence-list">
              ${evidence
                .slice(0, 6)
                .map(
                  (e) => `
                <div class="evidence-item">
                  <span class="evidence-label">${escapeHtml(e.label)}</span>
                  <code class="evidence-code">${escapeHtml(formatEvidenceDataHtml(e.data))}</code>
                </div>
              `,
                )
                .join("")}
              ${
                finding.evidenceSummary && finding.evidenceSummary.truncated
                  ? `
                <div class="evidence-truncated">
                  ... and ${finding.evidenceSummary.totalCount - finding.evidenceSummary.uniqueCount} more similar items
                </div>
              `
                  : ""
              }
            </div>
          </div>
        `
            : ""
        }

        ${
          correlation && correlation.correlations.length > 0
            ? `
          <div class="finding-section">
            <div class="block-title">Source Locations</div>
            <div class="source-list">
              ${correlation.correlations
                .slice(0, 3)
                .map(
                  (c) => `
                <div class="source-item">
                  <div class="source-item-top">
                    <code class="code-path">${escapeHtml(c.location.filePath)}${c.location.lineNumber ? `:${c.location.lineNumber}` : ""}</code>
                    <span class="confidence-badge confidence-${escapeAttr(normalizeConfidence(c.confidence))}">${escapeHtml(String(c.confidence))}</span>
                    <button
                      type="button"
                      class="icon-btn copy-btn"
                      data-copy="${escapeAttr(`${c.location.filePath}${c.location.lineNumber ? `:${c.location.lineNumber}` : ""}`)}"
                      aria-label="Copy source location"
                    >
                      Copy
                    </button>
                  </div>
                  ${c.location.codeSnippet ? `<pre class="snippet">${escapeHtml(c.location.codeSnippet)}</pre>` : `<div class="empty-inline">No code snippet available.</div>`}
                </div>
              `,
                )
                .join("")}
              ${
                correlation.totalLocations > 3
                  ? `<div class="muted">+ ${correlation.totalLocations - 3} more location${correlation.totalLocations - 3 > 1 ? "s" : ""}</div>`
                  : ""
              }
            </div>
          </div>
        `
            : ""
        }

        <div class="finding-section">
          <div class="action-grid">
            <div class="action-card">
              <div class="block-title">Impact</div>
              <p>${escapeHtml(finding.impact)}</p>
            </div>
            <div class="action-card">
              <div class="block-title">Recommendation</div>
              <p>${escapeHtml(finding.recommendation)}</p>
              ${
                finding.frameworkRecommendation
                  ? `
                <div class="framework-tip">
                  <strong>Framework tip:</strong> ${escapeHtml(finding.frameworkRecommendation)}
                </div>
              `
                  : ""
              }
            </div>
          </div>

          ${
            finding.ownership &&
            finding.ownership.reason &&
            finding.ownership.type !== "unknown"
              ? `
            <div class="ownership-hint">
              <span class="ownership-hint-label">Owner hint:</span>
              <span class="ownership-hint-text">${escapeHtml(finding.ownership.reason)}</span>
            </div>
          `
              : ""
          }

          ${
            finding.learnMoreUrl
              ? `
            <div class="learn-more-row">
              <a href="${escapeHtml(finding.learnMoreUrl)}" target="_blank" rel="noreferrer noopener" class="learn-more-link">
                Learn more <span aria-hidden="true">↗</span>
              </a>
            </div>
          `
              : ""
          }
        </div>
      </div>
    </article>
  `;
}

// ═══════════════════════════════════════
// Utility Helpers
// ═══════════════════════════════════════

function formatEnvironmentLabel(env: EnvironmentContext): string {
  if (env.isLocalDev) {
    return "Local Development";
  }

  switch (env.runtimeEnvironment) {
    case "preview":
      return "Preview";
    case "staging":
      return "Staging";
    case "production":
      return "Production";
    default:
      return "Unknown";
  }
}

function formatFrameworkLabel(framework: {
  name: string;
  version?: string;
}): string {
  let label = framework.name.charAt(0).toUpperCase() + framework.name.slice(1);
  if (framework.version) {
    label += ` v${framework.version}`;
  }
  return label;
}

function formatOwnershipLabel(type: string): string {
  const labels: Record<string, string> = {
    "app-owned": "App",
    "framework-owned": "Framework",
    "config-owned": "Config",
    "infra-owned": "Infra",
    "third-party": "3rd Party",
    unknown: "",
  };
  return labels[type] || type;
}

function formatPriorityLabel(priority: string): string {
  const labels: Record<string, string> = {
    "quick-win": "⚡ Quick Win",
    "high-impact": "🎯 High Impact",
    investigate: "🔍 Investigate",
    monitor: "👁 Monitor",
    highest: "🔝 Highest",
    high: "📈 High",
    medium: "⚖️ Medium",
    low: "📉 Low",
    lowest: "🔻 Lowest",
    none: "",
  };
  return labels[priority] || priority;
}

function formatEvidenceDataHtml(data: unknown): string {
  if (data === null || data === undefined) {
    return String(data);
  }

  if (typeof data === "string") {
    return data.length > 200 ? data.substring(0, 200) + "..." : data;
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
    return `${data.slice(0, 3).map(String).join(", ")} ... +${data.length - 3} more`;
  }

  return JSON.stringify(data);
}

function getScoreClass(score: number): string {
  if (score >= 90) return "score-good";
  if (score >= 50) return "score-ok";
  return "score-bad";
}

function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Strong";
  if (score >= 50) return "Needs Optimization";
  return "Critical Attention";
}

function normalizeConfidence(value: unknown): string {
  const str = String(value ?? "").toLowerCase();
  if (str === "definite" || str === "high") return "high";
  if (str === "medium") return "medium";
  return "low";
}

function formatDuration(duration: number): string {
  if (!Number.isFinite(duration)) return "—";
  if (duration < 1000) return `${duration}ms`;
  return `${(duration / 1000).toFixed(duration % 1000 === 0 ? 0 : 2)}s`;
}

function safeDate(value: string | number | Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString();
}

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(str: string): string {
  return escapeHtml(String(str)).replace(/'/g, "&#39;");
}
