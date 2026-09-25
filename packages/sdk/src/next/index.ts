import {
  handleWebhookRequest,
  type WebhookEventHandlers,
  type WebhookHandlerOptions,
} from "../webhooks/handler.ts";

export type MynthWebhookHandlerContext = {
  /** The original request received by the Next.js Route Handler. */
  request: Request;
  /**
   * The `X-Mynth-Delivery` ID. Every retry of a delivery repeats it, so store
   * it and skip IDs you have already handled.
   */
  deliveryId: string;
};

export type MynthWebhookEventHandlers = WebhookEventHandlers<MynthWebhookHandlerContext>;

export type MynthWebhookHandlerOptions = WebhookHandlerOptions;

/**
 * Create a Next.js App Router handler for signed Mynth webhooks.
 *
 * @example
 * ```ts
 * // app/api/mynth-webhook/route.ts
 * import { mynthWebhookHandler } from "@mynthio/sdk/next";
 *
 * export const POST = mynthWebhookHandler({
 *   imageTaskCompleted: async (payload, { deliveryId }) => {
 *     console.log(deliveryId, payload.task.id);
 *   },
 * });
 * ```
 */
export function mynthWebhookHandler(
  eventHandlers: MynthWebhookEventHandlers,
  options: MynthWebhookHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return (request) =>
    handleWebhookRequest(
      request,
      eventHandlers,
      (deliveryId) => ({ request, deliveryId }),
      options,
    );
}
