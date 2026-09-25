import { defineConfig } from "tsdown";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "convex/index": "src/convex/index.ts",
    "next/index": "src/next/index.ts",
    "tanstack-start/index": "src/tanstack-start/index.ts",
  },
  // The SDK runs in browsers, Node, edge runtimes and Convex.
  platform: "neutral",
  target: "es2022",
  dts: true,
  hash: false,
  publint: true,
  attw: { profile: "esm-only", level: "error" },
  failOnWarn: true,
});
