import type { MynthSDKTypes } from "../types.ts";
import {
  handleWebhookRequest,
  type WebhookEventHandlers,
  type WebhookHandlerOptions,
} from "../webhooks/handler.ts";

export type MynthWebhookHandlerContext = {
  /** The original request received by the Next.js Route Handler. */
  request: Request;
  /**
   * The verified event. `event.id` is the `webhook-id`: every delivery of the
   * event repeats it, so store it and skip IDs you have already handled.
   */
  event: MynthSDKTypes.WebhookEvent;
};

export type MynthWebhookEventHandlers = WebhookEventHandlers<MynthWebhookHandlerContext>;

export type MynthWebhookHandlerOptions = WebhookHandlerOptions;

/**
 * Create a Next.js App Router handler for Mynth webhooks.
 *
 * @example
 * ```ts
 * // app/api/mynth-webhook/route.ts
 * import { mynthWebhookHandler } from "@mynthio/sdk/next";
 *
 * export const POST = mynthWebhookHandler({
 *   imageTaskCompleted: async (result, { event }) => {
 *     console.log(event.id, result.taskId);
 *   },
 * });
 * ```
 */
export function mynthWebhookHandler(
  eventHandlers: MynthWebhookEventHandlers,
  options: MynthWebhookHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return (request) =>
    handleWebhookRequest(request, eventHandlers, (event) => ({ request, event }), options);
}
