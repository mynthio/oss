import {
  handleWebhookRequest,
  type WebhookEventHandlers,
  type WebhookHandlerOptions,
} from "../webhooks/handler.ts";

export type MynthTanStackStartHandlerContext<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = {
  /** The original, unread request received by the TanStack Start server route. */
  request: Request;
  /** Dynamic parameters for the matched route. */
  params: TParams;
  /** Context provided by TanStack Start request middleware. */
  context: TContext;
};

/** What event callbacks receive: the route context plus the delivery ID. */
export type MynthTanStackStartEventContext<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = MynthTanStackStartHandlerContext<TContext, TParams> & {
  /**
   * The `X-Mynth-Delivery` ID. Every retry of a delivery repeats it, so store
   * it and skip IDs you have already handled.
   */
  deliveryId: string;
};

export type MynthTanStackStartEventHandlers<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = WebhookEventHandlers<MynthTanStackStartEventContext<TContext, TParams>>;

export type MynthTanStackStartHandlerOptions = WebhookHandlerOptions;

/** Create a TanStack Start server route handler for signed Mynth webhooks. */
export function mynthWebhookHandler<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
>(
  eventHandlers: MynthTanStackStartEventHandlers<TContext, TParams>,
  options: MynthTanStackStartHandlerOptions = {},
): (context: MynthTanStackStartHandlerContext<TContext, TParams>) => Promise<Response> {
  // Verify a clone so callbacks still receive the original, unread request.
  return (context) =>
    handleWebhookRequest(
      context.request.clone(),
      eventHandlers,
      (deliveryId) => ({ ...context, deliveryId }),
      options,
    );
}
