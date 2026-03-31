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

/**
 * File System Analyzer
 * Analyzes local code structure, file sizes, dependencies
 */
export class FileSystemAnalyzer implements Analyzer {
  readonly name = "file-system";
  readonly description = "Analyzes local code structure and dependencies";
  readonly categories: Category[] = ["general", "javascript"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    // Get scan path from context
    const scanPath = context.options?.scanPath as string | undefined;

    if (!scanPath) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: ["No scan path provided. Use fpd scan <path>"],
      };
    }

    // Verify path exists
    const pathExists = await directoryExists(scanPath);
    if (!pathExists) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [`Directory not found: ${scanPath}`],
      };
    }

    // Scan directory
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

    // Check 1: Large files
    const largeFileFindings = this.checkLargeFiles(files);
    findings.push(...largeFileFindings);

    // Check 2: Directory structure issues
    const structureFindings = await this.checkDirectoryStructure(scanPath);
    findings.push(...structureFindings);

    // Check 3: Package.json analysis
    const dependencyFindings = await this.checkDependencies(scanPath, files);
    findings.push(...dependencyFindings);

    // Check 4: Import analysis
    const importFindings = await this.checkImports(files);
    findings.push(...importFindings);

    // Check 5: Code quality metrics
    const qualityFindings = this.checkCodeQuality(files);
    findings.push(...qualityFindings);

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  /**
   * Check for large files
   */
  private checkLargeFiles(files: ScannedFile[]): Finding[] {
    const findings: Finding[] = [];

    // JavaScript/TypeScript files
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
        description: `Found ${criticalJsFiles.length} JavaScript/TypeScript files larger than 500KB. Large files cause slow parse times and poor bundle performance.`,
        severity: "critical",
        category: "javascript",
        evidence: [
          {
            type: "code-snippet",
            label: "Large JavaScript files",
            data: examples.map((e) => `${e.path} (${e.size})`).join("\n"),
          },
        ],
        impact: "Slow bundle, long parse time (~200-300ms per 500KB on mobile)",
        recommendation:
          "Split into smaller modules, use code splitting, lazy load non-critical code",
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
        impact: "Larger bundle size, slower load times",
        recommendation:
          "Consider code splitting or breaking into smaller modules",
      });
    }

    // Images
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
        description: `Found ${largeImages.length} images larger than 1MB. Large images significantly impact LCP and page weight.`,
        severity: "critical",
        category: "assets",
        evidence: [
          {
            type: "code-snippet",
            label: "Large images",
            data: examples.map((e) => `${e.path} (${e.size})`).join("\n"),
          },
        ],
        impact: "Slow LCP, high bandwidth usage, poor mobile experience",
        recommendation:
          "Resize to appropriate dimensions, use WebP/AVIF format, compress with imagemin",
      });
    }

    return findings;
  }

  private async checkDirectoryStructure(rootPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check if node_modules is committed
    const nodeModulesExists = await directoryExists(`${rootPath}/node_modules`);
    if (nodeModulesExists) {
      findings.push({
        id: "fs-node-modules-committed",
        title: "node_modules committed to repository",
        description:
          "Found node_modules directory in the scanned path. This should never be committed to version control.",
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
          "Bloated repository (often 100MB-1GB), slow clone/pull operations",
        recommendation:
          "1. Add 'node_modules/' to .gitignore\n2. Run: git rm -r --cached node_modules\n3. Commit the removal",
      });
    }

    // Check if .env is committed
    const envExists = await fileExists(`${rootPath}/.env`);
    if (envExists) {
      findings.push({
        id: "fs-env-exposed",
        title: "Environment file (.env) found in repository",
        description:
          ".env file detected. This may contain sensitive data and should not be committed to Git.",
        severity: "critical",
        category: "general",
        evidence: [
          {
            type: "custom",
            label: "File",
            data: ".env",
          },
        ],
        impact: "API keys, secrets, credentials exposed in Git history",
        recommendation:
          "1. Add .env to .gitignore\n2. Create .env.example instead\n3. Rotate all exposed secrets immediately",
      });
    }

    // Check if dist/build is committed
    const distExists = await directoryExists(`${rootPath}/dist`);
    const buildExists = await directoryExists(`${rootPath}/build`);

    if (distExists || buildExists) {
      const dirs = [distExists && "dist", buildExists && "build"].filter(
        Boolean,
      );

      findings.push({
        id: "fs-build-artifacts-committed",
        title: "Build artifacts committed to repository",
        description: `Found ${dirs.join("/")} directory. Build outputs should not be committed.`,
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "code-snippet",
            label: "Directories",
            data: dirs.join(", "),
          },
        ],
        impact: "Repository bloat, merge conflicts, outdated artifacts",
        recommendation: "Add 'dist/' and 'build/' to .gitignore",
      });
    }

    // Check if .gitignore exists
    const gitignoreExists = await fileExists(`${rootPath}/.gitignore`);
    if (!gitignoreExists) {
      findings.push({
        id: "fs-no-gitignore",
        title: "Missing .gitignore file",
        description:
          "No .gitignore file found. This increases risk of committing sensitive files.",
        severity: "warning",
        category: "general",
        evidence: [],
        impact:
          "Risk of accidentally committing node_modules, .env, build artifacts",
        recommendation:
          "Create .gitignore with common patterns (node_modules, dist, .env, etc.)",
      });
    }

    return findings;
  }

  private async checkDependencies(
    rootPath: string,
    files: ScannedFile[],
  ): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Read file contents for import analysis
    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx"].includes(f.extension),
    );
    const fileContents = await Promise.all(
      jsFiles.map((f) => readFileContent(f.path)),
    );
    const validContents = fileContents.filter((c): c is string => c !== null);

    const analysis = await analyzeDependencies(rootPath, validContents);

    // Check total dependency count
    if (analysis.totalDependencies > 100) {
      findings.push({
        id: "fs-deps-too-many-critical",
        title: `${analysis.totalDependencies} dependencies detected`,
        description: `Project has ${analysis.dependencies.length} dependencies and ${analysis.devDependencies.length} devDependencies. This is very high.`,
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
          "Large node_modules, slow npm install, increased security surface",
        recommendation:
          "Audit dependencies, remove unused packages, consider lighter alternatives",
      });
    } else if (analysis.totalDependencies > 50) {
      findings.push({
        id: "fs-deps-many",
        title: `${analysis.totalDependencies} dependencies detected`,
        description:
          "High dependency count may indicate opportunity for cleanup.",
        severity: "warning",
        category: "general",
        evidence: [
          {
            type: "metric",
            label: "Dependency count",
            data: { total: analysis.totalDependencies },
          },
        ],
        impact: "Moderate node_modules size, potential bloat",
        recommendation: "Review and remove unused dependencies",
      });
    }

    // Potentially unused dependencies
    if (analysis.potentiallyUnused.length > 0) {
      const examples = analysis.potentiallyUnused.slice(0, 8);
      const remaining = analysis.potentiallyUnused.length - 8;

      findings.push({
        id: "fs-deps-unused",
        title: `${analysis.potentiallyUnused.length} potentially unused dependencies`,
        description: `Found ${analysis.potentiallyUnused.length} dependencies that are not imported in any scanned files. This is a heuristic check.`,
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
        impact: "Bloated node_modules, unnecessary package downloads",
        recommendation:
          "Verify usage with: grep -r \"from 'package-name'\" src/\nRemove if truly unused: npm uninstall <package>",
      });
    }

    // Heavy packages
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
        impact: "Larger bundle size, slower installs",
        recommendation: "Consider switching to suggested alternatives",
      });
    }

    // Missing scripts
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
        impact: "Inconsistent developer experience, harder onboarding",
        recommendation: "Add standard scripts: build, test, dev/start",
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
          "Found imports that bundle entire libraries instead of specific functions.",
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
        impact: "Larger bundle size (e.g., full lodash adds ~70KB)",
        recommendation:
          "Use specific imports:\n✅ import { debounce } from 'lodash-es'\n✅ import { useState } from 'react'",
      });
    }

    return findings;
  }

  private checkCodeQuality(files: ScannedFile[]): Finding[] {
    const findings: Finding[] = [];

    const jsFiles = files.filter((f) =>
      [".js", ".ts", ".jsx", ".tsx"].includes(f.extension),
    );

    // Total JavaScript size
    const totalJsSize = jsFiles.reduce((sum, f) => sum + f.size, 0);
    const totalJsSizeMB = totalJsSize / 1024 / 1024;

    if (totalJsSizeMB > 0) {
      const estimatedBundleKB = (totalJsSize / 1024) * 0.35; // Rough estimation
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
          "Rough estimation only — actual bundle depends on bundler config",
        recommendation:
          "For accurate bundle analysis, use webpack-bundle-analyzer or similar tools",
      });
    }

    return findings;
  }
}
