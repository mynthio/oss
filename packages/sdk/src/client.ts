import { API_URL } from "./constants";

/**
 * Error thrown when an API request fails.
 */
export class MynthAPIError extends Error {
  /** HTTP status code of the failed request */
  public readonly status: number;
  /** Error code from the API response, if available */
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "MynthAPIError";
    this.status = status;
    this.code = code;
  }
}

type APIErrorResponse = {
  error?: string;
  message?: string;
  code?: string;
};

type MynthClientRequestOptions = {
  headers?: Record<string, string>;
  accessToken?: string;
  auth?: boolean;
};

function createApiError(data: unknown, status: number) {
  const errorResponse = data as APIErrorResponse;
  const message =
    errorResponse.error || errorResponse.message || `Request failed with status ${status}`;

  return new MynthAPIError(message, status, errorResponse.code);
}

/**
 * Internal HTTP client for making API requests.
 * @internal
 */
class MynthClient {
  private readonly apiKey?: string;
  private readonly baseUrl: string;

  constructor(options: { apiKey?: string; baseUrl?: string }) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl
      ? options.baseUrl.endsWith("/")
        ? options.baseUrl.slice(0, -1)
        : options.baseUrl
      : API_URL;
  }

  getAuthHeaders(override?: { accessToken?: string; auth?: boolean }): Record<string, string> {
    if (override?.auth === false) {
      return {};
    }

    const token = override?.accessToken ?? this.apiKey;

    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  getUrl(path: string) {
    return `${this.baseUrl}${path}`;
  }

  public async post<DataType>(path: string, data: unknown): Promise<DataType> {
    const response = await fetch(this.getUrl(path), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...this.getAuthHeaders(),
      },
      body: JSON.stringify(data),
    });

    const json = await response.json();

    if (!response.ok) {
      throw createApiError(json, response.status);
    }

    return json as DataType;
  }

  public async get<DataType>(
    path: string,
    { headers, accessToken, auth }: MynthClientRequestOptions = {},
  ): Promise<{ data: DataType; status: number; ok: boolean }> {
    const response = await fetch(this.getUrl(path), {
      headers: {
        ...this.getAuthHeaders({ accessToken, auth }),
        ...headers,
      },
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
