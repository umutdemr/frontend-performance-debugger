# Frontend Performance Debugger CLI

Developer-first CLI for analyzing frontend performance, identifying bottlenecks, extracting root causes, and correlating runtime issues with local source code.

Unlike generic audit tools, FPD is designed to help you move from **finding** to **debugging** by combining runtime analysis, prioritization, framework awareness, environment context, and source-level hints in one workflow.

## Install

```bash
npm install @umutdev/fpd-cli
```

If needed:

```bash
npx playwright install chromium
```

## Usage

Analyze a live URL:

```bash
fpd analyze https://example.com
```

Analyze with verbose output:

```bash
fpd analyze https://example.com --verbose
```

Analyze localhost:

```bash
fpd analyze http://localhost:3000
```

Analyze localhost with source correlation:

```bash
fpd analyze http://localhost:3000 --project . --verbose
```

Open local report viewer after analysis:

```bash
fpd analyze http://localhost:3000 --project . --open
```

Export JSON:

```bash
fpd analyze https://example.com --format json --output report.json
```

Export Markdown:

```bash
fpd analyze https://example.com --format markdown --output report.md
```

Strict audit mode (no environment adjustments):

```bash
fpd analyze https://example.com --skip-env-adjustments
```

Force a specific environment type:

```bash
fpd analyze http://localhost:3000 --force-env staging
```

Scan local source code:

```bash
fpd scan .
```

List analyzers:

```bash
fpd analyzers
```

## Why use FPD?

FPD is built for developers who need more than metrics or a generic audit.

It helps you:

- analyze frontend behavior in a real browser session
- turn raw observations into structured, actionable findings
- identify root causes instead of only listing symptoms
- understand where performance is being lost through score breakdowns
- map runtime issues back to likely source files when a project path is available
- understand which findings are reliable in your current environment

In short, FPD is designed for a practical workflow from **analysis** to **triage** to **fixing**.

## What makes it different?

Most performance tools are strong in one area, such as metrics, audits, or static analysis.
FPD is built to connect those layers into a developer workflow.

### Unique strengths

- **Runtime + source correlation**
  Analyze a live URL and correlate findings with likely source files in the local project.

- **Root-cause-focused reporting**
  Highlights the underlying bottlenecks behind multiple findings instead of only showing a flat issue list.

- **Framework and route awareness**
  Detects the project's framework dynamically and identifies likely route-related source files for more relevant reporting.

- **Environment-aware analysis**
  FPD detects whether you are running against localhost, a preview deployment, or a production domain, and adjusts finding severity and confidence accordingly. Cache findings in local dev are not presented with production-level certainty. Common dev ports are not flagged as issues. Each adjusted finding includes a caveat explaining the limitation.

- **Ownership hints**
  Each finding is tagged with who should act on it — your application code, the framework, build configuration, or server infrastructure. This reduces triage time and makes findings more directly actionable.

- **Developer-first terminal output**
  Presents score, breakdown, root causes, findings, source hints, and snippets in a format optimized for debugging.

- **Actionable findings**
  Findings include severity, impact, confidence, recommendation, and priority — not just raw metrics.

- **Works across local and deployed workflows**
  Useful for production URLs, localhost environments, source correlation, and static project scans.

### In practice

FPD helps answer:

- What is actually slow?
- What matters most?
- What should I fix first?
- Is this finding reliable in my current environment?
- Who is responsible for fixing this?
- Where in the project should I start looking?

## Environment-Aware Analysis

FPD automatically detects your environment and adjusts findings to reduce noise and false positives.

| Environment       | Detection                                            | Behavior                                                                   |
| ----------------- | ---------------------------------------------------- | -------------------------------------------------------------------------- |
| Local Development | `localhost`, `127.0.0.1`, `::1`, private IPs         | Cache findings downgraded, HTTP not flagged as critical, dev ports ignored |
| Preview           | `*.vercel.app`, `*.netlify.app`, `*.pages.dev`, etc. | Cache findings have reduced confidence                                     |
| Production        | Public domain with production signals                | Full severity, all findings at face value                                  |

Findings affected by the environment are clearly marked with a caveat note. Use `--skip-env-adjustments` to disable this behavior for strict audits.

## Ownership Hints

Each finding is tagged to indicate who should act on it:

| Tag           | Meaning                                            |
| ------------- | -------------------------------------------------- |
| `[app]`       | Application code — your components, routes, assets |
| `[framework]` | Framework-managed — Next.js, Nuxt, Vite internals  |
| `[config]`    | Build or framework configuration                   |
| `[infra]`     | Server, CDN, or hosting configuration              |
| `[3rd-party]` | External services — analytics, fonts, embeds       |

## Score Calibration

The overall score accounts for:

- **Critical penalty** — extra deduction for critical severity findings
- **Collapse penalty** — extra deduction when a category scores near zero
- **Environment adjustment** — reduced penalty for findings that are unreliable in the current environment

This makes the score reflect actual severity rather than treating all findings equally.

## Options

| Flag                     | Alias | Description                                                        |
| ------------------------ | ----- | ------------------------------------------------------------------ |
| `--format`               | `-f`  | Output format: `terminal` (default), `json`, or `markdown`         |
| `--output`               | `-o`  | Write report to a file                                             |
| `--project`              | `-p`  | Local project path for source correlation                          |
| `--open`                 |       | Start local viewer after analysis                                  |
| `--verbose`              | `-v`  | Show detailed logs during analysis                                 |
| `--skip-env-adjustments` |       | Disable environment-aware severity adjustments                     |
| `--force-env <type>`     |       | Force environment: `local-dev`, `preview`, `staging`, `production` |
| `--no-score-breakdown`   |       | Omit detailed score breakdown from report                          |

## Feature summary

| Capability                            | Status |
| ------------------------------------- | ------ |
| Live URL analysis                     | ✅     |
| Real browser analysis via Playwright  | ✅     |
| Performance findings                  | ✅     |
| Network findings                      | ✅     |
| Asset findings                        | ✅     |
| Cache findings                        | ✅     |
| Render-blocking detection             | ✅     |
| Security / SEO checks                 | ✅     |
| Score generation                      | ✅     |
| Score breakdown                       | ✅     |
| Critical and collapse score penalties | ✅     |
| Root cause extraction                 | ✅     |
| Framework detection                   | ✅     |
| Route detection                       | ✅     |
| Source correlation                    | ✅     |
| Environment-aware analysis            | ✅     |
| Ownership hints per finding           | ✅     |
| Confidence levels per finding         | ✅     |
| Local report viewer                   | ✅     |
| JSON output                           | ✅     |
| Markdown output                       | ✅     |

## Output formats

- `terminal` — everyday local debugging
- `json` — automation, CI, integrations
- `markdown` — documentation, reporting, sharing

## Repository

https://github.com/umutdemr/frontend-performance-debugger

## License

Source-available. See the LICENSE file for full terms.
