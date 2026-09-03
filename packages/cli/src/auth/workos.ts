import { WORKOS_API_URL, WORKOS_CLIENT_ID } from "../config.ts";
import { CliError, DeviceFlowError } from "../errors.ts";
import {
  deviceAuthorization,
  tokenResponse,
  workosErrorResponse,
  type DeviceAuthorization,
  type TokenResponse,
} from "../api/schemas.ts";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json();
  } catch {
    return {};
  }
};

const post = async (path: string, body: string | URLSearchParams, label: string) => {
  try {
    return await fetch(`${WORKOS_API_URL}${path}`, {
      method: "POST",
      body,
      headers: {
        Accept: "application/json",
        ...(typeof body === "string" ? { "Content-Type": "application/json" } : {}),
      },
    });
  } catch (cause) {
    throw new CliError(`${label} failed: ${(cause as Error).message}`, { cause });
  }
};

const failure = async (response: Response, label: string): Promise<DeviceFlowError> => {
  const body = workosErrorResponse.catch({}).parse(await readJson(response));
  const code = body.error ?? body.code ?? "workos_error";
  return new DeviceFlowError(code, body.error_description ?? body.message ?? `${label} failed`);
};

const parse = async <T>(
  response: Response,
  schema: { safeParse: (input: unknown) => { success: boolean; data?: T; error?: unknown } },
  label: string,
): Promise<T> => {
  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new CliError(`${label} returned an unexpected response`, { cause: parsed.error });
  }
  return parsed.data as T;
};

/** Step 1: ask WorkOS for a user code and verification URL. */
export const requestDeviceAuthorization = async (): Promise<DeviceAuthorization> => {
  const response = await post(
    "/user_management/authorize/device",
    new URLSearchParams({ client_id: WORKOS_CLIENT_ID }),
    "device authorization",
  );
  if (!response.ok) throw await failure(response, "device authorization");
  return parse(response, deviceAuthorization, "device authorization");
};

/**
 * Step 2: exchange the device code for a session. Throws a `DeviceFlowError`
 * with `authorization_pending` / `slow_down` / `expired_token` /
 * `access_denied`, which the login loop uses to decide whether to keep waiting.
 *
 * The access token is used once, to mint an API key, and never stored.
 */
export const exchangeDeviceCode = async (deviceCode: string): Promise<TokenResponse> => {
  const response = await post(
    "/user_management/authenticate",
    JSON.stringify({
      grant_type: DEVICE_GRANT,
      client_id: WORKOS_CLIENT_ID,
      device_code: deviceCode,
    }),
    "device token exchange",
  );
  if (!response.ok) throw await failure(response, "device token exchange");
  return parse(response, tokenResponse, "device token exchange");
};
