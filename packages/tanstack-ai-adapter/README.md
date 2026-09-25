# @mynthio/tanstack-ai-adapter

[![npm version](https://img.shields.io/npm/v/@mynthio/tanstack-ai-adapter)](https://www.npmjs.com/package/@mynthio/tanstack-ai-adapter)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

TanStack AI image generation adapter for [Mynth](https://mynth.io).

It lets you use Mynth models with `generateImage()` while keeping TanStack AI's adapter pattern, normalized result shape, and full-stack streaming workflows.

## Features

- `mynthImage(model, config?)` for the common one-off case
- `createMynthImage(config?)` for reusable provider configuration
- Typed model IDs and capability lists (`MYNTH_IMAGE_MODELS`, `MYNTH_IMAGE_INPUT_MODELS`, and more) for model pickers and guards
- Per-model `modelOptions` typing: options a model cannot use are compile-time errors
- Image-to-image via TanStack content-part prompts, mapped onto Mynth `inputs`
- `mynthFiles()` for TanStack's `uploadFile()`: upload an image once, reference it in later prompts
- Cancellation through TanStack's `timeout` and `abortSignal`
- Normalized image results with `revisedPrompt`, plus `usage` with the image count and cost
- A browser-safe `mynthByok` descriptor for TanStack AI's bring-your-own-key flow

Requires `@tanstack/ai` 0.61 or newer.

## Installation

```bash
# Bun
bun add @mynthio/tanstack-ai-adapter @tanstack/ai

# pnpm
pnpm add @mynthio/tanstack-ai-adapter @tanstack/ai

# npm
npm install @mynthio/tanstack-ai-adapter @tanstack/ai

# yarn
yarn add @mynthio/tanstack-ai-adapter @tanstack/ai
```

## Authentication

Set your Mynth API key:

```env
MYNTH_API_KEY=mak_...
```

Keep the key on the server. You can also pass `apiKey` directly when creating the adapter. `baseUrl` is optional and useful for proxies, tests, or custom deployments.

## Quick Start

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("krea/krea-2-large"),
  prompt: "Editorial product photo of a ceramic mug on a linen tablecloth",
  numberOfImages: 1,
  size: "portrait",
});

console.log(result.id);
console.log(result.model);
console.log(result.images[0]?.url);
```

The adapter is model-bound, so you choose the Mynth model when you create it.

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

Per-call config overrides shared config:

```ts
const adapter = mynth("auto", {
  baseUrl: "https://proxy.example.com",
});
```

## Mynth Provider Options

Use TanStack's top-level fields for common options like `prompt`, `numberOfImages`, and shorthand `size`. Use `modelOptions` for Mynth-specific request fields:

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("google/gemini-3.1-flash-image"),
  prompt: "Modern poster design for a jazz festival",
  numberOfImages: 2,
  size: "landscape",
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
    },
    inputs: ["https://example.com/reference-image.jpg"],
    webhook: {
      dashboard: false,
    },
    access: {
      pat: {
        enabled: false,
      },
    },
    rating: true,
    metadata: {
      requestId: "req_123",
    },
    destination: "my-bucket",
  },
});
```

Notes:

- `magicPrompt` maps to Mynth's `magic_prompt`. The enhanced prompt comes back as `images[*].revisedPrompt`
- `negativePrompt` maps to Mynth's `negative_prompt`
- `size` overrides the top-level `size`. Use it for structured sizes: aspect ratios with an optional `scale: "4k"`, or `{ type: "auto" }`
- Top-level `size` takes shorthand strings: `"auto"` and presets such as `"square"`, `"16:9"` or `"16:9_4k"`
- `inputs` adds image inputs after the prompt's image parts. Entries can be URLs, `Blob`/`File` values (uploaded for you), or structured inputs with an explicit `as` role
- `access` lets you disable the default Public Access Token response when you do not need browser-side polling
- `destination` delivers the generation to a configured Mynth destination, overriding any adapter-level or `MYNTH_DESTINATION` default

### Options per model

`modelOptions` is typed for the adapter's model, so options that model cannot use fail at compile time:

- `inputs` (and image prompt parts) only on models in `MYNTH_IMAGE_INPUT_MODELS`
- 4k sizes (`_4k` presets and `scale: "4k"`) only on models in `MYNTH_IMAGE_4K_MODELS`. `auto` does not accept them, because the model it picks may not have 4k output
- `negativePrompt` on its own only on models in `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS` and on `auto`, which also uses it to pick a model. Other models take a negative prompt only together with `magicPrompt: true`, which uses it to steer the enhanced prompt

`MynthImageProviderOptionsFor<Model>` is the options type for one model, if you build options separately.

## Image inputs (image-to-image)

Models that support image inputs accept TanStack AI's content-part prompts, so
you can interleave instruction text with reference images for image-to-image,
reference-guided, and edit flows. The adapter maps the image parts onto
Mynth's `inputs`:

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("luma/uni-1"),
  prompt: [
    { type: "text", content: "Place the product in the style of the reference" },
    {
      type: "image",
      source: { type: "url", value: "https://example.com/product.jpg" },
    },
    {
      type: "image",
      source: { type: "url", value: "https://example.com/style.jpg" },
      metadata: { role: "reference" },
    },
  ],
});
```

Notes:

- Only the models in `MYNTH_IMAGE_INPUT_MODELS` accept image parts; passing image
  parts to a text-only model is a compile-time error.
- URL sources (`{ type: "url", value }`) are sent as they are. Inline data
  sources (`{ type: "data", value, mimeType }`) are uploaded to Mynth first,
  because the Mynth API only fetches http(s) URLs. File sources from
  `mynthFiles()` are covered below.
- Mynth accepts JPEG, PNG and WebP images.
- A part's `metadata.role` sets its Mynth input role (`as`): `"reference"` and
  `"character"` map to Mynth's `"reference"` guidance role, and Mynth routes a
  part without a role itself. Mynth has no mask, control or frame inputs, so
  parts with those roles throw instead of being sent as plain images. Pass
  `modelOptions.inputs` with `as: "source"` to mark a source image explicitly.
- Video and audio parts throw: Mynth image generation takes text and images only.

## Uploading images once

`mynthFiles()` plugs into TanStack AI's `uploadFile()`. Upload an image once and
reference it in later prompts, for example across the turns of an edit flow:

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

The handle's `id` and `uri` are the uploaded image's URL, held in Mynth's
temporary input storage. Mynth has no API to look up or delete an upload, so
`getFile()` and `deleteFile()` are not available.

## Cancellation

TanStack AI's `timeout` and `abortSignal` stop the adapter. It cancels pending
uploads and requests and stops polling the Mynth task:

```ts
const result = await generateImage({
  adapter: mynthImage("auto"),
  prompt,
  timeout: 120_000,
  abortSignal: request.signal,
});
```

A task that was already created keeps running on Mynth, and it is still billed.

## Usage and cost

`result.usage` reports what Mynth billed:

```ts
result.usage?.billed; // { quantity: 2, unit: "images" }
result.usage?.cost; // total task cost in USD, e.g. 0.024
```

Token fields are always `0`, since Mynth bills per image. TanStack AI passes
`usage` to middleware such as `otelMiddleware()`.

## Errors

When a task completes but every image failed, the adapter throws
`MynthNoImagesError`. It carries the `taskId` and each image's `errors` entry.
When only some images fail, the result holds the successful ones.

```ts
import { MynthNoImagesError } from "@mynthio/tanstack-ai-adapter";

