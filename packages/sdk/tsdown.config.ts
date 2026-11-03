import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
) as { version: string };

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
  // The SDK names itself in `X-Mynth-Client` as `sdk/<version>`.
  define: { __MYNTH_SDK_VERSION__: JSON.stringify(version) },
});
