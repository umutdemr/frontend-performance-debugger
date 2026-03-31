/**
 * ANSI color codes
 */
const COLORS = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
} as const;

/**
 * Analyzer information
 */
interface AnalyzerInfo {
  name: string;
  description: string;
  categories: string[];
  checks: string[];
}

/**
 * URL Analyzers
 */
const URL_ANALYZERS: AnalyzerInfo[] = [
  {
    name: "BasicUrlAnalyzer",
    description: "Analyzes URL structure for common issues",
    categories: ["general", "network", "seo"],
    checks: [
      "HTTPS usage (critical if HTTP)",
      "URL length (warning if >2000 chars)",
      "Trailing slash consistency",
      "WWW subdomain usage",
      "Query string complexity (warning if >10 params)",
    ],
  },
  {
    name: "SecurityAnalyzer",
    description: "Checks for security-related URL issues",
    categories: ["network", "general"],
    checks: [
      "Non-standard port usage (warning)",
      "IP address instead of domain (warning)",
      "Sensitive data in URL params (critical: password, token, api_key)",
      "Deep subdomain structure (phishing indicator)",
    ],
  },
  {
    name: "SeoAnalyzer",
    description: "Analyzes URL structure for SEO best practices",
    categories: ["seo", "general"],
    checks: [
      "UUID/hash in URL (info)",
      "Uppercase characters (warning - case sensitivity)",
      "Underscores vs hyphens (info - hyphens preferred)",
      "File extensions like .html, .php (info)",
      "URL depth >5 segments (warning)",
      "Hash-based routing #! (warning - bad for SEO)",
      "Duplicate slashes // (warning)",
    ],
  },
  {
    name: "PerformanceAnalyzer",
    description: "Analyzes Core Web Vitals and timing metrics",
    categories: ["rendering", "network"],
    checks: [
      "LCP - Largest Contentful Paint (<2500ms good, >4000ms poor)",
      "CLS - Cumulative Layout Shift (<0.1 good, >0.25 poor)",
      "TTFB - Time to First Byte (<800ms good, >1800ms poor)",
      "FCP - First Contentful Paint (<1800ms good, >3000ms poor)",
      "DOM Content Loaded (warning if >3000ms)",
      "Page Load Complete (info if >5000ms)",
    ],
  },
  {
    name: "NetworkAnalyzer",
    description: "Analyzes network requests and resource loading",
    categories: ["network", "assets", "caching"],
    checks: [
      "Total page size (warning >3MB, critical >10MB)",
      "Large resources >500KB (warning)",
      "Large images >200KB (info - suggest WebP/AVIF)",
      "Slow requests >2000ms (warning)",
      "HTTP 4xx errors (warning)",
      "HTTP 5xx errors (critical)",
    ],
  },
  {
    name: "AssetsAnalyzer",
    description: "Analyzes images, iframes, and DOM for best practices",
    categories: ["assets", "rendering", "accessibility"],
    checks: [
      "Images missing loading='lazy' (warning if many)",
      "Iframes missing loading='lazy' (warning)",
      "Images without width/height attributes (warning - CLS impact)",
      "Images without alt text (warning - accessibility)",
      "DOM size >1500 nodes (info), >3000 nodes (warning)",
    ],
  },
  {
    name: "CacheAnalyzer",
    description: "Analyzes HTTP cache headers and caching strategies",
    categories: ["caching", "network"],
    checks: [
      "HTML document cache strategy (should use no-cache or short max-age)",
      "Static assets long-term caching (1 year max-age recommended)",
      "ETag header usage for efficient validation",
      "Uncached static assets detection (CSS, JS, images, fonts)",
      "API response caching opportunities",
    ],
  },
  {
    name: "RenderBlockingAnalyzer",
    description: "Analyzes render-blocking CSS and JavaScript resources",
    categories: ["rendering", "javascript"],
    checks: [
      "Blocking external stylesheets in <head> (critical if >3)",
      "Blocking JavaScript without async/defer (warning)",
      "Critical CSS inlining (warning if missing)",
      "Excessive inline CSS >50KB (warning)",
      "Non-blocking script optimization (success if all deferred)",
    ],
  },
];

