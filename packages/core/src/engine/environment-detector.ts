import {
  type EnvironmentContext,
  type RuntimeEnvironment,
  type HostType,
  type ConfidenceLevel,
  type FrameworkAssetPatterns,
  DEFAULT_ENVIRONMENT_CONTEXT,
  STANDARD_PORTS,
  COMMON_DEV_PORTS,
  PREVIEW_DOMAIN_PATTERNS,
  STAGING_DOMAIN_PATTERNS,
} from "@fpd/shared-types";

export interface EnvironmentDetectionInput {
  url: string;
  responseHeaders?: Record<string, string>;
  htmlContent?: string;
  resourceUrls?: string[];
}

/**
 * Detect environment context from URL and optional response data.
 */
export function detectEnvironment(
  input: EnvironmentDetectionInput,
): EnvironmentContext {
  const { url, responseHeaders, htmlContent, resourceUrls } = input;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    return {
      ...DEFAULT_ENVIRONMENT_CONTEXT,
      analysisNotes: ["Could not parse URL for environment detection"],
    };
  }

  const hostname = parsedUrl.hostname.toLowerCase();
  const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : undefined;
  const isHttps = parsedUrl.protocol === "https:";

  const hostType = detectHostType(hostname);

  const runtimeEnvironment = detectRuntimeEnvironment(hostname, hostType, port);

  const isLocalDev = hostType === "localhost" || hostType === "private-ip";

  const isNonStandardPort = !STANDARD_PORTS.has(port) && !isLocalDev;

  const frameworkDetection = detectFramework(htmlContent, resourceUrls);

  const cacheHeadersReliable = determineCacheReliability(
    runtimeEnvironment,
    hostType,
    responseHeaders,
  );
  const cdnLikelyPresent = detectCdnPresence(responseHeaders, hostname);
  const productionLikeBuild = detectProductionBuild(htmlContent, resourceUrls);

  const analysisNotes = compileAnalysisNotes({
    runtimeEnvironment,
    hostType,
    isLocalDev,
    cacheHeadersReliable,
    frameworkDetection,
    isHttps,
  });

  const detectionConfidence = determineConfidence({
    hostType,
    runtimeEnvironment,
    hasHeaders: !!responseHeaders,
    hasHtml: !!htmlContent,
  });

  return {
    runtimeEnvironment,
    hostType,
    hostname,
    port,
    isHttps,
    isLocalDev,
    isNonStandardPort,
    cacheHeadersReliable,
    cdnLikelyPresent,
    productionLikeBuild,
    detectedFramework: frameworkDetection?.name,
    frameworkVersion: frameworkDetection?.version,
    frameworkPatterns: frameworkDetection?.patterns,
    detectionConfidence,
    analysisNotes,
  };
}

function detectHostType(hostname: string): HostType {
  // Localhost variants
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "[::1]"
  ) {
    return "localhost";
  }

  // Private IP ranges (RFC 1918)
  if (isPrivateIp(hostname)) {
    return "private-ip";
  }

  // If it looks like a domain or public IP
  if (hostname.includes(".") || isPublicIp(hostname)) {
    return "public";
  }

  return "unknown";
}

/**
 * Check if hostname is a private IP address.
 */
function isPrivateIp(hostname: string): boolean {
  // 10.0.0.0/8
  if (/^10\./.test(hostname)) return true;

  // 172.16.0.0/12
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname)) return true;

  // 192.168.0.0/16
  if (/^192\.168\./.test(hostname)) return true;

  // 169.254.0.0/16 (link-local)
  if (/^169\.254\./.test(hostname)) return true;

  return false;
}

/**
 * Check if hostname looks like a public IP.
 */
function isPublicIp(hostname: string): boolean {
  return /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname);
}

/**
 * Detect runtime environment from hostname and context.
 */
function detectRuntimeEnvironment(
  hostname: string,
  hostType: HostType,
  port?: number,
): RuntimeEnvironment {
  // Local development
  if (hostType === "localhost" || hostType === "private-ip") {
    return "local-dev";
  }

  // Check preview patterns
  for (const pattern of PREVIEW_DOMAIN_PATTERNS) {
    if (pattern.test(hostname)) {
      return "preview";
    }
  }

  // Check staging patterns
  for (const pattern of STAGING_DOMAIN_PATTERNS) {
    if (pattern.test(hostname)) {
      return "staging";
    }
  }

  // Common dev ports on public hosts might indicate preview
  if (port && COMMON_DEV_PORTS.has(port)) {
    return "preview";
  }

  // Default to production for public domains
  if (hostType === "public") {
    return "production";
  }

  return "unknown";
}

interface FrameworkDetection {
  name: string;
  version?: string;
  patterns: FrameworkAssetPatterns;
}

/**
 * Detect framework from HTML and resource patterns.
 */
