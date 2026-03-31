import * as fs from "fs";
import * as path from "path";
import type {
  ProjectStack,
  UILibrary,
  MetaFramework,
  Bundler,
  PackageManager,
  RoutingType,
  StylingType,
  StateManagement,
  FrameworkFeatures,
} from "@fpd/shared-types";
import {
  UNKNOWN_PROJECT_STACK,
  DEFAULT_FRAMEWORK_FEATURES,
  UI_LIBRARY_SIGNATURES,
  BUNDLER_SIGNATURES,
} from "@fpd/shared-types";

interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
}

/**
 * Framework detection result with metadata
 */
export interface FrameworkDetectionResult {
  stack: ProjectStack;
  errors: string[];
  warnings: string[];
  scanDuration: number;
}

/**
 * Framework Detector Class
 * Analyzes a project directory to detect the tech stack
 */
export class FrameworkDetector {
  private projectRoot: string;
  private packageJson: PackageJson | null = null;
  private detectedFrom: string[] = [];
  private errors: string[] = [];
  private warnings: string[] = [];

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  /**
   * Main detection method
   */
  detect(): FrameworkDetectionResult {
    const startTime = Date.now();

    // Reset state
    this.detectedFrom = [];
    this.errors = [];
    this.warnings = [];

    // Check if directory exists
    if (!fs.existsSync(this.projectRoot)) {
      this.errors.push(`Project directory not found: ${this.projectRoot}`);
      return {
        stack: UNKNOWN_PROJECT_STACK,
        errors: this.errors,
        warnings: this.warnings,
        scanDuration: Date.now() - startTime,
      };
    }

    // Load package.json
    this.packageJson = this.loadPackageJson();
    if (!this.packageJson) {
      this.warnings.push("No package.json found, detection will be limited");
    }

    // Detect all parts of the stack
    const uiLibraryResult = this.detectUILibrary();
    const metaFrameworkResult = this.detectMetaFramework();
    const bundlerResult = this.detectBundler();
    const packageManager = this.detectPackageManager();
    const routing = this.detectRouting(metaFrameworkResult.metaFramework);
    const styling = this.detectStyling();
    const stateManagement = this.detectStateManagement();
    const typescript = this.detectTypeScript();
    const monorepo = this.detectMonorepo();
    const features = this.detectFeatures(metaFrameworkResult.metaFramework);

    // Calculate confidence
    const confidence = this.calculateConfidence();

    const stack: ProjectStack = {
      uiLibrary: uiLibraryResult.uiLibrary,
      uiLibraryVersion: uiLibraryResult.version,
      metaFramework: metaFrameworkResult.metaFramework,
      metaFrameworkVersion: metaFrameworkResult.version,
      bundler: bundlerResult,
      packageManager,
      routing,
      styling,
      stateManagement,
      typescript,
      monorepo,
      features,
      confidence,
      detectedFrom: this.detectedFrom,
    };

    return {
      stack,
      errors: this.errors,
      warnings: this.warnings,
      scanDuration: Date.now() - startTime,
    };
  }

