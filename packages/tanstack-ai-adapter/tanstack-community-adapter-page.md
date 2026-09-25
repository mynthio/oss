---
title: Mynth
id: mynth-adapter
description: "Generate images with Mynth models like Flux, Recraft, Gemini, Qwen, Seedream, Wan, and Grok Imagine in TanStack AI via the Mynth community adapter."
keywords:
  - tanstack ai
  - mynth
  - image generation
  - flux
  - recraft
  - qwen
  - seedream
  - community adapter
---

# Mynth

The Mynth adapter gives you access to Mynth image generation models through TanStack AI. It is a community adapter for `generateImage()` with typed model IDs, per-model typed `modelOptions`, image-to-image support, a files adapter for `uploadFile()`, cancellation, usage and cost reporting, and a BYOK descriptor.

Mynth is image-only in this package. Reach for it when you want TanStack AI's image generation workflow with Mynth models such as Flux, Recraft, Gemini, Qwen, Seedream, Wan, and Grok Imagine.

Quick note: Mynth is in public beta, so the model lineup and a few request options are still settling. The adapter tracks the Mynth SDK closely, and we welcome feedback on the API and integration experience.

## Installation

```sh
# bun
bun add @mynthio/tanstack-ai-adapter @tanstack/ai

# pnpm
pnpm add @mynthio/tanstack-ai-adapter @tanstack/ai

# npm
npm install @mynthio/tanstack-ai-adapter @tanstack/ai
```

The adapter requires `@tanstack/ai` 0.61 or newer.

## Authentication

Set your Mynth API key in the environment:

```sh
MYNTH_API_KEY=mak_...
```

Keep `MYNTH_API_KEY` on the server only. Never expose it in browser code or public client environment variables, or it may end up in a client bundle.

You can also pass `apiKey` directly in the adapter config. `baseUrl` is optional and useful for proxies, tests, or custom deployments.

If you need a key, create one in the [Mynth API keys dashboard](https://mynth.io/dashboard/keys).

## Quick Start

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "Editorial product photo of a ceramic mug on a linen tablecloth",
  numberOfImages: 1,
  size: "square",
});

console.log(result.id);
console.log(result.model);
console.log(result.images[0]?.url);
```

TanStack AI adapters are model-bound, so you choose the Mynth model when you create the adapter.

## Reusable Provider

Use `createMynthImage()` when you want to share config across multiple adapters:

```ts
import { generateImage } from "@tanstack/ai";
import { createMynthImage } from "@mynthio/tanstack-ai-adapter";

const mynth = createMynthImage({
  apiKey: process.env.MYNTH_API_KEY!,
  baseUrl: "https://api.mynth.io",
});

const result = await generateImage({
  adapter: mynth("google/gemini-3.1-flash-image"),
  prompt: "A playful paper-cut illustration of a city park in spring",
});

console.log(result.images[0]?.url);
```

You can still override shared config per adapter:

```ts
import { createMynthImage } from "@mynthio/tanstack-ai-adapter";

const mynth = createMynthImage();

const adapter = mynth("auto", {
  baseUrl: "https://proxy.example.com",
});
```

## Model Options

Use TanStack's top-level fields for common options such as `prompt`, `numberOfImages`, and shorthand `size`. Use `modelOptions` for Mynth-specific options:

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("google/gemini-3.1-flash-image"),
  prompt: "Modern poster design for a jazz festival",
  numberOfImages: 2,
  size: "portrait",
  modelOptions: {
    magicPrompt: true,
    negativePrompt: "watermark, blurry text",
    size: {
      type: "aspect_ratio",
      aspectRatio: "4:5",
      scale: "4k",
    },
    output: {
      format: "png",
      quality: 90,
    },
    rating: true,
    metadata: {
      requestId: "req_123",
    },
  },
});
```

Notes:

- `modelOptions.magicPrompt` maps to Mynth's `magic_prompt`, and `modelOptions.negativePrompt` maps to `negative_prompt`. The enhanced prompt comes back as `images[*].revisedPrompt`
- `modelOptions.rating` configures content rating on the result
- `modelOptions.size` overrides the top-level `size`. Use it when you need structured Mynth size objects, including aspect ratios and an optional `scale: "4k"`
- Top-level `size` is for shorthand values such as `"auto"` and preset strings like `"square"`, `"landscape"` or `"16:9_4k"`
- `modelOptions.inputs` adds image inputs after the prompt's image parts. Entries can be URLs, `Blob`/`File` values (uploaded for you), or structured inputs with an explicit `as` role
- `modelOptions.destination` delivers the generation to a configured Mynth destination, overriding any adapter-level or env default

