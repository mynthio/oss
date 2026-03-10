import type { GenericActionCtx } from "convex/server";

import type { MynthSDKTypes } from "../types";
import { tryToGetWebhookSecretFromEnv, verifySignature } from "./utils";

// Webhook header constants
const WEBHOOK_HEADERS_EVENT = "X-Mynth-Event";
const WEBHOOK_HEADERS_SIGNATURE = "X-Mynth-Signature";

/**
 * Event handlers for Mynth webhook events.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex generic requires any
export type EventHandlers<T extends GenericActionCtx<any> = GenericActionCtx<any>> = {
  /** Called when an image generation task completes successfully */
  imageTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageCompletedPayload,
    context: { context: T; request: Request },
  ) => Promise<void>;
  /** Called when an image generation task fails */
  imageTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageFailedPayload,
    context: { context: T; request: Request },
  ) => Promise<void>;
};

/**
 * Options for configuring the webhook action.
 */
export type MynthWebhookActionOptions = {
  /** Webhook secret for signature verification. Defaults to MYNTH_WEBHOOK_SECRET env var. */
  webhookSecret?: string;
};

/**
 * Creates a Convex HTTP action handler for Mynth webhooks.
 *
 * @param eventHandlers - Handlers for different webhook events
 * @param options - Configuration options
 * @returns A Convex HTTP action handler
 *
 * @example
 * ```typescript
 * // In convex/http.ts
 * import { mynthWebhookAction } from "@mynthio/sdk/convex";
 *
 * export const mynthWebhook = mynthWebhookAction({
 *   imageTaskCompleted: async (payload, { context }) => {
 *     await context.runMutation(internal.images.save, {
 *       taskId: payload.task.id,
 *       images: payload.result.images,
 *     });
 *   },
 *   imageTaskFailed: async (payload, { context }) => {
 *     console.error("Task failed:", payload.task.id);
 *   },
 * });
 * ```
 */
export const mynthWebhookAction = (
  eventHandlers: EventHandlers,
  options?: MynthWebhookActionOptions,
) => {
  const webhookSecret = options?.webhookSecret ?? tryToGetWebhookSecretFromEnv();

  if (!webhookSecret) {
    throw new Error(
      "MYNTH_WEBHOOK_SECRET is required. Either pass it as an option or set the environment variable.",
    );
  }

  // Return a function that matches PublicHttpAction signature
  return async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Convex generic requires any
    ctx: GenericActionCtx<any>,
    request: Request,
  ): Promise<Response> => {
    const signature = request.headers.get(WEBHOOK_HEADERS_SIGNATURE);

    if (!signature) {
      return new Response("Unauthorized", { status: 401 });
    }

    const event = request.headers.get(WEBHOOK_HEADERS_EVENT);

    if (!event) {
      return new Response("Unauthorized", { status: 401 });
    }

    const bodyRaw = await request.text();
    const isValid = await verifySignature(bodyRaw, signature, webhookSecret);

    if (!isValid) {
      return new Response("Unauthorized", { status: 401 });
    }

    const payload = JSON.parse(bodyRaw) as MynthSDKTypes.WebhookPayload;

    switch (payload.event) {
      case "task.image.completed":
        await eventHandlers.imageTaskCompleted?.(payload, {
          context: ctx,
          request,
        });
        break;
      case "task.image.failed":
        await eventHandlers.imageTaskFailed?.(payload, {
          context: ctx,
          request,
        });
        break;
      default:
        return new Response("Unauthorized", { status: 401 });
    }

    return new Response(undefined, { status: 200 });
  };
};
