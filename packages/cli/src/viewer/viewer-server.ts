import * as http from "node:http";
import type { AddressInfo } from "node:net";
import type { Report } from "@fpd/shared-types";
import {
  DEFAULT_VIEWER_CONFIG,
  type ViewerConfig,
  getViewerBaseUrl,
} from "./viewer-config.js";
import { generateReportHTML } from "./viewer-html.js";

export interface ViewerServerInstance {
  server: http.Server;
  port: number;
  url: string;
  close: () => Promise<void>;
}

export async function startViewerServer(
  report: Report,
  config: ViewerConfig = DEFAULT_VIEWER_CONFIG,
): Promise<ViewerServerInstance> {
  const port = await findAvailablePort(config.defaultPort, config.host);

  const reportHTML = generateReportHTML(report);

  const server = http.createServer((req, res) => {
    const method = req.method ?? "GET";
    const requestUrl = req.url ?? "/";

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (method === "GET" && requestUrl === config.healthPath) {
      respondJson(res, 200, {
        status: "ok",
        service: "fpd-viewer",
      });
      return;
    }

    if (method === "GET" && requestUrl === config.reportPath) {
      respondJson(res, 200, report);
      return;
    }

    if (
      method === "GET" &&
      (requestUrl === "/" || requestUrl === "/index.html")
    ) {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(reportHTML);
      return;
    }

    if (requestUrl === "/favicon.ico") {
      res.statusCode = 204;
      res.end();
      return;
    }

    respondJson(res, 404, {
      error: "Not Found",
      message: `No route matches ${requestUrl}`,
    });
  });

  await listen(server, port, config.host);

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to resolve viewer server address");
  }

  const resolvedPort = (address as AddressInfo).port;
  const url = getViewerBaseUrl(resolvedPort, config);

  return {
    server,
    port: resolvedPort,
    url,
    close: () => closeServer(server),
  };
}

async function findAvailablePort(
  preferredPort: number,
  host: string,
  maxAttempts = 20,
): Promise<number> {
  let currentPort = preferredPort;

  for (let i = 0; i < maxAttempts; i++) {
    const available = await isPortAvailable(currentPort, host);
    if (available) {
      return currentPort;
    }
    currentPort += 1;
  }

  throw new Error(
    `Could not find an available port starting from ${preferredPort}`,
  );
}

async function isPortAvailable(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const tester = http.createServer();

    tester.once("error", () => {
      resolve(false);
    });

    tester.once("listening", () => {
      tester.close(() => resolve(true));
    });

    tester.listen(port, host);
  });
}

async function listen(
  server: http.Server,
  port: number,
  host: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

function respondJson(
  res: http.ServerResponse,
  statusCode: number,
  payload: unknown,
): void {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload, null, 2));
}
