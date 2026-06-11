import { NotAuthenticatedError } from "../domain/Errors.ts";
import type { OAuthCredentials, WorkOSUser } from "../domain/Schemas.ts";
import type { AppConfig } from "./AppConfig.ts";
import type { CredentialsStore } from "./CredentialsStore.ts";
import type { WorkOS } from "./WorkOS.ts";

const REFRESH_LEEWAY_MS = 60_000;

export type AuthStatus =
  | { kind: "none" }
  | { kind: "env"; source: "MYNTH_API_KEY" }
  | { kind: "api_key" }
  | { kind: "oauth"; expiresAt: number; user?: WorkOSUser };

export type ResolvedAuth =
  | { kind: "api_key"; apiKey: string; source: "env" | "stored" }
  | { kind: "oauth"; accessToken: string; user?: WorkOSUser };

const userField = (user: WorkOSUser | undefined) => (user ? { user } : {});

const notAuthenticated = (reason: string, cause: unknown) =>
  new NotAuthenticatedError({
    reason: cause instanceof Error ? `${reason}: ${cause.message}` : reason,
  });

export class Auth {
  readonly envApiKeySet: boolean;
  private readonly envApiKey: string | undefined;

  constructor(
    private readonly config: AppConfig,
    private readonly store: CredentialsStore,
    private readonly workos: WorkOS,
  ) {
    this.envApiKey = config.apiKeyEnvOverride;
    this.envApiKeySet = this.envApiKey !== undefined && this.envApiKey.length > 0;
  }

  async resolve(): Promise<ResolvedAuth> {
    if (this.envApiKeySet) {
      return { kind: "api_key", apiKey: this.envApiKey!, source: "env" };
    }

    let stored: Awaited<ReturnType<CredentialsStore["get"]>>;
    try {
      stored = await this.store.get();
    } catch (cause) {
      throw notAuthenticated("could not read credentials", cause);
    }

    if (stored === undefined) {
      throw new NotAuthenticatedError({ reason: "no credentials configured" });
    }

    if (stored.kind === "api_key") {
      return { kind: "api_key", apiKey: stored.api_key, source: "stored" };
    }

    const fresh = await this.refreshIfNeeded(stored);
    return { kind: "oauth", accessToken: fresh.access_token, ...userField(fresh.user) };
  }

  async status(): Promise<AuthStatus> {
    if (this.envApiKeySet) {
      return { kind: "env", source: "MYNTH_API_KEY" };
    }

    let stored: Awaited<ReturnType<CredentialsStore["get"]>>;
    try {
      stored = await this.store.get();
    } catch {
      stored = undefined;
    }

    if (stored === undefined) return { kind: "none" };
    if (stored.kind === "api_key") return { kind: "api_key" };
    return { kind: "oauth", expiresAt: stored.expires_at, ...userField(stored.user) };
  }

  async setApiKey(apiKey: string): Promise<void> {
    await this.store.set({ kind: "api_key", api_key: apiKey });
  }

  async saveOAuth(params: {
    readonly accessToken: string;
    readonly refreshToken: string;
    readonly expiresAt: number;
    readonly user?: WorkOSUser;
  }): Promise<void> {
    await this.store.set({
      kind: "oauth",
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
      expires_at: params.expiresAt,
      ...userField(params.user),
    });
  }

  async logout(): Promise<void> {
    await this.store.clear();
  }

  private async refreshIfNeeded(creds: OAuthCredentials): Promise<OAuthCredentials> {
    if (creds.expires_at - Date.now() > REFRESH_LEEWAY_MS) return creds;

    let refreshed: Awaited<ReturnType<WorkOS["refresh"]>>;
    try {
      refreshed = await this.workos.refresh(creds.refresh_token);
    } catch (cause) {
      throw notAuthenticated("token refresh failed", cause);
    }

    const next: OAuthCredentials = {
      kind: "oauth",
      access_token: refreshed.token.access_token,
      refresh_token: refreshed.token.refresh_token,
      expires_at: refreshed.expiresAt,
      ...userField(refreshed.token.user ?? creds.user),
    };

    try {
      await this.store.set(next);
    } catch (cause) {
      throw notAuthenticated("could not persist refreshed token", cause);
    }

    return next;
  }
}
