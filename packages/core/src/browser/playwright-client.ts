import {
  chromium,
  devices,
  type Browser,
  type Page,
  type BrowserContext,
} from "playwright";

export interface BrowserOptions {
  /** Run in headless mode */
  headless?: boolean;

  /** Network throttling preset */
  throttling?: "slow-3g" | "fast-3g" | "4g" | "none";

  /** Device emulation */
  device?: "desktop" | "mobile";

  /** Timeout for page load (ms) */
  timeout?: number;
}

export interface PageMetrics {
  /** Navigation timing */
  timing: {
    domContentLoaded?: number;
    loadComplete?: number;
    firstPaint?: number;
    firstContentfulPaint?: number;
  };

  /** Core Web Vitals */
  webVitals: {
    lcp?: number;
    fid?: number;
    cls?: number;
    inp?: number;
    ttfb?: number;
    fcp?: number;
  };

  /** Network requests */
  requests: NetworkRequest[];

  /** Page size info */
  size: {
    totalBytes: number;
    resourceCount: number;
  };

  /** DOM metrics */
  dom: {
    images: ImageInfo[];
    iframes: IframeInfo[];
    totalDOMNodes: number;
    headScripts: HeadScriptInfo[];
    headStylesheets: HeadStylesheetInfo[];
  };
}

/**
 * Network request info
 */
export interface NetworkRequest {
  url: string;
  method: string;
  resourceType: string;
  status?: number;
  size?: number;
  duration?: number;
  cached?: boolean;
}

/**
 * Image element info
 */
export interface ImageInfo {
  src: string;
  alt?: string;
  loading?: string;
  width?: number;
  height?: number;
  naturalWidth?: number;
  naturalHeight?: number;
  isInViewport: boolean;
  hasExplicitDimensions: boolean;
}

/**
 * Iframe element info
 */
export interface IframeInfo {
  src: string;
  loading?: string;
  isInViewport: boolean;
}

/**
 * Script in <head>
 */
export interface HeadScriptInfo {
  src?: string;
  inline: boolean;
  async: boolean;
  defer: boolean;
  type?: string;
  size?: number;
}

/**
 * Stylesheet in <head>
 */
export interface HeadStylesheetInfo {
  href?: string;
  inline: boolean;
  media?: string;
  size?: number;
}

/**
 * Web Vitals injection script
 * This script is injected into the page to collect Core Web Vitals
 */
const WEB_VITALS_SCRIPT = `
  window.__webVitals = {
    lcp: undefined,
    fid: undefined,
    cls: undefined,
    inp: undefined,
    ttfb: undefined,
    fcp: undefined
  };

  // LCP Observer
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const lastEntry = entries[entries.length - 1];
    if (lastEntry) {
      window.__webVitals.lcp = lastEntry.startTime;
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });

  // CLS Observer
  let clsValue = 0;
  new PerformanceObserver((entryList) => {
    for (const entry of entryList.getEntries()) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
        window.__webVitals.cls = clsValue;
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });

  // FID Observer
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    const firstEntry = entries[0];
    if (firstEntry) {
      window.__webVitals.fid = firstEntry.processingStart - firstEntry.startTime;
    }
  }).observe({ type: 'first-input', buffered: true });

  // FCP Observer
  new PerformanceObserver((entryList) => {
    const entries = entryList.getEntries();
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        window.__webVitals.fcp = entry.startTime;
      }
    }
  }).observe({ type: 'paint', buffered: true });

  // TTFB from Navigation Timing
  const navEntry = performance.getEntriesByType('navigation')[0];
  if (navEntry) {
    window.__webVitals.ttfb = navEntry.responseStart - navEntry.requestStart;
  }
`;

export class PlaywrightClient {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  /**
   * Launch browser
   */
  async launch(options: BrowserOptions = {}): Promise<void> {
    const { headless = true, device = "desktop" } = options;

    this.browser = await chromium.launch({
      headless,
    });

    // Create context with device emulation
    const contextOptions =
      device === "mobile"
        ? devices["iPhone 13"]
        : { viewport: { width: 1920, height: 1080 } };

    this.context = await this.browser.newContext(contextOptions);
  }

  /**
   * Navigate to URL and collect metrics
   */
  async collectMetrics(
    url: string,
    options: BrowserOptions = {},
  ): Promise<PageMetrics> {
    if (!this.context) {
      throw new Error("Browser not launched. Call launch() first.");
    }

    const { timeout = 30000 } = options;
    const page = await this.context.newPage();

    const requests: NetworkRequest[] = [];
    let totalBytes = 0;

    // Inject web-vitals script before page load
    await page.addInitScript(WEB_VITALS_SCRIPT);

    // Listen to network requests
    page.on("request", (request) => {
      const req: NetworkRequest = {
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType(),
      };
      requests.push(req);
    });

    page.on("response", async (response) => {
      const req = requests.find((r) => r.url === response.url());
      if (req) {
        req.status = response.status();

        // Check cache from headers
        const cacheHeader =
          response.headers()["x-cache"] ||
          response.headers()["cf-cache-status"] ||
          "";
        req.cached = cacheHeader.toLowerCase().includes("hit");

        try {
          const body = await response.body();
          req.size = body.length;
          totalBytes += body.length;
        } catch {}
      }
    });

    page.on("requestfinished", (request) => {
      const req = requests.find((r) => r.url === request.url());
      const timing = request.timing();
      if (req && timing) {
        req.duration = timing.responseEnd;
      }
    });

    // Navigate to page
    const response = await page.goto(url, {
      waitUntil: "networkidle",
      timeout,
    });

    if (!response) {
      throw new Error("Failed to load page");
    }

    // Wait a bit for LCP and CLS to stabilize
    await page.waitForTimeout(1000);

    // Simulate user interaction for FID (click on body)
    try {
      await page.click("body", { timeout: 500 });
    } catch {
      // Page might not be clickable, ignore
    }

    // Wait for interaction metrics
    await page.waitForTimeout(500);

    // Collect all metrics
    const timing = await this.collectTiming(page);
    const webVitals = await this.collectWebVitals(page);
    const dom = await this.collectDOMMetrics(page);

    await page.close();

    return {
      timing,
      webVitals,
      requests,
      size: {
        totalBytes,
        resourceCount: requests.length,
      },
      dom,
    };
  }

