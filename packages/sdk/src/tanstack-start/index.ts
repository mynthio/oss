import type { MynthSDKTypes } from "../types";
import {
  mynthWebhookHandler as createRequestHandler,
  type MynthWebhookHandlerOptions,
} from "../next";

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

export type MynthTanStackStartEventHandlers<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
> = {
  imageTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageCompletedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageFailedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageRateTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageRateCompletedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageRateTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageRateFailedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageAltTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageAltCompletedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageAltTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageAltFailedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageReviewTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageReviewCompletedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
  imageReviewTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageReviewFailedPayload,
    context: MynthTanStackStartHandlerContext<TContext, TParams>,
  ) => void | Promise<void>;
};

export type MynthTanStackStartHandlerOptions = MynthWebhookHandlerOptions;

/** Create a TanStack Start server route handler for signed Mynth webhooks. */
export function mynthWebhookHandler<
  TContext = unknown,
  TParams extends Record<string, string> = Record<string, string>,
>(
  eventHandlers: MynthTanStackStartEventHandlers<TContext, TParams>,
  options: MynthTanStackStartHandlerOptions = {},
): (context: MynthTanStackStartHandlerContext<TContext, TParams>) => Promise<Response> {
  return async (context) => {
    const handler = createRequestHandler(
      {
        imageTaskCompleted: (payload) => eventHandlers.imageTaskCompleted?.(payload, context),
        imageTaskFailed: (payload) => eventHandlers.imageTaskFailed?.(payload, context),
        imageRateTaskCompleted: (payload) =>
          eventHandlers.imageRateTaskCompleted?.(payload, context),
        imageRateTaskFailed: (payload) => eventHandlers.imageRateTaskFailed?.(payload, context),
        imageAltTaskCompleted: (payload) => eventHandlers.imageAltTaskCompleted?.(payload, context),
        imageAltTaskFailed: (payload) => eventHandlers.imageAltTaskFailed?.(payload, context),
        imageReviewTaskCompleted: (payload) =>
          eventHandlers.imageReviewTaskCompleted?.(payload, context),
        imageReviewTaskFailed: (payload) => eventHandlers.imageReviewTaskFailed?.(payload, context),
      },
      options,
    );

    return handler(context.request.clone());
  };
}
