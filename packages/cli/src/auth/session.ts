import type { Config } from "../config.ts";
import { AuthError } from "../errors.ts";
import type { OAuthCredentials, WorkosUser } from "../api/schemas.ts";
import type { TokenSource } from "../api/client.ts";
import { CredentialsStore } from "./credentials.ts";
import { refreshToken } from "./workos.ts";

/** Refresh this far ahead of expiry so a long request never races the clock. */
const REFRESH_LEEWAY_MS = 60_000;

export type AuthStatus =
  | { readonly kind: "none" }
  | { readonly kind: "env" }
  | { readonly kind: "api_key" }
  | { readonly kind: "oauth"; readonly expiresAt: number; readonly user?: WorkosUser };

/**
 * Resolves the credentials for outgoing API calls, in precedence order:
 * `MYNTH_API_KEY` > stored API key > stored OAuth tokens (refreshed on demand).
 */
export class Session implements TokenSource {
  readonly store: CredentialsStore;
  readonly envApiKeySet: boolean;
  private cached: string | undefined;

  constructor(private readonly config: Config) {
    this.store = new CredentialsStore();
    this.envApiKeySet = config.envApiKey !== undefined;
  }

  async token(options: { readonly forceRefresh?: boolean } = {}): Promise<string> {
    if (this.config.envApiKey !== undefined) return this.config.envApiKey;
    if (options.forceRefresh === true) this.cached = undefined;
    if (this.cached !== undefined) return this.cached;

    const stored = await this.read();
    if (stored === undefined) {
      throw new AuthError("not authenticated: run `mynth auth login` or set MYNTH_API_KEY");
    }

    this.cached =
      stored.kind === "api_key" ? stored.api_key : (await this.refresh(stored)).access_token;
    return this.cached;
  }

  async status(): Promise<AuthStatus> {
    if (this.envApiKeySet) return { kind: "env" };

    const stored = await this.read().catch(() => undefined);
    if (stored === undefined) return { kind: "none" };
    if (stored.kind === "api_key") return { kind: "api_key" };
    return {
      kind: "oauth",
      expiresAt: stored.expires_at,
      ...(stored.user !== undefined ? { user: stored.user } : {}),
    };
  }

  async saveApiKey(apiKey: string): Promise<void> {
    await this.store.set({ kind: "api_key", api_key: apiKey });
    this.cached = undefined;
  }

  async saveOAuth(credentials: Omit<OAuthCredentials, "kind">): Promise<void> {
    await this.store.set({ kind: "oauth", ...credentials });
    this.cached = undefined;
  }

  async logout(): Promise<void> {
    await this.store.clear();
    this.cached = undefined;
  }

  private async read() {
    try {
      return await this.store.get();
    } catch (cause) {
      throw new AuthError(`could not read stored credentials: ${(cause as Error).message}`, {
        cause,
      });
    }
  }

  private async refresh(stored: OAuthCredentials): Promise<OAuthCredentials> {
    if (stored.expires_at - Date.now() > REFRESH_LEEWAY_MS) return stored;

    let issued: Awaited<ReturnType<typeof refreshToken>>;
    try {
      issued = await refreshToken(stored.refresh_token);
    } catch (cause) {
      throw new AuthError(
        `session expired and could not be refreshed (${(cause as Error).message}); run \`mynth auth login\``,
        { cause },
      );
    }

    const next: OAuthCredentials = {
      kind: "oauth",
      access_token: issued.token.access_token,
      refresh_token: issued.token.refresh_token,
      expires_at: issued.expiresAt,
      ...((issued.token.user ?? stored.user) ? { user: issued.token.user ?? stored.user } : {}),
    };

    await this.store.set(next);
    return next;
  }
}
