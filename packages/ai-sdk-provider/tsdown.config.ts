import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  // The AI SDK runs on servers and edge runtimes; nothing here needs Node built-ins.
  platform: "neutral",
  target: "es2022",
  dts: true,
  publint: true,
  attw: { profile: "esm-only", level: "error" },
  failOnWarn: true,
});
