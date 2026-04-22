/**
 * Build-time constants. `WORKOS_CLIENT_ID` is replaced with a string literal
 * by tsup (see tsup.config.ts `env` option) — the runtime `process.env` lookup
 * does not exist in the built bundle, so users cannot override it.
 */
export const WORKOS_CLIENT_ID = process.env.MYNTH_WORKOS_CLIENT_ID!;
export const WORKOS_API_URL = "https://api.workos.com";
