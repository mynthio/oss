import type { ResolvedClientConfig } from "./config.ts";
import { MynthAPIError, type MynthAPIErrorIssue, MynthResponseError } from "./errors.ts";

type RequestOptions = { signal?: AbortSignal | undefined };

/**
 * Minimal Mynth API client: JSON and multipart requests with the API key,
 * the `{ data }` envelope unwrapped, and error responses turned into
 * {@link MynthAPIError}. Responses come back as `unknown` for the caller to
 * parse.
 *
 * It never retries on its own: creating a task is not idempotent, so only the
 * caller knows which requests are safe to repeat.
 */
export class MynthClient {
  private readonly config: ResolvedClientConfig;

  constructor(config: ResolvedClientConfig) {
    this.config = config;
  }

  get(path: string, options?: RequestOptions): Promise<unknown> {
    return this.send(path, { method: "GET" }, options);
  }

  postJson(path: string, body: unknown, options?: RequestOptions): Promise<unknown> {
    return this.send(
      path,
      { method: "POST", body: JSON.stringify(body), contentType: "application/json" },
      options,
    );
  }

  /** `fetch` sets the multipart boundary header itself. */
  postForm(path: string, body: FormData, options?: RequestOptions): Promise<unknown> {
    return this.send(path, { method: "POST", body }, options);
  }

  private async send(
    path: string,
    request: { method: string; body?: BodyInit; contentType?: string },
    { signal }: RequestOptions = {},
  ): Promise<unknown> {
    const response = await this.config.fetch(`${this.config.baseURL}${path}`, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        ...this.config.headers,
        ...(request.contentType ? { "Content-Type": request.contentType } : {}),
      },
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(signal ? { signal } : {}),
    });

    if (!response.ok) {
      throw await toApiError(response);
    }

    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new MynthResponseError(`Mynth API returned a non-JSON response for ${path}`);
    }

    if (typeof json !== "object" || json === null || !("data" in json)) {
      throw new MynthResponseError(`Mynth API response for ${path} has no data`);
    }

    return json.data;
  }
}

/** Every API error answers `{ "error": { code, message?, issues?, task_id? } }`. */
async function toApiError(response: Response): Promise<MynthAPIError> {
  // A proxy's HTML error page is not JSON, and still yields an API error.
  const body: unknown = await response.json().catch(() => undefined);
  const error =
    typeof body === "object" && body !== null && "error" in body && isRecord(body.error)
      ? body.error
      : {};

  return new MynthAPIError({
    message:
      (typeof error["message"] === "string" && error["message"]) ||
      `Mynth API request failed with status ${response.status}`,
    status: response.status,
    code: typeof error["code"] === "string" ? error["code"] : undefined,
    issues: Array.isArray(error["issues"]) ? error["issues"].filter(isIssue) : undefined,
    taskId: typeof error["task_id"] === "string" ? error["task_id"] : undefined,
    retryAfterMs: parseRetryAfter(response.headers.get("retry-after")),
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIssue(value: unknown): value is MynthAPIErrorIssue {
  return (
    isRecord(value) &&
    typeof value["message"] === "string" &&
    Array.isArray(value["path"]) &&
    value["path"].every((key) => typeof key === "string" || typeof key === "number")
  );
}

/** `Retry-After` is either delay seconds or an HTTP date. */
function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;

  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds >= 0 ? seconds * 1000 : undefined;

  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
