import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Ref from "effect/Ref";
import { MynthApiError, NotAuthenticatedError } from "../domain/Errors.ts";
import { appConfig } from "./AppConfig.ts";
import { Auth, type ResolvedAuth } from "./Auth.ts";

const tokenString = (resolved: ResolvedAuth): string =>
  resolved.kind === "api_key" ? resolved.apiKey : resolved.accessToken;

/**
 * Authenticated HTTP client for the Mynth API. Resolves the current credential
 * (env API key, stored API key, or OAuth access token), attaches it as Bearer,
 * and on a 401 response invalidates the cached credential and retries once —
 * which forces an OAuth refresh if applicable.
 */
export class MynthApi extends Effect.Service<MynthApi>()("MynthApi", {
  effect: Effect.gen(function* () {
    const cfg = yield* appConfig;
    const auth = yield* Auth;
    const baseClient = yield* HttpClient.HttpClient;

    const cache = yield* Ref.make(Option.none<ResolvedAuth>());

    const getToken = (forceRefresh: boolean) =>
      Effect.gen(function* () {
        if (forceRefresh) yield* Ref.set(cache, Option.none());
        const cached = yield* Ref.get(cache);
        if (Option.isSome(cached)) return cached.value;
        const fresh = yield* auth.resolve;
        yield* Ref.set(cache, Option.some(fresh));
        return fresh;
      });

    const attempt = Effect.fn("MynthApi.attempt")(function* (
      request: HttpClientRequest.HttpClientRequest,
      forceRefresh: boolean,
    ) {
      const tok = yield* getToken(forceRefresh);
      const authedReq = request.pipe(
        HttpClientRequest.prependUrl(cfg.mynthApiUrl),
        HttpClientRequest.setHeader("Authorization", `Bearer ${tokenString(tok)}`),
      );
      yield* Effect.logDebug("MynthApi request", {
        method: authedReq.method,
        url: authedReq.url,
        authKind: tok.kind,
        forceRefresh,
      });
      const response = yield* baseClient.execute(authedReq).pipe(
        Effect.tapErrorCause((cause) => Effect.logDebug("MynthApi transport error", cause)),
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `request failed: ${cause.message}`,
              status: 0,
              cause,
            }),
        ),
      );
      yield* Effect.logDebug("MynthApi response", { status: response.status });
      return response;
    });

    const execute = (
      request: HttpClientRequest.HttpClientRequest,
    ): Effect.Effect<
      HttpClientResponse.HttpClientResponse,
      MynthApiError | NotAuthenticatedError
    > =>
      Effect.gen(function* () {
        const first = yield* attempt(request, false);
        if (first.status !== 401) return first;
        return yield* attempt(request, true);
      });

    return { execute, baseUrl: cfg.mynthApiUrl } as const;
  }),
}) {}
