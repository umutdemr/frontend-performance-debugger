import { readdir, stat, readFile } from "node:fs/promises";
import { join, extname, relative } from "node:path";

export interface ScannedFile {
  path: string;
  relativePath: string;
  size: number;
  extension: string;
  isDirectory: boolean;
}

export interface FileScannerOptions {
  /** Extensions to scan (e.g., ['.js', '.ts']) */
  extensions?: string[];

  /** Directories to ignore */
  ignoreDirs?: string[];

  /** File patterns to ignore */
  ignorePatterns?: RegExp[];

  /** Maximum depth to scan */
  maxDepth?: number;
}

const DEFAULT_IGNORE_DIRS = [
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  "coverage",
  ".cache",
];

export async function scanDirectory(
  rootPath: string,
  options: FileScannerOptions = {},
): Promise<ScannedFile[]> {
  const {
    extensions = [],
    ignoreDirs = DEFAULT_IGNORE_DIRS,
    ignorePatterns = [],
    maxDepth = 10,
  } = options;

  const files: ScannedFile[] = [];

  async function scan(dirPath: string, depth: number): Promise<void> {
    if (depth > maxDepth) return;

    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      const relativePath = relative(rootPath, fullPath);

      // Check ignore patterns
      if (ignorePatterns.some((pattern) => pattern.test(relativePath))) {
        continue;
      }

      if (entry.isDirectory()) {
        // Skip ignored directories
        if (ignoreDirs.includes(entry.name)) {
          continue;
        }

        await scan(fullPath, depth + 1);
      } else {
        const ext = extname(entry.name);

        // Filter by extension if specified
        if (extensions.length > 0 && !extensions.includes(ext)) {
          continue;
        }

        const stats = await stat(fullPath);

        files.push({
          path: fullPath,
          relativePath,
          size: stats.size,
          extension: ext,
          isDirectory: false,
        });
      }
    }
  }

  await scan(rootPath, 0);
  return files;
}

export async function directoryExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

export async function fileExists(path: string): Promise<boolean> {
  try {
    const stats = await stat(path);
    return stats.isFile();
  } catch {
    return false;
  }
}

export async function readFileContent(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

export function getFileSizeCategory(
  size: number,
  extension: string,
): "ok" | "warning" | "critical" {
  const sizeKB = size / 1024;

  // JavaScript/TypeScript
  if ([".js", ".ts", ".jsx", ".tsx", ".mjs"].includes(extension)) {
    if (sizeKB > 500) return "critical";
    if (sizeKB > 200) return "warning";
    return "ok";
  }

  // CSS
  if ([".css", ".scss", ".sass", ".less"].includes(extension)) {
    if (sizeKB > 200) return "critical";
    if (sizeKB > 100) return "warning";
    return "ok";
  }

  // Images
  if ([".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp"].includes(extension)) {
    if (sizeKB > 1024) return "critical";
    if (sizeKB > 500) return "warning";
    return "ok";
  }

  // JSON
  if (extension === ".json") {
    if (sizeKB > 100) return "warning";
    if (sizeKB > 50) return "warning";
    return "ok";
  }

  return "ok";
}
