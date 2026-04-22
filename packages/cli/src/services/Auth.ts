import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import { NotAuthenticatedError } from "../domain/Errors.ts";
import type { OAuthCredentials, WorkOSUser } from "../domain/Schemas.ts";
import { appConfig } from "./AppConfig.ts";
import { CredentialsStore } from "./CredentialsStore.ts";
import { WorkOS } from "./WorkOS.ts";

const REFRESH_LEEWAY_MS = 60_000;

export type AuthStatus =
  | { kind: "none" }
  | { kind: "env"; source: "MYNTH_API_KEY" }
  | { kind: "api_key" }
  | { kind: "oauth"; expiresAt: number; user?: WorkOSUser };

export type ResolvedAuth =
  | { kind: "api_key"; apiKey: string; source: "env" | "stored" }
  | { kind: "oauth"; accessToken: string; user?: WorkOSUser };

const notAuthenticated = (reason: string) =>
  Effect.mapError(
    (cause: { readonly message: string }) =>
      new NotAuthenticatedError({ reason: `${reason}: ${cause.message}` }),
  );

const userField = (user: WorkOSUser | undefined) => (user ? { user } : {});

export class Auth extends Effect.Service<Auth>()("Auth", {
  effect: Effect.gen(function* () {
    const cfg = yield* appConfig;
    const store = yield* CredentialsStore;
    const workos = yield* WorkOS;

    const envApiKey: Option.Option<string> = Option.map(cfg.apiKeyEnvOverride, Redacted.value);
    const envApiKeySet = Option.isSome(envApiKey);

    const refreshIfNeeded = (
      creds: OAuthCredentials,
    ): Effect.Effect<OAuthCredentials, NotAuthenticatedError> =>
      Effect.gen(function* () {
        if (creds.expires_at - Date.now() > REFRESH_LEEWAY_MS) return creds;
        const refreshed = yield* workos
          .refresh(creds.refresh_token)
          .pipe(notAuthenticated("token refresh failed"));
        const next: OAuthCredentials = {
          kind: "oauth",
          access_token: refreshed.token.access_token,
          refresh_token: refreshed.token.refresh_token,
          expires_at: refreshed.expiresAt,
          ...userField(refreshed.token.user ?? creds.user),
        };
        yield* store.set(next).pipe(notAuthenticated("could not persist refreshed token"));
        return next;
      });

    /** Resolve auth from env > stored, refreshing oauth tokens as needed. */
    const resolve: Effect.Effect<ResolvedAuth, NotAuthenticatedError> = Effect.gen(function* () {
      if (Option.isSome(envApiKey)) {
        return { kind: "api_key", apiKey: envApiKey.value, source: "env" } as const;
      }
      const stored = yield* store.get.pipe(notAuthenticated("could not read credentials"));
      if (Option.isNone(stored)) {
        return yield* new NotAuthenticatedError({ reason: "no credentials configured" });
      }
      const creds = stored.value;
      if (creds.kind === "api_key") {
        return { kind: "api_key", apiKey: creds.api_key, source: "stored" } as const;
      }
      const fresh = yield* refreshIfNeeded(creds);
      return { kind: "oauth", accessToken: fresh.access_token, ...userField(fresh.user) } as const;
    });

    const status: Effect.Effect<AuthStatus> = Effect.gen(function* () {
      if (Option.isSome(envApiKey)) {
        return { kind: "env", source: "MYNTH_API_KEY" } as const;
      }
      const stored = yield* store.get.pipe(Effect.orElseSucceed(() => Option.none()));
      if (Option.isNone(stored)) return { kind: "none" } as const;
      const c = stored.value;
      if (c.kind === "api_key") return { kind: "api_key" } as const;
      return { kind: "oauth", expiresAt: c.expires_at, ...userField(c.user) } as const;
    });

    const setApiKey = (apiKey: string) => store.set({ kind: "api_key", api_key: apiKey });

    const saveOAuth = (params: {
      accessToken: string;
      refreshToken: string;
      expiresAt: number;
      user?: WorkOSUser;
    }) =>
      store.set({
        kind: "oauth",
        access_token: params.accessToken,
        refresh_token: params.refreshToken,
        expires_at: params.expiresAt,
        ...userField(params.user),
      });

    const logout = store.clear;

    return { resolve, status, setApiKey, saveOAuth, logout, envApiKeySet } as const;
  }),
}) {}
