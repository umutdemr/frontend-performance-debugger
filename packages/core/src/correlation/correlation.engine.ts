import * as fs from "fs";
import * as path from "path";
import type {
  Finding,
  SourceCorrelation,
  FindingCorrelations,
  CorrelationResult,
  RouteSourceMap,
  ProjectStack,
  CorrelationMethod,
} from "@fpd/shared-types";
import { SourceLocator } from "./source-locator.js";
import { detectFramework } from "../frameworks/framework.detector.js";

export interface CorrelationEngineOptions {
  projectRoot: string;
  maxCorrelationsPerFinding: number;
}

const DEFAULT_OPTIONS: CorrelationEngineOptions = {
  projectRoot: ".",
  maxCorrelationsPerFinding: 5,
};

const SUPPORTED_FINDINGS = new Set([
  "assets-images-no-dimensions",
  "assets-images-no-alt",
  "assets-images-no-lazy-loading",
  "network-resource-very-large",
  "render-blocking-scripts",
  "render-blocking-stylesheets",
  "cache-static-assets-not-cached",
]);

export class CorrelationEngine {
  private options: CorrelationEngineOptions;
  private sourceLocator: SourceLocator;
  private projectStack: ProjectStack | null = null;

  constructor(options: Partial<CorrelationEngineOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.sourceLocator = new SourceLocator(this.options.projectRoot);
  }

  async correlate(
    findings: Finding[],
    analyzedUrl: string,
  ): Promise<CorrelationResult> {
    const projectRoot = this.options.projectRoot;
    const packageJsonPath = path.join(projectRoot, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      console.warn(`[WARN] No package.json found. Skipping correlation.`);
      return this.createEmptyResult(analyzedUrl, projectRoot);
    }

    try {
      const result = detectFramework(projectRoot);
      this.projectStack = result.stack;
      console.log(`[INFO] Detected: ${this.projectStack.metaFramework}`);
    } catch {
      console.warn("[WARN] Framework detection failed.");
    }

    const findingCorrelations: FindingCorrelations[] = [];
    const routeMaps: RouteSourceMap[] = [];

    try {
      const urlPath = this.extractUrlPath(analyzedUrl);
      const routeCorrs = await this.sourceLocator.findRouteSource(urlPath);

      if (routeCorrs.length > 0 && routeCorrs[0]) {
        routeMaps.push({
          urlPath,
          pageFile: routeCorrs[0].location.filePath,
          layoutFiles: [],
          components: routeCorrs.map((c) => c.location),
          routeType: "page",
        });
        console.log(`[INFO] Route: ${routeCorrs[0].location.filePath}`);
      }
    } catch {}

    for (const finding of findings) {
      if (!SUPPORTED_FINDINGS.has(finding.id)) continue;

      try {
        const correlations = await this.correlateFind(finding);

        if (correlations.length > 0) {
          const limited = correlations.slice(
            0,
            this.options.maxCorrelationsPerFinding,
          );

          findingCorrelations.push({
            findingId: finding.id,
            category: finding.category,
            correlations: limited,
            primaryCorrelation: limited[0],
            totalLocations: limited.length,
            affectedFiles: new Set(limited.map((c) => c.location.filePath))
              .size,
          });
        }
      } catch (error) {
        console.warn(`[WARN] Correlation failed for ${finding.id}`);
      }
    }

    const totalCorrelations = findingCorrelations.reduce(
      (sum, fc) => sum + fc.totalLocations,
      0,
    );

    const highConfidenceCount = findingCorrelations.reduce(
      (sum, fc) =>
        sum + fc.correlations.filter((c) => c.confidence === "high").length,
      0,
    );

    console.log(
      `[INFO] Found ${totalCorrelations} correlations (${highConfidenceCount} high confidence)`,
    );

    return {
      analyzedUrl,
      projectRoot,
      timestamp: new Date().toISOString(),
      findingCorrelations,
      assetMaps: [],
      routeMaps,
      totalCorrelations,
      highConfidenceCount,
      correlationRate:
        findingCorrelations.length / Math.max(findings.length, 1),
    };
  }

