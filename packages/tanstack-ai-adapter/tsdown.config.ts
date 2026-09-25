import { defineConfig } from "tsdown";

export default defineConfig({
  // `byok` is its own entry so browsers can import it without the Mynth SDK.
  entry: ["src/index.ts", "src/byok.ts"],
  // TanStack AI adapters run wherever TanStack AI does: servers, edge runtimes and browsers.
  platform: "neutral",
  target: "es2022",
  dts: true,
  publint: true,
  attw: { profile: "esm-only", level: "error" },
  failOnWarn: true,
});
