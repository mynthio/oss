import type { MynthSDKTypes } from "../types.ts";
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

/** What event callbacks receive: the route context plus the verified event. */
export type MynthTanStackStartEventContext<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = MynthTanStackStartHandlerContext<TContext, TParams> & {
  /**
   * The verified event. `event.id` is the `webhook-id`: every delivery of the
   * event repeats it, so store it and skip IDs you have already handled.
   */
  event: MynthSDKTypes.WebhookEvent;
};

export type MynthTanStackStartEventHandlers<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = WebhookEventHandlers<MynthTanStackStartEventContext<TContext, TParams>>;

export type MynthTanStackStartHandlerOptions = WebhookHandlerOptions;

/** Create a TanStack Start server route handler for Mynth webhooks. */
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
      (event) => ({ ...context, event }),
      options,
    );
}
