import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
}

export interface DependencyAnalysis {
  totalDependencies: number;
  dependencies: string[];
  devDependencies: string[];
  potentiallyUnused: string[];
  heavyPackages: Array<{ name: string; reason: string }>;
  missingScripts: string[];
}

/**
 * Known heavy packages to warn about
 */
const HEAVY_PACKAGES: Record<string, string> = {
  lodash: "Consider lodash-es or individual imports",
  moment: "Consider date-fns (97% smaller) or dayjs",
  jquery: "Modern frameworks usually don't need jQuery",
  "core-js": "Often over-imported, check polyfill needs",
};

/**
 * Read and parse package.json
 */
export async function readPackageJson(
  rootPath: string,
): Promise<PackageJson | null> {
  try {
    const pkgPath = join(rootPath, "package.json");
    const content = await readFile(pkgPath, "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

export async function analyzeDependencies(
  rootPath: string,
  fileContents: string[],
): Promise<DependencyAnalysis> {
  const pkg = await readPackageJson(rootPath);

  if (!pkg) {
    return {
      totalDependencies: 0,
      dependencies: [],
      devDependencies: [],
      potentiallyUnused: [],
      heavyPackages: [],
      missingScripts: [],
    };
  }

  const dependencies = Object.keys(pkg.dependencies || {});
  const devDependencies = Object.keys(pkg.devDependencies || {});
  const allDeps = [...dependencies, ...devDependencies];

  const potentiallyUnused: string[] = [];
  for (const dep of allDeps) {
    const isUsed = fileContents.some((content) => {
      // Check various import patterns
      return (
        content.includes(`from '${dep}'`) ||
        content.includes(`from "${dep}"`) ||
        content.includes(`require('${dep}')`) ||
        content.includes(`require("${dep}")`) ||
        content.includes(`import('${dep}')`) ||
        content.includes(`import("${dep}")`)
      );
    });

    if (!isUsed) {
      potentiallyUnused.push(dep);
    }
  }

  // Check for heavy packages
  const heavyPackages = allDeps
    .filter((dep) => HEAVY_PACKAGES[dep])
    .map((dep) => ({
      name: dep,
      reason: HEAVY_PACKAGES[dep] as string,
    }));

  // Check for missing standard scripts
  const scripts = pkg.scripts || {};
  const missingScripts: string[] = [];

  if (!scripts.build) missingScripts.push("build");
  if (!scripts.test) missingScripts.push("test");
  if (!scripts.dev && !scripts.start) missingScripts.push("dev/start");

  return {
    totalDependencies: allDeps.length,
    dependencies,
    devDependencies,
    potentiallyUnused,
    heavyPackages,
    missingScripts,
  };
}

/**
 * Find import statements in code
 */
export function findImports(content: string): string[] {
  const imports: string[] = [];
  const importRegex = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  let match;

  while ((match = importRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }

  const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
  while ((match = requireRegex.exec(content)) !== null) {
    if (match[1]) {
      imports.push(match[1]);
    }
  }

  return imports;
}

export function detectHeavyImports(content: string): Array<{
  line: string;
  issue: string;
}> {
  const issues: Array<{ line: string; issue: string }> = [];

  if (
    content.includes("import _ from 'lodash'") ||
    content.includes('import _ from "lodash"')
  ) {
    issues.push({
      line: "import _ from 'lodash'",
      issue:
        "Imports entire lodash (~70KB). Use lodash-es or import specific functions",
    });
  }

  // React namespace import
  if (content.includes("import * as React from 'react'")) {
    issues.push({
      line: "import * as React from 'react'",
      issue: "Prefer named imports: import { useState } from 'react'",
    });
  }

  return issues;
}
