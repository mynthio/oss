const DEFAULT_BASE_URL = "https://api.mynth.io";
const API_KEY_ENV_VAR = "MYNTH_API_KEY";
const DESTINATION_ENV_VAR = "MYNTH_DESTINATION";

/**
 * Connection settings shared by the Mynth adapters.
 *
 * `baseURL` and `defaultHeaders` follow the names every TanStack AI adapter
 * uses, so the same gateway or proxy settings work here unchanged.
 */
export interface MynthClientConfig {
  /** Mynth API key. Defaults to the `MYNTH_API_KEY` environment variable. */
  apiKey?: string | undefined;
  /** API base URL, for proxies, gateways, and tests. Defaults to `https://api.mynth.io`. */
  baseURL?: string | undefined;
  /** @deprecated Use `baseURL`. `baseURL` wins when both are set. */
  baseUrl?: string | undefined;
  /** Headers sent with every request, e.g. a gateway's own authorization. */
  defaultHeaders?: Record<string, string> | undefined;
  /** Replaces the global `fetch`, for instrumentation, proxies, or tests. */
  fetch?: typeof fetch | undefined;
}

/** Configuration for the Mynth image adapter. */
export interface MynthImageConfig extends MynthClientConfig {
  /**
   * Default destination name (slug) the images are delivered to. Defaults to
   * the `MYNTH_DESTINATION` environment variable. `modelOptions.destination`
   * overrides it per request.
   */
  destination?: string | undefined;
}

/** Configuration for the Mynth files adapter. */
export type MynthFilesConfig = MynthClientConfig;

/** Client settings with every default applied. */
export interface ResolvedClientConfig {
  apiKey: string;
  baseURL: string;
  headers: Record<string, string>;
  fetch: typeof fetch;
}

/**
 * Read an environment variable where the runtime has `process.env` (Node,
 * Bun, Deno, and most edge runtimes). Browsers have none.
 */
export function readEnv(name: string): string | undefined {
  const { process } = globalThis as { process?: { env?: Record<string, string | undefined> } };
  return process?.env?.[name] || undefined;
}

/**
 * Apply defaults to the connection settings.
 *
 * @throws {Error} When no API key is passed and `MYNTH_API_KEY` is unset
 */
export function resolveClientConfig(config: MynthClientConfig): ResolvedClientConfig {
  const apiKey = config.apiKey || readEnv(API_KEY_ENV_VAR);

  if (!apiKey) {
    throw new Error(
      `Mynth API key is missing. Pass \`apiKey\` or set the ${API_KEY_ENV_VAR} environment variable.`,
    );
  }

  return {
    apiKey,
    baseURL: (config.baseURL ?? config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, ""),
    headers: config.defaultHeaders ?? {},
    // Read the global at call time, so a fetch patched after import (by an
    // instrumentation library, or a test) is still used.
    fetch: config.fetch ?? ((input, init) => globalThis.fetch(input, init)),
  };
}

/** The default destination: the configured one, then `MYNTH_DESTINATION`. */
export function resolveDestination(config: MynthImageConfig): string | undefined {
  return config.destination || readEnv(DESTINATION_ENV_VAR);
}
