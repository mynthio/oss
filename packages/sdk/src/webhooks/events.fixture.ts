import type { MynthSDKTypes } from "../types.ts";
import type { WebhookEventHandlers } from "./handler.ts";

type WebhookEventType = MynthSDKTypes.WebhookEventType;

const image = {
  id: "img_1",
  url: null,
  mynth_url: "https://mynth.test/1.png",
  size: "1024x768",
  format: "png",
} as const;

const errors = [{ code: "provider_error", message: "The provider failed." }];

const generateRequest = {
  prompt: "A ceramic mug",
  count: 2,
  metadata: { productId: "sku_1" },
} as const;
const rateRequest = { url: "https://cdn.test/image.webp", mode: "nsfw_sfw" } as const;
const altRequest = { url: "https://cdn.test/image.webp" };
const reviewRequest = { url: "https://cdn.test/image.webp", effort: "high" } as const;
const removeBackgroundRequest = {
  url: "https://cdn.test/image.jpg",
  metadata: { productId: "sku_1" },
};
const upscaleRequest = {
  url: "https://cdn.test/image.jpg",
  size: "2x",
  effort: "low",
  metadata: { productId: "sku_1" },
} as const;
const videoRequest = {
  model: "prunaai/p-video",
  prompt: "A cat surfing",
  metadata: { productId: "sku_1" },
} as const;

/** The task fields every event's `data` carries, as `GET /tasks/{id}` returns them. */
const task = {
  user_id: "user_1",
  api_key_id: "ak_1",
  created_at: "2026-10-04T10:00:00.000Z",
  updated_at: "2026-10-04T10:00:12.000Z",
} as const;

function completed<TType extends MynthSDKTypes.TaskType>(
  type: TType,
  id: string,
  data: Omit<
    MynthSDKTypes.CompletedTaskData<TType>,
    keyof typeof task | "id" | "type" | "status" | "errors"
  >,
): MynthSDKTypes.WebhookEventOf<TType, "completed"> {
  return {
    id: `evt_${id}_completed`,
    type: `task.${type}.completed`,
    timestamp: task.updated_at,
    data: { id, type, status: "completed", errors: null, ...task, ...data },
  } as MynthSDKTypes.WebhookEventOf<TType, "completed">;
}

function failed<TType extends MynthSDKTypes.TaskType>(
  type: TType,
  id: string,
  request: MynthSDKTypes.FailedTaskData<TType>["request"],
): MynthSDKTypes.WebhookEventOf<TType, "failed"> {
  return {
    id: `evt_${id}_failed`,
    type: `task.${type}.failed`,
    timestamp: task.updated_at,
    data: { id, type, status: "failed", request, result: null, errors, cost: null, ...task },
  } as MynthSDKTypes.WebhookEventOf<TType, "failed">;
}

