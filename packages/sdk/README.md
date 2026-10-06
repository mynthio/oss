# @mynthio/sdk

Official SDK for the [Mynth](https://mynth.io) image and video API.

The SDK gives you a typed `Mynth` client, temporary image uploads, sync and async image generation and analysis flows, video generation, model metadata, and webhook helpers for Next.js, TanStack Start, and Convex.

## Installation

```bash
# Bun
bun add @mynthio/sdk

# pnpm
pnpm add @mynthio/sdk

# npm
npm install @mynthio/sdk

# yarn
yarn add @mynthio/sdk
```

## Quick Start

Set your API key:

```env
MYNTH_API_KEY=mak_...
```

Create a client:

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth();
```

Generate an image:

```ts
const task = await mynth.image.generate({
  prompt: "A fox in a neon-lit city at night",
});

console.log(task.taskId);
console.log(task.urls);
console.log(task.model);
```

If you omit `model` and `size`, Mynth resolves them automatically. `generate()` waits for completion and returns a completed task.

## Client Options

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth({
  apiKey: process.env.MYNTH_API_KEY,
  baseUrl: "https://api.mynth.io",
});
```

- `apiKey`: required for image generation and analysis unless `MYNTH_API_KEY` is set; not required for the public model catalog
- `baseUrl`: optional override for proxies or tests

## Generate vs Generate Async

### Generate

`generate()` polls until the task is completed.

```ts
const task = await mynth.image.generate({
  prompt: "Editorial product photo of a matte black coffee grinder",
  model: "black-forest-labs/flux.2-dev",
});

console.log(task.images[0]?.width); // 1024
console.log(task.urls);
```

### Generate Async

Use `generateAsync()` when you want to trigger work now and fetch the final task later.

```ts
const taskAsync = await mynth.image.generateAsync({
  prompt: "A cinematic fantasy castle on a cliff",
  model: "google/gemini-3.1-flash-image",
  generate_public_access_token: true,
});

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken);

const completedTask = await taskAsync.wait();
console.log(completedTask.urls);
```

`taskAsync.access.publicAccessToken` is set when the request asks for it with `generate_public_access_token: true`. It is safe to send to the client: it is scoped to that single task, so you can poll task state from the browser without exposing your API key or building your own polling proxy.

You can use it as a Bearer token against:

- `GET /tasks/:id/status`
- `GET /tasks/:id/result`

Example:

```ts
const taskAsync = await mynth.image.generateAsync({
  prompt: "A cinematic fantasy castle on a cliff",
  model: "google/gemini-3.1-flash-image",
  generate_public_access_token: true,
});

const taskId = taskAsync.id;
const pat = taskAsync.access.publicAccessToken;

const status = await fetch(`https://api.mynth.io/tasks/${taskId}/status`, {
  headers: {
    Authorization: `Bearer ${pat}`,
  },
})
  .then((res) => res.json())
  .then((body) => body.data);

if (status.status === "completed") {
  const taskResult = await fetch(`https://api.mynth.io/tasks/${taskId}/result`, {
    headers: {
      Authorization: `Bearer ${pat}`,
    },
  })
    .then((res) => res.json())
    .then((body) => body.data);

  console.log(taskResult.result.images);
}
```

### Cancelling

Pass an `AbortSignal` to stop waiting, for example when the incoming request disconnects:

```ts
const task = await mynth.image.generate(
  { prompt: "A lighthouse in a storm" },
  { signal: AbortSignal.timeout(60_000) },
);

// Or on an async task:
const completedTask = await taskAsync.wait({ signal: request.signal });
```

An abort cancels pending uploads and API requests and stops polling, and the call rejects with the signal's reason. A task that was already created keeps running on Mynth. For `generateAsync()`, the signal covers the upload and the create request; pass one to `wait()` to abort the wait. When several `wait()` calls share a task, polling stops only after every one of them has aborted.

## Request Shape

`generate()` accepts a typed `ImageGenerationRequest`. The simplest request is just a prompt:

```ts
await mynth.image.generate({
  prompt: "A cozy cabin in a snowy pine forest",
});
```

You can also pass structured options:

```ts
const task = await mynth.image.generate({
  prompt: "Studio portrait of a futuristic fashion model",
  negative_prompt: "blurry, low detail",
  magic_prompt: true,
  model: "google/gemini-3-pro-image-preview",
  size: {
    type: "aspect_ratio",
    aspect_ratio: "4:5",
  },
  count: 2,
  output: {
    format: "webp",
  },
  webhook: {
    registered: false,
    custom: [{ url: "https://your-app.com/api/mynth-webhook?token=your-secret-token" }],
  },
  generate_public_access_token: true,
  rating: {
    mode: "custom",
    levels: [
      { value: "safe", description: "Safe for all audiences" },
      { value: "sensitive", description: "Contains mature or suggestive content" },
    ],
  },
  inputs: [
    "https://example.com/reference-1.jpg",
    {
      type: "image",
      source: {
        type: "url",
        url: "https://example.com/reference-2.jpg",
      },
    },
  ],
  metadata: {
    generationId: "gen_123",
    userId: "user_123",
  },
});
```

Request fields are the API's own, in snake_case, and the API rejects a field it does not know. `generate_public_access_token` asks for a short-lived Public Access Token for browser-side polling, as `taskAsync.access.publicAccessToken`. It defaults to `false`.

`webhook.registered: false` skips the webhooks registered on your account for this task. `webhook.custom` sends this task's events to other URLs, unsigned: use https and a public host, and put a secret token in the URL so your handler can check it (see [Unsigned custom webhooks](#unsigned-custom-webhooks)). Mynth only ever shows `scheme://host` of a custom URL back.

