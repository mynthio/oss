import { type ImageAltResult, toImageAltResult } from "../image-alt-result.ts";
import { type ImageGenerationResult, toImageGenerationResult } from "../image-generation-result.ts";
import { type ImageRateResult, toImageRateResult } from "../image-rate-result.ts";
import {
  type ImageRemoveBackgroundResult,
  toImageRemoveBackgroundResult,
} from "../image-remove-background-result.ts";
import { type ImageReviewResult, toImageReviewResult } from "../image-review-result.ts";
import { type ImageUpscaleResult, toImageUpscaleResult } from "../image-upscale-result.ts";
import {
  completedTaskFromWebhook,
  type MynthTaskFailure,
  taskFailureFromWebhook,
} from "../task-result.ts";
import type { MynthSDKTypes } from "../types.ts";
import { toVideoGenerationResult, type VideoGenerationResult } from "../video-generation-result.ts";
import {
  getWebhookSecretFromEnv,
  parseWebhookEvent,
  verifySignature,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
} from "./utils.ts";

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
  "task.image.upscale.completed": "imageUpscaleTaskCompleted",
  "task.image.upscale.failed": "imageUpscaleTaskFailed",
  "task.video.generate.completed": "videoTaskCompleted",
  "task.video.generate.failed": "videoTaskFailed",
} as const;

// Indexing EVENT_HANDLER_NAMES and WebhookEventArguments with every event type
// below is what fails to compile when a new event is not wired up.
type WebhookEventType = MynthSDKTypes.WebhookEventType;

type WebhookEventOfType<TType extends WebhookEventType> = Extract<
  MynthSDKTypes.WebhookEvent,
  { type: TType }
>;

/**
 * What each event's callback receives: the same result that polling returns,
 * or a {@link MynthTaskFailure}.
 */
type WebhookEventArguments = {
  "task.image.generate.completed": ImageGenerationResult;
  "task.image.generate.failed": MynthTaskFailure<MynthSDKTypes.ImageGenerationRequest>;
  "task.image.rate.completed": ImageRateResult<string>;
  "task.image.rate.failed": MynthTaskFailure<MynthSDKTypes.ImageRateRequest>;
  "task.image.alt.completed": ImageAltResult;
  "task.image.alt.failed": MynthTaskFailure<MynthSDKTypes.ImageAltRequest>;
  "task.image.review.completed": ImageReviewResult;
  "task.image.review.failed": MynthTaskFailure<MynthSDKTypes.ImageReviewRequest>;
  "task.image.remove_background.completed": ImageRemoveBackgroundResult;
  "task.image.remove_background.failed": MynthTaskFailure<MynthSDKTypes.ImageRemoveBackgroundRequest>;
  "task.image.upscale.completed": ImageUpscaleResult;
  "task.image.upscale.failed": MynthTaskFailure<MynthSDKTypes.ImageUpscaleRequest>;
  "task.video.generate.completed": VideoGenerationResult;
  "task.video.generate.failed": MynthTaskFailure<MynthSDKTypes.VideoGenerationRequest>;
};

/** Builds each event's callback argument from the event. */
const EVENT_ARGUMENTS: {
  [TType in WebhookEventType]: (event: WebhookEventOfType<TType>) => WebhookEventArguments[TType];
} = {
  "task.image.generate.completed": (event) =>
    toImageGenerationResult(completedTaskFromWebhook(event)),
  "task.image.generate.failed": (event) => ({
    ...taskFailureFromWebhook(event),
    metadata: event.data.request.metadata,
  }),
  "task.image.rate.completed": (event) =>
    toImageRateResult<string>(completedTaskFromWebhook(event)),
  "task.image.rate.failed": taskFailureFromWebhook,
  "task.image.alt.completed": (event) => toImageAltResult(completedTaskFromWebhook(event)),
  "task.image.alt.failed": taskFailureFromWebhook,
  "task.image.review.completed": (event) => toImageReviewResult(completedTaskFromWebhook(event)),
  "task.image.review.failed": taskFailureFromWebhook,
  "task.image.remove_background.completed": (event) =>
    toImageRemoveBackgroundResult(completedTaskFromWebhook(event)),
  "task.image.remove_background.failed": (event) => ({
    ...taskFailureFromWebhook(event),
    metadata: event.data.request.metadata,
  }),
  "task.image.upscale.completed": (event) => toImageUpscaleResult(completedTaskFromWebhook(event)),
  "task.image.upscale.failed": (event) => ({
    ...taskFailureFromWebhook(event),
    metadata: event.data.request.metadata,
  }),
  "task.video.generate.completed": (event) =>
    toVideoGenerationResult(completedTaskFromWebhook(event)),
  "task.video.generate.failed": (event) => ({
    ...taskFailureFromWebhook(event),
    metadata: event.data.request.metadata,
  }),
};

