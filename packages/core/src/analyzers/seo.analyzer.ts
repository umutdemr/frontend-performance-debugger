import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";

// SEO Analyzer Checks for SEO-related issues based on URL structure

export class SeoAnalyzer implements Analyzer {
  readonly name = "seo";
  readonly description = "Analyzes URL structure for SEO best practices";
  readonly categories: Category[] = ["seo", "general"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const url = new URL(context.url);

    // Check 1: URL readability
    const readabilityFinding = this.checkReadability(url);
    if (readabilityFinding) {
      findings.push(readabilityFinding);
    }

    // Check 2: Uppercase characters
    const uppercaseFinding = this.checkUppercase(url);
    if (uppercaseFinding) {
      findings.push(uppercaseFinding);
    }

    // Check 3: Underscores vs hyphens
    const underscoreFinding = this.checkUnderscores(url);
    if (underscoreFinding) {
      findings.push(underscoreFinding);
    }

    // Check 4: File extension in URL
    const extensionFinding = this.checkFileExtension(url);
    if (extensionFinding) {
      findings.push(extensionFinding);
    }

    // Check 5: URL depth
    const depthFinding = this.checkUrlDepth(url);
    if (depthFinding) {
      findings.push(depthFinding);
    }

    // Check 6: Hash fragments for content
    const hashFinding = this.checkHashFragment(url);
    if (hashFinding) {
      findings.push(hashFinding);
    }

    // Check 7: Duplicate slashes
    const slashFinding = this.checkDuplicateSlashes(url);
    if (slashFinding) {
      findings.push(slashFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkReadability(url: URL): Finding | null {
    const path = url.pathname;

    // Check for random-looking strings (UUIDs, hashes, etc.)
    const uuidPattern =
      /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    const hashPattern = /[a-f0-9]{32,}/i;
    const numericIdPattern = /\/\d{6,}\/?/;

    if (uuidPattern.test(path)) {
      return {
        id: "seo-uuid-in-url",
        title: "URL contains UUID",
        description:
          "The URL contains a UUID which is not human-readable and provides no SEO value.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
        ],
        impact: "Harder for users to understand, no keyword value for SEO",
        recommendation:
          "Consider using human-readable slugs alongside or instead of UUIDs",
      };
    }

    if (hashPattern.test(path)) {
      return {
        id: "seo-hash-in-url",
        title: "URL contains hash-like string",
        description:
          "The URL contains what appears to be a hash or encoded value, making it difficult to read.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
        ],
        impact: "Poor user experience, no SEO benefit from URL structure",
        recommendation: "Use descriptive, keyword-rich URL paths when possible",
      };
    }

    if (numericIdPattern.test(path)) {
      return {
        id: "seo-numeric-id-url",
        title: "URL uses long numeric ID",
        description:
          "The URL contains a long numeric ID. While functional, descriptive slugs are better for SEO.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
        ],
        impact: "Missed opportunity for keyword-rich URLs",
        recommendation:
          "Consider adding descriptive slugs (e.g., /products/123/blue-widget)",
      };
    }

    return null;
  }

  private checkUppercase(url: URL): Finding | null {
    const path = url.pathname;

    if (path !== path.toLowerCase()) {
      return {
        id: "seo-uppercase-url",
        title: "URL contains uppercase characters",
        description:
          "The URL path contains uppercase characters. URLs are case-sensitive, which can cause duplicate content issues.",
        severity: "warning",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
          {
            type: "code-snippet",
            label: "Lowercase version",
            data: path.toLowerCase(),
          },
        ],
        impact:
          "Potential duplicate content if both cases resolve, inconsistent linking",
        recommendation:
          "Use lowercase URLs and redirect uppercase variants to lowercase",
        learnMoreUrl:
          "https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls",
      };
    }

