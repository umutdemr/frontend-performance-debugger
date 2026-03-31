# Frontend Performance Debugger (FPD)

**A developer-first CLI for analyzing frontend performance, identifying bottlenecks, extracting root causes, and mapping runtime issues back to source code.**

[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-%3E%3D8.0.0-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## Overview

Frontend Performance Debugger (FPD) is an open-source, CLI-first tool for diagnosing frontend performance issues in a way that is practical for engineers.

Most performance tools are strong at reporting metrics. FPD is designed to go one step further: helping developers understand **what is wrong, why it matters, what to fix first, and where the issue likely lives in the codebase**.

FPD combines:

- runtime browser analysis
- structured findings
- severity and priority classification
- category-based scoring
- root cause extraction
- framework detection
- route detection
- source code correlation

The goal is simple:

> move from **audit output** to **debugging workflow**

---

## Why FPD?

Frontend performance work often breaks down in one of these ways:

- metrics exist, but priorities are unclear
- findings are too generic to act on
- browser behavior is disconnected from the source code
- reports are useful for audits, but weak for actual debugging
- developers know something is slow, but do not know where to start

FPD is built for that gap.

Instead of only saying:

> “Your LCP is poor”

FPD is intended to help you get closer to:

> “Your LCP is poor, large assets and render-blocking resources are likely involved, and these files are probably related.”

---

## Core Value

FPD is designed around four practical questions:

1. **What is wrong?**
2. **How serious is it?**
3. **What is the likely root cause?**
4. **Where should I look in the codebase?**

That makes it useful not only as a scoring tool, but as a developer tool.

---

## Quick Start

### Requirements

- Node.js `>= 18.0.0`
- pnpm `>= 8.0.0`

### Clone and install

```bash
git clone https://github.com/umutdemr/frontend-performance-debugger.git
cd frontend-performance-debugger/fpd
pnpm install
pnpm build
pnpm exec playwright install chromium
```

### Common First Commands

#### First analysis

```bash
fpd analyze https://example.com
```

#### Analyze a local app with source correlation

```bash
fpd analyze http://localhost:3000 --project . --verbose
```

#### Export JSON

```bash
fpd analyze https://example.com --format json --output report.json
```

---

## What FPD Does

### Runtime URL Analysis

FPD analyzes a live URL using a real browser session via Playwright.

It inspects:

- loading lifecycle
- browser timing metrics
- network requests
- resource sizes
- render-blocking resources
- asset delivery quality
- cache-related issues
- structural frontend bottlenecks

This gives a realistic, browser-level view of how a page behaves.

### Structured Findings

Raw browser observations are transformed into structured findings with:

- title
- description
- severity
- category
- evidence
- impact
- recommendation
- confidence
- priority
- optional documentation link

The result is more actionable than a flat list of metrics.

### Severity and Priority

Findings are classified in two ways:

| Dimension | Values                                       |
| --------- | -------------------------------------------- |
| Severity  | critical, warning, info, success             |
| Priority  | quick-win, high-impact, investigate, monitor |

This helps teams separate urgent issues from optimization opportunities.

### Score and Breakdown

FPD generates:

- an overall score
- category-level breakdown

Current categories:

- Performance
- Network
- Architecture
- SEO/Security

This makes the score useful for diagnosis, not only reporting.

### Root Cause Extraction

Instead of only listing issues, FPD also highlights the most important root causes behind multiple findings.

Typical root cause families include:

- oversized assets
- render-blocking resources
- weak caching strategy
- slow request patterns
- backend response issues

This helps reduce noise and improve triage.

### Source Code Correlation

When a local project path is provided, FPD attempts to connect runtime findings to likely source files.

This can surface:

- detected framework context
- likely route source
- likely source locations for findings
- file + line references
- contextual snippets

This is one of the most important differentiators of the tool.

### Framework Awareness

FPD can detect framework context from the project and use that context in reporting.

Examples include:

- React
- Next.js
- App Router / Pages Router route detection
- common modern frontend project structures

### Multiple Output Formats

FPD supports:

| Format   | Use Case                          |
| -------- | --------------------------------- |
| terminal | everyday local debugging          |
| json     | automation, CI, integrations      |
| markdown | documentation, reporting, sharing |

---

## Command Reference

### fpd analyze <url>

Analyze a live URL in a real browser session.

This command reports:

- performance issues
- network issues
- rendering issues
- asset issues
- caching issues
- SEO / security issues
- score and breakdown
- root causes
- source correlation when `--project` is provided

#### Basic usage

```bash
fpd analyze https://example.com
```

#### Verbose output

```bash
fpd analyze https://example.com --verbose
```

#### With source correlation

```bash
fpd analyze http://localhost:3000 --project . --verbose
```

#### Export JSON

```bash
fpd analyze https://example.com --format json --output report.json
```

#### Export Markdown

```bash
fpd analyze https://example.com --format markdown --output report.md
```

#### Analyze with an explicit project path

```bash
fpd analyze https://example.com --project ./my-project --verbose
```

#### Windows absolute path example

```bash
fpd analyze http://localhost:3000 --project ./my-project --verbose
```

### fpd scan <path>

Analyze a local project or source directory without running a runtime browser session.

This is useful when you want a local inspection workflow focused on code and static patterns.

#### Scan current project

```bash
fpd scan .
```

#### Scan a specific source directory

```bash
fpd scan ./src
```

#### Export scan result as Markdown

```bash
fpd scan . --format markdown --output local-scan.md
```

#### Export scan result as JSON

```bash
fpd scan . --format json --output local-scan.json
```

### fpd analyzers

List the currently available analyzers and the checks they perform.

```bash
fpd analyzers
```

---

## Common Workflows

#### Production site audit

```bash
fpd analyze https://example.com
```

#### Production site with machine-readable output

```bash
fpd analyze https://example.com --format json --output report.json
```

#### Local development debugging

```bash
fpd analyze http://localhost:3000 --verbose
```

#### Local development + source correlation

```bash
fpd analyze http://localhost:3000 --project . --verbose
```

#### Alternate local dev port

```bash
fpd analyze http://localhost:5173 --project . --verbose
```

#### Static project scan

```bash
fpd scan .
```

#### Shareable Markdown report

```bash
fpd analyze https://example.com --format markdown --output report.md
```

---

## Example Output

A typical terminal report includes:

- analyzed URL
- timestamp
- analysis duration
- detected framework
- detected route source
- source correlation summary
- score
- category score breakdown
- top root causes
- severity summary
- structured findings
- file and line hints where available

### Example

```text
Framework: React + Next.js (App Router)
Route:     src/app/page.js
Correlated: 12 source locations found (40% match rate)

Score: 41/100
  ├─ Performance:  35/40
  ├─ Network:      0/25
  ├─ Architecture: 19/20
  └─ SEO/Security: 0/15
```

This output is intended to be readable in daily terminal workflows while still being useful for engineering decision-making.

---

## Feature Summary

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

---

## Current Scope

FPD currently includes:

- browser-based runtime analysis
- multiple analyzer modules
- finding aggregation and deduplication
- finding enrichment with confidence and priority
- category-based scoring
- root cause extraction
- framework detection
- route detection
- source code correlation
- terminal, JSON, and Markdown output

This already makes it useful for real debugging workflows.

---

## Monorepo Structure

FPD is organized as a pnpm workspace monorepo.

### Packages

| Package                 | Purpose                                                               |
| ----------------------- | --------------------------------------------------------------------- |
| `packages/shared-types` | shared TypeScript models and report types                             |
| `packages/core`         | analysis engine, analyzers, browser integration, scoring, correlation |
| `packages/cli`          | command-line interface and output formatters                          |
| `app/web`               | reserved for future dashboard work                                    |

### High-level structure

```text
fpd/
├── app/
│   └── web/
├── packages/
│   ├── cli/
│   ├── core/
│   └── shared-types/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## Development

### Install dependencies

```bash
pnpm install
```

### Build everything

```bash
pnpm build
```

### Build specific packages

```bash
pnpm build:types
pnpm build:core
pnpm build:cli
```

### Typecheck

```bash
pnpm typecheck
```

### Clean build outputs

```bash
pnpm clean
```

### Tech Stack

- TypeScript (strict mode)
- Node.js
- pnpm workspaces
- tsup
- Playwright
- web-vitals
- monorepo architecture

---

## Current Limitations

FPD is actively evolving, and some parts are intentionally MVP-oriented.

Current limitations include:

- source correlation is still heuristic in some areas
- not every runtime issue maps to an exact source line
- framework-aware fix intelligence is still growing
- the web dashboard is planned but not yet a core part of the workflow

These limitations are known, intentional, and part of the current development direction.

---

## Roadmap

Likely next steps include:

- deeper source correlation
- stronger framework-specific analysis
- more precise asset-to-component mapping
- compare mode
- performance budgets
- CI-oriented workflows
- richer exports
- dashboard support in `app/web`

---

## Design Principles

FPD is built around a small set of clear principles:

- tool-first, UI-second
- developer-first workflow
- strict TypeScript
- actionable output over vanity scoring
- runtime + source awareness
- production-leaning, MVP-friendly implementation
- copy-paste usable CLI workflows

---

## Who Should Use FPD?

FPD is a strong fit for:

- frontend developers
- performance-focused engineers
- React / Next.js teams
- agencies and freelancers
- product teams auditing real user-facing pages
- teams that want source-aware debugging from the terminal

---

## Contributing

Ideas, bug reports, feature requests, and contributions are welcome.

Useful contribution areas include:

- analyzer improvements
- source correlation improvements
- formatter improvements
- framework-aware enhancements
- developer experience improvements
- real-world report samples and bug reproduction cases

---

## Repository

GitHub: [https://github.com/umutdemr/frontend-performance-debugger](https://github.com/umutdemr/frontend-performance-debugger)

---

## License

MIT
