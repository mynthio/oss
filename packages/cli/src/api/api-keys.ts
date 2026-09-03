import type { ApiClient } from "./client.ts";
import { createdApiKey, type CreatedApiKey } from "./schemas.ts";

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

export const deleteApiKey = (client: ApiClient, id: string): Promise<void> =>
  client.call("api key delete", `/api-key/${id}`, { method: "DELETE" });