`modelOptions` is typed for the adapter's model, so options the model cannot use are compile-time errors:

- `inputs` (and image prompt parts) only on models in `MYNTH_IMAGE_INPUT_MODELS`
- 4k sizes (`_4k` presets and `scale: "4k"`) only on models in `MYNTH_IMAGE_4K_MODELS`. `auto` does not accept them, because the model it picks may not have 4k output
- `negativePrompt` on its own only on models in `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS` and on `auto`, which also uses it to pick a model. Other models take a negative prompt only together with `magicPrompt: true`, which uses it to steer the enhanced prompt

## Image Inputs (image-to-image)

Models that accept image inputs work with TanStack AI's content-part prompts, so you can mix instruction text with reference images for image-to-image, reference-guided, and edit flows. The adapter maps the image parts onto Mynth's `inputs`:

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: [
    { type: "text", content: "Restyle this scene as a watercolor painting" },
    {
      type: "image",
      source: { type: "url", value: "https://example.com/photo.jpg" },
    },
  ],
});
```

A few things worth knowing:

- Only models in `MYNTH_IMAGE_INPUT_MODELS` accept image parts. Passing image parts to a text-only model is a compile-time error
- URL sources (`{ type: "url", value }`) are sent as they are. Inline data sources (`{ type: "data", value, mimeType }`) are uploaded to Mynth first, because the Mynth API only fetches http(s) URLs. File sources from `mynthFiles()` are covered below
- Mynth accepts JPEG, PNG and WebP images
- A part's `metadata.role` maps to Mynth's input role. TanStack's `"reference"` and `"character"` roles map to Mynth's `"reference"` guidance role, and Mynth routes a part without a role itself. Mynth has no mask, control or frame inputs, so parts with those roles throw instead of being sent as plain images
- For explicit routing, pass `modelOptions.inputs` with SDK-supported `as` values `"source"` or `"reference"`
- Image parts from the prompt and entries in `modelOptions.inputs` are combined, with prompt parts first
- Video and audio parts throw: Mynth image generation takes text and images only

## Uploading Images Once

`mynthFiles()` plugs into TanStack AI's `uploadFile()`. Upload an image once and reference it in later prompts, for example across the turns of an edit flow:

```ts
import { fileSourceFromHandle, generateImage, uploadFile } from "@tanstack/ai";
import { mynthFiles, mynthImage } from "@mynthio/tanstack-ai-adapter";

const handle = await uploadFile({
  adapter: mynthFiles(),
  input: productPhoto, // a Blob, or { data: base64, mimeType }
});

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-pro"),
  prompt: [
    { type: "text", content: "Place this product on a marble counter" },
    { type: "image", source: fileSourceFromHandle(handle) },
  ],
});
```

The handle is the uploaded image's URL in Mynth's temporary input storage. The files adapter is upload-only: Mynth has no API to look up or delete an upload, so `getFile()` and `deleteFile()` are not available.

## Cancellation

`timeout` and `abortSignal` stop the adapter: it cancels pending uploads and requests and stops polling the Mynth task.

```ts
const result = await generateImage({
  adapter: mynthImage("auto"),
  prompt,
  timeout: 120_000,
  abortSignal: request.signal,
});
```

A task that was already created keeps running on Mynth, and it is still billed.

## Usage and Cost

`result.usage` reports what Mynth billed: `billed` is `{ quantity, unit: "images" }` and `cost` is the task's total in USD. Token fields are always `0`, since Mynth bills per image. TanStack AI passes `usage` to middleware such as `otelMiddleware()`.

## Errors

When a task completes but every image failed, the adapter throws `MynthNoImagesError`, which carries the `taskId` and each image's error. When only some images fail, the result holds the successful ones. Request and task errors from the Mynth SDK propagate unchanged.

## Bring Your Own Key

`@mynthio/tanstack-ai-adapter/byok` exports `mynthByok`, a browser-safe descriptor for TanStack AI's BYOK flow. On the relay, read the key (the `x-byok-mynth` header, then `MYNTH_API_KEY`) and pass it to the adapter:

```ts
import { byokMissing } from "@tanstack/ai/byok";
import { getByokKey } from "@tanstack/ai/byok/server";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";
import { mynthByok } from "@mynthio/tanstack-ai-adapter/byok";

const apiKey = getByokKey(request, mynthByok);
if (!apiKey) return byokMissing(mynthByok);