/**
 * Event callbacks shared by every framework helper, keyed by handler name,
 * and `onEvent`, which receives every event, including types newer than this
 * SDK, before its typed callback runs. `TContext` carries the verified event:
 * deduplicate on `event.id`, which every delivery repeats.
 */
export type WebhookEventHandlers<TContext> = {
  [TType in WebhookEventType as (typeof EVENT_HANDLER_NAMES)[TType]]?: (
    argument: WebhookEventArguments[TType],
    context: TContext,
  ) => void | Promise<void>;
} & {
  onEvent?: (event: MynthSDKTypes.WebhookEvent, context: TContext) => void | Promise<void>;
};

export type WebhookHandlerOptions = {
  /** Defaults to MYNTH_WEBHOOK_SECRET, read when each request arrives. */
  webhookSecret?: string;
  /**
   * Accept unsigned deliveries: a custom webhook URL set on the request.
   * Signatures are not checked at all; `verify` decides instead, usually by
   * checking a secret token you put in the URL. Answers `401` when it returns
   * `false`. Without this, an unsigned delivery answers `400`.
   */
  unsigned?: {
    verify: (request: Request) => boolean | Promise<boolean>;
  };
};

type AnyWebhookEventHandler<TContext> = (
  argument: unknown,
  context: TContext,
) => void | Promise<void>;

/**
 * Verify a Mynth webhook request and dispatch its event to the matching callback.
 *
 * Signed deliveries (registered webhooks) answer `400` for a missing header, a
 * missing or invalid signature, a timestamp more than five minutes off, a
 * malformed body, or a body `id` other than `webhook-id`. Unsigned deliveries
 * (custom URLs) are accepted only with the `unsigned` option, and answer `401`
 * when its `verify` refuses them.
 *
 * Answers `200` for events without a callback, including event types newer
 * than this SDK. Callback errors, and events that do not build into a result,
 * propagate, so the framework answers `5xx` and Mynth retries the delivery.
 */
export async function handleWebhookRequest<TContext>(
  request: Request,
  eventHandlers: WebhookEventHandlers<TContext>,
  createContext: (event: MynthSDKTypes.WebhookEvent) => TContext,
  options: WebhookHandlerOptions,
): Promise<Response> {
  const id = request.headers.get(WEBHOOK_ID_HEADER);
  const timestamp = request.headers.get(WEBHOOK_TIMESTAMP_HEADER);
  if (!id || !timestamp) return badRequest();

  // Verify the exact bytes that were signed; decoding to a string first could alter them.
  const body = new Uint8Array(await request.arrayBuffer());

  if (options.unsigned) {
    if (!(await options.unsigned.verify(request))) return unauthorized();
  } else {
    // Resolve the secret per request: build steps and deploy-time analysis run without runtime secrets.
    const secret = options.webhookSecret ?? getWebhookSecretFromEnv();
    if (!secret) {
      throw new Error(
        "MYNTH_WEBHOOK_SECRET is required. Either pass it as an option or set the environment variable.",
      );
    }

    const signature = request.headers.get(WEBHOOK_SIGNATURE_HEADER);
    if (!signature) return badRequest();

    if (!(await verifySignature({ id, timestamp, signature, body, secret }))) {
      return badRequest();
    }
  }

  const event = parseWebhookEvent(body, id);
  if (!event) return badRequest();

  const context = createContext(event);

  await eventHandlers.onEvent?.(event, context);

  // Events newer than this SDK are acknowledged so Mynth does not retry them.
  if (!Object.hasOwn(EVENT_HANDLER_NAMES, event.type)) return ok();

  const handlerName = EVENT_HANDLER_NAMES[event.type];
  const handler = eventHandlers[handlerName] as AnyWebhookEventHandler<TContext> | undefined;
  if (!handler) return ok();

  // Built only for events with a callback, so an event nobody handles cannot fail the delivery.
  const toArgument = EVENT_ARGUMENTS[event.type] as (event: MynthSDKTypes.WebhookEvent) => unknown;
  await handler(toArgument(event), context);

  return ok();
}

function ok(): Response {
  return new Response("OK", { status: 200 });
}

function badRequest(): Response {
  return new Response("Bad Request", { status: 400 });
}

function unauthorized(): Response {
  return new Response("Unauthorized", { status: 401 });
}
