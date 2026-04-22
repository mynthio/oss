import * as HttpBody from "@effect/platform/HttpBody";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import {
  AuthorizationDeniedError,
  AuthorizationExpiredError,
  AuthorizationPendingError,
  WorkOSError,
} from "../domain/Errors.ts";
import { WORKOS_API_URL, WORKOS_CLIENT_ID } from "../constants.ts";
import {
  DeviceAuthorizationResponse,
  TokenResponse,
  WorkOSErrorResponse,
} from "../domain/Schemas.ts";

const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const REFRESH_GRANT = "refresh_token";

/**
 * Decode the `exp` claim of a JWT (no signature verification — we trust the issuer
 * because we just received the token over TLS from WorkOS).
 */
const decodeJwtExp = (token: string): Effect.Effect<number, WorkOSError> =>
  Effect.try({
    try: () => {
      const parts = token.split(".");
      if (parts.length < 2) throw new Error("malformed jwt");
      const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf8")) as {
        exp?: number;
      };
      if (typeof payload.exp !== "number") throw new Error("jwt missing exp claim");
      return payload.exp * 1000;
    },
    catch: (cause) => new WorkOSError({ message: "could not decode access token", cause }),
  });

const formBody = (params: Record<string, string>): HttpBody.HttpBody =>
  HttpBody.urlParams(Object.entries(params));

/** Parse the JSON error body WorkOS returns, tolerating a missing/malformed body. */
const readErrorBody = (response: HttpClientResponse.HttpClientResponse) =>
  HttpClientResponse.schemaBodyJson(WorkOSErrorResponse)(response).pipe(
    Effect.orElseSucceed(() => ({}) as Record<string, never>),
  );

const failWorkOsError = (
  response: HttpClientResponse.HttpClientResponse,
  fallbackMessage: string,
): Effect.Effect<never, WorkOSError> =>
  readErrorBody(response).pipe(
    Effect.flatMap((errBody) => {
      const code = errBody.error ?? errBody.code;
      return new WorkOSError({
        message: errBody.error_description ?? errBody.message ?? fallbackMessage,
        status: response.status,
        ...(code !== undefined ? { code } : {}),
      });
    }),
  );

const parseTokenSuccess = (response: HttpClientResponse.HttpClientResponse, label: string) =>
  Effect.gen(function* () {
    const body = yield* HttpClientResponse.schemaBodyJson(TokenResponse)(response).pipe(
      Effect.mapError(
        (cause) =>
          new WorkOSError({ message: `invalid ${label} response`, status: response.status, cause }),
      ),
    );
    const expiresAt = yield* decodeJwtExp(body.access_token);
    return { token: body, expiresAt };
  });

const parseAuthenticate = Effect.fn("WorkOS.parseAuthenticate")(function* (
  response: HttpClientResponse.HttpClientResponse,
) {
  if (response.status === 200) return yield* parseTokenSuccess(response, "token");

  const errBody = yield* readErrorBody(response);
  const code = errBody.error ?? errBody.code;

  return yield* Match.value(code).pipe(
    Match.when("authorization_pending", () => new AuthorizationPendingError({ slowDown: false })),
    Match.when("slow_down", () => new AuthorizationPendingError({ slowDown: true })),
    Match.when("expired_token", () => new AuthorizationExpiredError()),
    Match.when("access_denied", () => new AuthorizationDeniedError()),
    Match.orElse(
      () =>
        new WorkOSError({
          message: errBody.error_description ?? errBody.message ?? "WorkOS error",
          status: response.status,
          ...(code !== undefined ? { code } : {}),
        }),
    ),
  );
});

export class WorkOS extends Effect.Service<WorkOS>()("WorkOS", {
  effect: Effect.gen(function* () {
    const baseClient = yield* HttpClient.HttpClient;
    const client = baseClient.pipe(
      HttpClient.mapRequest(HttpClientRequest.prependUrl(WORKOS_API_URL)),
    );

    const post = (path: string, body: HttpBody.HttpBody) =>
      HttpClientRequest.post(path).pipe(
        HttpClientRequest.setBody(body),
        HttpClientRequest.setHeader("Accept", "application/json"),
      );

    const sendAuthenticate = (body: HttpBody.HttpBody, label: string) =>
      client
        .execute(post("/user_management/authenticate", body))
        .pipe(
          Effect.mapError(
            (cause) => new WorkOSError({ message: `${label} request failed`, cause }),
          ),
        );

    const requestDeviceAuthorization = Effect.fn("WorkOS.deviceAuthorize")(function* () {
      const res = yield* client
        .execute(
          post("/user_management/authorize/device", formBody({ client_id: WORKOS_CLIENT_ID })),
        )
        .pipe(
          Effect.mapError(
            (cause) => new WorkOSError({ message: "device authorize request failed", cause }),
          ),
        );
      if (res.status !== 200) {
        return yield* failWorkOsError(res, "device authorize failed");
      }
      return yield* HttpClientResponse.schemaBodyJson(DeviceAuthorizationResponse)(res).pipe(
        Effect.mapError(
          (cause) => new WorkOSError({ message: "invalid device authorize response", cause }),
        ),
      );
    });

    const exchangeDeviceCode = Effect.fn("WorkOS.exchangeDeviceCode")(function* (
      deviceCode: string,
    ) {
      const res = yield* sendAuthenticate(
        HttpBody.unsafeJson({
          grant_type: DEVICE_GRANT,
          client_id: WORKOS_CLIENT_ID,
          device_code: deviceCode,
        }),
        "authenticate",
      );
      return yield* parseAuthenticate(res);
    });

    const refresh = Effect.fn("WorkOS.refresh")(function* (refreshToken: string) {
      const res = yield* sendAuthenticate(
        HttpBody.unsafeJson({
          grant_type: REFRESH_GRANT,
          client_id: WORKOS_CLIENT_ID,
          refresh_token: refreshToken,
        }),
        "refresh",
      );
      if (res.status === 200) return yield* parseTokenSuccess(res, "refresh");
      return yield* failWorkOsError(res, "refresh failed");
    });

    return { requestDeviceAuthorization, exchangeDeviceCode, refresh } as const;
  }),
}) {}
