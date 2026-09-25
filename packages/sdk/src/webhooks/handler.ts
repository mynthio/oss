import type { MynthSDKTypes } from "../types.ts";
import { getWebhookSecretFromEnv, verifySignature } from "./utils.ts";

const WEBHOOK_EVENT_HEADER = "X-Mynth-Event";
const WEBHOOK_DELIVERY_HEADER = "X-Mynth-Delivery";
const WEBHOOK_SIGNATURE_HEADER = "X-Mynth-Signature";

/** Maps every webhook event to the callback name the framework helpers accept. */
const EVENT_HANDLER_NAMES = {
  "task.image.generate.completed": "imageTaskCompleted",
  "task.image.generate.failed": "imageTaskFailed",
  "task.image.rate.completed": "imageRateTaskCompleted",
  "task.image.rate.failed": "imageRateTaskFailed",
  "task.image.alt.completed": "imageAltTaskCompleted",
  "task.image.alt.failed": "imageAltTaskFailed",
  "task.image.review.completed": "imageReviewTaskCompleted",
  "task.image.review.failed": "imageReviewTaskFailed",
  "task.image.remove_background.completed": "imageRemoveBackgroundTaskCompleted",
  "task.image.remove_background.failed": "imageRemoveBackgroundTaskFailed",
  "task.video.generate.completed": "videoTaskCompleted",
  "task.video.generate.failed": "videoTaskFailed",
} as const;

// Indexing EVENT_HANDLER_NAMES with every payload event below is what fails to
// compile when a new event has no handler name.
type WebhookEvent = MynthSDKTypes.WebhookPayload["event"];

/** Event callbacks shared by every framework helper, keyed by handler name. */
export type WebhookEventHandlers<TContext> = {
  [TEvent in WebhookEvent as (typeof EVENT_HANDLER_NAMES)[TEvent]]?: (
    payload: Extract<MynthSDKTypes.WebhookPayload, { event: TEvent }>,
    context: TContext,
  ) => void | Promise<void>;
};

export type WebhookHandlerOptions = {
  /** Defaults to MYNTH_WEBHOOK_SECRET, read when each request arrives. */
  webhookSecret?: string;
};

type AnyWebhookEventHandler<TContext> = (
  payload: MynthSDKTypes.WebhookPayload,
  context: TContext,
) => void | Promise<void>;

/**
 * Verify a signed Mynth webhook request and dispatch it to the matching callback.
 *
 * Answers `400` for a missing delivery ID, a missing or invalid signature, a
 * stale timestamp, a malformed body, or an `X-Mynth-Event` header that does
 * not match the body.
 * Answers `200` for signed events without a callback. Callback errors
 * propagate, so the framework answers `5xx` and Mynth retries the delivery.
 */
export async function handleWebhookRequest<TContext>(
  request: Request,
  eventHandlers: WebhookEventHandlers<TContext>,
  createContext: (deliveryId: string) => TContext,
  options: WebhookHandlerOptions,
): Promise<Response> {
  // Resolve the secret per request: build steps and deploy-time analysis run without runtime secrets.
  const webhookSecret = options.webhookSecret ?? getWebhookSecretFromEnv();
  if (!webhookSecret) {
    throw new Error(
      "MYNTH_WEBHOOK_SECRET is required. Either pass it as an option or set the environment variable.",
    );
  }

  const event = request.headers.get(WEBHOOK_EVENT_HEADER);
  const deliveryId = request.headers.get(WEBHOOK_DELIVERY_HEADER);
  const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER);
  if (!event || !deliveryId || !signature) return badRequest();

  // Verify the exact bytes that were signed; decoding to a string first could alter them.
  const body = new Uint8Array(await request.arrayBuffer());
  const isValid = await verifySignature(body, signature, webhookSecret);
  if (!isValid) return badRequest();

  const payload = parsePayload(body);
  if (!payload || payload.event !== event) return badRequest();

  // Signed events newer than this SDK are acknowledged so Mynth does not retry them.
  if (!Object.hasOwn(EVENT_HANDLER_NAMES, payload.event)) return ok();

  const handlerName = EVENT_HANDLER_NAMES[payload.event];
  const handler = eventHandlers[handlerName] as AnyWebhookEventHandler<TContext> | undefined;
  await handler?.(payload, createContext(deliveryId));

  return ok();
}

function parsePayload(body: Uint8Array): MynthSDKTypes.WebhookPayload | null {
  let payload: unknown;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return null;
  }

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

  return payload as MynthSDKTypes.WebhookPayload;
}

function ok(): Response {
  return new Response("OK", { status: 200 });
}

function badRequest(): Response {
  return new Response("Bad Request", { status: 400 });
}
