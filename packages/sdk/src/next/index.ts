import type { MynthSDKTypes } from "../types";
import { getWebhookSecretFromEnv, verifySignature } from "../webhooks/utils";

const WEBHOOK_EVENT_HEADER = "X-Mynth-Event";
const WEBHOOK_SIGNATURE_HEADER = "X-Mynth-Signature";
const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

export type MynthWebhookHandlerContext = {
  /** The original request received by the Next.js Route Handler. */
  request: Request;
};

export type MynthWebhookEventHandlers = {
  imageTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageCompletedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageFailedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageRateTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageRateCompletedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageRateTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageRateFailedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageAltTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageAltCompletedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageAltTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageAltFailedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageReviewTaskCompleted?: (
    payload: MynthSDKTypes.WebhookTaskImageReviewCompletedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
  imageReviewTaskFailed?: (
    payload: MynthSDKTypes.WebhookTaskImageReviewFailedPayload,
    context: MynthWebhookHandlerContext,
  ) => void | Promise<void>;
};

export type MynthWebhookHandlerOptions = {
  /** Defaults to MYNTH_WEBHOOK_SECRET at request time. */
  webhookSecret?: string;
};

type WebhookEnvelope = {
  event: string;
  task: { id: string };
};

/**
 * Create a Next.js App Router handler for signed Mynth webhooks.
 *
 * @example
 * ```ts
 * // app/api/mynth-webhook/route.ts
 * import { mynthWebhookHandler } from "@mynthio/sdk/next";
 *
 * export const POST = mynthWebhookHandler({
 *   imageTaskCompleted: async (payload, { request }) => {
 *     console.log(payload.task.id, request.url);
 *   },
 * });
 * ```
 */
export function mynthWebhookHandler(
  eventHandlers: MynthWebhookEventHandlers,
  options: MynthWebhookHandlerOptions = {},
): (request: Request) => Promise<Response> {
  return async (request) => {
    // Resolve the secret per request so Next.js builds do not require runtime secrets.
    const webhookSecret = options.webhookSecret ?? getWebhookSecretFromEnv();
    if (!webhookSecret) {
      throw new Error(
        "MYNTH_WEBHOOK_SECRET is required. Either pass it as an option or set the environment variable.",
      );
    }

    const event = request.headers.get(WEBHOOK_EVENT_HEADER);
    const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER);
    if (!event || !signature) return badRequest();

    const body = await request.text();
    const isValid = await verifySignature(
      body,
      signature,
      webhookSecret,
      SIGNATURE_TOLERANCE_SECONDS,
    );
    if (!isValid) return badRequest();

    const payload = parseEnvelope(body);
    if (!payload || payload.event !== event) return badRequest();

    const context = { request };

    switch (payload.event) {
      case "task.image.generate.completed":
        await eventHandlers.imageTaskCompleted?.(
          payload as MynthSDKTypes.WebhookTaskImageCompletedPayload,
          context,
        );
        break;
      case "task.image.generate.failed":
        await eventHandlers.imageTaskFailed?.(
          payload as MynthSDKTypes.WebhookTaskImageFailedPayload,
          context,
        );
        break;
      case "task.image.rate.completed":
        await eventHandlers.imageRateTaskCompleted?.(
          payload as MynthSDKTypes.WebhookTaskImageRateCompletedPayload,
          context,
        );
        break;
      case "task.image.rate.failed":
        await eventHandlers.imageRateTaskFailed?.(
          payload as MynthSDKTypes.WebhookTaskImageRateFailedPayload,
          context,
        );
        break;
      case "task.image.alt.completed":
        await eventHandlers.imageAltTaskCompleted?.(
          payload as MynthSDKTypes.WebhookTaskImageAltCompletedPayload,
          context,
        );
        break;
      case "task.image.alt.failed":
        await eventHandlers.imageAltTaskFailed?.(
          payload as MynthSDKTypes.WebhookTaskImageAltFailedPayload,
          context,
        );
        break;
      case "task.image.review.completed":
        await eventHandlers.imageReviewTaskCompleted?.(
          payload as MynthSDKTypes.WebhookTaskImageReviewCompletedPayload,
          context,
        );
        break;
      case "task.image.review.failed":
        await eventHandlers.imageReviewTaskFailed?.(
          payload as MynthSDKTypes.WebhookTaskImageReviewFailedPayload,
          context,
        );
        break;
    }

    return new Response("OK", { status: 200 });
  };
}

function parseEnvelope(body: string): WebhookEnvelope | null {
  try {
    const payload: unknown = JSON.parse(body);

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("event" in payload) ||
      typeof payload.event !== "string" ||
      !("task" in payload) ||
      typeof payload.task !== "object" ||
      payload.task === null ||
      !("id" in payload.task) ||
      typeof payload.task.id !== "string"
    ) {
      return null;
    }

    return payload as WebhookEnvelope;
  } catch {
    return null;
  }
}

function badRequest(): Response {
  return new Response("Bad Request", { status: 400 });
}
