/**
 * Build-time and environment configuration.
 *
 * `MYNTH_WORKOS_CLIENT_ID` and `MYNTH_CLI_VERSION` are replaced with string
 * literals by tsup (see `tsup.config.ts`), so the `process.env` lookups do not
 * exist in the published bundle and users cannot override them.
 */
export const WORKOS_CLIENT_ID = process.env.MYNTH_WORKOS_CLIENT_ID!;
export const WORKOS_API_URL = "https://api.workos.com";
export const CLI_VERSION = process.env.MYNTH_CLI_VERSION ?? "0.0.0-dev";

export type Config = {
  readonly apiUrl: string;
  readonly docsUrl: string;
  /** `MYNTH_API_KEY`, when set. Takes precedence over stored credentials. */
  readonly envApiKey: string | undefined;
  /** `MYNTH_DESTINATION`, used when `--destination` is omitted. */
  readonly envDestination: string | undefined;
  readonly debug: boolean;
};

const trimTrailingSlash = (url: string) => url.replace(/\/+$/, "");

const nonEmpty = (value: string | undefined) =>
  value !== undefined && value.length > 0 ? value : undefined;

export const loadConfig = (): Config => ({
  apiUrl: trimTrailingSlash(process.env["MYNTH_API_URL"] ?? "https://api.mynth.io"),
  docsUrl: trimTrailingSlash(process.env["MYNTH_DOCS_URL"] ?? "https://docs.mynth.io"),
  envApiKey: nonEmpty(process.env["MYNTH_API_KEY"]),
  envDestination: nonEmpty(process.env["MYNTH_DESTINATION"]),
  debug: process.env["MYNTH_DEBUG"] === "1" || process.env["MYNTH_DEBUG"] === "true",
});
