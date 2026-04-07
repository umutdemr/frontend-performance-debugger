export function getViewerStyles(scoreAngle: number): string {
  return `
    :root {
      color-scheme: dark;
      --bg: #07111f;
      --bg-elevated: #0d1728;
      --bg-card: rgba(13, 23, 40, 0.82);
      --bg-soft: #0b1525;
      --bg-hover: #13213a;

      --border: rgba(148, 163, 184, 0.16);
      --text: #e6edf7;
      --text-soft: #c5d0e0;
      --text-muted: #8fa2bc;

      --accent: #60a5fa;
      --critical: #f87171;
      --warning: #fbbf24;
      --info: #60a5fa;
      --success: #4ade80;

      --shadow-lg: 0 24px 80px rgba(0, 0, 0, 0.42);
      --shadow-md: 0 12px 32px rgba(0, 0, 0, 0.28);

      --radius-sm: 10px;
      --radius-md: 16px;
      --radius-lg: 24px;

      --font: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: "SFMono-Regular", "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;
      --container: 1280px;
      --score-angle: ${scoreAngle}deg;
    }

    /* ═══════════════════════════════════════
       Reset & Base
       ═══════════════════════════════════════ */

    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }

    body {
      margin: 0;
      font-family: var(--font);
      background:
        radial-gradient(circle at top left, rgba(37, 99, 235, 0.16), transparent 34%),
        radial-gradient(circle at top right, rgba(34, 197, 94, 0.10), transparent 24%),
        linear-gradient(180deg, #07111f 0%, #091321 40%, #07101d 100%);
      color: var(--text);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }

    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    button, input, select { font: inherit; }
    button { color: inherit; }

    /* ═══════════════════════════════════════
       Layout
       ═══════════════════════════════════════ */

    .container {
      width: min(100% - 32px, var(--container));
      margin: 0 auto;
    }

    .page-content { padding-bottom: 52px; }
    .section-gap { margin-top: 22px; }

    .grid { display: grid; gap: 18px; }
    .grid-12 { grid-template-columns: repeat(12, minmax(0, 1fr)); }
    .col-4 { grid-column: span 4; }
    .col-5 { grid-column: span 5; }
    .col-7 { grid-column: span 7; }
    .col-8 { grid-column: span 8; }

    /* ═══════════════════════════════════════
       Header
       ═══════════════════════════════════════ */

    .shell-header {
      position: sticky;
      top: 0;
      z-index: 40;
      backdrop-filter: blur(16px);
      background: rgba(7, 17, 31, 0.72);
      border-bottom: 1px solid var(--border);
    }

    .shell-header-inner {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 24px;
      padding: 18px 0;
    }

    .brand-block {
      display: flex;
      align-items: center;
      gap: 16px;
      min-width: 0;
    }

    .brand-mark {
      width: 52px;
      height: 52px;
      border-radius: 16px;
      display: grid;
      place-items: center;
      background:
        linear-gradient(135deg, rgba(96, 165, 250, 0.22), rgba(34, 197, 94, 0.16)),
        rgba(255,255,255,0.02);
      border: 1px solid rgba(96, 165, 250, 0.24);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #dcecff;
    }

    .eyebrow,
    .section-kicker {
      margin: 0 0 6px;
      color: var(--accent);
      text-transform: uppercase;
      letter-spacing: 0.12em;
      font-size: 0.74rem;
      font-weight: 700;
    }

    .brand-title {
      margin: 0;
      font-size: clamp(1.1rem, 1rem + 0.8vw, 1.5rem);
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .brand-subtitle {
      margin: 6px 0 0;
      color: var(--text-muted);
      font-size: 0.92rem;
      max-width: 760px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .header-meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }

    .meta-chip {
      display: inline-flex;
      align-items: flex-start;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid var(--border);
      min-width: 0;
    }

    .meta-chip-label {
      color: var(--text-muted);
      font-size: 0.78rem;
      white-space: nowrap;
    }

    .meta-chip-value {
      color: var(--text-soft);
      font-size: 0.82rem;
      font-weight: 600;
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* ═══════════════════════════════════════
       Hero Section
       ═══════════════════════════════════════ */

    .hero {
      margin: 26px 0 22px;
      padding: 30px;
    }

    .glass-card {
      background:
        linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02)),
        var(--bg-card);
      border: 1px solid var(--border);
      box-shadow: var(--shadow-lg);
    }

    .hero-main {
      display: grid;
      grid-template-columns: 240px 1fr;
      gap: 32px;
      align-items: center;
    }

    .hero-score {
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .hero-score-shell {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .hero-score-ring {
      width: 188px;
      height: 188px;
      border-radius: 50%;
      padding: 14px;
      background:
        conic-gradient(
          var(--ring-color, var(--warning)) 0deg,
          var(--ring-color, var(--warning)) var(--score-angle),
          rgba(255,255,255,0.10) var(--score-angle),
          rgba(255,255,255,0.10) 360deg
        );
      box-shadow:
        0 18px 46px rgba(0, 0, 0, 0.34),
        inset 0 0 0 1px rgba(255,255,255,0.04);
      position: relative;
    }

    .hero-score-ring::before {
      content: "";
      position: absolute;
      inset: 10px;
      border-radius: 50%;
      background:
        radial-gradient(circle at 30% 30%, rgba(255,255,255,0.10), transparent 38%),
        linear-gradient(180deg, #04101d 0%, #061224 100%);
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.04);
    }

    .hero-score-center {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: grid;
      place-items: center;
      text-align: center;
    }

    .score-good { --ring-color: var(--success); }
    .score-ok { --ring-color: var(--warning); }
    .score-bad { --ring-color: var(--critical); }

    .hero-score-value {
      font-size: 3.2rem;
      font-weight: 800;
      line-height: 1;
      letter-spacing: -0.05em;
      color: var(--ring-color, var(--warning));
      text-shadow: 0 0 24px rgba(255,255,255,0.06);
    }

    .hero-score-label {
      margin-top: 8px;
      color: var(--text-muted);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .hero-score-caption {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--text-soft);
    }

    .hero-score-caption-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--ring-color, var(--warning));
      box-shadow: 0 0 12px var(--ring-color, var(--warning));
    }

    .hero-headline {
      margin: 0;
      font-size: clamp(1.4rem, 1.15rem + 1vw, 2rem);
      line-height: 1.18;
      letter-spacing: -0.03em;
      max-width: 920px;
    }

    .hero-stats {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
    }

    /* ═══════════════════════════════════════
       Stat Cards
       ═══════════════════════════════════════ */

    .stat-card {
      background: rgba(255,255,255,0.035);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      min-width: 0;
    }

    .stat-title {
      color: var(--text-muted);
      font-size: 0.78rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
    }

    .stat-value {
      margin-top: 8px;
      font-size: 1.15rem;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--text);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .stat-subtitle {
      margin-top: 4px;
      color: var(--text-muted);
      font-size: 0.8rem;
    }

    /* ═══════════════════════════════════════
       Cards
       ═══════════════════════════════════════ */

    .card {
      background: var(--bg-card);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 24px;
      box-shadow: var(--shadow-md);
      backdrop-filter: blur(8px);
    }

    .section-head {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 20px;
    }

    .section-head-spread { align-items: center; }

    .section-title {
      margin: 0;
      font-size: 1.12rem;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }

    .section-head-note {
      color: var(--text-muted);
      font-size: 0.84rem;
      text-align: right;
      white-space: nowrap;
    }

    /* ═══════════════════════════════════════
       Key-Value Lists
       ═══════════════════════════════════════ */

    .kv-list.refined {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .kv-row {
      display: grid;
      grid-template-columns: minmax(120px, 180px) 1fr;
      gap: 16px;
      align-items: start;
      padding: 12px 0;
      border-bottom: 1px solid rgba(148, 163, 184, 0.10);
    }

    .kv-row:last-child { border-bottom: none; }

    .kv-key {
      color: var(--text-muted);
      font-size: 0.86rem;
      font-weight: 600;
    }

    .kv-value {
      color: var(--text-soft);
      font-size: 0.92rem;
      word-break: break-word;
      text-align: left;
    }

    /* ═══════════════════════════════════════
       Score Breakdown
       ═══════════════════════════════════════ */

    .breakdown-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .breakdown-item {
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(148, 163, 184, 0.10);
    }

    .breakdown-header {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      margin-bottom: 8px;
    }

    .breakdown-label {
      font-weight: 600;
      font-size: 0.92rem;
    }

    .breakdown-value {
      color: var(--text-muted);
      font-size: 0.84rem;
      font-weight: 600;
    }

    .breakdown-caption {
      margin-top: 8px;
      font-size: 0.8rem;
      color: var(--text-muted);
    }

    .bar-track {
      height: 8px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: inherit;
      transition: width 400ms ease;
    }

    .bar-good { background: linear-gradient(90deg, #22c55e, #4ade80); }
    .bar-ok { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .bar-bad { background: linear-gradient(90deg, #ef4444, #f87171); }

    /* ═══════════════════════════════════════
       Severity
       ═══════════════════════════════════════ */

    .severity-stack {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .severity-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 16px;
      border-radius: 14px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(255,255,255,0.03);
    }

    .severity-item-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .severity-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
    }

    .severity-critical { background: var(--critical); }
    .severity-warning { background: var(--warning); }
    .severity-info { background: var(--info); }
    .severity-success { background: var(--success); }

    .severity-label {
      font-weight: 600;
      font-size: 0.92rem;
    }

    .severity-count {
      font-size: 1rem;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    /* ═══════════════════════════════════════
       Root Causes
       ═══════════════════════════════════════ */

    .root-cause-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .root-cause-item {
      display: grid;
      grid-template-columns: 44px 1fr;
      gap: 14px;
      padding: 14px;
      border-radius: 16px;
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(148, 163, 184, 0.10);
    }

    .root-cause-index {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-weight: 800;
      background: rgba(96, 165, 250, 0.10);
      color: var(--accent);
      border: 1px solid rgba(96, 165, 250, 0.18);
    }

    .root-cause-group {
      color: var(--warning);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .root-cause-description {
      margin: 0;
      color: var(--text-soft);
      font-size: 0.92rem;
    }

    /* ═══════════════════════════════════════
       Correlations
       ═══════════════════════════════════════ */

    .correlation-list {
      display: flex;
      flex-direction: column;
      gap: 14px;
    }

    .correlation-item {
      border-radius: 18px;
      padding: 18px;
      background: rgba(255,255,255,0.025);
      border: 1px solid rgba(148, 163, 184, 0.12);
    }

    .correlation-header {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      margin-bottom: 12px;
    }

    .correlation-header-main {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      min-width: 0;
    }

    .correlation-title {
      margin: 0;
      font-size: 0.98rem;
      line-height: 1.3;
      letter-spacing: -0.01em;
    }

    .correlation-locations {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .more-locations { padding-left: 2px; }

    /* ═══════════════════════════════════════
       Source Locations & Code
       ═══════════════════════════════════════ */

    .location-card,
    .source-item {
      padding: 14px;
      border-radius: 14px;
      background: var(--bg-soft);
      border: 1px solid rgba(148, 163, 184, 0.10);
    }

    .location-topline,
    .source-item-top {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 10px;
    }

    .code-path {
      font-family: var(--font-mono);
      color: #9ecbff;
      font-size: 0.82rem;
      background: rgba(96, 165, 250, 0.08);
      border: 1px solid rgba(96, 165, 250, 0.12);
      padding: 6px 8px;
      border-radius: 10px;
      word-break: break-all;
    }

    .snippet {
      margin: 0;
      padding: 14px;
      border-radius: 12px;
      overflow-x: auto;
      background: #08101b;
      color: #d7e7ff;
      border: 1px solid rgba(148, 163, 184, 0.10);
      font-family: var(--font-mono);
      font-size: 0.8rem;
      line-height: 1.55;
      white-space: pre-wrap;
      word-break: break-word;
    }

    /* ═══════════════════════════════════════
       Badges
       ═══════════════════════════════════════ */

    .badge,
    .priority-tag,
    .confidence-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 28px;
      padding: 0 10px;
      border-radius: 999px;
      font-size: 0.74rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .badge-critical { background: rgba(248, 113, 113, 0.12); color: var(--critical); border: 1px solid rgba(248, 113, 113, 0.18); }
    .badge-warning { background: rgba(251, 191, 36, 0.12); color: var(--warning); border: 1px solid rgba(251, 191, 36, 0.18); }
    .badge-info { background: rgba(96, 165, 250, 0.12); color: var(--info); border: 1px solid rgba(96, 165, 250, 0.18); }
    .badge-success { background: rgba(74, 222, 128, 0.12); color: var(--success); border: 1px solid rgba(74, 222, 128, 0.18); }

    .priority-tag {
      background: rgba(168, 85, 247, 0.14);
      color: #d8b4fe;
      border: 1px solid rgba(168, 85, 247, 0.22);
    }

    .confidence-high { background: rgba(34, 197, 94, 0.14); color: var(--success); border: 1px solid rgba(34, 197, 94, 0.20); }
    .confidence-medium { background: rgba(245, 158, 11, 0.14); color: var(--warning); border: 1px solid rgba(245, 158, 11, 0.20); }
    .confidence-low { background: rgba(148, 163, 184, 0.12); color: var(--text-muted); border: 1px solid rgba(148, 163, 184, 0.18); }

    /* ═══════════════════════════════════════
       Findings
       ═══════════════════════════════════════ */

    .findings-shell { padding-bottom: 18px; }
    .findings-head { margin-bottom: 16px; }

    .findings-list {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .finding-card {
      border-radius: 18px;
      border: 1px solid rgba(148, 163, 184, 0.12);
      background: rgba(255,255,255,0.025);
      overflow: clip;
      transition: transform 160ms ease, border-color 160ms ease, background 160ms ease;
    }

    .finding-card:hover {
      border-color: rgba(148, 163, 184, 0.20);
      background: rgba(255,255,255,0.035);
    }

    .finding-toggle {
      width: 100%;
      border: 0;
      background: transparent;
      padding: 18px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      text-align: left;
      cursor: pointer;
    }

    .finding-header-left {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      min-width: 0;
      flex: 1;
    }

    .finding-heading-block {
      display: flex;
      flex-direction: column;
      gap: 2px;
      min-width: 0;
      flex: 1;
    }

    .finding-title {
      font-size: 1rem;
      font-weight: 700;
      line-height: 1.3;
      letter-spacing: -0.01em;
      color: var(--text);
    }

    .finding-meta {
      color: var(--text-muted);
      font-size: 0.82rem;
      font-weight: 500;
      overflow-wrap: anywhere;
    }

    .toggle-icon {
      color: var(--text-muted);
      font-size: 1.2rem;
      transition: transform 160ms ease;
      flex-shrink: 0;
    }

    .finding-toggle[aria-expanded="true"] .toggle-icon {
      transform: rotate(180deg);
    }

    .finding-body {
      padding: 0 20px 20px;
      border-top: 1px solid rgba(148, 163, 184, 0.08);
    }

    .finding-section + .finding-section { margin-top: 18px; }

    .finding-description {
      margin: 16px 0 0;
      color: var(--text-soft);
      font-size: 0.94rem;
    }

    .block-title {
      margin-bottom: 10px;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
      font-size: 0.74rem;
      font-weight: 800;
    }

    /* ═══════════════════════════════════════
       Evidence
       ═══════════════════════════════════════ */

    .evidence-list,
    .source-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .evidence-item {
      display: grid;
      grid-template-columns: minmax(120px, 180px) 1fr;
      gap: 12px;
      align-items: start;
      padding: 12px 14px;
      border-radius: 14px;
      background: var(--bg-soft);
      border: 1px solid rgba(148, 163, 184, 0.10);
    }

    .evidence-label {
      color: var(--text-muted);
      font-size: 0.82rem;
      font-weight: 700;
    }

    .evidence-code {
      color: #b9d9ff;
      font-family: var(--font-mono);
      font-size: 0.8rem;
      word-break: break-word;
      white-space: pre-wrap;
    }

    /* ═══════════════════════════════════════
       Action Cards
       ═══════════════════════════════════════ */

    .action-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }

    .action-card {
      padding: 14px;
      border-radius: 14px;
      background: var(--bg-soft);
      border: 1px solid rgba(148, 163, 184, 0.10);
    }

    .action-card p {
      margin: 0;
      color: var(--text-soft);
      font-size: 0.9rem;
    }

    .learn-more-row {
      margin-top: 14px;
      display: flex;
      justify-content: flex-start;
    }

    .learn-more-link {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 12px;
      border: 1px solid rgba(96, 165, 250, 0.22);
      background: linear-gradient(180deg, rgba(96, 165, 250, 0.12), rgba(96, 165, 250, 0.07));
      text-decoration: none;
      font-weight: 700;
      color: #d8eaff;
    }

    .learn-more-link:hover {
      text-decoration: none;
      background: linear-gradient(180deg, rgba(96, 165, 250, 0.18), rgba(96, 165, 250, 0.10));
      border-color: rgba(96, 165, 250, 0.34);
    }

    /* ═══════════════════════════════════════
       Toolbar & Filters
       ═══════════════════════════════════════ */

    .toolbar {
      position: sticky;
      top: 89px;
      z-index: 20;
      margin-bottom: 24px;
      padding: 16px;
      border-radius: 18px;
      background: rgba(9, 19, 33, 0.88);
      backdrop-filter: blur(14px);
      border: 1px solid var(--border);
    }

    .toolbar-row {
      display: flex;
      gap: 12px;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
    }

    .search-wrap {
      flex: 1 1 320px;
      min-width: 260px;
    }

    .search-input,
    .control-select {
      width: 100%;
      border: 1px solid rgba(148, 163, 184, 0.16);
      background: linear-gradient(180deg, rgba(255,255,255,0.045), rgba(255,255,255,0.03));
      color: var(--text);
      border-radius: 14px;
      padding: 13px 14px;
      outline: none;
      transition: border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
    }

    .search-input::placeholder { color: var(--text-muted); }

    .search-input:focus,
    .control-select:focus,
    .secondary-btn:focus,
    .filter-chip:focus,
    .finding-toggle:focus,
    .icon-btn:focus {
      border-color: rgba(96, 165, 250, 0.42);
      box-shadow: 0 0 0 4px rgba(96, 165, 250, 0.12);
      outline: none;
    }

    .toolbar-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .select-wrap {
      position: relative;
      min-width: 220px;
    }

    .control-select {
      appearance: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      padding-right: 42px;
      min-width: 220px;
      cursor: pointer;
      font-weight: 600;
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
    }

    .control-select option {
      background: #0f1b2d;
      color: #e6edf7;
    }

    .select-icon {
      position: absolute;
      right: 14px;
      top: 50%;
      transform: translateY(-50%);
      pointer-events: none;
      color: var(--text-muted);
      font-size: 1rem;
    }

    /* ═══════════════════════════════════════
       Buttons
       ═══════════════════════════════════════ */

    .secondary-btn,
    .icon-btn,
    .filter-chip {
      border: 1px solid rgba(148, 163, 184, 0.16);
      border-radius: 12px;
      cursor: pointer;
      transition: transform 120ms ease, background 120ms ease, border-color 120ms ease, color 120ms ease;
    }

    .secondary-btn {
      height: 46px;
      padding: 0 14px;
      font-weight: 600;
      background: rgba(255,255,255,0.04);
      color: var(--text-soft);
    }

    .secondary-btn:hover,
    .icon-btn:hover {
      background: rgba(96, 165, 250, 0.10);
      border-color: rgba(96, 165, 250, 0.24);
      color: var(--text);
    }

    .icon-btn {
      height: 30px;
      padding: 0 10px;
      font-size: 0.78rem;
      font-weight: 700;
      background: rgba(255,255,255,0.04);
      color: var(--text-soft);
    }

    .icon-btn.is-copied {
      color: var(--success);
      border-color: rgba(34, 197, 94, 0.24);
      background: rgba(34, 197, 94, 0.10);
    }

    /* ═══════════════════════════════════════
       Filter Chips
       ═══════════════════════════════════════ */

    .filter-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 14px;
      padding-top: 2px;
    }

    .filter-chip {
      height: 40px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 8px;
      font-size: 0.85rem;
      font-weight: 700;
      background: rgba(255,255,255,0.03);
      color: var(--text-soft);
    }

    .filter-chip span {
      font-size: 0.76rem;
      font-weight: 800;
      padding: 2px 7px;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: inherit;
    }

    .filter-chip-all { border-color: rgba(148, 163, 184, 0.18); color: #dbe7f6; }
    .filter-chip-critical { border-color: rgba(248, 113, 113, 0.25); color: var(--critical); background: rgba(248, 113, 113, 0.07); }
    .filter-chip-warning { border-color: rgba(251, 191, 36, 0.25); color: var(--warning); background: rgba(251, 191, 36, 0.07); }
    .filter-chip-info { border-color: rgba(96, 165, 250, 0.25); color: var(--info); background: rgba(96, 165, 250, 0.07); }
    .filter-chip-success { border-color: rgba(74, 222, 128, 0.25); color: var(--success); background: rgba(74, 222, 128, 0.07); }

    .filter-chip.active {
      box-shadow: inset 0 0 0 1px rgba(255,255,255,0.06), 0 0 0 3px rgba(255,255,255,0.03);
      transform: translateY(-1px);
    }

    .filter-chip-all.active { background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.18); color: #ffffff; }
    .filter-chip-critical.active { background: rgba(248, 113, 113, 0.16); border-color: rgba(248, 113, 113, 0.42); color: #ffd2d2; }
    .filter-chip-warning.active { background: rgba(251, 191, 36, 0.16); border-color: rgba(251, 191, 36, 0.42); color: #ffe59a; }
    .filter-chip-info.active { background: rgba(96, 165, 250, 0.16); border-color: rgba(96, 165, 250, 0.42); color: #d5e8ff; }
    .filter-chip-success.active { background: rgba(74, 222, 128, 0.16); border-color: rgba(74, 222, 128, 0.42); color: #cbffd9; }

    /* ═══════════════════════════════════════
       Utility
       ═══════════════════════════════════════ */

    .muted,
    .empty-inline {
      color: var(--text-muted);
      font-size: 0.84rem;
    }

    .empty-state {
      padding: 28px;
      text-align: center;
      color: var(--text-muted);
      border: 1px dashed rgba(148, 163, 184, 0.18);
      border-radius: 16px;
      background: rgba(255,255,255,0.02);
    }

    .empty-state.compact {
      padding: 18px;
      text-align: left;
    }

    .hidden { display: none !important; }

    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    /* ═══════════════════════════════════════
       Footer
       ═══════════════════════════════════════ */

    .shell-footer {
      border-top: 1px solid var(--border);
      background: rgba(7, 17, 31, 0.52);
      margin-top: 32px;
    }

    .shell-footer-inner {
      padding: 18px 0 28px;
      display: flex;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      color: var(--text-muted);
      font-size: 0.82rem;
    }

    /* ═══════════════════════════════════════
       Responsive
       ═══════════════════════════════════════ */

    @media (max-width: 1100px) {
      .hero-main { grid-template-columns: 1fr; }
      .hero-score { justify-content: flex-start; }
      .hero-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .col-4, .col-5, .col-7, .col-8 { grid-column: span 12; }
    }

    @media (max-width: 820px) {
      .shell-header-inner {
        flex-direction: column;
        align-items: flex-start;
      }
      .header-meta {
        width: 100%;
        justify-content: flex-start;
      }
      .toolbar { top: 74px; }
      .action-grid { grid-template-columns: 1fr; }
      .evidence-item,
      .kv-row {
        grid-template-columns: 1fr;
      }
    }

    @media (max-width: 640px) {
      .container { width: min(100% - 20px, var(--container)); }
      .card, .hero { padding: 18px; }
      .brand-subtitle, .meta-chip-value { white-space: normal; }
      .hero-score-ring { width: 156px; height: 156px; }
      .hero-score-value { font-size: 2.7rem; }
      .hero-stats { grid-template-columns: 1fr; }
      .toolbar-row { align-items: stretch; }
      .toolbar-actions { width: 100%; }
      .select-wrap, .control-select, .secondary-btn { width: 100%; }
      .finding-toggle { padding: 16px; }
      .finding-body { padding: 0 16px 16px; }
      .location-topline, .source-item-top, .correlation-header { align-items: flex-start; }
      .shell-footer-inner { flex-direction: column; }
    }
  `;
}
