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
