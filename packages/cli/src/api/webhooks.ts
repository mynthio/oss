import type { ApiClient } from "./client.ts";
import {
  createdWebhook,
  updatedWebhook,
  type CreatedWebhook,
  type UpdatedWebhook,
} from "./schemas.ts";

export type WebhookEvents = "all" | ReadonlyArray<string>;

export type WebhookBody = {
  readonly enabled: boolean;
  readonly url: string;
  readonly events: WebhookEvents;
  /** Restricts deliveries to tasks created by these API keys. Omit for all keys. */
  readonly apiKeyIds?: ReadonlyArray<string>;
  /** Whether OAuth-authenticated tasks (CLI, playground) deliver here. */
  readonly oauthEnabled?: boolean;
};

export const createWebhook = (client: ApiClient, body: WebhookBody): Promise<CreatedWebhook> =>
  client.fetch("webhook create", "/webhook", createdWebhook, { body });

export const updateWebhook = (
  client: ApiClient,
  id: string,
  body: WebhookBody,
): Promise<UpdatedWebhook> =>
  client.fetch("webhook update", `/webhook/${id}`, updatedWebhook, { method: "PUT", body });

export const deleteWebhook = (client: ApiClient, id: string): Promise<void> =>
  client.call("webhook delete", `/webhook/${id}`, { method: "DELETE" });
