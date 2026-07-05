import { MynthApiError } from "../domain/Errors.ts";
import type { AppConfig } from "./AppConfig.ts";
import type { Auth, ResolvedAuth } from "./Auth.ts";

const tokenString = (resolved: ResolvedAuth): string =>
  resolved.kind === "api_key" ? resolved.apiKey : resolved.accessToken;

export const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch (cause) {
    throw new MynthApiError({
      message: `invalid JSON response: ${(cause as Error).message}`,
      status: response.status,
      cause,
    });
  }
};

export const readText = async (response: Response): Promise<string> => {
  try {
    return await response.text();
  } catch {
    return "";
  }
};

// Throws on non-2xx, preserving the API error `code` (e.g. UNAUTHORIZED,
// INSUFFICIENT_BALANCE) so it can be mapped to a distinct exit code.
export const requireSuccess = async (response: Response, label: string): Promise<void> => {
  if (response.status >= 200 && response.status < 300) return;
  const bodyText = await readText(response);
  let code: string | undefined;
  try {
    const parsed = JSON.parse(bodyText) as { code?: unknown };
    if (typeof parsed.code === "string") code = parsed.code;
  } catch {
    // Non-JSON error body; classify by HTTP status alone.
  }
  throw new MynthApiError({
    message: `${label} failed (${response.status}): ${bodyText || "no body"}`,
    status: response.status,
    ...(code !== undefined ? { code } : {}),
  });
};

export class MynthApi {
  readonly baseUrl: string;
  private cachedAuth: ResolvedAuth | undefined;

  constructor(
    config: AppConfig,
    private readonly auth: Auth,
  ) {
    this.baseUrl = config.mynthApiUrl;
  }

  async execute(path: string, init: RequestInit = {}): Promise<Response> {
    const first = await this.attempt(path, init, false);
    if (first.status !== 401) return first;
    return this.attempt(path, init, true);
  }

  async executePublic(path: string, init: RequestInit = {}): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, init);
    } catch (cause) {
      throw new MynthApiError({
        message: `request failed: ${(cause as Error).message}`,
        status: 0,
        cause,
      });
    }
  }

  private async attempt(path: string, init: RequestInit, forceRefresh: boolean): Promise<Response> {
    const auth = await this.getAuth(forceRefresh);
    const headers = new Headers(init.headers);
    headers.set("Authorization", `Bearer ${tokenString(auth)}`);

    try {
      return await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    } catch (cause) {
      throw new MynthApiError({
        message: `request failed: ${(cause as Error).message}`,
        status: 0,
        cause,
      });
    }
  }

  private async getAuth(forceRefresh: boolean): Promise<ResolvedAuth> {
    if (forceRefresh) this.cachedAuth = undefined;
    if (this.cachedAuth !== undefined) return this.cachedAuth;
    this.cachedAuth = await this.auth.resolve();
    return this.cachedAuth;
  }
}
