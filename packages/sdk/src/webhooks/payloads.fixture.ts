import type { MynthSDKTypes } from "../types.ts";
import type { WebhookEventHandlers } from "./handler.ts";

type WebhookEvent = MynthSDKTypes.WebhookPayload["event"];

const image = {
  id: "img_1",
  url: null,
  mynth_url: "https://mynth.test/1.png",
  size: "1024x768",
  format: "png",
} as const;

const errors = [{ code: "PROVIDER_ERROR", message: "The provider failed." }];

const generateRequest = { prompt: "A ceramic mug", metadata: { productId: "sku_1" } };
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

/** A valid payload for every webhook event, as Mynth signs and sends it. */
export const WEBHOOK_PAYLOADS: {
  [TEvent in WebhookEvent]: Extract<MynthSDKTypes.WebhookPayload, { event: TEvent }>;
} = {
  "task.image.generate.completed": {
    event: "task.image.generate.completed",
    task: { id: "tsk_generate", cost: "0.03000000" },
    request: generateRequest,
    result: {
      model: "black-forest-labs/flux.2-dev",
      images: [
        { status: "success", ...image },
        { status: "failed", error: errors[0]! },
      ],
    },
  },
  "task.image.generate.failed": {
    event: "task.image.generate.failed",
    task: { id: "tsk_generate" },
    request: generateRequest,
    errors,
  },
  "task.image.rate.completed": {
    event: "task.image.rate.completed",
    task: { id: "tsk_rate", cost: "0.00020000" },
    request: rateRequest,
    result: { level: "sfw" },
  },
  "task.image.rate.failed": {
    event: "task.image.rate.failed",
    task: { id: "tsk_rate" },
    request: rateRequest,
    errors,
  },
  "task.image.alt.completed": {
    event: "task.image.alt.completed",
    task: { id: "tsk_alt", cost: "0.00040000" },
    request: altRequest,
    result: { alt: "A ceramic mug on a table" },
  },
  "task.image.alt.failed": {
    event: "task.image.alt.failed",
    task: { id: "tsk_alt" },
    request: altRequest,
    errors,
  },
  "task.image.review.completed": {
    event: "task.image.review.completed",
    task: { id: "tsk_review", cost: "0.02000000" },
    request: reviewRequest,
    result: { score: 3, summary: "Clean.", findings: [], strengths: [] },
  },
  "task.image.review.failed": {
    event: "task.image.review.failed",
    task: { id: "tsk_review" },
    request: reviewRequest,
    errors,
  },
  "task.image.remove_background.completed": {
    event: "task.image.remove_background.completed",
    task: { id: "tsk_remove_background", cost: "0.02000000" },
    request: removeBackgroundRequest,
    result: { image },
  },
  "task.image.remove_background.failed": {
    event: "task.image.remove_background.failed",
    task: { id: "tsk_remove_background" },
    request: removeBackgroundRequest,
    errors,
  },
  "task.image.upscale.completed": {
    event: "task.image.upscale.completed",
    task: { id: "tsk_upscale", cost: "0.03000000" },
    request: upscaleRequest,
    result: { image },
  },
  "task.image.upscale.failed": {
    event: "task.image.upscale.failed",
    task: { id: "tsk_upscale" },
    request: upscaleRequest,
    errors,
  },
  "task.video.generate.completed": {
    event: "task.video.generate.completed",
    task: { id: "tsk_video", cost: "0.40500000" },
    request: videoRequest,
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
  },
  "task.video.generate.failed": {
    event: "task.video.generate.failed",
    task: { id: "tsk_video" },
    request: videoRequest,
    errors,
  },
};

/** Every webhook event with the callback name the framework helpers accept. */
export const WEBHOOK_HANDLER_NAMES: readonly (readonly [
  WebhookEvent,
  keyof WebhookEventHandlers<unknown>,
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
