import type {
  Finding,
  Category,
  EnvironmentContext,
  Severity,
  ConfidenceLevel,
} from "@fpd/shared-types";

export interface ResourceTiming {
  startTime: number;
  responseEnd: number;
  domainLookupStart?: number;
  domainLookupEnd?: number;
  connectStart?: number;
  connectEnd?: number;
  secureConnectionStart?: number;
  requestStart?: number;
  responseStart?: number;
}

export type ResourceType =
  | "document"
  | "script"
  | "stylesheet"
  | "image"
  | "font"
  | "xhr"
  | "fetch"
  | "media"
  | "other";

export interface ResourceInfo {
  url: string;
  type: ResourceType;
  size?: number;
  transferSize?: number;
  duration?: number;
  status?: number;
  headers?: Record<string, string>;
  initiator?: string;
  timing?: ResourceTiming;
}

export interface PerformanceMetrics {
  fcp?: number;
  lcp?: number;
  cls?: number;
  fid?: number;
  ttfb?: number;
  tti?: number;
  tbt?: number;
  domContentLoaded?: number;
  load?: number;
}

export interface AnalyzerContext {
  url: string;

  pageData?: Record<string, unknown>;

  options?: AnalyzerOptions;

  environment?: EnvironmentContext;

  html?: string;

  resources?: ResourceInfo[];

  headers?: Record<string, string>;

  metrics?: PerformanceMetrics;
}

export interface AnalyzerOptions {
  verbose?: boolean;

  timeout?: number;

  scanPath?: string;

  skipEnvironmentAdjustments?: boolean;

  forceEnvironment?: EnvironmentContext;
}

export interface AnalyzerResult {
  analyzerName: string;

  findings: Finding[];

  duration: number;

  errors?: string[];
}

export interface Analyzer {
  readonly name: string;

  readonly description: string;

  readonly categories: Category[];

  analyze(context: AnalyzerContext): Promise<AnalyzerResult>;

  shouldRun?(context: AnalyzerContext): boolean;
}

export type AnalyzerConstructor = new () => Analyzer;

export interface SeverityAdjustmentResult {
  severity: Severity;
  downgraded: boolean;
  note?: string;
}

export type FindingTypeForAdjustment =
  | "cache"
  | "network"
  | "security"
  | "performance"
  | "rendering"
  | "other";

export function getEnvironment(context: AnalyzerContext): EnvironmentContext {
  return (
    context.environment ?? {
      runtimeEnvironment: "unknown",
      hostType: "unknown",
      hostname: "",
      isHttps: false,
      isLocalDev: false,
      isNonStandardPort: false,
      cacheHeadersReliable: true,
      cdnLikelyPresent: false,
      productionLikeBuild: true,
      detectionConfidence: "low",
      analysisNotes: [],
    }
  );
}

export function shouldApplyEnvironmentAdjustments(
  context: AnalyzerContext,
): boolean {
  if (context.options?.skipEnvironmentAdjustments) {
    return false;
  }
  return true;
}

export function adjustSeverityForEnvironment(
  severity: Severity,
  context: AnalyzerContext,
  findingType: FindingTypeForAdjustment,
): SeverityAdjustmentResult {
  const environment = getEnvironment(context);

  if (!shouldApplyEnvironmentAdjustments(context)) {
    return { severity, downgraded: false };
  }

  if (
    environment.runtimeEnvironment === "production" &&
    !environment.isLocalDev
  ) {
    return { severity, downgraded: false };
  }

  if (findingType === "cache" && environment.isLocalDev) {
    if (severity === "critical") {
      return {
        severity: "info",
        downgraded: true,
        note: "Severity reduced: cache headers in local development rarely reflect production",
      };
    }
    if (severity === "warning") {
      return {
        severity: "success",
        downgraded: true,
        note: "Severity reduced: cache behavior differs in local development",
      };
    }
    if (severity === "info") {
      return {
        severity: "success",
        downgraded: true,
        note: "Cache findings in local dev have limited reliability",
      };
    }
  }

  if (
    (findingType === "network" || findingType === "security") &&
    environment.hostType === "localhost"
  ) {
    if (severity === "critical") {
      return {
        severity: "info",
        downgraded: true,
        note: "Severity reduced: localhost does not require HTTPS",
      };
    }
    if (severity === "warning") {
      return {
        severity: "success",
        downgraded: true,
        note: "Severity reduced: finding not applicable to localhost",
      };
    }
  }

  if (environment.runtimeEnvironment === "preview") {
    if (findingType === "cache" && severity === "warning") {
      return {
        severity: "info",
        downgraded: true,
        note: "Severity reduced: preview environments often have different cache policies",
      };
    }
  }

  if (findingType === "performance" && !environment.productionLikeBuild) {
    if (severity === "critical") {
      return {
        severity: "warning",
        downgraded: true,
        note: "Severity reduced: development builds have different performance characteristics",
      };
    }
    if (severity === "warning") {
      return {
        severity: "info",
        downgraded: true,
        note: "Performance findings in dev builds have reduced reliability",
      };
    }
  }

  return { severity, downgraded: false };
}

export function createEnvironmentNotes(
  context: AnalyzerContext,
  findingType: FindingTypeForAdjustment,
  additionalNote?: string,
): string[] {
  const environment = getEnvironment(context);
  const notes: string[] = [];

  if (environment.isLocalDev) {
    if (findingType === "cache") {
      notes.push(
        "Local development servers typically do not configure production-like caching. " +
          "Verify cache behavior in a production or staging environment.",
      );
    } else if (findingType === "network") {
      notes.push(
        "Network performance in local development may differ significantly from production.",
      );
    } else if (findingType === "performance") {
      notes.push(
        "Performance measurements in local development may not reflect production behavior.",
      );
    } else {
      notes.push("Analysis ran in local development environment.");
    }
  } else if (!environment.cacheHeadersReliable && findingType === "cache") {
    notes.push(
      "Cache headers in this environment may not reflect production configuration.",
    );
  } else if (environment.runtimeEnvironment === "preview") {
    notes.push(
      "Preview environments may have different optimizations than production.",
    );
  }

  if (!environment.productionLikeBuild && findingType === "performance") {
    notes.push(
      "Development builds typically have larger bundles and less optimization than production.",
    );
  }

  if (additionalNote) {
    notes.push(additionalNote);
  }

  return notes;
}

export function isEnvironmentLimited(
  context: AnalyzerContext,
  findingType: FindingTypeForAdjustment,
): boolean {
  const environment = getEnvironment(context);

  if (environment.isLocalDev) {
    return true;
  }

  if (findingType === "cache" && !environment.cacheHeadersReliable) {
    return true;
  }

  if (findingType === "performance" && !environment.productionLikeBuild) {
    return true;
  }

  if (environment.runtimeEnvironment === "preview") {
    return findingType === "cache" || findingType === "network";
  }

  return false;
}

export function getConfidenceForEnvironment(
  context: AnalyzerContext,
  findingType: FindingTypeForAdjustment,
  baseConfidence: ConfidenceLevel = "high",
): ConfidenceLevel {
  const environment = getEnvironment(context);

  if (environment.isLocalDev) {
    if (findingType === "cache") return "low";
    if (findingType === "network") return "low";
    if (findingType === "performance") return "low";
    return "medium";
  }

  if (findingType === "cache" && !environment.cacheHeadersReliable) {
    return baseConfidence === "high" ? "medium" : "low";
  }

  if (findingType === "performance" && !environment.productionLikeBuild) {
    return baseConfidence === "high" ? "medium" : "low";
  }

  return baseConfidence;
}
