import type { Finding, Category } from "@fpd/shared-types";
import type {
  Analyzer,
  AnalyzerContext,
  AnalyzerResult,
} from "./analyzer.interface.js";
import type {
  PageMetrics,
  ImageInfo,
  IframeInfo,
} from "../browser/playwright-client.js";

// Assets Analyzer Analyzes images, iframes, and other assets for best practices

export class AssetsAnalyzer implements Analyzer {
  readonly name = "assets";
  readonly description =
    "Analyzes images and assets for lazy loading, dimensions, and best practices";
  readonly categories: Category[] = ["assets", "rendering", "accessibility"];

  async analyze(context: AnalyzerContext): Promise<AnalyzerResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];

    const metrics = context.pageData?.metrics as PageMetrics | undefined;

    if (!metrics || !metrics.dom) {
      return {
        analyzerName: this.name,
        findings: [],
        duration: Date.now() - startTime,
        errors: [
          "No DOM metrics available. Playwright integration may not be active.",
        ],
      };
    }

    // Check images for lazy loading
    const lazyLoadFindings = this.checkLazyLoading(
      metrics.dom.images,
      metrics.dom.iframes,
    );
    findings.push(...lazyLoadFindings);

    // Check images for explicit dimensions
    const dimensionFindings = this.checkImageDimensions(metrics.dom.images);
    findings.push(...dimensionFindings);

    // Check images for alt text
    const altTextFindings = this.checkAltText(metrics.dom.images);
    findings.push(...altTextFindings);

    // Check DOM size
    const domSizeFinding = this.checkDOMSize(metrics.dom.totalDOMNodes);
    if (domSizeFinding) {
      findings.push(domSizeFinding);
    }

    return {
      analyzerName: this.name,
      findings,
      duration: Date.now() - startTime,
    };
  }

  //Check for images/iframes missing lazy loading

  private checkLazyLoading(
    images: ImageInfo[],
    iframes: IframeInfo[],
  ): Finding[] {
    const findings: Finding[] = [];

    // Filter below-the-fold images without lazy loading
    const imagesWithoutLazy = images.filter(
      (img) => !img.isInViewport && img.loading !== "lazy" && img.src,
    );

    // Filter below-the-fold iframes without lazy loading
    const iframesWithoutLazy = iframes.filter(
      (iframe) =>
        !iframe.isInViewport && iframe.loading !== "lazy" && iframe.src,
    );

    if (imagesWithoutLazy.length > 0) {
      // Limit to first 5 examples
      const examples = imagesWithoutLazy.slice(0, 5).map((img) => img.src);
      const remaining = imagesWithoutLazy.length - 5;

      findings.push({
        id: "assets-images-no-lazy-loading",
        title: `${imagesWithoutLazy.length} images missing lazy loading`,
        description: `Found ${imagesWithoutLazy.length} below-the-fold images without \`loading="lazy"\` attribute. This causes unnecessary data download on initial page load.`,
        severity: imagesWithoutLazy.length > 5 ? "warning" : "info",
        category: "assets",
        evidence: [
          {
            type: "code-snippet",
            label: "Images without lazy loading",
            data:
              examples.join("\n") +
              (remaining > 0 ? `\n... and ${remaining} more` : ""),
          },
        ],
        impact: `${imagesWithoutLazy.length} unnecessary image downloads on initial load`,
        recommendation:
          'Add `loading="lazy"` attribute to below-the-fold images',
        learnMoreUrl: "https://web.dev/browser-level-image-lazy-loading/",
      });
    }

    if (iframesWithoutLazy.length > 0) {
      const examples = iframesWithoutLazy
        .slice(0, 3)
        .map((iframe) => iframe.src);

      findings.push({
        id: "assets-iframes-no-lazy-loading",
        title: `${iframesWithoutLazy.length} iframes missing lazy loading`,
        description: `Found ${iframesWithoutLazy.length} below-the-fold iframes without \`loading="lazy"\` attribute.`,
        severity: "warning",
        category: "assets",
        evidence: [
          {
            type: "code-snippet",
            label: "Iframes without lazy loading",
            data: examples.join("\n"),
          },
        ],
        impact: "Iframes load immediately, blocking main content",
        recommendation:
          'Add `loading="lazy"` attribute to below-the-fold iframes',
        learnMoreUrl: "https://web.dev/iframe-lazy-loading/",
      });
    }

    // Success: all images have lazy loading
    const totalBelowFold = images.filter(
      (img) => !img.isInViewport && img.src,
    ).length;
    const lazyLoadedCount = images.filter(
      (img) => !img.isInViewport && img.loading === "lazy",
    ).length;

    if (totalBelowFold > 0 && imagesWithoutLazy.length === 0) {
      findings.push({
        id: "assets-lazy-loading-good",
        title: "All below-the-fold images use lazy loading",
        description: `${lazyLoadedCount} below-the-fold images correctly use \`loading="lazy"\`.`,
        severity: "success",
        category: "assets",
        evidence: [
          {
            type: "metric",
            label: "Lazy loaded images",
            data: { value: lazyLoadedCount },
          },
        ],
        impact: "Good practice: reduces initial page load size",
        recommendation: "Keep using lazy loading for off-screen content",
      });
    }

    return findings;
  }

  //Check images for explicit width/height attributes

  private checkImageDimensions(images: ImageInfo[]): Finding[] {
    const findings: Finding[] = [];

    const imagesWithoutDimensions = images.filter(
      (img) => !img.hasExplicitDimensions && img.src,
    );

    if (imagesWithoutDimensions.length > 5) {
      const examples = imagesWithoutDimensions
        .slice(0, 5)
        .map((img) => img.src);
      const remaining = imagesWithoutDimensions.length - 5;

      findings.push({
        id: "assets-images-no-dimensions",
        title: `${imagesWithoutDimensions.length} images missing explicit dimensions`,
        description: `Found ${imagesWithoutDimensions.length} images without explicit \`width\` and \`height\` attributes. This can cause Cumulative Layout Shift (CLS).`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Images without dimensions",
            data:
              examples.join("\n") +
              (remaining > 0 ? `\n... and ${remaining} more` : ""),
          },
        ],
        impact: "Layout shifts when images load, poor CLS score",
        recommendation:
          "Add explicit width and height attributes to all images, or use CSS aspect-ratio",
        learnMoreUrl: "https://web.dev/optimize-cls/#images-without-dimensions",
      });
    } else if (imagesWithoutDimensions.length > 0) {
      findings.push({
        id: "assets-images-no-dimensions",
        title: `${imagesWithoutDimensions.length} images missing explicit dimensions`,
        description: `Found ${imagesWithoutDimensions.length} images without explicit dimensions.`,
        severity: "info",
        category: "rendering",
        evidence: [
          {
            type: "code-snippet",
            label: "Images without dimensions",
            data: imagesWithoutDimensions.map((img) => img.src).join("\n"),
          },
        ],
        impact: "Minor layout shifts possible",
        recommendation:
          "Add width and height attributes to prevent layout shifts",
        learnMoreUrl: "https://web.dev/optimize-cls/#images-without-dimensions",
      });
    }

    return findings;
  }

  // Check images for alt text (accessibility)

  private checkAltText(images: ImageInfo[]): Finding[] {
    const findings: Finding[] = [];

    const imagesWithoutAlt = images.filter(
      (img) => img.alt === undefined || img.alt === "",
    );

    if (imagesWithoutAlt.length > 0) {
      const examples = imagesWithoutAlt.slice(0, 5).map((img) => img.src);
      const remaining = imagesWithoutAlt.length - 5;

      findings.push({
        id: "assets-images-no-alt",
        title: `${imagesWithoutAlt.length} images missing alt text`,
        description: `Found ${imagesWithoutAlt.length} images without \`alt\` attribute. This impacts accessibility and SEO.`,
        severity: imagesWithoutAlt.length > 10 ? "warning" : "info",
        category: "accessibility",
        evidence: [
          {
            type: "code-snippet",
            label: "Images without alt text",
            data:
              examples.join("\n") +
              (remaining > 0 ? `\n... and ${remaining} more` : ""),
          },
        ],
        impact: "Screen readers cannot describe images, SEO impact",
        recommendation: "Add descriptive alt text to all informative images",
        learnMoreUrl: "https://web.dev/image-alt/",
      });
    }

    return findings;
  }

  // Check total DOM node count

  private checkDOMSize(totalNodes: number): Finding | null {
    if (totalNodes > 3000) {
      return {
        id: "assets-dom-too-large",
        title: "DOM size is very large",
        description: `The page has ${totalNodes} DOM nodes. Large DOMs increase memory usage and slow down DOM operations.`,
        severity: "warning",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "DOM Nodes",
            data: { value: totalNodes, threshold: 3000 },
          },
        ],
        impact:
          "Slower rendering, higher memory usage, longer style calculations",
        recommendation:
          "Reduce DOM size by removing unnecessary elements, virtualizing long lists",
        learnMoreUrl:
          "https://developer.chrome.com/docs/lighthouse/performance/dom-size/",
      };
    }

    if (totalNodes > 1500) {
      return {
        id: "assets-dom-large",
        title: "DOM size is larger than recommended",
        description: `The page has ${totalNodes} DOM nodes. Consider reducing for better performance.`,
        severity: "info",
        category: "rendering",
        evidence: [
          {
            type: "metric",
            label: "DOM Nodes",
            data: { value: totalNodes, threshold: 1500 },
          },
        ],
        impact: "May cause slower interactions on low-end devices",
        recommendation: "Consider reducing unnecessary DOM elements",
        learnMoreUrl:
          "https://developer.chrome.com/docs/lighthouse/performance/dom-size/",
      };
    }

    return null;
  }
}
