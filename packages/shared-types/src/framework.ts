/**
 * Core UI libraries / frameworks
 */
export type UILibrary =
  | "react"
  | "vue"
  | "angular"
  | "svelte"
  | "solid"
  | "preact"
  | "lit"
  | "htmx"
  | "vanilla" // Plain JS/TS
  | "unknown";

/**
 * Meta-frameworks / Build tools built on top of UI libraries
 */
export type MetaFramework =
  // React ecosystem
  | "nextjs"
  | "remix"
  | "gatsby"
  | "cra" // Create React App
  | "vite-react"

  // Vue ecosystem
  | "nuxt"
  | "vite-vue"
  | "vue-cli"

  // Angular ecosystem
  | "angular-cli"

  // Svelte ecosystem
  | "sveltekit"
  | "vite-svelte"

  // Solid ecosystem
  | "solid-start"
  | "vite-solid"

  // Multi-framework / Agnostic
  | "astro"
  | "vite" // Plain Vite

  // Unknown
  | "unknown";

export type Bundler =
  | "webpack"
  | "vite"
  | "turbopack"
  | "esbuild"
  | "rollup"
  | "parcel"
  | "rspack"
  | "bun"
  | "unknown";

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun" | "unknown";

export type RoutingType =
  | "app-router" // Next.js 13+ App Router
  | "pages-router" // Next.js Pages Router
  | "file-based" // Nuxt, SvelteKit, Astro
  | "config-based" // React Router, Vue Router
  | "unknown";

export type StylingType =
  | "tailwind"
  | "css-modules"
  | "styled-components"
  | "emotion"
  | "sass"
  | "less"
  | "vanilla-css"
  | "styled-jsx"
  | "linaria"
  | "panda-css"
  | "unknown";

export type StateManagement =
  | "redux"
  | "zustand"
  | "jotai"
  | "recoil"
  | "mobx"
  | "pinia"
  | "vuex"
  | "nanostores"
  | "xstate"
  | "tanstack-query"
  | "swr"
  | "apollo"
  | "none"
  | "unknown";

/**
 * Full project stack detection
 */
export interface ProjectStack {
  uiLibrary: UILibrary;
  uiLibraryVersion: string | null;
  metaFramework: MetaFramework;
  metaFrameworkVersion: string | null;
  bundler: Bundler;
  packageManager: PackageManager;
  routing: RoutingType;
  styling: StylingType[];
  stateManagement: StateManagement[];
  typescript: boolean;
  monorepo: boolean;
  features: FrameworkFeatures;
  confidence: "high" | "medium" | "low";
  detectedFrom: string[];
}

/**
 * Framework-specific features / capabilities
 */
export interface FrameworkFeatures {
  /** Image optimization (next/image, nuxt/image, etc.) */
  imageOptimization: boolean;

  /** Script optimization (next/script, etc.) */
  scriptOptimization: boolean;

  /** Font optimization (next/font, etc.) */
  fontOptimization: boolean;

  /** Server-side rendering */
  ssr: boolean;

  /** Static site generation */
  ssg: boolean;

  /** Incremental static regeneration */
  isr: boolean;

  /** Edge runtime support */
  edgeRuntime: boolean;

  /** Middleware support */
  middleware: boolean;

  /** API routes / Server functions */
  apiRoutes: boolean;

  /** Streaming / Suspense support */
  streaming: boolean;

  /** Server Components (React 18+) */
  serverComponents: boolean;

  /** Partial hydration / Islands */
  partialHydration: boolean;
}

/**
 * Default framework features (all false)
 */
export const DEFAULT_FRAMEWORK_FEATURES: FrameworkFeatures = {
  imageOptimization: false,
  scriptOptimization: false,
  fontOptimization: false,
  ssr: false,
  ssg: false,
  isr: false,
  edgeRuntime: false,
  middleware: false,
  apiRoutes: false,
  streaming: false,
  serverComponents: false,
  partialHydration: false,
};

/**
 * Default/unknown project stack
 */
export const UNKNOWN_PROJECT_STACK: ProjectStack = {
  uiLibrary: "unknown",
  uiLibraryVersion: null,
  metaFramework: "unknown",
  metaFrameworkVersion: null,
  bundler: "unknown",
  packageManager: "unknown",
  routing: "unknown",
  styling: [],
  stateManagement: [],
  typescript: false,
  monorepo: false,
  features: DEFAULT_FRAMEWORK_FEATURES,
  confidence: "low",
  detectedFrom: [],
};

