import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import type {
  SourceCorrelation,
  CorrelationConfidence,
  CorrelationSearchOptions,
} from "@fpd/shared-types";
import { DEFAULT_CORRELATION_OPTIONS } from "@fpd/shared-types";

const ALWAYS_EXCLUDE = new Set([
  "node_modules",
  ".next",
  ".nuxt",
  "dist",
  "build",
  ".git",
  "coverage",
  ".turbo",
  ".cache",
  "out",
  ".svelte-kit",
  ".astro",
  ".vercel",
  ".netlify",
  "__pycache__",
  ".idea",
  ".vscode",
  "vendor",
  "tmp",
  "temp",
  "logs",
  ".parcel-cache",
  ".yarn",
  "public",
  "static",
  "assets",
]);

const MAX_FILES = 3000;
const MAX_FILE_SIZE = 150 * 1024;
const MAX_RESULTS_PER_SEARCH = 50;
const MAX_LINE_LENGTH = 1000;
const MAX_DEPTH = 10;

export interface SearchMatch {
  filePath: string;
  lineNumber: number;
  columnNumber: number;
  lineContent: string;
  matchStart: number;
  matchEnd: number;
}

export class SourceLocator {
  private projectRoot: string;
  private options: CorrelationSearchOptions;
  private allFilesCache: string[] | null = null;

  constructor(
    projectRoot: string,
    options: Partial<CorrelationSearchOptions> = {},
  ) {
    this.projectRoot = path.resolve(projectRoot);
    this.options = {
      ...DEFAULT_CORRELATION_OPTIONS,
      ...options,
      projectRoot: this.projectRoot,
    };
  }

  async searchPattern(pattern: string | RegExp): Promise<SearchMatch[]> {
    const matches: SearchMatch[] = [];
    const files = await this.getSourceFiles();

    for (const filePath of files) {
      if (matches.length >= MAX_RESULTS_PER_SEARCH) break;

      const fileMatches = await this.searchInFileStreaming(filePath, pattern);
      matches.push(...fileMatches);
    }

    return matches.slice(0, MAX_RESULTS_PER_SEARCH);
  }

