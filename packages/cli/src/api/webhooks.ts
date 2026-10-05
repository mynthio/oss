import type { ApiClient } from "./client.ts";
import {
  createdWebhook,
  updatedWebhook,
  type CreatedWebhook,
  type UpdatedWebhook,
} from "./schemas.ts";

/** `["all"]`, or the event names to subscribe to. */
export type WebhookEvents = ReadonlyArray<string>;

export type WebhookBody = {
  readonly enabled: boolean;
  readonly url: string;
  readonly events: WebhookEvents;
  /** Restricts deliveries to tasks created by these API keys. Omit for all keys. */
  readonly api_key_ids?: ReadonlyArray<string>;
  /** Whether tasks created without an API key (playground, OAuth sessions) deliver here. */
  readonly include_session_tasks?: boolean;
};

export const createWebhook = (client: ApiClient, body: WebhookBody): Promise<CreatedWebhook> =>
  client.fetch("webhook create", "/webhooks", createdWebhook, { body });

export const updateWebhook = (
  client: ApiClient,
  id: string,
  body: WebhookBody,
): Promise<UpdatedWebhook> =>
  client.fetch("webhook update", `/webhooks/${id}`, updatedWebhook, { method: "PUT", body });

export const deleteWebhook = (client: ApiClient, id: string): Promise<void> =>
  client.call("webhook delete", `/webhooks/${id}`, { method: "DELETE" });