function detectFramework(
  htmlContent?: string,
  resourceUrls?: string[],
): FrameworkDetection | undefined {
  const urls = resourceUrls || [];
  const html = htmlContent || "";

  // Next.js detection
  if (
    urls.some((u) => u.includes("/_next/")) ||
    html.includes("__NEXT_DATA__") ||
    html.includes("_next/static")
  ) {
    const versionMatch = html.match(/Next\.js\s+([\d.]+)/i);
    return {
      name: "next.js",
      version: versionMatch?.[1],
      patterns: NEXTJS_PATTERNS,
    };
  }

  // Nuxt detection
  if (urls.some((u) => u.includes("/_nuxt/")) || html.includes("__NUXT__")) {
    return {
      name: "nuxt",
      patterns: NUXT_PATTERNS,
    };
  }

  // Vite/SvelteKit detection
  if (
    urls.some((u) => u.includes("/@vite/") || u.includes("/__vite_")) ||
    html.includes("vite/client")
  ) {
    return {
      name: "vite",
      patterns: VITE_PATTERNS,
    };
  }

  // Gatsby detection
  if (
    urls.some((u) => u.includes("/page-data/")) ||
    html.includes("___gatsby")
  ) {
    return {
      name: "gatsby",
      patterns: GATSBY_PATTERNS,
    };
  }

  // Create React App detection
  if (
    urls.some(
      (u) => u.includes("/static/js/main.") || u.includes("/static/js/bundle."),
    ) ||
    (html.includes("root") && html.includes("react"))
  ) {
    return {
      name: "create-react-app",
      patterns: CRA_PATTERNS,
    };
  }

  return undefined;
}

// Framework-specific asset patterns

const NEXTJS_PATTERNS: FrameworkAssetPatterns = {
  frameworkName: "next.js",
  ownedPathPatterns: [
    /\/_next\/static\//i,
    /\/_next\/image/i,
    /\/_next\/data\//i,
  ],
  runtimeChunkPatterns: [
    /\/_next\/static\/chunks\/(webpack|framework|main|polyfills)/i,
    /\/_next\/static\/chunks\/pages\/_app/i,
    /\/_next\/static\/chunks\/pages\/_document/i,
    /\/_next\/static\/chunks\/pages\/_error/i,
    /\/_next\/static\/runtime\//i,
  ],
  configPatterns: [/next\.config\.(js|mjs|ts)/i],
};

const NUXT_PATTERNS: FrameworkAssetPatterns = {
  frameworkName: "nuxt",
  ownedPathPatterns: [/\/_nuxt\//i],
  runtimeChunkPatterns: [/\/_nuxt\/.*runtime\./i, /\/_nuxt\/.*vendor\./i],
  configPatterns: [/nuxt\.config\.(js|ts)/i],
};

const VITE_PATTERNS: FrameworkAssetPatterns = {
  frameworkName: "vite",
  ownedPathPatterns: [/\/@vite\//i, /\/__vite_/i, /\/\.vite\//i],
  runtimeChunkPatterns: [/\/vite\/modulepreload-polyfill/i, /\/vite\/client/i],
  configPatterns: [/vite\.config\.(js|ts)/i],
};

const GATSBY_PATTERNS: FrameworkAssetPatterns = {
  frameworkName: "gatsby",
  ownedPathPatterns: [/\/page-data\//i, /\/static\/.*-[a-f0-9]{20}\./i],
  runtimeChunkPatterns: [
    /\/webpack-runtime-/i,
    /\/framework-/i,
    /\/polyfill-/i,
  ],
  configPatterns: [/gatsby-config\.(js|ts)/i],
};

const CRA_PATTERNS: FrameworkAssetPatterns = {
  frameworkName: "create-react-app",
  ownedPathPatterns: [
    /\/static\/js\//i,
    /\/static\/css\//i,
    /\/static\/media\//i,
  ],
  runtimeChunkPatterns: [
    /\/static\/js\/runtime-main\./i,
    /\/static\/js\/\d+\.[a-f0-9]+\.chunk\.js$/i,
  ],
  configPatterns: [],
};

/**
 * Determine if cache headers are reliable for this environment.
 */
function determineCacheReliability(
  env: RuntimeEnvironment,
  hostType: HostType,
  headers?: Record<string, string>,
): boolean {
  // Local dev cache headers are almost never production-representative
  if (
    env === "local-dev" ||
    hostType === "localhost" ||
    hostType === "private-ip"
  ) {
    return false;
  }

  if (env === "preview" || env === "staging") {
    if (headers && (headers["cache-control"] || headers["etag"])) {
      return true;
    }
    return false;
  }

  return true;
}

/**
 * Detect CDN presence from headers and hostname.
 */
function detectCdnPresence(
  headers?: Record<string, string>,
  hostname?: string,
): boolean {
  if (!headers) return false;

  const cdnHeaders = [
    "x-served-by",
    "x-cache",
    "cf-ray", // Cloudflare
    "x-vercel-cache", // Vercel
    "x-amz-cf-id", // CloudFront
    "x-fastly-request-id", // Fastly
    "x-cdn",
  ];

  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]),
  );

  if (cdnHeaders.some((h) => h in normalizedHeaders)) {
    return true;
  }

  if (hostname) {
    const cdnDomains = [
      /\.cloudflare\.com$/i,
      /\.cloudfront\.net$/i,
      /\.fastly\.net$/i,
      /\.akamaized\.net$/i,
      /\.azureedge\.net$/i,
    ];
    if (cdnDomains.some((p) => p.test(hostname))) {
      return true;
    }
  }

  return false;
}