try {
  await generateImage({ adapter: mynthImage("auto"), prompt });
} catch (error) {
  if (error instanceof MynthNoImagesError) {
    console.log(
      error.taskId,
      error.errors.map((e) => e.code),
    );
  }
}
```

Request and task errors from the Mynth SDK (for example `MynthAPIError` or
`TaskAsyncTaskFailedError`) propagate unchanged.

## Bring your own key

`@mynthio/tanstack-ai-adapter/byok` exports `mynthByok` for TanStack AI's BYOK
flow. It holds no key and does not import the Mynth SDK, so it is safe in the
browser. On the server, read the user's key (the `x-byok-mynth` header, then
`MYNTH_API_KEY`) and pass it to the adapter:

```ts
import { byokMissing } from "@tanstack/ai/byok";
import { getByokKey } from "@tanstack/ai/byok/server";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";
import { mynthByok } from "@mynthio/tanstack-ai-adapter/byok";

const apiKey = getByokKey(request, mynthByok);
if (!apiKey) return byokMissing(mynthByok);

const adapter = mynthImage("auto", { apiKey });
```

See TanStack AI's BYOK docs for the client side (`defineByok` in
`@tanstack/ai-client/byok`).

## Available Models

The package exports runtime arrays and type unions for Mynth image models:

```ts
import { MYNTH_IMAGE_MODELS, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";

const defaultModel: MynthImageModel = "auto";

for (const model of MYNTH_IMAGE_MODELS) {
  console.log(model);
}
```

This is especially useful for building selectors, validating incoming model IDs, or keeping server and client code in sync.

Capability subsets mirror the Mynth SDK's model catalog:

| List                                 | Type                            | Models that…                         |
| ------------------------------------ | ------------------------------- | ------------------------------------ |
| `MYNTH_IMAGE_INPUT_MODELS`           | `MynthImageInputModel`          | accept image inputs (image-to-image) |
| `MYNTH_IMAGE_4K_MODELS`              | `MynthImage4kModel`             | can output at 4k scale               |
| `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS` | `MynthImageNegativePromptModel` | take a native negative prompt        |

## Full-Stack Streaming Example

This adapter works well with TanStack AI's streaming image flow. The example app in this repo uses a server route that streams `generateImage()` over SSE:

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

For a working app with model selection and `useGenerateImage()`, see [tanstack-start-ai-mynth-adapter](https://github.com/mynthio/oss/tree/main/examples/tanstack-start-ai-mynth-adapter).

## Result Shape

The adapter returns TanStack AI's normalized image result:

- `id`: the Mynth task id
- `model`: the resolved model returned by Mynth, or the requested model as a fallback
- `images`: only successful images are included
- `images[*].url`: the image's destination URL, or its Mynth CDN URL when it has no destination URL
- `images[*].revisedPrompt`: included when Mynth enhances the prompt
- `usage`: `billed` image count and the task's `cost` in USD

## API

### `mynthImage(model, config?)`

Creates a Mynth image adapter directly.

- `model`: a `MynthImageModel`
- `config.apiKey?`: optional override for `MYNTH_API_KEY`
- `config.baseUrl?`: optional base URL override
- `config.destination?`: optional default destination, overriding `MYNTH_DESTINATION`

### `createMynthImage(config?)`

Creates a reusable provider factory that returns model-bound adapters.

### `mynthFiles(config?)`

Creates a files adapter for `uploadFile()`. Takes `apiKey` and `baseUrl`.

### `mynthByok`

BYOK descriptor, exported from `@mynthio/tanstack-ai-adapter/byok`.

### `MynthNoImagesError`

Thrown when a task completes without any successful image.

### Model lists

`MYNTH_IMAGE_MODELS`, `MYNTH_IMAGE_INPUT_MODELS`, `MYNTH_IMAGE_4K_MODELS` and
`MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS`, with the matching `MynthImageModel`,
`MynthImageInputModel`, `MynthImage4kModel` and `MynthImageNegativePromptModel`
types.

## Development

From [`public/oss`](../../):

```bash
pnpm install
pnpm build
pnpm test
pnpm typecheck
```

Package-local commands also work from this directory:

```bash
pnpm build
pnpm test
pnpm typecheck
```

## Contributing

Contributions are welcome. See [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).

## License

MIT