  private async correlateFind(finding: Finding): Promise<SourceCorrelation[]> {
    switch (finding.id) {
      case "assets-images-no-dimensions": {
        const corrs = await this.sourceLocator.findImagesWithoutDimensions();
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "assets-images-no-alt": {
        const missingCorrs = await this.sourceLocator.findImageUsages({
          missingAttribute: "alt",
        });
        const emptyCorrs = await this.sourceLocator.findEmptyAltImages();
        const combined = [...missingCorrs, ...emptyCorrs];
        return combined.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "assets-images-no-lazy-loading": {
        const corrs = await this.sourceLocator.findImageUsages({
          missingAttribute: "loading",
        });
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "network-resource-very-large": {
        const resourceUrls = this.extractResourceUrls(finding);
        const corrs = await this.sourceLocator.findAssetUsages(resourceUrls);
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "render-blocking-scripts": {
        const corrs = await this.sourceLocator.findBlockingScripts();
        if (corrs.length === 0) {
          const layoutCorr = this.createLayoutFallback(
            "Scripts injected by Next.js. Check build configuration or layout files.",
            finding.id,
          );
          if (layoutCorr) corrs.push(layoutCorr);
        }
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "render-blocking-stylesheets": {
        const corrs = await this.sourceLocator.findStyleImports();
        if (corrs.length === 0) {
          const layoutCorr = this.createLayoutFallback(
            "CSS files injected by Next.js. Check global CSS imports in layout files.",
            finding.id,
          );
          if (layoutCorr) corrs.push(layoutCorr);
        }
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      case "cache-static-assets-not-cached": {
        const resourceUrls = this.extractResourceUrls(finding);
        const corrs = await this.sourceLocator.findAssetUsages(resourceUrls);
        if (corrs.length === 0) {
          const configCorr = this.createConfigFallback(
            "Static assets are served by Next.js build system. Configure caching in next.config.js or server headers.",
            finding.id,
          );
          if (configCorr) corrs.push(configCorr);
        }
        return corrs.map((c) => ({ ...c, findingId: finding.id }));
      }

      default:
        return [];
    }
  }

  private createLayoutFallback(
    reason: string,
    findingId: string,
  ): SourceCorrelation | null {
    const layoutPaths = [
      "app/layout.tsx",
      "app/layout.jsx",
      "app/layout.js",
      "src/app/layout.tsx",
      "src/app/layout.jsx",
      "src/app/layout.js",
      "pages/_app.tsx",
      "pages/_app.jsx",
      "pages/_document.tsx",
    ];

    for (const layoutPath of layoutPaths) {
      const fullPath = path.join(this.options.projectRoot, layoutPath);
      if (fs.existsSync(fullPath)) {
        return {
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          findingId,
          location: {
            filePath: layoutPath,
            lineNumber: 1,
          },
          confidence: "medium",
          method: "content-search" as CorrelationMethod,
          reason,
        };
      }
    }

    return null;
  }

  private createConfigFallback(
    reason: string,
    findingId: string,
  ): SourceCorrelation | null {
    const configPaths = ["next.config.js", "next.config.ts", "next.config.mjs"];

    for (const configPath of configPaths) {
      const fullPath = path.join(this.options.projectRoot, configPath);
      if (fs.existsSync(fullPath)) {
        return {
          id: `corr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          findingId,
          location: {
            filePath: configPath,
            lineNumber: 1,
          },
          confidence: "low",
          method: "content-search" as CorrelationMethod,
          reason,
        };
      }
    }

    return null;
  }

  private extractResourceUrls(finding: Finding): string[] {
    const urls: string[] = [];

    if (!finding.evidence) return urls;

    for (const evidence of finding.evidence) {
      if (
        evidence.label === "Resource URL" &&
        typeof evidence.data === "string"
      ) {
        urls.push(evidence.data);
      }

      if (
        evidence.label === "Uncached static assets" &&
        typeof evidence.data === "string"
      ) {
        const lines = evidence.data.split("\n").filter(Boolean);
        urls.push(...lines);
      }

      if (
        (evidence.label === "Images without dimensions" ||
          evidence.label === "Images without alt text" ||
          evidence.label === "Images without lazy loading") &&
        typeof evidence.data === "string"
      ) {
        const lines = evidence.data.split("\n").filter(Boolean);
        urls.push(...lines);
      }
    }

    return urls
      .map((url) => this.urlToAssetPath(url))
      .filter(Boolean) as string[];
  }

  private urlToAssetPath(url: string): string | null {
    try {
      const parsed = new URL(url);
      const pathname = parsed.pathname;

      if (pathname.startsWith("/_next/image")) {
        const urlParam = parsed.searchParams.get("url");
        if (urlParam) {
          return decodeURIComponent(urlParam).replace(/^\//, "");
        }
      }

      if (pathname.startsWith("/_next/static")) {
        return null;
      }

      return pathname.replace(/^\//, "");
    } catch {
      return url.replace(/^\//, "");
    }
  }

  private extractUrlPath(url: string): string {
    try {
      return new URL(url).pathname;
    } catch {
      return "/";
    }
  }

  private createEmptyResult(
    analyzedUrl: string,
    projectRoot: string,
  ): CorrelationResult {
    return {
      analyzedUrl,
      projectRoot,
      timestamp: new Date().toISOString(),
      findingCorrelations: [],
      assetMaps: [],
      routeMaps: [],
      totalCorrelations: 0,
      highConfidenceCount: 0,
      correlationRate: 0,
    };
  }

  getProjectStack(): ProjectStack | null {
    return this.projectStack;
  }

  clearCache(): void {
    this.sourceLocator.clearCache();
  }
}

export function createCorrelationEngine(
  options?: Partial<CorrelationEngineOptions>,
): CorrelationEngine {
  return new CorrelationEngine(options);
}

export async function correlateFindings(
  findings: Finding[],
  analyzedUrl: string,
  projectRoot: string,
): Promise<CorrelationResult> {
  const engine = new CorrelationEngine({ projectRoot });
  return engine.correlate(findings, analyzedUrl);
}
