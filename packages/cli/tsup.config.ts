import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: false,
  clean: true,
  outDir: "dist",
  noExternal: ["@fpd/core", "@fpd/shared-types"],
  external: ["playwright"],
  shims: true,
});