`output` is optional. Set `output.format` to `png`, `jpg`, or `webp`. When it is omitted, the result keeps the format the provider delivered.

## Upload Images

Use `upload()` to store local or downloaded images temporarily, then pass the returned URLs to `inputs`:

```ts
const { urls } = await mynth.image.upload(file);

await mynth.image.generate({
  prompt: "Turn this product photo into a studio campaign image",
  inputs: urls,
});
```

`upload()` accepts one `File`/`Blob` or an array of `File`/`Blob` inputs.

```ts
await mynth.image.upload(file);
await mynth.image.upload(await response.blob());
```

The API accepts JPEG, PNG, and WebP images.

## Prompt Options

`prompt` is the positive text prompt. Use `negative_prompt` for exclusions and `magic_prompt: true` to ask Mynth to enhance the prompt before generation.

```ts
await mynth.image.generate({
  prompt: "A luxury watch on a marble pedestal",
  negative_prompt: "text, watermark",
  magic_prompt: true,
});
```

## Size Options

`size` supports:

- presets such as `"square"`, `"portrait"`, `"landscape"`, `"portrait_tall"`, `"landscape_wide"`, and the explicit aspect-ratio preset IDs
- `"auto"`
- structured auto objects
- structured aspect-ratio objects with an optional `scale: "4k"`

Supported aspect ratios:

- `"1:1"`
- `"2:3"`
- `"3:2"`
- `"3:4"`
- `"4:3"`
- `"4:5"`
- `"5:4"`
- `"9:16"`
- `"16:9"`
- `"21:9"`
- `"2:1"`
- `"1:2"`

Use `scale: "4k"` when you want the higher tier and the model supports it.

Examples:

```ts
size: "landscape";
size: "auto";
size: { type: "aspect_ratio", aspect_ratio: "16:9" };
size: { type: "aspect_ratio", aspect_ratio: "4:5", scale: "4k" };
size: { type: "auto" };
```

## Input Images

Use `inputs` to send input images:

```ts
inputs: [
  "https://example.com/input-image.jpg",
  {
    type: "image",
    source: {
      type: "url",
      url: "https://example.com/reference-image.jpg",
    },
  },
];
```

String URLs are a shorthand for image inputs. Structured inputs use `type` and `source`.

Structured inputs can declare a role with `as` to guide the model. Valid values are
`"auto"` (default), `"source"`, and `"reference"`. Unified models such as Luma UNI-1 split
inputs by the declared role: `"source"` is the image being transformed or edited, and
`"reference"` is guidance only (style, character, composition). A request where every
input is `"reference"` runs as text-to-image guided by those references; any `"source"`
(or an untagged input, which defaults to the source) makes it an edit.

```ts
inputs: [
  { type: "image", as: "source", source: { type: "url", url: "https://.../product.png" } },
  { type: "image", as: "reference", source: { type: "url", url: "https://.../style.png" } },
];
```

## Rating

Enable per-image content rating during generation with `rating`.

