import {
  AuthorizationDeniedError,
  AuthorizationExpiredError,
  AuthorizationPendingError,
  WorkOSError,
} from "../domain/Errors.ts";
import { WORKOS_API_URL, WORKOS_CLIENT_ID } from "../constants.ts";
import {
  DeviceAuthorizationResponseSchema,
  TokenResponseSchema,
  WorkOSErrorResponseSchema,
  type DeviceAuthorizationResponse,
  type TokenResponse,
} from "../domain/Schemas.ts";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_GRANT = "refresh_token";

type TokenSuccess = {
  readonly token: TokenResponse;
  readonly expiresAt: number;
};

const decodeJwtExp = (token: string): number => {
  try {
    const parts = token.split(".");
    if (parts.length < 2) throw new Error("malformed jwt");
    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
      exp?: number;
    };
    if (typeof payload.exp !== "number") throw new Error("jwt missing exp claim");
    return payload.exp * 1000;
  } catch (cause) {
    throw new WorkOSError({ message: "could not decode access token", cause });
  }
};

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const readErrorBody = async (response: Response) =>
  WorkOSErrorResponseSchema.catch({}).parse(await readJson(response));

const failWorkOsError = async (response: Response, fallbackMessage: string): Promise<never> => {
  const errBody = await readErrorBody(response);
  const code = errBody.error ?? errBody.code;
  throw new WorkOSError({
    message: errBody.error_description ?? errBody.message ?? fallbackMessage,
    status: response.status,
    ...(code !== undefined ? { code } : {}),
  });
};

const parseTokenSuccess = async (response: Response, label: string): Promise<TokenSuccess> => {
  const parsed = TokenResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new WorkOSError({
      message: `invalid ${label} response`,
      status: response.status,
      cause: parsed.error,
    });
  }
  return { token: parsed.data, expiresAt: decodeJwtExp(parsed.data.access_token) };
};

const parseAuthenticate = async (response: Response): Promise<TokenSuccess> => {
  if (response.status === 200) return parseTokenSuccess(response, "token");

  const errBody = await readErrorBody(response);
  const code = errBody.error ?? errBody.code;
  switch (code) {
    case "authorization_pending":
      throw new AuthorizationPendingError({ slowDown: false });
    case "slow_down":
      throw new AuthorizationPendingError({ slowDown: true });
    case "expired_token":
      throw new AuthorizationExpiredError();
    case "access_denied":
      throw new AuthorizationDeniedError();
    default:
      throw new WorkOSError({
        message: errBody.error_description ?? errBody.message ?? "WorkOS error",
        status: response.status,
        ...(code !== undefined ? { code } : {}),
      });
  }
};

export class WorkOS {
  private readonly baseUrl = WORKOS_API_URL;

  async requestDeviceAuthorization(): Promise<DeviceAuthorizationResponse> {
    const res = await this.post(
      "/user_management/authorize/device",
      new URLSearchParams({ client_id: WORKOS_CLIENT_ID }),
      "device authorize request failed",
    );

    if (res.status !== 200) {
      return failWorkOsError(res, "device authorize failed");
    }

    const parsed = DeviceAuthorizationResponseSchema.safeParse(await readJson(res));
    if (!parsed.success) {
      throw new WorkOSError({
        message: "invalid device authorize response",
        status: res.status,
        cause: parsed.error,
      });
    }
    return parsed.data;
  }

  async exchangeDeviceCode(deviceCode: string): Promise<TokenSuccess> {
    const res = await this.post(
      "/user_management/authenticate",
      JSON.stringify({
        grant_type: DEVICE_GRANT,
        client_id: WORKOS_CLIENT_ID,
        device_code: deviceCode,
      }),
      "authenticate request failed",
      { "Content-Type": "application/json" },
    );
    return parseAuthenticate(res);
  }

  async refresh(refreshToken: string): Promise<TokenSuccess> {
    const res = await this.post(
      "/user_management/authenticate",
      JSON.stringify({
        grant_type: REFRESH_GRANT,
        client_id: WORKOS_CLIENT_ID,
        refresh_token: refreshToken,
      }),
      "refresh request failed",
      { "Content-Type": "application/json" },
    );

    if (res.status === 200) return parseTokenSuccess(res, "refresh");
    return failWorkOsError(res, "refresh failed");
  }

  private async post(
    path: string,
    body: string | URLSearchParams,
    failureMessage: string,
    headers: Record<string, string> = {},
  ): Promise<Response> {
    try {
      return await fetch(`${this.baseUrl}${path}`, {
        method: "POST",
        body,
        headers: { Accept: "application/json", ...headers },
      });
    } catch (cause) {
      throw new WorkOSError({ message: failureMessage, cause });
    }
  }
}