  /**
   * Collect navigation timing metrics
   */
  private async collectTiming(page: Page): Promise<PageMetrics["timing"]> {
    const timing = (await page.evaluate(`
      (function() {
        var perf = performance;
        var entries = perf.getEntriesByType("navigation");
        var nav = entries[0];

        if (!nav) {
          return {
            domContentLoaded: 0,
            loadComplete: 0,
            firstPaint: 0,
            firstContentfulPaint: 0
          };
        }

        var paintEntries = perf.getEntriesByType("paint");
        var firstPaint = 0;
        var firstContentfulPaint = 0;

        for (var i = 0; i < paintEntries.length; i++) {
          var entry = paintEntries[i];
          if (entry.name === "first-paint") {
            firstPaint = entry.startTime;
          }
          if (entry.name === "first-contentful-paint") {
            firstContentfulPaint = entry.startTime;
          }
        }

        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.fetchStart,
          loadComplete: nav.loadEventEnd - nav.fetchStart,
          firstPaint: firstPaint,
          firstContentfulPaint: firstContentfulPaint
        };
      })()
    `)) as PageMetrics["timing"];

    return timing;
  }

  /**
   * Collect Core Web Vitals from injected script
   */
  private async collectWebVitals(
    page: Page,
  ): Promise<PageMetrics["webVitals"]> {
    const vitals = (await page.evaluate(`
      (function() {
        var wv = window.__webVitals || {};
        return {
          lcp: wv.lcp,
          fid: wv.fid,
          cls: wv.cls,
          inp: wv.inp,
          ttfb: wv.ttfb,
          fcp: wv.fcp
        };
      })()
    `)) as PageMetrics["webVitals"];

    return vitals;
  }

  /**
   * Collect DOM metrics (images, iframes, scripts, stylesheets)
   */
  private async collectDOMMetrics(page: Page): Promise<PageMetrics["dom"]> {
    const dom = (await page.evaluate(`
      (function() {
        var viewportHeight = window.innerHeight;
        var viewportWidth = window.innerWidth;

        function isInViewport(rect) {
          return (
            rect.top < viewportHeight &&
            rect.bottom > 0 &&
            rect.left < viewportWidth &&
            rect.right > 0
          );
        }

        // Collect images
        var images = Array.from(document.querySelectorAll('img')).map(function(img) {
          var rect = img.getBoundingClientRect();
          return {
            src: img.src || img.dataset.src || '',
            alt: img.alt || undefined,
            loading: img.loading || undefined,
            width: img.width || undefined,
            height: img.height || undefined,
            naturalWidth: img.naturalWidth || undefined,
            naturalHeight: img.naturalHeight || undefined,
            isInViewport: isInViewport(rect),
            hasExplicitDimensions: img.hasAttribute('width') && img.hasAttribute('height')
          };
        });

        // Collect iframes
        var iframes = Array.from(document.querySelectorAll('iframe')).map(function(iframe) {
          var rect = iframe.getBoundingClientRect();
          return {
            src: iframe.src || '',
            loading: iframe.loading || undefined,
            isInViewport: isInViewport(rect)
          };
        });

        // Collect scripts in <head>
        var headScripts = Array.from(document.head.querySelectorAll('script')).map(function(script) {
          return {
            src: script.src || undefined,
            inline: !script.src,
            async: script.async || false,
            defer: script.defer || false,
            type: script.type || undefined,
            size: script.textContent ? script.textContent.length : undefined
          };
        });

        // Collect stylesheets in <head>
        var headStylesheets = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map(function(el) {
          if (el.tagName === 'LINK') {
            return {
              href: el.href || undefined,
              inline: false,
              media: el.media || undefined,
              size: undefined
            };
          } else {
            return {
              href: undefined,
              inline: true,
              media: undefined,
              size: el.textContent ? el.textContent.length : undefined
            };
          }
        });

        // Total DOM nodes
        var totalDOMNodes = document.querySelectorAll('*').length;

        return {
          images: images,
          iframes: iframes,
          totalDOMNodes: totalDOMNodes,
          headScripts: headScripts,
          headStylesheets: headStylesheets
        };
      })()
    `)) as PageMetrics["dom"];

    return dom;
  }

  /**
   * Close browser
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.context = null;
    }
  }
}

/**
 * Create a PlaywrightClient instance
 */
export function createPlaywrightClient(): PlaywrightClient {
  return new PlaywrightClient();
}
