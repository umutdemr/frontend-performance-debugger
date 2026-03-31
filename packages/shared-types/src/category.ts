/**
 * Performance finding categories
 * Each analyzer typically focuses on one category
 */
export type Category =
  | "network"
  | "rendering"
  | "javascript"
  | "assets"
  | "caching"
  | "accessibility"
  | "seo"
  | "general";

/**
 * Human-readable labels for categories
 */
export const CATEGORY_LABEL: Record<Category, string> = {
  network: "Network",
  rendering: "Rendering",
  javascript: "JavaScript",
  assets: "Assets",
  caching: "Caching",
  accessibility: "Accessibility",
  seo: "SEO",
  general: "General",
} as const;

/**
 * Category descriptions for documentation/help
 */
export const CATEGORY_DESCRIPTION: Record<Category, string> = {
  network: "Network requests, latency, and transfer size issues",
  rendering: "Paint, layout, and visual rendering problems",
  javascript: "Script execution, bundle size, and runtime issues",
  assets: "Images, fonts, and static resource optimization",
  caching: "Browser and CDN caching strategies",
  accessibility: "Performance-related accessibility concerns",
  seo: "Performance impact on search engine optimization",
  general: "General performance observations",
} as const;
