import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsup";

/**
 * `MYNTH_WORKOS_CLIENT_ID` and `MYNTH_CLI_VERSION` are inlined as string
 * literals, so the published bundle has no `process.env` lookup for them and
 * users cannot point the CLI at a different OAuth client.
 */
const readEnvFile = (): Record<string, string> => {
  try {
    const raw = readFileSync(resolve(__dirname, ".env"), "utf8");
    return Object.fromEntries(
      raw
        .split("\n")
        .map((line) => /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line))
        .filter((match): match is RegExpExecArray => match !== null)
        .map(([, key, value]) => [key!, value!.replace(/^(['"])(.*)\1$/, "$2")]),
    );
  } catch {
    return {};
  }
};

const workosClientId =
  process.env.MYNTH_WORKOS_CLIENT_ID ?? readEnvFile()["MYNTH_WORKOS_CLIENT_ID"];

if (!workosClientId) {
  throw new Error("tsup build: MYNTH_WORKOS_CLIENT_ID is not set (checked process.env and .env)");
}

const { version } = JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8")) as {
  version: string;
};

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
    MYNTH_CLI_VERSION: version,
  },
  banner: {
    js: "#!/usr/bin/env node",
  },
});
