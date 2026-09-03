import { z } from "zod";
import type { ApiClient } from "./client.ts";
import { apiKey, createdApiKey, type ApiKey, type CreatedApiKey } from "./schemas.ts";

/**
 * Minting a key with `manage` or `keys` scope requires OAuth: the API rejects
 * scope escalation from an API-key session. `token` therefore carries the
 * short-lived access token from the device flow.
 */
export const createApiKey = (
  client: ApiClient,
  args: { readonly name: string; readonly scopes: ReadonlyArray<string>; readonly token: string },
): Promise<CreatedApiKey> =>
  client.fetch("api key create", "/api-key", createdApiKey, {
    body: { name: args.name, scopes: args.scopes },
    token: args.token,
  });

/**
 * Creates a key with the current session's credentials. An API-key session can
 * only ever mint `generate` keys; the API rejects anything wider with
 * SCOPE_ESCALATION and explains why.
 */
export const createApiKeyAsSelf = (
  client: ApiClient,
  args: { readonly name: string; readonly scopes: ReadonlyArray<string> },
): Promise<CreatedApiKey> =>
  client.fetch("api key create", "/api-key", createdApiKey, {
    body: { name: args.name, scopes: args.scopes },
  });

export const listApiKeys = (client: ApiClient): Promise<ReadonlyArray<ApiKey>> =>
  client.fetch("api key list", "/api-key", z.array(apiKey));

export const deleteApiKey = (client: ApiClient, id: string): Promise<void> =>
  client.call("api key delete", `/api-key/${id}`, { method: "DELETE" });