/**
 * Framework-specific recommendation
 */
export interface FrameworkRecommendation {
  uiLibrary?: UILibrary;
  metaFramework?: MetaFramework;
  findingId: string;
  title: string;
  description: string;
  codeBefore?: string;
  codeAfter?: string;
  codeLanguage?:
    | "tsx"
    | "jsx"
    | "typescript"
    | "javascript"
    | "vue"
    | "svelte"
    | "html"
    | "css"
    | "json";
  docsUrl?: string;
  estimatedImpact?: "high" | "medium" | "low";
  effort?: "low" | "medium" | "high";
}

/**
 * Popular framework configurations for quick detection
 */
export const FRAMEWORK_SIGNATURES = {
  // Next.js
  nextjs: {
    files: ["next.config.js", "next.config.mjs", "next.config.ts", ".next"],
    dependencies: ["next"],
    devDependencies: [],
  },

  // Nuxt
  nuxt: {
    files: ["nuxt.config.js", "nuxt.config.ts", ".nuxt"],
    dependencies: ["nuxt"],
    devDependencies: [],
  },

  // Vite (generic)
  vite: {
    files: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
    dependencies: [],
    devDependencies: ["vite"],
  },

  // Create React App
  cra: {
    files: [],
    dependencies: ["react-scripts"],
    devDependencies: [],
  },

  // Remix
  remix: {
    files: ["remix.config.js"],
    dependencies: ["@remix-run/react"],
    devDependencies: [],
  },

  // Gatsby
  gatsby: {
    files: ["gatsby-config.js", "gatsby-config.ts"],
    dependencies: ["gatsby"],
    devDependencies: [],
  },

  // SvelteKit
  sveltekit: {
    files: ["svelte.config.js"],
    dependencies: ["@sveltejs/kit"],
    devDependencies: [],
  },

  // Astro
  astro: {
    files: ["astro.config.mjs", "astro.config.ts"],
    dependencies: ["astro"],
    devDependencies: [],
  },

  // Angular
  angular: {
    files: ["angular.json"],
    dependencies: ["@angular/core"],
    devDependencies: [],
  },

  // Vue CLI
  vueCli: {
    files: ["vue.config.js"],
    dependencies: [],
    devDependencies: ["@vue/cli-service"],
  },

  // SolidStart
  solidStart: {
    files: [],
    dependencies: ["solid-start"],
    devDependencies: [],
  },
} as const;

/**
 * UI Library detection signatures
 */
export const UI_LIBRARY_SIGNATURES = {
  react: {
    dependencies: ["react", "react-dom"],
  },
  vue: {
    dependencies: ["vue"],
  },
  angular: {
    dependencies: ["@angular/core"],
  },
  svelte: {
    dependencies: ["svelte"],
  },
  solid: {
    dependencies: ["solid-js"],
  },
  preact: {
    dependencies: ["preact"],
  },
  lit: {
    dependencies: ["lit"],
  },
} as const;

export const BUNDLER_SIGNATURES = {
  webpack: {
    files: ["webpack.config.js", "webpack.config.ts"],
    dependencies: ["webpack"],
  },
  vite: {
    files: ["vite.config.js", "vite.config.ts", "vite.config.mjs"],
    dependencies: ["vite"],
  },
  turbopack: {
    files: [],
    dependencies: ["turbo"],
  },
  parcel: {
    files: [],
    dependencies: ["parcel"],
  },
  rollup: {
    files: ["rollup.config.js"],
    dependencies: ["rollup"],
  },
  esbuild: {
    files: [],
    dependencies: ["esbuild"],
  },
  rspack: {
    files: ["rspack.config.js"],
    dependencies: ["@rspack/core"],
  },
} as const;

/**
 * Styling solution detection signatures
 */
export const STYLING_SIGNATURES = {
  tailwind: {
    files: ["tailwind.config.js", "tailwind.config.ts"],
    dependencies: ["tailwindcss"],
  },
  "styled-components": {
    dependencies: ["styled-components"],
  },
  emotion: {
    dependencies: ["@emotion/react", "@emotion/styled"],
  },
  sass: {
    dependencies: ["sass", "node-sass"],
  },
  less: {
    dependencies: ["less"],
  },
  "css-modules": {
    files: [], // Detected by .module.css files
    dependencies: [],
  },
  "panda-css": {
    dependencies: ["@pandacss/dev"],
  },
} as const;