/** A valid event for every webhook event type, as Mynth sends it. */
export const WEBHOOK_EVENTS: {
  [TType in WebhookEventType]: Extract<MynthSDKTypes.WebhookEvent, { type: TType }>;
} = {
  "task.image.generate.completed": completed("image.generate", "tsk_generate", {
    request: generateRequest,
    cost: "0.03000000",
    result: {
      model: "black-forest-labs/flux.2-dev",
      images: [
        { status: "success", ...image },
        { status: "failed", error: errors[0]! },
      ],
    },
  }),
  "task.image.generate.failed": failed("image.generate", "tsk_generate", generateRequest),
  "task.image.rate.completed": completed("image.rate", "tsk_rate", {
    request: rateRequest,
    cost: "0.00020000",
    result: { level: "sfw" },
  }),
  "task.image.rate.failed": failed("image.rate", "tsk_rate", rateRequest),
  "task.image.alt.completed": completed("image.alt", "tsk_alt", {
    request: altRequest,
    cost: "0.00040000",
    result: { alt: "A ceramic mug on a table" },
  }),
  "task.image.alt.failed": failed("image.alt", "tsk_alt", altRequest),
  "task.image.review.completed": completed("image.review", "tsk_review", {
    request: reviewRequest,
    cost: "0.02000000",
    result: { score: 3, summary: "Clean.", findings: [], strengths: [] },
  }),
  "task.image.review.failed": failed("image.review", "tsk_review", reviewRequest),
  "task.image.remove_background.completed": completed(
    "image.remove_background",
    "tsk_remove_background",
    { request: removeBackgroundRequest, cost: "0.02000000", result: { image } },
  ),
  "task.image.remove_background.failed": failed(
    "image.remove_background",
    "tsk_remove_background",
    removeBackgroundRequest,
  ),
  "task.image.upscale.completed": completed("image.upscale", "tsk_upscale", {
    request: upscaleRequest,
    cost: "0.03000000",
    result: { image },
  }),
  "task.image.upscale.failed": failed("image.upscale", "tsk_upscale", upscaleRequest),
  "task.video.generate.completed": completed("video.generate", "tsk_video", {
    request: videoRequest,
    cost: "0.40500000",
    result: {
      model: "prunaai/p-video",
      videos: [
        {
          status: "success",
          id: "vid_1",
          url: "https://mynth.test/1.mp4",
          mynth_url: "https://mynth.test/1.mp4",
          cost: "0.40500000",
          duration: 5,
          resolution: "720p",
          audio: false,
        },
      ],
    },
  }),
  "task.video.generate.failed": failed("video.generate", "tsk_video", videoRequest),
};

/** Every webhook event type with the callback name the framework helpers accept. */
export const WEBHOOK_HANDLER_NAMES: readonly (readonly [
  WebhookEventType,
  Exclude<keyof WebhookEventHandlers<unknown>, "onEvent">,
])[] = [
  ["task.image.generate.completed", "imageTaskCompleted"],
  ["task.image.generate.failed", "imageTaskFailed"],
  ["task.image.rate.completed", "imageRateTaskCompleted"],
  ["task.image.rate.failed", "imageRateTaskFailed"],
  ["task.image.alt.completed", "imageAltTaskCompleted"],
  ["task.image.alt.failed", "imageAltTaskFailed"],
  ["task.image.review.completed", "imageReviewTaskCompleted"],
  ["task.image.review.failed", "imageReviewTaskFailed"],
  ["task.image.remove_background.completed", "imageRemoveBackgroundTaskCompleted"],
  ["task.image.remove_background.failed", "imageRemoveBackgroundTaskFailed"],
  ["task.image.upscale.completed", "imageUpscaleTaskCompleted"],
  ["task.image.upscale.failed", "imageUpscaleTaskFailed"],
  ["task.video.generate.completed", "videoTaskCompleted"],
  ["task.video.generate.failed", "videoTaskFailed"],
];

/** A `whsec_` secret, as the API issues one. */
export const WEBHOOK_SECRET = "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw";

/** Signs a body the way Mynth does, for tests: Standard Webhooks `v1`. */
export async function signWebhook(
  body: string,
  id: string,
  timestamp: number = Math.floor(Date.now() / 1000),
  secret: string = WEBHOOK_SECRET,
): Promise<string> {
  const keyBytes = Uint8Array.from(atob(secret.replace(/^whsec_/, "")), (char) =>
    char.charCodeAt(0),
  );
  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );

  return `v1,${btoa(String.fromCharCode(...new Uint8Array(signature)))}`;
}

/** A webhook request carrying `event`, signed unless `signed` is false. */
export async function webhookRequest(
  event: { id: string },
  {
    url = "https://example.com/mynth-webhook",
    signed = true,
    timestamp = Math.floor(Date.now() / 1000),
    secret = WEBHOOK_SECRET,
    body = JSON.stringify(event),
  }: {
    url?: string;
    signed?: boolean;
    timestamp?: number;
    secret?: string;
    body?: string;
  } = {},
): Promise<Request> {
  return new Request(url, {
    method: "POST",
    headers: {
      "webhook-id": event.id,
      "webhook-timestamp": String(timestamp),
      ...(signed
        ? { "webhook-signature": await signWebhook(body, event.id, timestamp, secret) }
        : {}),
    },
    body,
  });
}
