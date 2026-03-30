# @mynthio/sdk

Official SDK for the [Mynth](https://mynth.io) image generation API.

The SDK gives you a typed `Mynth` client, sync and async generation flows, model metadata, and a Convex webhook helper.

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
const task = await mynth.generate({
  prompt: "A fox in a neon-lit city at night",
});

console.log(task.id);
console.log(task.urls);
console.log(task.result?.model);
```

If you omit `model` and `size`, Mynth resolves them automatically. By default, `generate()` waits for completion and returns a completed task.

## Client Options

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth({
  apiKey: process.env.MYNTH_API_KEY,
  baseUrl: "https://api.mynth.io",
});
```

- `apiKey`: optional if `MYNTH_API_KEY` is set
- `baseUrl`: optional override for proxies or tests

## Sync vs Async

### Sync Mode

Sync mode is the default. It polls until the task is completed.

```ts
const task = await mynth.generate({
  prompt: "Editorial product photo of a matte black coffee grinder",
  model: "black-forest-labs/flux.2-dev",
});

console.log(task.status); // "completed"
console.log(task.urls);
```

### Async Mode

Use async mode when you want to trigger work now and fetch the final task later.

```ts
const taskAsync = await mynth.generate(
  {
    prompt: "A cinematic fantasy castle on a cliff",
    model: "google/gemini-3.1-flash-image",
  },
  { mode: "async" },
);

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken);

const completedTask = await taskAsync.toTask();
console.log(completedTask.urls);
```

`taskAsync.access.publicAccessToken` is safe to send to the client. It is scoped to that single task, so you can poll task state from the browser without exposing your API key or building your own polling proxy.

You can use it as a Bearer token against:

- `GET /tasks/:id/status`
- `GET /tasks/:id/results`

Example:

```ts
const taskAsync = await mynth.generate(
  {
    prompt: "A cinematic fantasy castle on a cliff",
    model: "google/gemini-3.1-flash-image",
  },
  { mode: "async" },
);

const taskId = taskAsync.id;
const pat = taskAsync.access.publicAccessToken;

const status = await fetch(`https://api.mynth.io/tasks/${taskId}/status`, {
  headers: {
    Authorization: `Bearer ${pat}`,
  },
}).then((res) => res.json());

if (status.status === "completed") {
  const results = await fetch(`https://api.mynth.io/tasks/${taskId}/results`, {
    headers: {
      Authorization: `Bearer ${pat}`,
    },
  }).then((res) => res.json());

  console.log(results.images);
}
```

## Request Shape

`generate()` accepts a typed `ImageGenerationRequest`. The simplest request is just a prompt:

```ts
await mynth.generate({
  prompt: "A cozy cabin in a snowy pine forest",
});
```

You can also pass structured options:

```ts
const task = await mynth.generate({
  prompt: {
    positive: "Studio portrait of a futuristic fashion model",
    negative: "blurry, low detail",
    enhance: "prefer_magic",
  },
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
    enabled: true,
    custom: [{ url: "https://your-app.com/api/mynth-webhook" }],
  },
  access: {
    pat: {
      enabled: true,
    },
  },
  content_rating: {
    enabled: true,
    levels: [
      { value: "safe", description: "Safe for all audiences" },
      { value: "sensitive", description: "Contains mature or suggestive content" },
    ],
  },
  inputs: [
    "https://example.com/reference-1.jpg",
    {
      type: "image",
      role: "reference",
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

## Prompt Options

`prompt` can be:

- a string
- a structured object with `positive`, optional `negative`, and `enhance`

```ts
prompt: {
  positive: "A luxury watch on a marble pedestal",
  negative: "text, watermark",
  enhance: false,
}
```

`enhance` accepts:

- `false`
- `"prefer_magic"`
- `"prefer_native"`

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
size: { type: "auto", prefer: "native" };
```

## Input Images

Use `inputs` to send reference, context, or init images:

```ts
inputs: [
  "https://example.com/context-image.jpg",
  {
    type: "image",
    role: "reference",
    source: {
      type: "url",
      url: "https://example.com/reference-image.jpg",
    },
  },
];
```

String URLs are a shorthand for image inputs. Structured inputs let you control the role explicitly with `"context"`, `"init"`, or `"reference"`.

## Working With Results

Completed tasks expose a few helpful accessors:

```ts
const task = await mynth.generate({
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
console.log(task.result?.prompt_enhance);
```

`task.urls` and `task.getImages()` return only successful images by default. `task.result?.images` may also include failed image entries.

## Available Models

The SDK exports `AVAILABLE_MODELS`, which mirrors the current model list and capability metadata shipped with the package.

```ts
import { AVAILABLE_MODELS } from "@mynthio/sdk";

const model = AVAILABLE_MODELS.find((item) => item.id === "google/gemini-3.1-flash-image");

console.log(model);
// {
//   id: "google/gemini-3.1-flash-image",
//   label: "Nano Banana 2",
//   capabilities: ["inputs", "4k", "native_enhance_prompt", "native_auto_size"]
// }
```

Current model IDs include:

- `auto`
- `alibaba/qwen-image-2.0`
- `alibaba/qwen-image-2.0-pro`
- `bytedance/seedream-5.0-lite`
- `black-forest-labs/flux.1-dev`
- `black-forest-labs/flux-1-schnell`
- `black-forest-labs/flux.2-dev`
- `black-forest-labs/flux.2-klein-4b`
- `google/gemini-3.1-flash-image`
- `google/gemini-3-pro-image-preview`
- `john6666/bismuth-illustrious-mix`
- `purplesmartai/pony-diffusion-v6-xl`
- `recraft/recraft-v4`
- `recraft/recraft-v4-pro`
- `tongyi-mai/z-image-turbo`
- `wan/wan2.6-image`
- `xai/grok-imagine-image`

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
});
```

Set `MYNTH_WEBHOOK_SECRET` in your environment, or pass `webhookSecret` explicitly as the second argument to `mynthWebhookAction(...)`.

## Error Handling

`generate()` may throw `MynthAPIError` if the initial request fails. Async polling can also throw task-specific errors:

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
  const taskAsync = await mynth.generate({ prompt: "A watercolor landscape" }, { mode: "async" });

  const task = await taskAsync.toTask();
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
    console.error("The generation task failed");
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
