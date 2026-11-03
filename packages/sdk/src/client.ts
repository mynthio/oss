import { API_URL } from "./constants.ts";

/**
 * Error thrown when an API request fails.
 */
export class MynthAPIError extends Error {
  /** HTTP status code of the failed request */
  public readonly status: number;
  /** Error code from the API response, if available, e.g. `insufficient_balance` */
  public readonly code?: string | undefined;
  /**
   * One entry per invalid or unknown field when `code` is `validation_error`.
   * `message` already states all of them.
   */
  public readonly issues?: ReadonlyArray<MynthAPIErrorIssue> | undefined;
  /**
   * The task the request created before it failed, when `code` is
   * `public_access_token_failed`. It will run: follow it rather than resending.
   */
  public readonly taskId?: string | undefined;

  constructor(
    message: string,
    status: number,
    code?: string,
    issues?: ReadonlyArray<MynthAPIErrorIssue>,
    taskId?: string,
  ) {
    super(message);
    this.name = "MynthAPIError";
    this.status = status;
    this.code = code;
    this.issues = issues;
    this.taskId = taskId;
  }
}

export type MynthAPIErrorIssue = {
  /** Where the problem is, e.g. `["size", "scale"]`. Empty for the body as a whole. */
  path: ReadonlyArray<string | number>;
  message: string;
};

/** Every API error answers `{ "error": { code, message?, issues?, task_id? } }`. */
type APIErrorResponse = {
  error?: {
    code?: unknown;
    message?: unknown;
    issues?: unknown;
    task_id?: unknown;
  };
};

declare const __MYNTH_SDK_VERSION__: string | undefined;

/**
 * Sent as `X-Mynth-Client` on creates so Mynth can count SDK traffic. The API
 * only records it, never checks it. The build inlines the package version.
 */
export const SDK_CLIENT: string =
  typeof __MYNTH_SDK_VERSION__ === "string" ? `sdk/${__MYNTH_SDK_VERSION__}` : "sdk/dev";

/**
 * Waits before each retry of a create that failed in transit or with a 5xx.
 * The retry sends the same `Idempotency-Key`, so Mynth returns the task the
 * first attempt made, if it made one, instead of creating and charging another.
 */
const CREATE_RETRY_DELAYS_MS = [500, 2000] as const;

/** Statuses a create may answer while the API is restarting or overloaded. */
const RETRYABLE_STATUSES = new Set([500, 502, 503, 504]);

/** A fresh `Idempotency-Key`: one per logical create, reused by its retries. */
export function createIdempotencyKey(): string {
  const crypto = globalThis.crypto;
  if (typeof crypto?.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto?.getRandomValues === "function") {
    crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function wait(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

type MynthClientRequestOptions = {
  headers?: Record<string, string>;
  accessToken?: string | undefined;
  auth?: boolean | undefined;
  signal?: AbortSignal | undefined;
};

function createApiError(data: unknown, status: number) {
  const body = (typeof data === "object" && data !== null ? data : {}) as APIErrorResponse;
  const error = typeof body.error === "object" && body.error !== null ? body.error : {};
  const message =
    (typeof error.message === "string" && error.message) || `Request failed with status ${status}`;
  const code = typeof error.code === "string" ? error.code : undefined;
  const issues = Array.isArray(error.issues) ? (error.issues as MynthAPIErrorIssue[]) : undefined;
  const taskId = typeof error.task_id === "string" ? error.task_id : undefined;

  return new MynthAPIError(message, status, code, issues, taskId);
}

/** An error body that is not JSON (a proxy's HTML page, say) still yields an API error. */
async function readErrorBody(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * Internal HTTP client for making API requests.
 * @internal
 */
class MynthClient {
  private readonly apiKey: string | undefined;
  private readonly baseUrl: string;

  constructor(options: { apiKey?: string | undefined; baseUrl?: string | undefined }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl
      ? options.baseUrl.endsWith("/")
        ? options.baseUrl.slice(0, -1)
        : options.baseUrl
      : API_URL;
  }

  getAuthHeaders(
    override?: Pick<MynthClientRequestOptions, "accessToken" | "auth">,
  ): Record<string, string> {
    if (override?.auth === false) {
      return {};
    }

    const token = override?.accessToken ?? this.apiKey;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getUrl(path: string) {
    return `${this.baseUrl}${path}`;
  }

  public async post<DataType>(
    path: string,
    data: unknown,
    { signal }: Pick<MynthClientRequestOptions, "signal"> = {},
  ): Promise<DataType> {
    const isFormData = typeof FormData !== "undefined" && data instanceof FormData;
    const response = await fetch(this.getUrl(path), {
      method: "POST",
      headers: {
        ...(isFormData ? {} : { "Content-Type": "application/json" }),
        ...this.getAuthHeaders(),
      },
      body: isFormData ? data : JSON.stringify(data),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw createApiError(await readErrorBody(response), response.status);
    }

    return (await response.json()) as DataType;
  }

  /**
   * Creates a task. Sends `X-Mynth-Client` and an `Idempotency-Key` (the
   * caller's, or a fresh one), and retries with the same key when the request
   * fails in transit or with a 5xx, so a retry never creates a second task.
   */
  public async createTask<DataType>(
    path: string,
    data: unknown,
    {
      signal,
      idempotencyKey = createIdempotencyKey(),
    }: Pick<MynthClientRequestOptions, "signal"> & { idempotencyKey?: string | undefined } = {},
  ): Promise<DataType> {
    const body = JSON.stringify(data);

    for (let attempt = 0; ; attempt++) {
      const delay = CREATE_RETRY_DELAYS_MS[attempt];
      let response: Response;

      try {
        response = await fetch(this.getUrl(path), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": idempotencyKey,
            "X-Mynth-Client": SDK_CLIENT,
            ...this.getAuthHeaders(),
          },
          body,
          ...(signal ? { signal } : {}),
        });
      } catch (error) {
        if (signal?.aborted || delay === undefined) {
          throw error;
        }
        await wait(delay, signal);
        continue;
      }

      if (response.ok) {
        return (await response.json()) as DataType;
      }

      if (RETRYABLE_STATUSES.has(response.status) && delay !== undefined) {
        await response.body?.cancel();
        await wait(delay, signal);
        continue;
      }

      throw createApiError(await readErrorBody(response), response.status);
    }
  }

  public async get<DataType>(
    path: string,
    { headers, accessToken, auth, signal }: MynthClientRequestOptions = {},
  ): Promise<{ data: DataType; status: number; ok: boolean }> {
    const response = await fetch(this.getUrl(path), {
      headers: {
        ...this.getAuthHeaders({ accessToken, auth }),
        ...headers,
      },
      ...(signal ? { signal } : {}),
    });

    const data = (await response.json()) as DataType;

    return { data, status: response.status, ok: response.ok };
  }

  public async getOrThrow<DataType>(
    path: string,
    options: MynthClientRequestOptions = {},
  ): Promise<DataType> {
    const response = await this.get<DataType>(path, options);

    if (!response.ok) {
      throw createApiError(response.data, response.status);
    }

    return response.data;
  }
}

export { MynthClient };
