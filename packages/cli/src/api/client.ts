import { setTimeout as sleep } from "node:timers/promises";
import type { z } from "zod";
import { CLI_VERSION, type Config } from "../config.ts";
import { ApiError } from "../errors.ts";
import { envelope } from "./schemas.ts";

/** Supplies the API key for authenticated calls; implemented by `auth/session.ts`. */
export type TokenSource = {
  token(): Promise<string>;
};

export type RequestOptions = {
  readonly method?: string;
  /** A plain object is sent as JSON; `FormData` is sent as multipart. */
  readonly body?: unknown;
  readonly query?: Record<string, string | number | undefined>;
  /** Bearer token to use instead of the session (e.g. a public access token). */
  readonly token?: string;
  /** Set to `false` for endpoints that need no credentials. */
  readonly auth?: false;
  /**
   * Sent as `Idempotency-Key`. Only task creates set it; with it, a request that
   * fails in transit or with a 5xx is retried with the same key, so Mynth
   * returns the task the first attempt made instead of creating another.
   */
  readonly idempotencyKey?: string;
};

/** Sent as `X-Mynth-Client` so Mynth can count CLI traffic; never checked. */
export const CLI_CLIENT: string = `cli/${CLI_VERSION}`;

/** Waits before each retry of an idempotent create. */
const CREATE_RETRY_DELAYS_MS = [500, 2000] as const;

/** A 5xx may come from a restart or an overload; a retry can succeed. */
const isRetryable = (status: number): boolean => status >= 500;

const buildQuery = (query: RequestOptions["query"]): string => {
  if (query === undefined) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  return params.size > 0 ? `?${params}` : "";
};

type FetchBody = NonNullable<RequestInit["body"]>;

const buildBody = (body: unknown): { body?: FetchBody; headers: Record<string, string> } => {
  if (body === undefined) return { headers: {} };
  if (body instanceof FormData) return { body, headers: {} };
  return { body: JSON.stringify(body), headers: { "Content-Type": "application/json" } };
};

const readText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

/**
 * Turns a non-2xx response into an `ApiError`, preserving the server's `code`
 * (`unauthorized`, `insufficient_balance`, ...) so it can drive the exit code.
 * Every API error answers `{ "error": { code, message } }`.
 */
const toApiError = async (response: Response, label: string): Promise<ApiError> => {
  const text = await readText(response);
  let code: string | undefined;
  let message: string | undefined;

  try {
    const parsed = JSON.parse(text) as { error?: { code?: unknown; message?: unknown } };
    if (typeof parsed.error?.code === "string") code = parsed.error.code;
    if (typeof parsed.error?.message === "string") message = parsed.error.message;
  } catch {
    // Non-JSON error body; classify by HTTP status alone.
  }

  return new ApiError(`${label} failed (${response.status}): ${message ?? text ?? "no body"}`, {
    status: response.status,
    ...(code !== undefined ? { code } : {}),
  });
};

export class ApiClient {
  readonly baseUrl: string;
  private readonly tokens: TokenSource;

  constructor(config: Config, tokens: TokenSource) {
    this.baseUrl = config.apiUrl;
    this.tokens = tokens;
  }

  /** Performs a request and throws `ApiError` on transport failure or non-2xx. */
  async send(label: string, path: string, options: RequestOptions = {}): Promise<Response> {
    // API keys do not expire, so a 401 means revoked or wrong — never stale.
    // No retry fixes a 4xx.
    // Only a create with an `Idempotency-Key` is retried: the key makes a
    // repeat return the original task, so it can never be charged twice.
    const delays: ReadonlyArray<number> =
      options.idempotencyKey === undefined ? [] : CREATE_RETRY_DELAYS_MS;

    for (let attempt = 0; ; attempt++) {
      const delay = delays[attempt];
      let response: Response;
      try {
        response = await this.attempt(path, options);
      } catch (error) {
        if (delay === undefined || !(error instanceof ApiError) || error.status !== 0) throw error;
        await sleep(delay);
        continue;
      }
      if (response.ok) return response;
      if (delay !== undefined && isRetryable(response.status)) {
        await response.body?.cancel();
        await sleep(delay);
        continue;
      }
      throw await toApiError(response, label);
    }
  }

  /** Performs a request and parses the `{ data }` envelope with `schema`. */
  async fetch<T>(
    label: string,
    path: string,
    schema: z.ZodType<T>,
    options: RequestOptions = {},
  ): Promise<T> {
    const response = await this.send(label, path, options);

    let json: unknown;
    try {
      json = await response.json();
    } catch (cause) {
      throw new ApiError(`${label} returned invalid JSON: ${(cause as Error).message}`, {
        status: response.status,
        cause,
      });
    }

    const parsed = envelope(schema).safeParse(json);
    if (!parsed.success) {
      throw new ApiError(`${label} returned an unexpected response shape`, {
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data as T;
  }

  /** Performs a request whose success response has no body (204). */
  async call(label: string, path: string, options: RequestOptions = {}): Promise<void> {
    await this.send(label, path, options);
  }

  private async attempt(path: string, options: RequestOptions): Promise<Response> {
    const { body, headers } = buildBody(options.body);
    const auth =
      options.auth === false ? undefined : (options.token ?? (await this.tokens.token()));

    try {
      return await fetch(`${this.baseUrl}${path}${buildQuery(options.query)}`, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers: {
          ...headers,
          "X-Mynth-Client": CLI_CLIENT,
          ...(options.idempotencyKey !== undefined
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
          ...(auth !== undefined ? { Authorization: `Bearer ${auth}` } : {}),
        },
        ...(body !== undefined ? { body } : {}),
      });
    } catch (cause) {
      throw new ApiError(`request to ${path} failed: ${(cause as Error).message}`, {
        status: 0,
        cause,
      });
    }
  }
}
