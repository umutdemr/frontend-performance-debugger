import * as os from "node:os";
import * as path from "node:path";

export interface ViewerConfig {
  defaultPort: number;
  host: string;
  title: string;
  tempDir: string;
  reportFileName: string;
  healthPath: string;
  reportPath: string;
}

export const DEFAULT_VIEWER_CONFIG: ViewerConfig = {
  defaultPort: 3210,
  host: "127.0.0.1",
  title: "Frontend Performance Debugger Viewer",
  tempDir: path.join(os.tmpdir(), "fpd"),
  reportFileName: "latest-report.json",
  healthPath: "/api/health",
  reportPath: "/api/report",
};

export function getViewerReportPath(
  config: ViewerConfig = DEFAULT_VIEWER_CONFIG,
): string {
  return path.join(config.tempDir, config.reportFileName);
}

export function getViewerBaseUrl(
  port: number,
  config: ViewerConfig = DEFAULT_VIEWER_CONFIG,
): string {
  return `http://${config.host}:${port}`;
}

export function getViewerHealthUrl(
  port: number,
  config: ViewerConfig = DEFAULT_VIEWER_CONFIG,
): string {
  return `${getViewerBaseUrl(port, config)}${config.healthPath}`;
}

export function getViewerReportUrl(
  port: number,
  config: ViewerConfig = DEFAULT_VIEWER_CONFIG,
): string {
  return `${getViewerBaseUrl(port, config)}${config.reportPath}`;
}
