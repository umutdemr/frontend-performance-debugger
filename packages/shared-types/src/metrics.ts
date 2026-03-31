/**
 * Core Web Vitals metrics
 */
export interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  lcp?: number;

  /** First Input Delay (ms) */
  fid?: number;

  /** Cumulative Layout Shift (unitless) */
  cls?: number;

  /** Interaction to Next Paint (ms) */
  inp?: number;

  /** Time to First Byte (ms) */
  ttfb?: number;

  /** First Contentful Paint (ms) */
  fcp?: number;
}

/**
 * Additional performance metrics
 */
export interface ExtendedMetrics {
  /** Total page load time (ms) */
  loadTime?: number;

  /** DOM Content Loaded time (ms) */
  domContentLoaded?: number;

  /** Total number of requests */
  requestCount?: number;

  /** Total transfer size (bytes) */
  transferSize?: number;

  /** Total resource size uncompressed (bytes) */
  resourceSize?: number;

  /** Number of DOM nodes */
  domNodes?: number;

  /** JavaScript execution time (ms) */
  scriptDuration?: number;

  /** Layout/reflow time (ms) */
  layoutDuration?: number;
}

/**
 * Combined metrics object used in reports
 */
export interface Metrics {
  coreWebVitals: CoreWebVitals;
  extended: ExtendedMetrics;

  /** Raw timing data if available */
  raw?: Record<string, unknown>;
}

/**
 * Thresholds for Core Web Vitals (good/needs-improvement/poor)
 * Based on web.dev recommendations
 */
export const CWV_THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  fid: { good: 100, poor: 300 },
  cls: { good: 0.1, poor: 0.25 },
  inp: { good: 200, poor: 500 },
  ttfb: { good: 800, poor: 1800 },
  fcp: { good: 1800, poor: 3000 },
} as const;