  /**
   * Load and parse package.json
   */
  private loadPackageJson(): PackageJson | null {
    const packageJsonPath = path.join(this.projectRoot, "package.json");

    if (!fs.existsSync(packageJsonPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(packageJsonPath, "utf-8");
      this.detectedFrom.push("package.json");
      return JSON.parse(content) as PackageJson;
    } catch (error) {
      this.errors.push(`Failed to parse package.json: ${error}`);
      return null;
    }
  }

  /**
   * Check if a file exists in project root
   */
  private fileExists(filename: string): boolean {
    return fs.existsSync(path.join(this.projectRoot, filename));
  }

  /**
   * Check if a directory exists in project root
   */
  private dirExists(dirname: string): boolean {
    const fullPath = path.join(this.projectRoot, dirname);
    return fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory();
  }

  /**
   * Get all dependencies (deps + devDeps + peerDeps)
   */
  private getAllDependencies(): Record<string, string> {
    if (!this.packageJson) return {};

    return {
      ...this.packageJson.dependencies,
      ...this.packageJson.devDependencies,
      ...this.packageJson.peerDependencies,
    };
  }

  /**
   * Check if a dependency exists
   */
  private hasDependency(name: string): boolean {
    const allDeps = this.getAllDependencies();
    return name in allDeps;
  }

  private getDependencyVersion(name: string): string | null {
    const allDeps = this.getAllDependencies();
    const version = allDeps[name];
    if (!version) return null;

    // Clean version string (remove ^, ~, etc.)
    return version.replace(/^[\^~>=<]+/, "");
  }

  /**
   * Detect UI Library (React, Vue, Angular, etc.)
   */
  private detectUILibrary(): { uiLibrary: UILibrary; version: string | null } {
    for (const [library, signature] of Object.entries(UI_LIBRARY_SIGNATURES)) {
      for (const dep of signature.dependencies) {
        if (this.hasDependency(dep)) {
          this.detectedFrom.push(`dependency:${dep}`);
          return {
            uiLibrary: library as UILibrary,
            version: this.getDependencyVersion(dep),
          };
        }
      }
    }

    return { uiLibrary: "unknown", version: null };
  }

  /**
   * Detect Meta-Framework (Next.js, Nuxt, etc.)
   */
  private detectMetaFramework(): {
    metaFramework: MetaFramework;
    version: string | null;
  } {
    // Check Next.js
    if (this.hasDependency("next")) {
      this.detectedFrom.push("dependency:next");
      return {
        metaFramework: "nextjs",
        version: this.getDependencyVersion("next"),
      };
    }

    // Check Nuxt
    if (this.hasDependency("nuxt")) {
      this.detectedFrom.push("dependency:nuxt");
      return {
        metaFramework: "nuxt",
        version: this.getDependencyVersion("nuxt"),
      };
    }

    // Check Remix
    if (this.hasDependency("@remix-run/react")) {
      this.detectedFrom.push("dependency:@remix-run/react");
      return {
        metaFramework: "remix",
        version: this.getDependencyVersion("@remix-run/react"),
      };
    }

    // Check Gatsby
    if (this.hasDependency("gatsby")) {
      this.detectedFrom.push("dependency:gatsby");
      return {
        metaFramework: "gatsby",
        version: this.getDependencyVersion("gatsby"),
      };
    }

    // Check SvelteKit
    if (this.hasDependency("@sveltejs/kit")) {
      this.detectedFrom.push("dependency:@sveltejs/kit");
      return {
        metaFramework: "sveltekit",
        version: this.getDependencyVersion("@sveltejs/kit"),
      };
    }

    // Check Astro
    if (this.hasDependency("astro")) {
      this.detectedFrom.push("dependency:astro");
      return {
        metaFramework: "astro",
        version: this.getDependencyVersion("astro"),
      };
    }

    // Check SolidStart
    if (this.hasDependency("solid-start")) {
      this.detectedFrom.push("dependency:solid-start");
      return {
        metaFramework: "solid-start",
        version: this.getDependencyVersion("solid-start"),
      };
    }

    // Check Create React App
    if (this.hasDependency("react-scripts")) {
      this.detectedFrom.push("dependency:react-scripts");
      return {
        metaFramework: "cra",
        version: this.getDependencyVersion("react-scripts"),
      };
    }

    // Check Vue CLI
    if (this.hasDependency("@vue/cli-service")) {
      this.detectedFrom.push("dependency:@vue/cli-service");
      return {
        metaFramework: "vue-cli",
        version: this.getDependencyVersion("@vue/cli-service"),
      };
    }

    // Check Angular CLI
    if (this.fileExists("angular.json")) {
      this.detectedFrom.push("file:angular.json");
      return {
        metaFramework: "angular-cli",
        version: this.getDependencyVersion("@angular/core"),
      };
    }

    // Check Vite with specific UI library
    if (this.hasDependency("vite")) {
      this.detectedFrom.push("dependency:vite");

      if (this.hasDependency("react")) {
        return {
          metaFramework: "vite-react",
          version: this.getDependencyVersion("vite"),
        };
      }
      if (this.hasDependency("vue")) {
        return {
          metaFramework: "vite-vue",
          version: this.getDependencyVersion("vite"),
        };
      }
      if (this.hasDependency("svelte")) {
        return {
          metaFramework: "vite-svelte",
          version: this.getDependencyVersion("vite"),
        };
      }
      if (this.hasDependency("solid-js")) {
        return {
          metaFramework: "vite-solid",
          version: this.getDependencyVersion("vite"),
        };
      }

      return {
        metaFramework: "vite",
        version: this.getDependencyVersion("vite"),
      };
    }

    return { metaFramework: "unknown", version: null };
  }

  private detectBundler(): Bundler {
    // Check config files first
    for (const [bundler, signature] of Object.entries(BUNDLER_SIGNATURES)) {
      for (const file of signature.files) {
        if (this.fileExists(file)) {
          this.detectedFrom.push(`file:${file}`);
          return bundler as Bundler;
        }
      }
    }

    // Check dependencies
    for (const [bundler, signature] of Object.entries(BUNDLER_SIGNATURES)) {
      for (const dep of signature.dependencies) {
        if (this.hasDependency(dep)) {
          return bundler as Bundler;
        }
      }
    }

    // Infer from meta-framework
    if (this.hasDependency("next")) {
      return "webpack";
    }

    if (this.hasDependency("nuxt")) {
      return "vite";
    }

    return "unknown";
  }

  private detectPackageManager(): PackageManager {
    if (
      this.fileExists("pnpm-lock.yaml") ||
      this.fileExists("pnpm-workspace.yaml")
    ) {
      this.detectedFrom.push("file:pnpm-lock.yaml");
      return "pnpm";
    }

    if (this.fileExists("yarn.lock")) {
      this.detectedFrom.push("file:yarn.lock");
      return "yarn";
    }

    if (this.fileExists("bun.lockb")) {
      this.detectedFrom.push("file:bun.lockb");
      return "bun";
    }

    if (this.fileExists("package-lock.json")) {
      this.detectedFrom.push("file:package-lock.json");
      return "npm";
    }

    return "unknown";
  }

  private detectRouting(metaFramework: MetaFramework): RoutingType {
    switch (metaFramework) {
      case "nextjs":
        if (this.dirExists("app") || this.dirExists("src/app")) {
          this.detectedFrom.push("dir:app");
          return "app-router";
        }
        if (this.dirExists("pages") || this.dirExists("src/pages")) {
          this.detectedFrom.push("dir:pages");
          return "pages-router";
        }
        return "unknown";

      case "nuxt":
      case "sveltekit":
      case "astro":
        return "file-based";

      case "cra":
      case "vite-react":
      case "vite-vue":
        return "config-based";

      default:
        return "unknown";
    }
  }

  private detectStyling(): StylingType[] {
    const styling: StylingType[] = [];

    if (
      this.fileExists("tailwind.config.js") ||
      this.fileExists("tailwind.config.ts") ||
      this.fileExists("tailwind.config.mjs") ||
      this.hasDependency("tailwindcss")
    ) {
      styling.push("tailwind");
      this.detectedFrom.push("styling:tailwind");
    }

    if (this.hasDependency("styled-components")) {
      styling.push("styled-components");
    }

    if (
      this.hasDependency("@emotion/react") ||
      this.hasDependency("@emotion/styled")
    ) {
      styling.push("emotion");
    }

    if (this.hasDependency("sass") || this.hasDependency("node-sass")) {
      styling.push("sass");
    }

    if (this.hasDependency("less")) {
      styling.push("less");
    }

    if (this.hasDependency("@pandacss/dev")) {
      styling.push("panda-css");
    }

    if (this.hasDependency("styled-jsx")) {
      styling.push("styled-jsx");
    }

    if (styling.length === 0) {
      styling.push("vanilla-css");
    }

    return styling;
  }

  private detectStateManagement(): StateManagement[] {
    const stateManagement: StateManagement[] = [];

    if (this.hasDependency("@reduxjs/toolkit") || this.hasDependency("redux")) {
      stateManagement.push("redux");
    }

    if (this.hasDependency("zustand")) {
      stateManagement.push("zustand");
    }

    if (this.hasDependency("jotai")) {
      stateManagement.push("jotai");
    }

    if (this.hasDependency("recoil")) {
      stateManagement.push("recoil");
    }

    if (this.hasDependency("mobx")) {
      stateManagement.push("mobx");
    }

    if (this.hasDependency("pinia")) {
      stateManagement.push("pinia");
    }

    if (this.hasDependency("vuex")) {
      stateManagement.push("vuex");
    }

    if (
      this.hasDependency("@tanstack/react-query") ||
      this.hasDependency("@tanstack/vue-query")
    ) {
      stateManagement.push("tanstack-query");
    }

    if (this.hasDependency("swr")) {
      stateManagement.push("swr");
    }

    if (this.hasDependency("@apollo/client")) {
      stateManagement.push("apollo");
    }

    if (this.hasDependency("xstate")) {
      stateManagement.push("xstate");
    }

    if (this.hasDependency("nanostores")) {
      stateManagement.push("nanostores");
    }

    if (stateManagement.length === 0) {
      stateManagement.push("none");
    }

    return stateManagement;
  }

  private detectTypeScript(): boolean {
    if (this.fileExists("tsconfig.json")) {
      this.detectedFrom.push("file:tsconfig.json");
      return true;
    }

    if (this.hasDependency("typescript")) {
      return true;
    }

    return false;
  }

  private detectMonorepo(): boolean {
    if (this.fileExists("pnpm-workspace.yaml")) {
      this.detectedFrom.push("monorepo:pnpm-workspace");
      return true;
    }

    if (this.fileExists("lerna.json")) {
      this.detectedFrom.push("monorepo:lerna");
      return true;
    }

    if (this.fileExists("nx.json")) {
      this.detectedFrom.push("monorepo:nx");
      return true;
    }

    if (this.fileExists("turbo.json")) {
      this.detectedFrom.push("monorepo:turborepo");
      return true;
    }

    if (this.packageJson?.workspaces) {
      this.detectedFrom.push("monorepo:yarn-workspaces");
      return true;
    }

    return false;
  }

  /**
   * Detect Framework-specific Features
   */
  private detectFeatures(metaFramework: MetaFramework): FrameworkFeatures {
    const features: FrameworkFeatures = { ...DEFAULT_FRAMEWORK_FEATURES };

    switch (metaFramework) {
      case "nextjs":
        features.imageOptimization = true;
        features.scriptOptimization = true;
        features.fontOptimization = true;
        features.ssr = true;
        features.ssg = true;
        features.isr = true;
        features.apiRoutes = true;
        features.middleware = true;
        features.edgeRuntime = true;

        const nextVersion = this.getDependencyVersion("next");
        if (nextVersion && this.isVersionAtLeast(nextVersion, "13.0.0")) {
          features.serverComponents = true;
          features.streaming = true;
        }
        break;

      case "nuxt":
        features.imageOptimization = this.hasDependency("@nuxt/image");
        features.ssr = true;
        features.ssg = true;
        features.apiRoutes = true;
        features.middleware = true;
        break;

      case "remix":
        features.ssr = true;
        features.streaming = true;
        features.apiRoutes = true;
        break;

      case "astro":
        features.ssg = true;
        features.partialHydration = true;
        features.ssr =
          this.hasDependency("@astrojs/node") ||
          this.hasDependency("@astrojs/vercel") ||
          this.hasDependency("@astrojs/netlify");
        break;

      case "sveltekit":
        features.ssr = true;
        features.ssg = true;
        features.apiRoutes = true;
        break;

      case "gatsby":
        features.ssg = true;
        features.imageOptimization = true;
        break;

      default:
        break;
    }

    return features;
  }

  /**
   * Compare semver versions
   */
  private isVersionAtLeast(version: string, minimum: string): boolean {
    const vParts = version.split(".").map((p) => parseInt(p, 10) || 0);
    const mParts = minimum.split(".").map((p) => parseInt(p, 10) || 0);

    for (let i = 0; i < 3; i++) {
      const v = vParts[i] || 0;
      const m = mParts[i] || 0;

      if (v > m) return true;
      if (v < m) return false;
    }

    return true;
  }

  private calculateConfidence(): "high" | "medium" | "low" {
    const detectionCount = this.detectedFrom.length;

    if (detectionCount >= 5) return "high";
    if (detectionCount >= 2) return "medium";
    return "low";
  }
}

/**
 * Convenience function for quick detection
 */
export function detectFramework(projectRoot: string): FrameworkDetectionResult {
  const detector = new FrameworkDetector(projectRoot);
  return detector.detect();
}

/**
 * Sync version - same as detectFramework since implementation is sync
 */
export function detectFrameworkSync(projectRoot: string): ProjectStack {
  const result = detectFramework(projectRoot);
  return result.stack;
}