const adapter = mynthImage("auto", { apiKey });
```

## Available Models

The adapter exports a runtime list and a type union for supported image models:

```ts
import { MYNTH_IMAGE_MODELS, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";

const defaultModel: MynthImageModel = "auto";

for (const model of MYNTH_IMAGE_MODELS) {
  console.log(model);
}
```

This is handy for model selectors, validation, and keeping client and server code in sync. Capability subsets mirror the Mynth SDK's catalog: `MYNTH_IMAGE_INPUT_MODELS` (image inputs), `MYNTH_IMAGE_4K_MODELS` (4k output) and `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS` (native negative prompt), each with a matching type.

Mynth supports model IDs across multiple providers, including `auto`, Flux, Recraft, Gemini, Qwen, Seedream, Imagine, Wan, and Grok Imagine. The exported list is a fixed snapshot for type safety. For the live catalog with pricing, use the models endpoint below.

### Models endpoint

Mynth exposes a public catalog at `https://api.mynth.io/models`. It does not require an API key, and it carries pricing today with room for more metadata over time. This is the source of truth if you want to render a picker with live pricing rather than the static exported list.

```ts
const response = await fetch("https://api.mynth.io/models");
const { data } = await response.json();

for (const model of data) {
  console.log(model.id, model.displayName, model.pricing);
}
```

Each entry looks roughly like this:

```jsonc
{
  "id": "black-forest-labs/flux.2-dev",
  "displayName": "FLUX.2 Dev",
  "pricing": {
    "perImage": { "base": "0.01", "4k": "0.04" },
    "perInput": "0.002",
  },
}
```

If you already use the Mynth SDK, the same data is available through `new Mynth().models.list()`.

## Streaming Example

This adapter also works with TanStack AI's streaming image workflow:

```ts
import { generateImage, toServerSentEventsResponse } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

export async function POST(request: Request) {
  const { prompt, model } = await request.json();

  const stream = generateImage({
    adapter: mynthImage(model ?? "auto"),
    prompt,
    numberOfImages: 1,
    stream: true,
    abortSignal: request.signal,
  });

  return toServerSentEventsResponse(stream);
}
```

For a full example using `useGenerateImage()`, see the [TanStack Start + Mynth adapter demo](https://github.com/mynthio/oss/tree/main/examples/tanstack-start-ai-mynth-adapter).

## Supported Capabilities

- Image generation with `generateImage()`
- Image-to-image with content-part prompts on input-capable models
- Streaming image generation with `stream: true`
- File uploads with `uploadFile()` and `mynthFiles()`
- Cancellation with `timeout` and `abortSignal`
- Usage and cost on `result.usage`
- BYOK with `mynthByok`
- Typed model IDs through `MYNTH_IMAGE_MODELS` and `MynthImageModel`
- Mynth-specific request options through `modelOptions`, typed per model

The adapter returns TanStack AI's normalized image result shape:

- `id`: the Mynth task id
- `model`: the resolved model returned by Mynth, or the requested model as a fallback
- `images`: only successful images are included
- `images[*].url`: the image's destination URL, or its Mynth CDN URL when it has no destination URL
- `images[*].revisedPrompt`: included when Mynth enhances the prompt
- `usage`: `billed` image count and the task's `cost` in USD

## API Reference

### `mynthImage(model, config?)`

Creates a Mynth image adapter directly.

- `model`: a `MynthImageModel`
- `config.apiKey?`: optional override for `MYNTH_API_KEY`
- `config.baseUrl?`: optional base URL override
- `config.destination?`: optional default destination for generated images

Returns a `MynthImageAdapter` for use with `generateImage()`.

### `createMynthImage(config?)`

Creates a reusable provider factory that returns model-bound adapters.

### `mynthFiles(config?)`

Creates a files adapter for `uploadFile()`. Takes `apiKey` and `baseUrl`.

### `mynthByok`

BYOK descriptor, exported from `@mynthio/tanstack-ai-adapter/byok`.

### `MynthNoImagesError`

Thrown when a task completes without any successful image.

### Model lists

`MYNTH_IMAGE_MODELS`, `MYNTH_IMAGE_INPUT_MODELS`, `MYNTH_IMAGE_4K_MODELS` and `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS`, with the matching `MynthImageModel`, `MynthImageInputModel`, `MynthImage4kModel` and `MynthImageNegativePromptModel` types.

## Limitations

- This package provides an image adapter for `generateImage()` and a files adapter for `uploadFile()`
- It does not provide chat or text-generation adapters

## Next Steps

- [Mynth SDK README](https://github.com/mynthio/oss/tree/main/packages/sdk)
- [TanStack Start + Mynth adapter demo](https://github.com/mynthio/oss/tree/main/examples/tanstack-start-ai-mynth-adapter)
- [Mynth](https://mynth.io)
