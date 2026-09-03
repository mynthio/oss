import type { z } from "zod";
import type { Config } from "../config.ts";
import { ApiError } from "../errors.ts";
import { envelope } from "./schemas.ts";

/** Supplies bearer tokens; implemented by `auth/session.ts`. */
export type TokenSource = {
  token(options?: { readonly forceRefresh?: boolean }): Promise<string>;
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
};

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
 * (UNAUTHORIZED, INSUFFICIENT_BALANCE, ...) so it can drive the exit code.
 */
const toApiError = async (response: Response, label: string): Promise<ApiError> => {
  const text = await readText(response);
  let code: string | undefined;
  let message: string | undefined;

  try {
    const parsed = JSON.parse(text) as { code?: unknown; message?: unknown; error?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
    if (typeof parsed.message === "string") message = parsed.message;
    else if (typeof parsed.error === "string") message = parsed.error;
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

  constructor(
    config: Config,
    private readonly tokens: TokenSource,
  ) {
    this.baseUrl = config.apiUrl;
  }

  /** Performs a request and throws `ApiError` on transport failure or non-2xx. */
  async send(label: string, path: string, options: RequestOptions = {}): Promise<Response> {
    const response = await this.attempt(path, options, false);
    // A 401 on a session token usually means it expired mid-flight; refresh once.
    if (response.status !== 401 || options.auth === false || options.token !== undefined) {
      if (response.ok) return response;
      throw await toApiError(response, label);
    }

    const retried = await this.attempt(path, options, true);
    if (retried.ok) return retried;
    throw await toApiError(retried, label);
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

  private async attempt(
    path: string,
    options: RequestOptions,
    forceRefresh: boolean,
  ): Promise<Response> {
    const { body, headers } = buildBody(options.body);
    const auth =
      options.auth === false
        ? undefined
        : (options.token ?? (await this.tokens.token({ forceRefresh })));

    try {
      return await fetch(`${this.baseUrl}${path}${buildQuery(options.query)}`, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers: { ...headers, ...(auth !== undefined ? { Authorization: `Bearer ${auth}` } : {}) },
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