/**
 * Local Analyzers
 */
const LOCAL_ANALYZERS: AnalyzerInfo[] = [
  {
    name: "FileSystemAnalyzer",
    description: "Analyzes local code structure and dependencies",
    categories: ["general", "javascript", "assets"],
    checks: [
      "File size detection (JS >200KB, images >1MB)",
      "node_modules or build folders committed to Git",
      "Environment variables (.env) exposed",
      "Missing .gitignore",
      "Package.json health (>50 deps warning)",
      "Unused dependencies (heuristic)",
      "Heavy packages (lodash, moment)",
      "Heavy import patterns (full library imports)",
      "Bundle size estimation",
    ],
  },
];

/**
 * Print all analyzers
 */
export function analyzersCommand(): void {
  console.log("");
  console.log(
    `${COLORS.bold}${COLORS.cyan}╔════════════════════════════════════════════════════════════╗${COLORS.reset}`,
  );
  console.log(
    `${COLORS.bold}${COLORS.cyan}║${COLORS.reset}  ${COLORS.bold}Available Analyzers${COLORS.reset}                                      ${COLORS.cyan}║${COLORS.reset}`,
  );
  console.log(
    `${COLORS.bold}${COLORS.cyan}╚════════════════════════════════════════════════════════════╝${COLORS.reset}`,
  );
  console.log("");

  // Print URL Analyzers
  console.log(
    `${COLORS.bold}${COLORS.yellow}URL Analyzers (Run with: fpd analyze <url>)${COLORS.reset}`,
  );
  console.log(
    `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
  );

  URL_ANALYZERS.forEach((analyzer, index) => {
    console.log(
      `${COLORS.bold}${COLORS.green}${index + 1}. ${analyzer.name}${COLORS.reset}`,
    );
    console.log(`   ${COLORS.dim}${analyzer.description}${COLORS.reset}`);
    console.log(
      `   ${COLORS.yellow}Categories:${COLORS.reset} ${analyzer.categories.join(", ")}`,
    );
    console.log(`   ${COLORS.magenta}Checks:${COLORS.reset}`);
    analyzer.checks.forEach((check) => {
      console.log(`     • ${check}`);
    });
    console.log("");
  });

  // Print Local Analyzers
  console.log(
    `${COLORS.bold}${COLORS.yellow}Local Analyzers (Run with: fpd scan <path>)${COLORS.reset}`,
  );
  console.log(
    `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
  );

  LOCAL_ANALYZERS.forEach((analyzer, index) => {
    console.log(
      `${COLORS.bold}${COLORS.green}${index + 1}. ${analyzer.name}${COLORS.reset}`,
    );
    console.log(`${COLORS.dim}${analyzer.description}${COLORS.reset}`);
    console.log(
      `${COLORS.yellow}Categories:${COLORS.reset} ${analyzer.categories.join(", ")}`,
    );
    console.log(`${COLORS.magenta}Checks:${COLORS.reset}`);
    analyzer.checks.forEach((check) => {
      console.log(`•${check}`);
    });
    console.log("");
  });

  const totalChecks =
    URL_ANALYZERS.reduce((sum, a) => sum + a.checks.length, 0) +
    LOCAL_ANALYZERS.reduce((sum, a) => sum + a.checks.length, 0);
  const totalAnalyzers = URL_ANALYZERS.length + LOCAL_ANALYZERS.length;

  console.log(
    `${COLORS.dim}────────────────────────────────────────${COLORS.reset}`,
  );
  console.log(
    `${COLORS.bold}Total:${COLORS.reset} ${totalAnalyzers} analyzers, ${totalChecks} checks`,
  );
  console.log("");
  console.log(
    `${COLORS.dim}Usage: fpd analyze <url> | fpd scan <path>${COLORS.reset}`,
  );
  console.log("");
}
