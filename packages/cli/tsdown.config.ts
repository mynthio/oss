import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "tsdown";

/**
 * `MYNTH_WORKOS_CLIENT_ID` and `MYNTH_CLI_VERSION` are inlined as string
 * literals, so the published bundle has no `process.env` lookup for them and
 * users cannot point the CLI at a different OAuth client.
 */
const envFile = resolve(import.meta.dirname, ".env");
// Variables already set in the environment (CI) win over the file.
if (existsSync(envFile)) process.loadEnvFile(envFile);

const workosClientId = process.env["MYNTH_WORKOS_CLIENT_ID"];
if (!workosClientId) {
  throw new Error("CLI build: MYNTH_WORKOS_CLIENT_ID is not set (checked process.env and .env)");
}

const { version } = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "package.json"), "utf8"),
) as { version: string };

export default defineConfig({
  entry: ["src/bin.ts"],
  platform: "node",
  // `bin` points at dist/bin.js; the package is ESM, so no .mjs is needed.
  fixedExtension: false,
  env: {
    MYNTH_WORKOS_CLIENT_ID: workosClientId,
    MYNTH_CLI_VERSION: version,
  },
  publint: true,
  failOnWarn: true,
});
