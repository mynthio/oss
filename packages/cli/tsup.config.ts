import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

function loadDotEnv(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(__dirname, ".env"), "utf8");
    const out: Record<string, string> = {};
    for (const line of raw.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
      if (!m) continue;
      const key = m[1];
      let value = m[2];
      if (!key || value === undefined) continue;
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      out[key] = value;
    }
    return out;
  } catch {
    return {};
  }
}

const fileEnv = loadDotEnv();
const workosClientId = process.env.MYNTH_WORKOS_CLIENT_ID ?? fileEnv.MYNTH_WORKOS_CLIENT_ID;
if (!workosClientId) {
  throw new Error("tsup build: MYNTH_WORKOS_CLIENT_ID is not set (checked process.env and .env)");
}

export default defineConfig({
  entry: ["src/bin.ts"],
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  minify: true,
  treeshake: "smallest",
  sourcemap: false,
  splitting: false,
  shims: true,
  env: {
    MYNTH_WORKOS_CLIENT_ID: workosClientId,
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