    return null;
  }

  private checkUnderscores(url: URL): Finding | null {
    const path = url.pathname;

    if (path.includes("_")) {
      return {
        id: "seo-underscores-url",
        title: "URL uses underscores instead of hyphens",
        description:
          "The URL uses underscores (_) as word separators. Search engines prefer hyphens (-) as they treat them as word separators.",
        severity: "info",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
          {
            type: "code-snippet",
            label: "Hyphenated version",
            data: path.replace(/_/g, "-"),
          },
        ],
        impact:
          "Google treats underscores as joiners, not separators (my_page = mypage)",
        recommendation: "Use hyphens (-) instead of underscores (_) in URLs",
        learnMoreUrl: "https://www.youtube.com/watch?v=AQcSFsQyct8",
      };
    }

    return null;
  }

  private checkFileExtension(url: URL): Finding | null {
    const path = url.pathname.toLowerCase();
    const oldExtensions = [
      ".html",
      ".htm",
      ".php",
      ".asp",
      ".aspx",
      ".jsp",
      ".cgi",
    ];

    for (const ext of oldExtensions) {
      if (path.endsWith(ext)) {
        return {
          id: "seo-file-extension",
          title: "URL contains file extension",
          description: `The URL ends with "${ext}". Modern URLs typically omit file extensions for cleaner appearance.`,
          severity: "info",
          category: "seo",
          evidence: [
            {
              type: "url",
              label: "Path",
              data: url.pathname,
            },
          ],
          impact: "Slightly dated appearance, exposes technology stack",
          recommendation:
            "Configure server to serve clean URLs without file extensions",
        };
      }
    }

    return null;
  }

  private checkUrlDepth(url: URL): Finding | null {
    const path = url.pathname;
    const segments = path.split("/").filter((s) => s.length > 0);

    if (segments.length > 5) {
      return {
        id: "seo-deep-url",
        title: "URL has deep path structure",
        description: `The URL has ${segments.length} path segments. Deep URLs may indicate poor site architecture and can dilute page authority.`,
        severity: "warning",
        category: "seo",
        evidence: [
          {
            type: "metric",
            label: "Path Depth",
            data: { value: segments.length, segments },
          },
        ],
        impact:
          "Diluted link equity, harder for users to navigate, may indicate content buried too deep",
        recommendation:
          "Flatten site structure to keep important content within 3-4 clicks of homepage",
        learnMoreUrl:
          "https://developers.google.com/search/docs/fundamentals/seo-starter-guide#hierarchy",
      };
    }

    return null;
  }

  private checkHashFragment(url: URL): Finding | null {
    const hash = url.hash;

    if (hash && hash.length > 1) {
      // Check if it looks like a route (#!/ or #/)
      if (hash.startsWith("#!") || hash.startsWith("#/")) {
        return {
          id: "seo-hashbang-url",
          title: "URL uses hash-based routing",
          description:
            "The URL uses hash-bang (#!) or hash-based routing. This is an outdated pattern that can cause SEO issues.",
          severity: "warning",
          category: "seo",
          evidence: [
            {
              type: "url",
              label: "Hash Fragment",
              data: hash,
            },
          ],
          impact: "Search engines may not properly crawl hash-based routes",
          recommendation:
            "Use HTML5 History API (pushState) for client-side routing instead of hash-based routing",
          learnMoreUrl:
            "https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics",
        };
      }
    }

    return null;
  }

  private checkDuplicateSlashes(url: URL): Finding | null {
    const path = url.pathname;

    if (path.includes("//")) {
      return {
        id: "seo-duplicate-slashes",
        title: "URL contains duplicate slashes",
        description:
          "The URL path contains consecutive slashes (//). This can cause duplicate content issues.",
        severity: "warning",
        category: "seo",
        evidence: [
          {
            type: "url",
            label: "Path",
            data: path,
          },
          {
            type: "code-snippet",
            label: "Clean version",
            data: path.replace(/\/+/g, "/"),
          },
        ],
        impact:
          "Same content accessible via multiple URLs, confuses search engines",
        recommendation:
          "Configure server to normalize URLs and redirect duplicate slash variants",
      };
    }

    return null;
  }
}