  async findAssetUsage(assetUrl: string): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];

    const filename = this.extractFilename(assetUrl);
    if (!filename) return correlations;

    const matches = await this.searchPattern(filename);

    for (const match of matches.slice(0, 5)) {
      correlations.push({
        id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        findingId: "",
        location: {
          filePath: this.getRelativePath(match.filePath),
          lineNumber: match.lineNumber,
          columnNumber: match.columnNumber,
          codeSnippet: this.truncateLine(match.lineContent),
        },
        confidence: "high",
        method: "filename-match",
        reason: `Found "${filename}" in source`,
        resourceUrl: assetUrl,
      });
    }

    return correlations;
  }

  async findAssetUsages(assetUrls: string[]): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    for (const url of assetUrls.slice(0, 20)) {
      if (correlations.length >= 15) break;
      const matches = await this.findAssetUsage(url);
      correlations.push(...matches);
    }
    return correlations;
  }

  async findRouteSource(urlPath: string): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const routePatterns = this.generateRouteSearchPatterns(urlPath);

    for (const pattern of routePatterns) {
      const fullPath = path.join(this.projectRoot, pattern.filePath);

      if (fs.existsSync(fullPath)) {
        correlations.push({
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          findingId: "",
          location: {
            filePath: pattern.filePath,
            lineNumber: 1,
          },
          confidence: pattern.confidence,
          method: "pattern-match",
          reason: `Route "${urlPath}" maps to this file`,
          resourceUrl: urlPath,
        });
        break;
      }
    }

    return correlations;
  }

  async findImagesWithoutDimensions(): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const jsxExtensions = [".tsx", ".jsx", ".js", ".ts"];
    const files = await this.getSourceFiles(jsxExtensions);

    for (const filePath of files.slice(0, 150)) {
      if (correlations.length >= 20) break;

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        const tagRegex = /<(Image|img)\b[\s\S]*?(?:\/?>|<\/\1>)/gi;
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
          if (correlations.length >= 20) break;

          const tagContent = match[0];

          if (!/\b(width|height)\s*=/i.test(tagContent)) {
            const srcMatch = tagContent.match(
              /src\s*=\s*(?:["']([^"']+)["']|{([^}]+)})/i,
            );
            const resourceUrl = srcMatch
              ? srcMatch[1] || srcMatch[2]
              : "unknown";

            const lineNumber = this.getLineNumber(content, match.index);

            correlations.push({
              id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              findingId: "assets-images-no-dimensions",
              location: {
                filePath: this.getRelativePath(filePath),
                lineNumber,
                codeSnippet: this.extractSnippet(tagContent),
              },
              confidence: "high",
              method: "content-search",
              reason: "Image component without dimensions",
              resourceUrl,
            });
          }
        }
      } catch {}
    }

    return correlations;
  }

  async findImageUsages(options: {
    missingAttribute: string;
  }): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const jsxExtensions = [".tsx", ".jsx", ".js", ".ts", ".html"];
    const files = await this.getSourceFiles(jsxExtensions);

    for (const filePath of files.slice(0, 150)) {
      if (correlations.length >= 20) break;

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        const tagRegex = /<(Image|img)\b[\s\S]*?(?:\/?>|<\/\1>)/gi;
        const attrPattern = new RegExp(
          `\\b${options.missingAttribute}\\s*=`,
          "i",
        );
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
          if (correlations.length >= 20) break;

          const tagContent = match[0];

          if (!attrPattern.test(tagContent)) {
            const srcMatch = tagContent.match(
              /src\s*=\s*(?:["']([^"']+)["']|{([^}]+)})/i,
            );
            const resourceUrl = srcMatch
              ? srcMatch[1] || srcMatch[2]
              : "unknown";

            const lineNumber = this.getLineNumber(content, match.index);

            correlations.push({
              id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              findingId: "",
              location: {
                filePath: this.getRelativePath(filePath),
                lineNumber,
                codeSnippet: this.extractSnippet(tagContent),
              },
              confidence: "high",
              method: "content-search",
              reason: `Image component missing '${options.missingAttribute}' attribute`,
              resourceUrl,
            });
          }
        }
      } catch {}
    }

    return correlations;
  }

  async findEmptyAltImages(): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const jsxExtensions = [".tsx", ".jsx", ".js", ".ts"];
    const files = await this.getSourceFiles(jsxExtensions);

    for (const filePath of files.slice(0, 150)) {
      if (correlations.length >= 20) break;

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        const tagRegex = /<(Image|img)\b[\s\S]*?(?:\/?>|<\/\1>)/gi;
        let match;

        while ((match = tagRegex.exec(content)) !== null) {
          if (correlations.length >= 20) break;

          const tagContent = match[0];

          const emptyAltRegex = /\balt\s*=\s*(?:""|'')/i;

          if (emptyAltRegex.test(tagContent)) {
            const srcMatch = tagContent.match(
              /src\s*=\s*(?:["']([^"']+)["']|{([^}]+)})/i,
            );
            const resourceUrl = srcMatch
              ? srcMatch[1] || srcMatch[2]
              : "unknown";

            const lineNumber = this.getLineNumber(content, match.index);

            correlations.push({
              id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              findingId: "",
              location: {
                filePath: this.getRelativePath(filePath),
                lineNumber,
                codeSnippet: this.extractSnippet(tagContent),
              },
              confidence: "high",
              method: "content-search",
              reason: "Image component with empty alt attribute",
              resourceUrl,
            });
          }
        }
      } catch {}
    }

    return correlations;
  }

  async findStyleImports(): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const files = await this.getSourceFiles([
      ".tsx",
      ".jsx",
      ".js",
      ".ts",
      ".html",
    ]);

    for (const filePath of files.slice(0, 100)) {
      if (correlations.length >= 10) break;

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        const styleRegex =
          /import\s+['"][^'"]+\.(css|scss|sass|less)['"]|<link[^>]+rel=["']stylesheet["'][^>]*>/gi;
        let match;

        while ((match = styleRegex.exec(content)) !== null) {
          if (correlations.length >= 10) break;

          const lineNumber = this.getLineNumber(content, match.index);

          correlations.push({
            id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
            findingId: "render-blocking-stylesheets",
            location: {
              filePath: this.getRelativePath(filePath),
              lineNumber,
              codeSnippet: this.extractSnippet(match[0]),
            },
            confidence: "high",
            method: "content-search",
            reason: "Synchronous stylesheet import/link found",
          });
        }
      } catch {}
    }

    return correlations;
  }

  async findBlockingScripts(): Promise<SourceCorrelation[]> {
    const correlations: SourceCorrelation[] = [];
    const files = await this.getSourceFiles([
      ".tsx",
      ".jsx",
      ".js",
      ".ts",
      ".html",
    ]);

    for (const filePath of files.slice(0, 100)) {
      if (correlations.length >= 10) break;

      try {
        const content = fs.readFileSync(filePath, "utf-8");

        const scriptRegex = /<script[^>]+src=["'][^"']+["'][^>]*>/gi;
        const asyncDeferPattern = /\b(async|defer)\b/i;
        let match;

        while ((match = scriptRegex.exec(content)) !== null) {
          if (correlations.length >= 10) break;

          if (!asyncDeferPattern.test(match[0])) {
            const lineNumber = this.getLineNumber(content, match.index);

            correlations.push({
              id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
              findingId: "render-blocking-scripts",
              location: {
                filePath: this.getRelativePath(filePath),
                lineNumber,
                codeSnippet: this.extractSnippet(match[0]),
              },
              confidence: "high",
              method: "content-search",
              reason: "Script without async/defer",
            });
          }
        }
      } catch {}
    }

    return correlations;
  }

  private async getSourceFiles(
    extensions: string[] = this.options.extensions || [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".html",
      ".css",
    ],
  ): Promise<string[]> {
    if (this.allFilesCache === null) {
      this.allFilesCache = [];
      await this.collectFiles(this.projectRoot, this.allFilesCache, 0);
    }

    return this.allFilesCache.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return extensions.includes(ext);
    });
  }

  private async collectFiles(
    dir: string,
    files: string[],
    depth: number,
  ): Promise<void> {
    if (depth > MAX_DEPTH) return;
    if (files.length >= MAX_FILES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= MAX_FILES) return;
      if (entry.name.startsWith(".")) continue;
      if (entry.isDirectory() && ALWAYS_EXCLUDE.has(entry.name)) continue;

      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        await this.collectFiles(fullPath, files, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (
          ext === ".js" ||
          ext === ".jsx" ||
          ext === ".ts" ||
          ext === ".tsx" ||
          ext === ".html" ||
          ext === ".css" ||
          ext === ".scss"
        ) {
          try {
            const stats = fs.statSync(fullPath);
            if (stats.size <= MAX_FILE_SIZE) {
              files.push(fullPath);
            }
          } catch {}
        }
      }
    }
  }

  private searchInFileStreaming(
    filePath: string,
    pattern: string | RegExp,
  ): Promise<SearchMatch[]> {
    return new Promise((resolve) => {
      const matches: SearchMatch[] = [];
      let lineNumber = 0;

      const regex =
        pattern instanceof RegExp
          ? new RegExp(pattern.source, pattern.flags)
          : new RegExp(this.escapeRegex(pattern), "gi");

      try {
        const fileStream = fs.createReadStream(filePath, {
          encoding: "utf-8",
          highWaterMark: 16 * 1024,
        });

        const rl = readline.createInterface({
          input: fileStream,
          crlfDelay: Infinity,
        });

        rl.on("line", (line: string) => {
          lineNumber++;

          if (line.length > MAX_LINE_LENGTH) return;

          if (matches.length >= 10) {
            rl.close();
            fileStream.destroy();
            return;
          }

          regex.lastIndex = 0;
          const match = regex.exec(line);

          if (match) {
            matches.push({
              filePath,
              lineNumber,
              columnNumber: match.index + 1,
              lineContent: line,
              matchStart: match.index,
              matchEnd: match.index + match[0].length,
            });
          }
        });

        rl.on("close", () => resolve(matches));
        rl.on("error", () => resolve(matches));
        fileStream.on("error", () => resolve(matches));
      } catch {
        resolve(matches);
      }
    });
  }

  private extractFilename(url: string): string | null {
    try {
      if (url.includes("?url=")) {
        const parsedUrl = new URL("http://localhost" + url);
        const innerUrl = parsedUrl.searchParams.get("url");
        if (innerUrl) url = innerUrl;
      }

      const parsed = new URL(url);
      const filename = path.basename(parsed.pathname);
      return filename && filename.length > 2 ? filename : null;
    } catch {
      const filename = path.basename(url);
      return filename && filename.length > 2 ? filename : null;
    }
  }

  private generateRouteSearchPatterns(urlPath: string): Array<{
    filePath: string;
    confidence: CorrelationConfidence;
  }> {
    const cleanPath = urlPath.replace(/^\/+|\/+$/g, "") || "index";

    return [
      { filePath: `app/${cleanPath}/page.tsx`, confidence: "high" },
      { filePath: `app/${cleanPath}/page.jsx`, confidence: "high" },
      { filePath: `app/${cleanPath}/page.js`, confidence: "high" },
      { filePath: `src/app/${cleanPath}/page.tsx`, confidence: "high" },
      { filePath: `src/app/${cleanPath}/page.jsx`, confidence: "high" },
      { filePath: `src/app/${cleanPath}/page.js`, confidence: "high" },
      { filePath: `pages/${cleanPath}.tsx`, confidence: "high" },
      { filePath: `pages/${cleanPath}.jsx`, confidence: "high" },
      { filePath: `pages/${cleanPath}.js`, confidence: "high" },
      { filePath: `pages/${cleanPath}/index.tsx`, confidence: "high" },
      { filePath: `app/page.tsx`, confidence: "medium" },
      { filePath: `app/page.jsx`, confidence: "medium" },
      { filePath: `app/page.js`, confidence: "medium" },
      { filePath: `src/app/page.tsx`, confidence: "medium" },
      { filePath: `src/app/page.jsx`, confidence: "medium" },
      { filePath: `src/app/page.js`, confidence: "medium" },
    ];
  }

  private truncateLine(line: string): string {
    const trimmed = line.trim();
    return trimmed.length > 100 ? trimmed.slice(0, 100) + "..." : trimmed;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private getRelativePath(fullPath: string): string {
    return path.relative(this.projectRoot, fullPath).replace(/\\/g, "/");
  }

  clearCache(): void {
    this.allFilesCache = null;
  }

  private getLineNumber(content: string, charIndex: number): number {
    const lines = content.substring(0, charIndex).split("\n");
    return lines.length;
  }

  private extractSnippet(tagContent: string): string {
    const collapsed = tagContent.replace(/\s+/g, " ").trim();
    return collapsed.length > 120 ? collapsed.slice(0, 120) + "..." : collapsed;
  }
}

export function createSourceLocator(
  projectRoot: string,
  options?: Partial<CorrelationSearchOptions>,
): SourceLocator {
  return new SourceLocator(projectRoot, options);
}
