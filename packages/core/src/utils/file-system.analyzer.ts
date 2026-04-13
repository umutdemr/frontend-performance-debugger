import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "../analyzers/analyzer.interface";
import {
  scanDirectory,
  directoryExists,
  fileExists,
  readFileContent,
  getFileSizeCategory,
  type ScannedFile,
} from "../utils/file-scanner.js";
import {
  analyzeDependencies,
  detectHeavyImports,
} from "../utils/dependency-analyzer.js";

export class FileSystemAnalyzer implements Analyzer {
  readonly name = "file-system";
  readonly description = "Analyzes local code structure and dependencies";
  readonly categories: Category[] = ["general", "javascript"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const scanPath = context.options?.scanPath as string | undefined;

    if (!scanPath) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: ["No scan path provided. Use fpd scan <path>"],
      };
    }

    const pathExists = await directoryExists(scanPath);
    if (!pathExists) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [`Directory not found: ${scanPath}`],
      };
    }

    const files = await scanDirectory(scanPath, {
      extensions: [
        ".js",
        ".ts",
        ".jsx",
        ".tsx",
        ".css",
        ".scss",
        ".json",
        ".png",
        ".jpg",
        ".jpeg",
        ".gif",
        ".svg",
        ".webp",
      ],
    });

    const largeFileFindings = this.checkLargeFiles(files);
    findings.push(...largeFileFindings);

    const structureFindings = await this.checkDirectoryStructure(scanPath);
    findings.push(...structureFindings);

    const dependencyFindings = await this.checkDependencies(scanPath, files);
    findings.push(...dependencyFindings);

    const importFindings = await this.checkImports(files);
    findings.push(...importFindings);

    const qualityFindings = this.checkCodeQuality(files);
    findings.push(...qualityFindings);

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  private checkLargeFiles(files: ScannedFile[]): Finding[] {
    const findings: Finding[] = [];

    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx", ".mjs"].includes(f.extension),
    );

    const criticalJsFiles = jsFiles.filter(
      (f) => getFileSizeCategory(f.size, f.extension) === "critical",
    );
    const warningJsFiles = jsFiles.filter(
      (f) => getFileSizeCategory(f.size, f.extension) === "warning",
    );

    if (criticalJsFiles.length > 0) {
      const examples = criticalJsFiles.slice(0, 5).map((f) => ({
        path: f.relativePath,
        size: `${(f.size / 1024).toFixed(0)}KB`,
      }));

      findings.push({
        id: "fs-js-files-critical",
        title: `${criticalJsFiles.length} JavaScript files exceed 500KB`,
        description: `Found ${criticalJsFiles.length} JavaScript/TypeScript files larger than 500KB. Large source files can increase parse cost, reduce maintainability, and may contribute to larger bundles depending on build configuration.`,
        severity: "critical",
        category: "javascript",
        evidence: [
          {
            type: "code-snippet",
            label: "Large JavaScript files",
            data: examples.map((e) => `${e.path} (${e.size})`).join("\n"),
          },
        ],
        impact:
          "Potentially slower parse/build times and larger client bundles",
        recommendation:
          "Split into smaller modules, use route-level/code splitting, and verify real bundle output with a bundle analyzer",
      });
    } else if (warningJsFiles.length > 0) {
      const examples = warningJsFiles.slice(0, 5).map((f) => ({
        path: f.relativePath,
        size: `${(f.size / 1024).toFixed(0)}KB`,
      }));

      findings.push({
        id: "fs-js-files-warning",
        title: `${warningJsFiles.length} JavaScript files exceed 200KB`,
        description: `Found ${warningJsFiles.length} JavaScript/TypeScript files larger than 200KB.`,
        severity: "warning",
        category: "javascript",
        evidence: [
          {
            type: "code-snippet",
            label: "Large JavaScript files",
            data: examples.map((e) => `${e.path} (${e.size})`).join("\n"),
          },
        ],
        impact: "Potentially larger bundles and slower developer iteration",
        recommendation:
          "Consider splitting large modules and validating actual bundle impact",
      });
    }

    const images = files.filter((f) =>
      [".png", ".jpg", ".jpeg", ".gif", ".svg", ".webp"].includes(f.extension),
    );

    const largeImages = images.filter(
      (f) => getFileSizeCategory(f.size, f.extension) === "critical",
    );

    if (largeImages.length > 0) {
      const examples = largeImages.slice(0, 5).map((f) => ({
        path: f.relativePath,
        size: `${(f.size / 1024).toFixed(0)}KB`,
      }));

      findings.push({
        id: "fs-images-large",
        title: `${largeImages.length} images exceed 1MB`,
        description: `Found ${largeImages.length} images larger than 1MB in the scanned path. If shipped to users, these assets can significantly affect LCP and total page weight.`,
        severity: "critical",
        category: "assets",
        evidence: [
          {
            type: "code-snippet",
            label: "Large images",
            data: examples.map((e) => `${e.path} (${e.size})`).join("\n"),
          },
        ],
        impact:
          "Potentially slow LCP, high bandwidth usage, poor mobile experience",
        recommendation:
          "Resize to appropriate dimensions, prefer WebP/AVIF where suitable, and compress oversized assets before shipping",
      });
    }

    return findings;
  }

  private async checkDirectoryStructure(rootPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    const nodeModulesExists = await directoryExists(`${rootPath}/node_modules`);
    if (nodeModulesExists) {
      findings.push({
        id: "fs-node-modules-detected",
        title: "node_modules directory detected in scanned path",
        description:
          "A node_modules directory was found in the scanned path. This is normal locally, but it should not be committed to version control.",
        severity: "critical",
        category: "general",
        evidence: [
          {
            type: "custom",
            label: "Directory",
            data: "node_modules/",
          },
        ],
        impact:
          "If committed, repository size can grow dramatically and clone/pull workflows become slower",
        recommendation:
          "Ensure 'node_modules/' is listed in .gitignore. If it was committed previously, remove it from version control with: git rm -r --cached node_modules",
      });
    }

    const envExists = await fileExists(`${rootPath}/.env`);
    if (envExists) {
      findings.push({
        id: "fs-env-file-detected",
        title: "Environment file (.env) detected",
        description:
          ".env file detected in the scanned path. This is common in local development, but it should not be committed to Git if it contains secrets.",
        severity: "critical",
        category: "general",
        evidence: [
          {
            type: "custom",
            label: "File",
            data: ".env",
          },
        ],
        impact:
          "If committed and populated with secrets, credentials or API keys may be exposed in repository history",
        recommendation:
          "Ensure .env is ignored by Git, keep a sanitized .env.example for documentation, and rotate secrets if this file was ever committed",
      });
    }

    const distExists = await directoryExists(`${rootPath}/dist`);
    const buildExists = await directoryExists(`${rootPath}/build`);

    if (distExists || buildExists) {
      const dirs = [distExists && "dist", buildExists && "build"].filter(
        Boolean,
      ) as string[];

      findings.push({
        id: "fs-build-artifacts-detected",
        title: "Build artifacts detected in scanned path",
        description: `Found ${dirs.join("/")} director${dirs.length > 1 ? "ies" : "y"} in the scanned path. This is often expected locally, but these outputs are usually excluded from version control.`,
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Directories",
            data: dirs.join(", "),
          },
        ],
        impact:
          "Potential repository bloat, noisy diffs, and outdated generated artifacts",
        recommendation:
          "Confirm these directories are ignored by Git unless your deployment workflow explicitly requires committed build outputs",
      });
    }

    const gitignoreExists = await fileExists(`${rootPath}/.gitignore`);
    if (!gitignoreExists) {
      findings.push({
        id: "fs-no-gitignore",
        title: "Missing .gitignore file",
        description:
          "No .gitignore file found. This increases the risk of accidentally tracking local-only files and generated artifacts.",
        severity: "warning",
        category: "general",
        evidence: [],
        impact:
          "Higher risk of committing node_modules, .env files, logs, and build outputs",
        recommendation:
          "Create a .gitignore that covers common local and generated files such as node_modules, dist, build, .env, and framework caches",
      });
    }

    return findings;
  }

  private async checkDependencies(
    rootPath: string,
    files: ScannedFile[],
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx"].includes(f.extension),
    );
    const fileContents = await Promise.all(
      jsFiles.map((f) => readFileContent(f.path)),
    );
    const validContents = fileContents.filter((c): c is string => c !== null);

    const analysis = await analyzeDependencies(rootPath, validContents);

    if (analysis.totalDependencies > 100) {
      findings.push({
        id: "fs-deps-too-many-critical",
        title: `${analysis.totalDependencies} dependencies detected`,
        description: `Project has ${analysis.dependencies.length} dependencies and ${analysis.devDependencies.length} devDependencies. This is very high and may indicate dependency sprawl.`,
        severity: "critical",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "Dependency count",
            data: { total: analysis.totalDependencies, threshold: 100 },
          },
        ],
        impact:
          "Larger node_modules, slower installs, wider security and maintenance surface",
        recommendation:
          "Audit dependencies, remove unused packages, and prefer lighter alternatives where possible",
      });
    } else if (analysis.totalDependencies > 50) {
      findings.push({
        id: "fs-deps-many",
        title: `${analysis.totalDependencies} dependencies detected`,
        description:
          "High dependency count may indicate an opportunity for cleanup.",
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "Dependency count",
            data: { total: analysis.totalDependencies },
          },
        ],
        impact: "Moderate node_modules size and ongoing maintenance overhead",
        recommendation: "Review and remove unused or overlapping dependencies",
      });
    }

    if (analysis.potentiallyUnused.length > 0) {
      const examples = analysis.potentiallyUnused.slice(0, 8);
      const remaining = analysis.potentiallyUnused.length - 8;

      findings.push({
        id: "fs-deps-unused",
        title: `${analysis.potentiallyUnused.length} potentially unused dependencies`,
        description:
          `Found ${analysis.potentiallyUnused.length} dependencies that are not imported in scanned source files. ` +
          `This is a heuristic check and may produce false positives for dynamic imports, config-only packages, CLI tools, framework conventions, or build-time usage.`,
        severity: analysis.potentiallyUnused.length > 10 ? "warning" : "info",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Potentially unused",
            data:
              examples.join("\n") +
              (remaining > 0 ? `\n... and ${remaining} more` : ""),
          },
        ],
        impact: "Potential dependency bloat and unnecessary install cost",
        recommendation:
          "Verify usage before removing packages. Check source imports, config files, scripts, dynamic imports, and framework/plugin integration points before uninstalling anything.",
      });
    }

    if (analysis.heavyPackages.length > 0) {
      findings.push({
        id: "fs-deps-heavy",
        title: `${analysis.heavyPackages.length} heavy packages detected`,
        description: "Found packages with lighter alternatives available.",
        severity: "info",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Heavy packages",
            data: analysis.heavyPackages
              .map((p) => `${p.name} — ${p.reason}`)
              .join("\n"),
          },
        ],
        impact: "Potentially larger bundles and slower installs",
        recommendation:
          "Consider lighter alternatives where the tradeoff makes sense",
      });
    }

    if (analysis.missingScripts.length > 0) {
      findings.push({
        id: "fs-pkg-missing-scripts",
        title: "Missing standard npm scripts",
        description: `package.json is missing: ${analysis.missingScripts.join(", ")}`,
        severity: "info",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Missing scripts",
            data: analysis.missingScripts.join(", "),
          },
        ],
        impact: "Inconsistent developer experience and harder onboarding",
        recommendation:
          "Add the scripts your team expects, such as build, test, dev, or start",
      });
    }

    return findings;
  }

  private async checkImports(files: ScannedFile[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx"].includes(f.extension),
    );

    const heavyImportIssues: Array<{ file: string; issues: string[] }> = [];

    for (const file of jsFiles) {
      const content = await readFileContent(file.path);
      if (!content) continue;

      const issues = detectHeavyImports(content);
      if (issues.length > 0) {
        heavyImportIssues.push({
          file: file.relativePath,
          issues: issues.map((i) => `${i.line} — ${i.issue}`),
        });
      }
    }

    if (heavyImportIssues.length > 0) {
      const examples = heavyImportIssues.slice(0, 5);
      const remaining = heavyImportIssues.length - 5;

      findings.push({
        id: "fs-imports-heavy",
        title: `Heavy import patterns detected in ${heavyImportIssues.length} files`,
        description:
          "Found import patterns that may pull in more code than needed.",
        severity: heavyImportIssues.length > 10 ? "warning" : "info",
        category: "javascript",
        evidence: [
          {
            type: "code-snippet",
            label: "Heavy imports",
            data:
              examples
                .map((e) => `${e.file}:\n  ${e.issues.join("\n  ")}`)
                .join("\n\n") +
              (remaining > 0 ? `\n\n... and ${remaining} more files` : ""),
          },
        ],
        impact: "Potentially larger bundle size and unnecessary shipped code",
        recommendation:
          "Prefer narrower imports where possible and verify actual bundle impact with your bundler output",
      });
    }

    return findings;
  }

  private checkCodeQuality(files: ScannedFile[]): Finding[] {
    const findings: Finding[] = [];

    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx"].includes(f.extension),
    );

    const totalJsSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
    const totalJsSizeMB = totalJsSize / 1024 / 1024;

    if (totalJsSizeMB > 0) {
      const estimatedBundleKB = (totalJsSize / 1024) * 0.35;
      const estimatedGzippedKB = estimatedBundleKB * 0.3;

      findings.push({
        id: "fs-bundle-estimation",
        title: "Bundle size estimation",
        description: `Total JavaScript/TypeScript: ${totalJsSizeMB.toFixed(1)}MB uncompressed across ${jsFiles.length} files.`,
        severity: "info",
        category: "javascript",
        evidence: [
          {
            type: "metric",
            label: "Bundle estimation",
            data: {
              totalSourceMB: totalJsSizeMB.toFixed(1),
              estimatedBundleKB: estimatedBundleKB.toFixed(0),
              estimatedGzippedKB: estimatedGzippedKB.toFixed(0),
            },
          },
        ],
        impact:
          "Rough estimation only — actual bundle size depends on bundler config, tree shaking, and route-level splitting",
        recommendation:
          "For accurate bundle analysis, use webpack-bundle-analyzer, Next bundle analysis, or your bundler's official inspection tools",
      });
    }

    return findings;
  }
}
