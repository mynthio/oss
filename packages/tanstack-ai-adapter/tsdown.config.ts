import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  // TanStack AI adapters run wherever TanStack AI does: servers, edge runtimes and browsers.
  platform: "neutral",
  target: "es2022",
  dts: true,
  publint: true,
  attw: { profile: "esm-only", level: "error" },
  failOnWarn: true,
});
