import type { Report, Finding, RootCause } from "@fpd/shared-types";
import { getViewerStyles } from "./viewer-styles";

/**
 * Generate a polished, self-contained HTML report viewer
 */
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
          <div class="meta-chip">
            <span class="meta-chip-label">Generated</span>
            <span class="meta-chip-value">${escapeHtml(analyzedAt)}</span>
          </div>
          <div class="meta-chip">
            <span class="meta-chip-label">Framework</span>
            <span class="meta-chip-value">${escapeHtml(detectFrameworkLabel(report))}</span>
          </div>
        </div>
      </div>
    </header>

    <main class="container page-content">
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
            ${renderKV("Headline", report.summary.headline || "—")}
            ${report.correlationResult ? renderKV("Framework", detectFrameworkLabel(report)) : ""}
            ${report.correlationResult?.routeMaps?.[0] ? renderKV("Route", report.correlationResult.routeMaps[0].pageFile) : ""}
            ${renderKV("Findings", String(findings.length))}
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
            report.summary.breakdown
              ? `
            <div class="breakdown-stack">
              ${renderBreakdownBar("Performance", report.summary.breakdown.performance)}
              ${renderBreakdownBar("Network", report.summary.breakdown.network)}
              ${renderBreakdownBar("Architecture", report.summary.breakdown.architecture)}
              ${renderBreakdownBar("SEO / Security", report.summary.breakdown.seoSecurity)}
            </div>
          `
              : `<div class="empty-state compact">No score breakdown available.</div>`
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

                return `
                  <article class="correlation-item">
                    <div class="correlation-header">
                      <div class="correlation-header-main">
                        <span class="badge badge-${escapeAttr(finding.severity)}">${escapeHtml(finding.severity.toUpperCase())}</span>
                        <h3 class="correlation-title">${escapeHtml(finding.title)}</h3>
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
                            <span class="confidence-badge confidence-${escapeAttr(normalizeConfidence(c.confidence))}">
                              ${escapeHtml(String(c.confidence))}
                            </span>
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

function renderBreakdownBar(label: string, value: string): string {
  const parts = String(value).split("/");
  const current = Number(parts[0]?.trim() ?? 0);
  const max = Number(parts[1]?.trim() ?? 0);
  const percent =
    max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const barClass =
    percent >= 80 ? "bar-good" : percent >= 50 ? "bar-ok" : "bar-bad";

  return `
    <div class="breakdown-item">
      <div class="breakdown-header">
        <span class="breakdown-label">${escapeHtml(label)}</span>
        <span class="breakdown-value">${escapeHtml(value)}</span>
      </div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill ${barClass}" style="width:${percent}%"></div>
      </div>
      <div class="breakdown-caption">${percent}% completion</div>
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

  return `
    <article
      class="finding-card"
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
          <span class="finding-heading-block">
            <span class="finding-title">${escapeHtml(finding.title)}</span>
            <span class="finding-meta">
              ${escapeHtml(finding.category)} · ${escapeHtml(finding.id)}
              ${finding.confidence ? ` · confidence: ${escapeHtml(String(finding.confidence))}` : ""}
            </span>
          </span>
          ${finding.priority && finding.priority !== "none" ? `<span class="priority-tag">${escapeHtml(String(finding.priority))}</span>` : ""}
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
                  <code class="evidence-code">${escapeHtml(typeof e.data === "object" ? JSON.stringify(e.data) : String(e.data))}</code>
                </div>
              `,
                )
                .join("")}
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
            </div>
          </div>

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

function detectFrameworkLabel(report: Report): string {
  if (!report.correlationResult) return "Unknown";
  const routeMap = report.correlationResult.routeMaps?.[0];
  if (!routeMap) return "Unknown";
  if (routeMap.pageFile.includes("app/") && routeMap.pageFile.includes("page."))
    return "Next.js (App Router)";
  if (routeMap.pageFile.includes("pages/")) return "Next.js (Pages Router)";
  return "Detected";
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
