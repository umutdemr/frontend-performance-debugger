# Frontend Performance Debugger CLI

Developer-first CLI for analyzing frontend performance, identifying bottlenecks, extracting root causes, and correlating runtime issues with local source code.

Unlike generic audit tools, FPD is designed to help you move from **finding** to **debugging** by combining runtime analysis, prioritization, framework awareness, and source-level hints in one workflow.

## Install

```bash
npm install -g @umutdev/fpd-cli
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

Export JSON:

```bash
fpd analyze https://example.com --format json --output report.json
```

Export Markdown:

```bash
fpd analyze https://example.com --format markdown --output report.md
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
- Where in the project should I start looking?

## Feature summary

| Capability                           | Status |
| ------------------------------------ | ------ |
| Live URL analysis                    | ✅     |
| Real browser analysis via Playwright | ✅     |
| Performance findings                 | ✅     |
| Network findings                     | ✅     |
| Asset findings                       | ✅     |
| Cache findings                       | ✅     |
| Render-blocking detection            | ✅     |
| Security / SEO checks                | ✅     |
| Score generation                     | ✅     |
| Score breakdown                      | ✅     |
| Root cause extraction                | ✅     |
| Framework detection                  | ✅     |
| Route detection                      | ✅     |
| Source correlation                   | ✅     |
| JSON output                          | ✅     |
| Markdown output                      | ✅     |

## Output formats

- terminal
- json
- markdown

## Repository

https://github.com/umutdemr/frontend-performance-debugger

## License

MIT