Rating labels describe detected content. They do not override the [Mynth Terms of Service](https://mynth.io/legal/terms) or permit otherwise prohibited generation.

```ts
const task = await mynth.image.generate({
  prompt: "A fashion editorial image",
  rating: true, // same result levels as { mode: "nsfw_sfw" }
});

const rating = task.images[0]?.rating;

if (rating?.status === "success") {
  console.log(rating.level); // "sfw" | "nsfw"
}
```

For custom labels, pass at least two and at most seven levels:

```ts
const task = await mynth.image.generate({
  prompt: "A movie poster",
  rating: {
    mode: "custom",
    levels: [
      { value: "general", description: "Appropriate for all audiences" },
      { value: "teen", description: "Mild mature themes" },
      { value: "adult", description: "Adult-oriented content" },
    ] as const,
  },
});

const rating = task.images[0]?.rating;

if (rating?.status === "success") {
  console.log(rating.level); // "general" | "teen" | "adult"
}
```

You can also rate an existing image URL (mode defaults to `nsfw_sfw`):

```ts
const result = await mynth.image.rate({
  url: "https://example.com/image.webp",
});

console.log(result.taskId);
console.log(result.level); // "sfw" | "nsfw"
```

Use `rateAsync()` when you want to create the rating task now and wait later:

```ts
const taskAsync = await mynth.image.rateAsync({
  url: "https://example.com/image.webp",
});

console.log(taskAsync.id);

const result = await taskAsync.wait();
console.log(result.level);
```

## Alt Text

Generate short alt text for an existing image URL:

```ts
const result = await mynth.image.alt({
  url: "https://example.com/image.webp",
});

console.log(result.taskId);
console.log(result.alt);
```

Use `altAsync()` when you want to create the alt text task now and wait later:

```ts
const taskAsync = await mynth.image.altAsync({
  url: "https://example.com/image.webp",
});

console.log(taskAsync.id);

const result = await taskAsync.wait();
console.log(result.alt);
```

## Image Review

Review an existing image with a multi-model quality panel:

```ts
const result = await mynth.image.review({
  url: "https://example.com/image.webp",
});

console.log(result.score); // 1–4, higher is better
console.log(result.summary);
console.log(result.findings);
console.log(result.strengths);
```

Review effort defaults to `high`. Use `low` for a faster, cheaper triage panel:

```ts
const result = await mynth.image.review({
  file,
  effort: "low",
});
```

Use `reviewAsync()` to create the task without waiting for completion:

```ts
const taskAsync = await mynth.image.reviewAsync({
  url: "https://example.com/image.webp",
});

const result = await taskAsync.wait();
console.log(result.summary);
```

## Remove Background

Remove the background from an existing image. Mynth picks the model, so there is no `model` field:

```ts
const result = await mynth.image.removeBackground({
  url: "https://example.com/product.jpg",
});

console.log(result.image.url); // transparent image
console.log(result.image.format); // "png" | "webp"
```

The result keeps the format the provider returned. Set `output.format` to always get `png` or `webp`.
`removeBackground()` also takes a local `file`, plus `destination`, `webhook`, and `metadata` like `generate()`:

```ts
const result = await mynth.image.removeBackground({
  file,
  output: { format: "webp" },
  destination: "bunny-prod",
  metadata: { productId: "sku_1" },
});

console.log(result.metadata.productId);
```

Use `removeBackgroundAsync()` to create the task without waiting. Like `generateAsync()`, it returns a public access token when you ask for one:

```ts
const taskAsync = await mynth.image.removeBackgroundAsync({
  url: "https://example.com/product.jpg",
  generate_public_access_token: true,
});

return { id: taskAsync.id, access: taskAsync.access };
```

## Upscale

Enlarge an existing image 2x or 4x. Mynth picks the model, so there is no `model` field. `size` and `effort` are both required:

```ts
const result = await mynth.image.upscale({
  url: "https://example.com/product.jpg",
  size: "2x",
  effort: "low",
});

console.log(result.image.url); // upscaled image
console.log(result.image.width, result.image.height); // e.g. 2048 1536
```

`effort` sets the price: `low` is fast and sharp, `high` rebuilds fine detail such as small text and faces. `size` is `"2x"` or `"4x"`, or `{ type: "scale", factor: 2 | 4 }`. The upscaled image can be at most 4096x4096 pixels; a larger request fails with `output_too_large` and is not charged.

The result keeps the format the provider returned. Set `output.format` to always get `png`, `jpg`, or `webp`.
`upscale()` also takes a local `file`, plus `destination`, `webhook`, and `metadata` like `generate()`:

```ts
const result = await mynth.image.upscale({
  file,
  size: "4x",
  effort: "high",
  output: { format: "webp" },
  destination: "bunny-prod",
  metadata: { productId: "sku_1" },
});

console.log(result.metadata.productId);
```

Use `upscaleAsync()` to create the task without waiting. Like `generateAsync()`, it returns a public access token when you ask for one:

```ts
const taskAsync = await mynth.image.upscaleAsync({
  url: "https://example.com/product.jpg",
  size: "2x",
  effort: "low",
  generate_public_access_token: true,
});

return { id: taskAsync.id, access: taskAsync.access };
```

## Working With Image Results

`generate()`, `removeBackground()`, and `upscale()` all hand back the same image shape, `MynthOutputImage`:

```ts
const task = await mynth.image.generate({
  prompt: "An orange cat astronaut on the moon",
  metadata: { source: "readme-example" },
});

console.log(task.taskId);
console.log(task.cost); // "0.04"
console.log(task.model); // resolved model, also when you asked for "auto"
console.log(task.metadata); // { source: "readme-example" }, typed from the request
console.log(task.magicPrompt); // the rewritten prompt, with magic_prompt: true
console.log(task.urls); // `url` of each image, skipping `null`

for (const image of task.images) {
  image.id;
  image.url; // your destination's URL, or the Mynth URL without a destination; null if delivery failed
  image.mynthUrl; // always set, served for 7 days
  image.width; // 1024
  image.height; // 768
  image.size; // "1024x768"
  image.format; // "png" | "jpg" | "webp"
  image.mimeType; // "image/png" | "image/jpeg" | "image/webp"
  image.destination; // delivery status when the request named a destination
  image.rating; // generate() only, typed from the request's rating levels
}
```

`url` is exactly what the API reports. The SDK never swaps in the Mynth URL for you, so a `null` cannot hide behind a URL from another origin. Fall back explicitly where any URL will do:

```ts
const src = image.url ?? image.mynthUrl;
```

`task.images` holds the successful images only. A completed task can also hold failed ones; `task.failures` lists why:

```ts
if (task.failures.length > 0) {
  console.warn(task.failures); // [{ code: "provider_error", message: "..." }]
}
```

Results are plain objects, so they pass as they are to client components, server functions, Convex mutations, and `JSON.stringify`.

To download an image, fetch `mynthUrl`. It is set with or without a destination:

```ts
import { writeFile } from "node:fs/promises";

const response = await fetch(image.mynthUrl);
await writeFile(`cat.${image.format}`, new Uint8Array(await response.arrayBuffer()));
```

Every result also keeps the request and result exactly as the API returned them, in `raw`, for fields the SDK does not map yet.

## Available Models

Use `mynth.models.list()` to fetch the live public model catalog. This endpoint does not require an API key.

```ts
const models = await mynth.models.list();

console.log(models[0]);
// {
//   id: "black-forest-labs/flux.2-pro",
//   display_name: "FLUX.2 Pro",
//   type: "image",
//   modes: { "txt->img": {}, "img->img": { inputs: { rules: [...], max_total: 4 } } },
//   pricing: { per_image: { base: "0.05" } }
// }
```

The catalog covers image and video models. Narrow on `type` to reach the
media-specific modes and pricing: image models price per image, video models
price per second of output, keyed by resolution tier.

```ts
for (const model of models) {
  if (model.type === "video") {
    console.log(model.id, model.pricing?.per_second["720p"], Object.keys(model.modes));
  } else {
    console.log(model.id, model.pricing?.per_image.base, Object.keys(model.modes));
  }
}
```

`modes` lists the generation modes the model currently serves, each with the
input contract it accepts — how many images, and in which roles.

The SDK also exports `AVAILABLE_MODELS`, which mirrors the static model list and capability metadata shipped with the package.

```ts
import { AVAILABLE_MODELS } from "@mynthio/sdk";

const model = AVAILABLE_MODELS.find((item) => item.id === "google/gemini-3.1-flash-image");

console.log(model);
// {
//   id: "google/gemini-3.1-flash-image",
//   label: "Nano Banana 2",
//   capabilities: ["inputs", "4k"]
// }
```

Current model IDs include:

- `auto`
- `alibaba/qwen-image-2.0`
- `alibaba/qwen-image-2.0-pro`
- `alibaba/qwen-image-2.1-pro`
- `alibaba/qwen-image-3.0`
- `alibaba/qwen-image-3.0-pro`
- `bytedance/seedream-5.0-lite`
- `bytedance/seedream-pro`
- `bytedance/seedream-v5-flash`
- `black-forest-labs/flux.1-dev`
- `black-forest-labs/flux-1-schnell`
- `black-forest-labs/flux.2-dev`
- `black-forest-labs/flux.2-pro`
- `black-forest-labs/flux.2-flex`
- `black-forest-labs/flux.2-max`
- `black-forest-labs/flux.2-klein-4b`
- `black-forest-labs/flux-3`
- `goofy-ai/prefect-pony-xl-lora`
- `google/gemini-3.1-flash-lite-image`
- `google/gemini-3.1-flash-image`
- `google/gemini-3-pro-image-preview`
- `imagineart/imagineart-1.5-pro`
- `imagineart/imagineart-2.0`
- `ideogram/ideogram-4.5`
- `john6666/bismuth-illustrious-mix`
- `maxfeifei8/one-obsession`
- `krea/krea-2-turbo`
- `krea/krea-2-medium`
- `krea/krea-2-large`
- `luma/uni-1`
- `luma/uni-1-max`
- `meta/muse-image`
- `openai/gpt-image-2`
- `purplesmartai/pony-diffusion-v6-xl`
- `recraft/recraft-v4`
- `recraft/recraft-v4.1-flash`
- `recraft/recraft-v4-pro`
- `sourceful/riverflow-2.0-pro`
- `tongyi-mai/z-image`
- `tongyi-mai/z-image-turbo`
- `wan/wan2.6-image`
- `wan/wan2.7-image`
- `wan/wan2.7-image-pro`
- `xai/grok-imagine-image`
- `xai/grok-imagine-image-2.0`
- `xai/grok-imagine-image-quality`

## Video Generation

`mynth.video` mirrors `mynth.image`: `generate()` waits, `generateAsync()` hands you a pollable task, and local files in `inputs` are uploaded for you.

```ts
const task = await mynth.video.generate({
  model: "google/gemini-omni-flash-1.1",
  prompt: "A drone shot over a misty forest at dawn",
  duration: 8,
  resolution: "1080p",
  audio: true,
});

console.log(task.urls);
console.log(task.videos[0]?.duration);
```

Video generation always runs on a pinned model: unlike images, there is no `auto`, so `model` is required.

### Waiting vs Polling

Video renders take minutes, not seconds. `generate()` polls every 10 seconds for up to an hour before throwing `TaskAsyncTimeoutError` — comfortably longer than the image profile, but far too long to hold an HTTP request open.

Prefer `generateAsync()` on the server and let the browser (or a webhook) pick the result up:

```ts
const taskAsync = await mynth.video.generateAsync({
  model: "bytedance/seedance-2.0-mini",
  prompt: "A neon city street in the rain",
  generate_public_access_token: true,
});

return { id: taskAsync.id, access: taskAsync.access };
```

`taskAsync.access.publicAccessToken` works exactly as it does for images: requested with `generate_public_access_token: true`, scoped to that one task, safe to send to the client, and usable against `GET /tasks/:id/status` and `GET /tasks/:id/result`.

### Duration, Resolution and Audio

`duration` is in whole seconds and `resolution` is a tier (`"480p"`, `"720p"`, `"1080p"`, `"4k"`). Each model accepts a subset of both, and rejects a request outside it. Omit either to take the model default. `audio: true` enables model-native generated audio.

### Input Images

`inputs` accepts up to five image inputs, as URL strings, `File`/`Blob` values, or structured objects. Declare the role with `as`:

- `"first_frame"` — the clip starts from this image
- `"last_frame"` — the clip ends on this image
- `"reference"` — guidance only
- `"auto"` (default) — the first image becomes the first frame

```ts
const task = await mynth.video.generate({
  model: "bytedance/seedance-2.0-mini",
  prompt: "Morph smoothly between the two frames",
  inputs: [
    firstFrameFile,
    {
      type: "image",
      as: "last_frame",
      source: { type: "url", url: "https://example.com/last.png" },
    },
  ],
});
```

Local files are uploaded to temporary input storage before the request, in a single batch, preserving order. `mynth.video.upload()` is available when you want to reuse the URLs across several requests — video inputs are images, so it is the same storage `mynth.image.upload()` uses.

### Estimating Cost

Video is priced per render, so you can price a request before running it. The endpoint validates the request the same way `generate()` does, which makes it a pre-flight check as well as a cost lookup:

```ts
const { estimated_cost } = await mynth.video.estimate({
  model: "google/gemini-omni-flash-1.1",
  prompt: "A timelapse of clouds over a canyon",
  duration: 10,
  resolution: "4k",
});
```

`estimate()` returns the API's own response, so its fields are snake_case. Because the model is always concrete, the estimate is exact.

### Working With Video Results

Video results mirror image results:

```ts
console.log(task.taskId);
console.log(task.cost); // failed videos are refunded
console.log(task.model);
console.log(task.urls);
console.log(task.videos); // successful videos only
console.log(task.failures); // [{ code, message? }] for each failed video
console.log(task.metadata);
console.log(task.raw);
```

Each video has `id`, `url`, `mynthUrl`, `cost`, `duration`, `resolution`, and `audio`. `url` is `null` when the video could not be delivered there; `mynthUrl` is always set.

### Video Models

The SDK exports `AVAILABLE_VIDEO_MODELS` with the capability metadata each model enforces:

```ts
import { AVAILABLE_VIDEO_MODELS } from "@mynthio/sdk";

const model = AVAILABLE_VIDEO_MODELS.find((item) => item.id === "google/gemini-omni-flash-1.1");

console.log(model);
// {
//   id: "google/gemini-omni-flash-1.1",
//   label: "Gemini Omni Flash 1.1",
//   resolutions: ["720p", "1080p", "4k"],
//   defaultResolution: "720p",
//   duration: { default: 8, min: 3, max: 10 },
//   audio: true,
//   inputs: ["first_frame", "last_frame"],
//   maxInputs: 2
// }
```

| Model                          | Resolutions       | Duration (s)     | Inputs                  |
| ------------------------------ | ----------------- | ---------------- | ----------------------- |
| `bytedance/seedance-2.0-mini`  | 480p, 720p        | 4–15 (default 5) | first frame, last frame |
| `google/gemini-omni-flash-1.1` | 720p, 1080p, 4k   | 3–10 (default 8) | first frame, last frame |
| `prunaai/p-video`              | 720p, 1080p       | 1–10 (default 5) | first frame             |
| `xai/grok-imagine-video-1.5`   | 480p, 720p, 1080p | 1–15 (default 8) | first frame             |

Each of these supports generated audio.

`mynth.models.list()` covers these video models alongside the image catalog.

## TypeScript Types

The SDK exports the request, task and webhook event types via `MynthSDKTypes`. They describe the API's own data, so their fields are snake_case; the SDK's own surface (methods, options, result objects such as `task.taskId`) is camelCase.

```ts
import type { MynthSDKTypes } from "@mynthio/sdk";

const request: MynthSDKTypes.ImageGenerationRequest = {
  prompt: "Minimal product shot of a glass bottle",
  model: "auto",
};
```

## Webhooks

Mynth delivers webhooks the [Standard Webhooks](https://www.standardwebhooks.com) way. Every delivery is a `POST` with an event body and these headers:

- `webhook-id`: the event ID, `evt_...`. The same for every delivery of the event, and the same as the body's `id`
- `webhook-timestamp`: when this attempt was sent, in Unix seconds
- `webhook-signature`: `v1,<base64>`, only on deliveries to a webhook registered in the dashboard or through the API

```json
{
  "id": "evt_01KE7Y9M3R8T2QXN5BVC4WJ6HD",
  "type": "task.image.generate.completed",
  "timestamp": "2026-10-04T10:00:12.000Z",
  "data": {
    "id": "tsk_...",
    "type": "image.generate",
    "status": "completed",
    "request": {},
    "result": {}
  }
}
```

`data` is the task exactly as `GET /tasks/{id}` returns it. Deliveries are retried for about 72 hours, so the same event can arrive more than once: store `event.id` and skip IDs you have already handled.

### Verify an event

`verifyWebhook()` checks the signature against the raw body, rejects a timestamp more than five minutes off, checks that the body's `id` is the `webhook-id`, and returns the typed event. It runs on Web Crypto, so it works in Node, edge runtimes and Workers.

```ts
import { verifyWebhook } from "@mynthio/sdk";

export async function POST(request: Request) {
  const event = await verifyWebhook({ body: await request.text(), headers: request.headers });

  switch (event.type) {
    case "task.image.generate.completed":
      await saveImages(event.data.id, event.data.result.images);
      break;
    case "task.image.generate.failed":
      await markTaskFailed(event.data.id, event.data.errors);
      break;
  }

  return new Response(null, { status: 204 });
}
```

The secret defaults to `MYNTH_WEBHOOK_SECRET`; pass it as the second argument otherwise. A failed check throws `MynthWebhookVerificationError`, which your handler should answer with a `400`. Keep a `default` branch: an event type newer than your SDK version is returned as is.

The framework helpers below do the same verification and hand each event to a typed callback.

### Next.js Integration

Use the App Router helper to verify and route registered Mynth webhooks. Add the signing secret shown when you create the webhook:

```env
MYNTH_WEBHOOK_SECRET=whsec_...
```

Create a Route Handler:

```ts
// app/api/mynth-webhook/route.ts
import { mynthWebhookHandler } from "@mynthio/sdk/next";

export const POST = mynthWebhookHandler({
  imageTaskCompleted: async (result, { event, request }) => {
    console.log("Event:", event.id, "received at:", request.url);

    await saveImages(result.taskId, result.images);
  },
  imageTaskFailed: async (failure) => {
    await markTaskFailed(failure.taskId, failure.errors);
  },
  videoTaskCompleted: async (result) => {
    await saveVideos(result.taskId, result.videos);
  },
});
```

The helper reads the raw body, verifies the signature, rejects a timestamp more than five minutes off, and checks the event before calling a typed callback. A completed callback receives the same result that `generate()`, `upscale()` and the other methods return, so `result.images`, `result.cost` and `result.metadata` work the same in both places. A failed callback receives `{ taskId, errors, metadata, raw }`; `metadata` is there for task types whose request takes it. The last argument holds the original `request` and the verified `event`.

`onEvent` receives every event, typed, before its callback runs, including event types newer than the SDK. Events without a callback are answered `200`, so Mynth does not retry them.

The route must be publicly reachable, so exclude it from authentication middleware. Make callback side effects idempotent by storing `event.id` and skipping IDs you have already handled, and enqueue slow work before returning. Callback errors are propagated so Mynth can retry the delivery.

Pass `{ webhookSecret: "whsec_..." }` as the second argument only when the application does not use `MYNTH_WEBHOOK_SECRET`.

### Unsigned custom webhooks

A request can send its events to URLs of its own with `webhook.custom`. Those deliveries are not signed: put a secret token in the URL, and check it with the `unsigned` option. The helpers then skip signature verification and answer `401` when `verify` returns `false`. Without the option, an unsigned delivery is answered `400`.

```ts
export const POST = mynthWebhookHandler(
  { imageTaskCompleted: async (result, { event }) => saveImages(result.taskId, result.images) },
  {
    unsigned: {
      verify: (request) =>
        new URL(request.url).searchParams.get("token") === process.env.MY_WEBHOOK_TOKEN,
    },
  },
);
```

Compare the token in constant time if an attacker could time your endpoint. Mynth only ever shows `scheme://host` of a custom URL back, so a token in the path or query does not leak through the task.

### TanStack Start Integration

Mount the webhook helper directly on a TanStack Start server route:

```ts
// src/routes/api/webhooks/mynth.ts
import { mynthWebhookHandler } from "@mynthio/sdk/tanstack-start";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/webhooks/mynth")({
  server: {
    handlers: {
      POST: mynthWebhookHandler({
        imageTaskCompleted: async (result, { event, request, params, context }) => {
          console.log("Event:", event.id, "received at:", request.url);
          await saveImages(result.taskId, result.images);
        },
        imageTaskFailed: async (failure) => {
          await markTaskFailed(failure.taskId, failure.errors);
        },
      }),
    },
  },
});
```

Set `MYNTH_WEBHOOK_SECRET` in the server environment, or pass `webhookSecret` as the second argument. Event callbacks receive the original request, route params, TanStack Start middleware context, and the verified `event`.

### Convex Integration

The package includes a Convex HTTP action helper for webhook verification and event routing.

```ts
import { mynthWebhookAction } from "@mynthio/sdk/convex";

export const mynthWebhook = mynthWebhookAction({
  imageTaskCompleted: async (result, { context, event }) => {
    console.log("Completed task:", result.taskId, "event:", event.id);
    console.log(result.images);
  },
  imageTaskFailed: async (failure) => {
    console.error("Mynth task failed:", failure.taskId);
  },
  imageRateTaskCompleted: async (result) => {
    console.log("Completed rating task:", result.taskId);
    console.log(result.level);
  },
  imageRateTaskFailed: async (failure) => {
    console.error("Mynth rating task failed:", failure.taskId);
  },
  imageAltTaskCompleted: async (result) => {
    console.log("Completed alt text task:", result.taskId);
    console.log(result.alt);
  },
  imageAltTaskFailed: async (failure) => {
    console.error("Mynth alt text task failed:", failure.taskId);
  },
  imageReviewTaskCompleted: async (result) => {
    console.log("Completed review task:", result.taskId);
    console.log(result.summary);
  },
  imageReviewTaskFailed: async (failure) => {
    console.error("Mynth review task failed:", failure.taskId);
  },
  imageRemoveBackgroundTaskCompleted: async (result) => {
    console.log("Completed remove background task:", result.taskId);
    console.log(result.image.url);
  },
  imageRemoveBackgroundTaskFailed: async (failure) => {
    console.error("Mynth remove background task failed:", failure.taskId);
  },
  imageUpscaleTaskCompleted: async (result) => {
    console.log("Completed upscale task:", result.taskId);
    console.log(result.image.url);
  },
  imageUpscaleTaskFailed: async (failure) => {
    console.error("Mynth upscale task failed:", failure.taskId);
  },
  videoTaskCompleted: async (result) => {
    console.log("Completed video task:", result.taskId);
    console.log(result.videos);
  },
  videoTaskFailed: async (failure) => {
    console.error("Mynth video task failed:", failure.taskId);
  },
});
```

Set `MYNTH_WEBHOOK_SECRET` in your environment, or pass `webhookSecret` explicitly as the second argument to `mynthWebhookAction(...)`. The `unsigned` option works the same as in the Next.js helper.

## Error Handling

`upload()`, `generate()`, `generateAsync()`, `rate()`, `rateAsync()`, `alt()`, `altAsync()`, `review()`, `reviewAsync()`, `removeBackground()`, `removeBackgroundAsync()`, `upscale()`, `upscaleAsync()`, `models.list()`, and the `video` equivalents (`video.generate()`, `video.generateAsync()`, `video.upload()`, `video.estimate()`) may throw `MynthAPIError` if the request fails. Polling can also throw task-specific errors:

While polling, transient failures (404, 5xx, dropped connections) are retried: a created task is owed an answer, so a cold cache or a brief outage does not lose you the result. A 429 slows polling down, doubling the interval up to 30 seconds, and only the timeout ends it. Polling gives up after 20 consecutive failures (~100s) with `TaskAsyncFetchError` or `TaskAsyncTaskFetchError`, immediately on a 401 or 403 with `TaskAsyncUnauthorizedError`, and immediately on any other 4xx with `TaskAsyncFetchError` or `TaskAsyncTaskFetchError`. Image waits time out after 30 minutes, video waits after an hour.

```ts
import {
  MynthAPIError,
  TaskAsyncFetchError,
  TaskAsyncTaskFailedError,
  TaskAsyncTaskFetchError,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
} from "@mynthio/sdk";

try {
  const taskAsync = await mynth.image.generateAsync({ prompt: "A watercolor landscape" });

  const task = await taskAsync.wait();
  console.log(task.urls);
} catch (error) {
  if (error instanceof MynthAPIError) {
    // `message` says what to fix. On a validation_error, `issues` lists each invalid field.
    console.error(error.status, error.code, error.message, error.issues);
  } else if (error instanceof TaskAsyncTimeoutError) {
    console.error("Task polling timed out");
  } else if (error instanceof TaskAsyncUnauthorizedError) {
    console.error("Task access was denied");
  } else if (error instanceof TaskAsyncFetchError) {
    console.error("Repeated status fetch failures");
  } else if (error instanceof TaskAsyncTaskFailedError) {
    console.error("The task failed");
  } else if (error instanceof TaskAsyncTaskFetchError) {
    console.error("Fetching the completed task failed");
  }
}
```

## Migrating from 0.0.49

0.0.50 follows the stable API, which changed in one go. Nothing in it is backward compatible:

- Request fields are snake_case, and the API now rejects a field it does not know. `size.aspectRatio` is `size.aspect_ratio`.
- `access: { pat: { enabled } }` is `generate_public_access_token: true`, and it now defaults to `false`: pass it to get `taskAsync.access.publicAccessToken` from `generateAsync()`, `removeBackgroundAsync()`, `upscaleAsync()` and `video.generateAsync()`.
- `webhook.dashboard` is `webhook.registered`.
- `MynthAPIError.code` and every task error code are lowercase: `validation_error`, `insufficient_balance`, `provider_error`.
- API data the SDK returns as is is snake_case: `MynthSDKTypes.TaskData` (`user_id`, `api_key_id`, `created_at`, `updated_at`), the model catalog (`display_name`, `per_image`, `per_second`, `max_total`) and `video.estimate()` (`estimated_cost`, `estimate_kind`).
- A video's `url` can be `null`, like an image's. `result.urls` skips it.
- Webhooks follow Standard Webhooks. Every registered webhook got a new `whsec_...` signing secret: copy it from the dashboard into `MYNTH_WEBHOOK_SECRET`. `X-Mynth-Event`, `X-Mynth-Delivery` and `X-Mynth-Signature` are gone; deliveries carry `webhook-id`, `webhook-timestamp` and `webhook-signature`.
- The webhook body is an event, `{ id, type, timestamp, data }`, with the task in `data`. `MynthSDKTypes.WebhookPayload` and its variants are replaced by `MynthSDKTypes.WebhookEvent`, and `verifyWebhook()` returns one.
- Webhook callbacks get `{ event }` in their last argument instead of `deliveryId`. Deduplicate on `event.id`.
- Unsigned deliveries to a custom URL are refused unless the helper gets the `unsigned` option.

## Documentation

For product documentation and API guides, visit [mynth.io/docs](https://mynth.io/docs).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, Conventional Commits guidance, and release process notes.

## License

MIT
