import { httpActionGeneric, type GenericActionCtx, type PublicHttpAction } from "convex/server";

import {
  handleWebhookRequest,
  type WebhookEventHandlers,
  type WebhookHandlerOptions,
} from "../webhooks/handler.ts";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex generic requires any
type AnyActionCtx = GenericActionCtx<any>;

export type MynthWebhookActionContext<T extends AnyActionCtx = AnyActionCtx> = {
  /** The Convex action context, for `runQuery`, `runMutation`, and `scheduler`. */
  context: T;
  /** The request received by the Convex HTTP action. Its body has already been read. */
  request: Request;
  /**
   * The `X-Mynth-Delivery` ID. Every retry of a delivery repeats it, so store
   * it and skip IDs you have already handled.
   */
  deliveryId: string;
};

/**
 * Event handlers for Mynth webhook events.
 */
export type EventHandlers<T extends AnyActionCtx = AnyActionCtx> = WebhookEventHandlers<
  MynthWebhookActionContext<T>
>;

/**
 * Options for configuring the webhook action.
 */
export type MynthWebhookActionOptions = WebhookHandlerOptions;

/**
 * Create a Convex HTTP action for signed Mynth webhooks.
 *
 * @example
 * ```typescript
 * // convex/http.ts
 * import { httpRouter } from "convex/server";
 * import { mynthWebhookAction } from "@mynthio/sdk/convex";
 *
 * import { internal } from "./_generated/api";
 *
 * const http = httpRouter();
 *
 * http.route({
 *   path: "/mynth-webhook",
 *   method: "POST",
 *   handler: mynthWebhookAction({
 *     imageTaskCompleted: async (payload, { context }) => {
 *       await context.runMutation(internal.images.save, {
 *         taskId: payload.task.id,
 *         images: payload.result.images,
 *       });
 *     },
 *   }),
 * });
 *
 * export default http;
 * ```
 */
export function mynthWebhookAction(
  eventHandlers: EventHandlers,
  options: MynthWebhookActionOptions = {},
): PublicHttpAction {
  return httpActionGeneric((context, request) =>
    handleWebhookRequest(
      request,
      eventHandlers,
      (deliveryId) => ({ context, request, deliveryId }),
      options,
    ),
  );
}
