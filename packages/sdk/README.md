# @mynthio/sdk

Official SDK for the [Mynth](https://mynth.io) image API.

The SDK gives you a typed `Mynth` client, temporary image uploads, sync and async generation, rating, and alt text flows, model metadata, and a Convex webhook helper.

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

console.log(task.id);
console.log(task.urls);
console.log(task.result?.model);
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

- `apiKey`: required for image generation, rating, and alt text unless `MYNTH_API_KEY` is set; not required for the public model catalog
- `baseUrl`: optional override for proxies or tests

## Generate vs Generate Async

### Generate

`generate()` polls until the task is completed.

```ts
const task = await mynth.image.generate({
  prompt: "Editorial product photo of a matte black coffee grinder",
  model: "black-forest-labs/flux.2-dev",
});

console.log(task.status); // "completed"
console.log(task.urls);
```

### Generate Async

Use `generateAsync()` when you want to trigger work now and fetch the final task later.

```ts
const taskAsync = await mynth.image.generateAsync({
  prompt: "A cinematic fantasy castle on a cliff",
  model: "google/gemini-3.1-flash-image",
});

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken);

const completedTask = await taskAsync.wait();
console.log(completedTask.urls);
```

`taskAsync.access.publicAccessToken` is safe to send to the client. It is scoped to that single task, so you can poll task state from the browser without exposing your API key or building your own polling proxy.

You can use it as a Bearer token against:

- `GET /tasks/:id/status`
- `GET /tasks/:id/result`

Example:

```ts
const taskAsync = await mynth.image.generateAsync({
  prompt: "A cinematic fantasy castle on a cliff",
  model: "google/gemini-3.1-flash-image",
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
    aspectRatio: "4:5",
  },
  count: 2,
  output: {
    format: "webp",
    quality: 80,
  },
  webhook: {
    dashboard: false,
    custom: [{ url: "https://your-app.com/api/mynth-webhook" }],
  },
  access: {
    pat: {
      enabled: true,
    },
  },
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

`access.pat.enabled` controls whether the create-task response includes a short-lived Public Access Token for browser-side polling. It defaults to `true`.

`output` is optional. When you provide it, include both `format` and `quality`; when omitted, Mynth defaults to WebP at quality 80.

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
size: { type: "aspect_ratio", aspectRatio: "16:9" };
size: { type: "aspect_ratio", aspectRatio: "4:5", scale: "4k" };
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
`"auto"` (default), `"person"`, `"garment"`, `"pose"`, `"source"`, and `"reference"`.
Most models auto-detect the kind from the image. Unified models such as Luma UNI-1 split
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

console.log(task.getImages()[0]?.rating?.level); // "sfw" | "nsfw"
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

console.log(task.getImages()[0]?.rating?.level); // "general" | "teen" | "adult"
```

You can also rate existing image URLs:

```ts
const result = await mynth.image.rate({
  mode: "nsfw_sfw",
  urls: ["https://example.com/image.webp"],
});

console.log(result.task.id);
console.log(result.getRatings());
```

Use `rateAsync()` when you want to create the rating task now and wait later:

```ts
const taskAsync = await mynth.image.rateAsync({
  mode: "nsfw_sfw",
  urls: ["https://example.com/image.webp"],
});

console.log(taskAsync.id);

const result = await taskAsync.wait();
console.log(result.getRatings());
```

## Alt Text

Generate short alt text for existing image URLs:

```ts
const result = await mynth.image.alt({
  urls: ["https://example.com/image.webp"], // 1-10 URLs
});

console.log(result.task.id);
console.log(result.getAltTexts());
// [{ status: "success", url: "https://example.com/image.webp", alt: "..." }]
```

Use `altAsync()` when you want to create the alt text task now and wait later:

```ts
const taskAsync = await mynth.image.altAsync({
  urls: ["https://example.com/image.webp"],
});

console.log(taskAsync.id);

const result = await taskAsync.wait();
console.log(result.getAltTexts());
console.log(result.getErrors());
```

## Working With Results

Completed tasks expose a few helpful accessors:

```ts
const task = await mynth.image.generate({
  prompt: "An orange cat astronaut on the moon",
  metadata: { source: "readme-example" },
});

console.log(task.id);
console.log(task.status);
console.log(task.isCompleted);
console.log(task.urls);
console.log(task.getImages());
console.log(task.getImages({ includeFailed: true }));
console.log(task.getMetadata());
console.log(task.result?.magic_prompt);
```

`task.urls` and `task.getImages()` return only successful images by default. `task.result?.images` may also include failed image entries.

## Available Models

Use `mynth.models.list()` to fetch the live public model catalog. This endpoint does not require an API key.

```ts
const models = await mynth.models.list();

console.log(models[0]);
// {
//   id: "black-forest-labs/flux.2-pro",
//   displayName: "FLUX.2 Pro",
//   pricing: { perImage: { base: "0.05" } }
// }
```

The SDK also exports `AVAILABLE_MODELS`, which mirrors the static model list and capability metadata shipped with the package.

```ts
import { AVAILABLE_MODELS } from "@mynthio/sdk";

const model = AVAILABLE_MODELS.find((item) => item.id === "google/gemini-3.1-flash-image");

console.log(model);
// {
//   id: "google/gemini-3.1-flash-image",
//   label: "Nano Banana 2",
//   capabilities: ["inputs", "4k", "native_enhance_prompt"]
// }
```

Current model IDs include:

- `auto`
- `alibaba/qwen-image-2.0`
- `alibaba/qwen-image-2.0-pro`
- `bytedance/seedream-5.0-lite`
- `bytedance/seedream-pro`
- `black-forest-labs/flux.1-dev`
- `black-forest-labs/flux-1-schnell`
- `black-forest-labs/flux.2-dev`
- `black-forest-labs/flux.2-pro`
- `black-forest-labs/flux.2-flex`
- `black-forest-labs/flux.2-max`
- `black-forest-labs/flux.2-klein-4b`
- `black-forest-labs/flux-virtual-try-on`
- `google/gemini-3.1-flash-lite-image`
- `google/gemini-3.1-flash-image`
- `google/gemini-3-pro-image-preview`
- `ideogram/remove-background`
- `imagineart/imagineart-1.5-pro`
- `imagineart/imagineart-2.0`
- `john6666/bismuth-illustrious-mix`
- `maxfeifei8/one-obsession`
- `krea/krea-2-turbo`
- `krea/krea-2-medium`
- `krea/krea-2-large`
- `luma/uni-1`
- `luma/uni-1-max`
- `openai/gpt-image-2`
- `prunaai/p-image-try-on`
- `purplesmartai/pony-diffusion-v6-xl`
- `recraft/recraft-v4`
- `recraft/recraft-v4-pro`
- `sourceful/riverflow-2.0-pro`
- `tongyi-mai/z-image`
- `tongyi-mai/z-image-turbo`
- `wan/wan2.6-image`
- `wan/wan2.7-image`
- `wan/wan2.7-image-pro`
- `xai/grok-imagine-image`
- `xai/grok-imagine-image-quality`

## TypeScript Types

The SDK exports the request and payload types via `MynthSDKTypes`.

```ts
import type { MynthSDKTypes } from "@mynthio/sdk";

const request: MynthSDKTypes.ImageGenerationRequest = {
  prompt: "Minimal product shot of a glass bottle",
  model: "auto",
};
```

## Convex Integration

The package includes a Convex HTTP action helper for webhook verification and event routing.

```ts
import { mynthWebhookAction } from "@mynthio/sdk/convex";

export const mynthWebhook = mynthWebhookAction({
  imageTaskCompleted: async (payload, { context }) => {
    console.log("Completed task:", payload.task.id);
    console.log(payload.result.images);
  },
  imageTaskFailed: async (payload) => {
    console.error("Mynth task failed:", payload.task.id);
  },
  imageRateTaskCompleted: async (payload) => {
    console.log("Completed rating task:", payload.task.id);
    console.log(payload.result.results);
  },
  imageRateTaskFailed: async (payload) => {
    console.error("Mynth rating task failed:", payload.task.id);
  },
  imageAltTaskCompleted: async (payload) => {
    console.log("Completed alt text task:", payload.task.id);
    console.log(payload.result.results);
  },
  imageAltTaskFailed: async (payload) => {
    console.error("Mynth alt text task failed:", payload.task.id);
  },
});
```

Set `MYNTH_WEBHOOK_SECRET` in your environment, or pass `webhookSecret` explicitly as the second argument to `mynthWebhookAction(...)`.

## Error Handling

`upload()`, `generate()`, `generateAsync()`, `rate()`, `rateAsync()`, `alt()`, `altAsync()`, and `models.list()` may throw `MynthAPIError` if the request fails. Polling can also throw task-specific errors:

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
    console.error(error.status, error.code, error.message);
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

## Documentation

For product documentation and API guides, visit [docs.mynth.io](https://docs.mynth.io).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, Conventional Commits guidance, and release process notes.

## License

MIT