/**
 * Detect if this looks like a production build (not dev mode).
 */
function detectProductionBuild(
  htmlContent?: string,
  resourceUrls?: string[],
): boolean {
  const html = htmlContent || "";
  const urls = resourceUrls || [];

  // Dev mode indicators
  const devIndicators = [
    // React dev mode
    /react\.development/i,
    /development mode/i,
    // Vite dev server
    /\/@vite\/client/i,
    /\/__vite_/i,
    // HMR indicators
    /hot-update/i,
    /webpack.*hmr/i,
    // Source maps in URL
    /\.map$/i,
  ];

  // Check HTML
  for (const indicator of devIndicators) {
    if (indicator.test(html)) {
      return false;
    }
  }

  // Check resource URLs
  for (const url of urls) {
    for (const indicator of devIndicators) {
      if (indicator.test(url)) {
        return false;
      }
    }
  }

  // Production indicators
  const prodIndicators = [
    // Minified bundles with hashes
    /\.[a-f0-9]{8,}\.js$/i,
    /\.min\.js$/i,
    // Production React
    /react\.production/i,
  ];

  for (const url of urls) {
    for (const indicator of prodIndicators) {
      if (indicator.test(url)) {
        return true;
      }
    }
  }

  // Default to assuming production if no dev indicators
  return true;
}

interface AnalysisNotesInput {
  runtimeEnvironment: RuntimeEnvironment;
  hostType: HostType;
  isLocalDev: boolean;
  cacheHeadersReliable: boolean;
  frameworkDetection?: FrameworkDetection;
  isHttps: boolean;
}

/**
 * Compile analysis notes/caveats based on environment.
 */
function compileAnalysisNotes(input: AnalysisNotesInput): string[] {
  const notes: string[] = [];

  if (input.isLocalDev) {
    notes.push(
      "Analysis ran against local development environment. " +
        "Some findings may not reflect production behavior.",
    );
  }

  if (!input.cacheHeadersReliable) {
    notes.push(
      "Cache and header-based findings may not reflect production configuration.",
    );
  }

  if (input.runtimeEnvironment === "preview") {
    notes.push(
      "Preview environment detected. Some optimizations may differ from production.",
    );
  }

  if (!input.isHttps && input.hostType === "public") {
    notes.push(
      "Site served over HTTP on public domain. HTTPS findings are highly relevant.",
    );
  }

  if (input.frameworkDetection) {
    notes.push(
      `Detected framework: ${input.frameworkDetection.name}` +
        (input.frameworkDetection.version
          ? ` v${input.frameworkDetection.version}`
          : "") +
        ". Framework-specific recommendations may be available.",
    );
  }

  return notes;
}

interface ConfidenceInput {
  hostType: HostType;
  runtimeEnvironment: RuntimeEnvironment;
  hasHeaders: boolean;
  hasHtml: boolean;
}

/**
 * Determine overall confidence in environment detection.
 */
function determineConfidence(input: ConfidenceInput): ConfidenceLevel {
  if (input.hostType === "localhost") {
    return "high";
  }

  if (
    input.runtimeEnvironment === "production" &&
    input.hasHeaders &&
    input.hasHtml
  ) {
    return "high";
  }

  if (input.hasHeaders || input.hasHtml) {
    return "medium";
  }

  return "low";
}

/**
 * Check if a URL is framework-owned based on detected patterns.
 */
export function isFrameworkOwnedUrl(
  url: string,
  patterns?: FrameworkAssetPatterns,
): boolean {
  if (!patterns) return false;

  const allPatterns = [
    ...patterns.ownedPathPatterns,
    ...patterns.runtimeChunkPatterns,
  ];

  return allPatterns.some((p) => p.test(url));
}

/**
 * Check if a URL is a framework runtime chunk.
 */
export function isRuntimeChunk(
  url: string,
  patterns?: FrameworkAssetPatterns,
): boolean {
  if (!patterns) return false;
  return patterns.runtimeChunkPatterns.some((p) => p.test(url));
}
