import type { TokenSource } from "../api/client.ts";
import type { Credentials } from "../api/schemas.ts";
import type { Config } from "../config.ts";
import { AuthError } from "../errors.ts";
import { CredentialsStore } from "./credentials.ts";

export type AuthStatus =
  | { readonly kind: "none" }
  | { readonly kind: "env" }
  | { readonly kind: "stored"; readonly credentials: Credentials };

/**
 * Resolves the API key for outgoing requests: `MYNTH_API_KEY` first, then the
 * stored key. Keys do not expire, so there is nothing to refresh and no expiry
 * to track.
 */
export class Session implements TokenSource {
  readonly store: CredentialsStore;
  readonly envApiKeySet: boolean;
  private cached: string | undefined;

  constructor(private readonly config: Config) {
    this.store = new CredentialsStore();
    this.envApiKeySet = config.envApiKey !== undefined;
  }

  async token(): Promise<string> {
    if (this.config.envApiKey !== undefined) return this.config.envApiKey;
    if (this.cached !== undefined) return this.cached;

    const stored = await this.read();
    if (stored === undefined) {
      throw new AuthError("not authenticated: run `mynth auth login` or set MYNTH_API_KEY");
    }

    this.cached = stored.api_key;
    return this.cached;
  }

  async status(): Promise<AuthStatus> {
    if (this.envApiKeySet) return { kind: "env" };

    const stored = await this.read().catch(() => undefined);
    return stored === undefined ? { kind: "none" } : { kind: "stored", credentials: stored };
  }

  async save(credentials: Credentials): Promise<void> {
    await this.store.set(credentials);
    this.cached = undefined;
  }

  async clear(): Promise<void> {
    await this.store.clear();
    this.cached = undefined;
  }

  private async read(): Promise<Credentials | undefined> {
    try {
      return await this.store.get();
    } catch (cause) {
      throw new AuthError(`could not read stored credentials: ${(cause as Error).message}`, {
        cause,
      });
    }
  }
}
