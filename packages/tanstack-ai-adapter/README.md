# @mynthio/tanstack-ai-adapter

[![npm version](https://img.shields.io/npm/v/@mynthio/tanstack-ai-adapter)](https://www.npmjs.com/package/@mynthio/tanstack-ai-adapter)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

TanStack AI image generation adapter for [Mynth](https://mynth.io).

It lets you use Mynth models with `generateImage()` while keeping TanStack AI's adapter pattern, normalized result shape, and full-stack streaming workflows.

## Features

- `mynthImage(model, config?)` for the common one-off case
- `createMynthImage(config?)` for reusable provider configuration
- Typed model IDs, display names and capabilities (`MYNTH_IMAGE_MODEL_META`, `MYNTH_IMAGE_MODELS`, `isMynthImageModel()`, and more) for model pickers and guards
- Per-model `modelOptions` typing: options a model cannot use are compile-time errors
- Image-to-image via TanStack content-part prompts, mapped onto Mynth `inputs`
- `mynthFiles()` for TanStack's `uploadFile()`: upload an image once, reference it in later prompts
- Cancellation through TanStack's `timeout` and `abortSignal`
- Normalized image results with `revisedPrompt`, plus `usage` with the image count and cost
- Typed errors with stable codes that TanStack AI reports on `RUN_ERROR`
- `baseURL`, `defaultHeaders` and a custom `fetch` for proxies, gateways and tests
- A browser-safe `mynthByok` descriptor for TanStack AI's bring-your-own-key flow
- No dependencies besides the `@tanstack/ai` peer: the adapter talks to the Mynth API directly

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

Keep the key on the server. You can also pass `apiKey` directly when creating the adapter. See [Proxies and gateways](#proxies-and-gateways) for `baseURL` and friends.

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
  destination: "my-bucket",
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
  destination: "another-bucket",
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
      aspect_ratio: "4:5",
      scale: "4k",
    },
    output: {
      format: "png",
    },
    inputs: ["https://example.com/reference-image.jpg"],
    webhook: {
      registered: false,
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
- `destination` delivers the generation to a configured Mynth destination, overriding any adapter-level or `MYNTH_DESTINATION` default

### Options per model

`modelOptions` is typed for the adapter's model, so options that model cannot use fail at compile time:

- `inputs` (and image prompt parts) only on models in `MYNTH_IMAGE_INPUT_MODELS`
- 4k sizes (`_4k` presets and `scale: "4k"`) only on models in `MYNTH_IMAGE_4K_MODELS`. `auto` does not accept them, because the model it picks may not have 4k output
- `negativePrompt` on its own only on models in `MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS` and on `auto`, which also uses it to pick a model. Other models take a negative prompt only together with `magicPrompt: true`, which uses it to steer the enhanced prompt

`MynthImageProviderOptionsFor<Model>` is the options type for one model, if you build options separately.

A few edit models (`bria/fibo-edit-1.5`, `reve/reve-remix`) need at least one input image. Without one, Mynth answers with a `validation_error`.

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

## How a generation runs

`generateImages()` uploads any local input images in one request, creates the
Mynth task, and waits for it:

- It polls the task status every second for the first 10 seconds, every 2
  seconds up to a minute, then every 5 seconds. Most images finish within the
  first phase. The full task is read once, when the status says it is done.
- Network errors, `5xx` responses and a cold-cache `404` are retried with
  backoff for up to 2 minutes in a row. A `429` waits as long as `Retry-After`
  asks. `401`, `403` and other `4xx` responses fail at once.
- Creating the task is never retried, because a repeat would create and bill a
  second task.
- The wait gives up after 30 minutes with `MynthTaskTimeoutError`. Use
  TanStack's `timeout` for a shorter limit.

Pass `debug: { provider: true }` to `generateImage()` to log every polled status.

## Usage and cost

`result.usage` reports what Mynth billed:

```ts
result.usage?.billed; // { quantity: 2, unit: "images" }
result.usage?.cost; // total task cost in USD, e.g. 0.024
```

Token fields are always `0`, since Mynth bills per image. TanStack AI passes
`usage` to middleware such as `otelMiddleware()`.

## Errors

Every Mynth failure is a `MynthError` with a `code`. TanStack AI reports that
code on the stream's `RUN_ERROR` event, so a client can tell the cases apart.

| Error                   | `code`                                                          | When                                                                                            |
| ----------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `MynthAPIError`         | the API's code, e.g. `insufficient_balance`, `validation_error` | The API answered with an error status. Also has `status`, `issues`, `taskId` and `retryAfterMs` |
| `MynthTaskFailedError`  | `MYNTH_TASK_FAILED`                                             | The task failed as a whole. `errors` says why. It is not billed                                 |
| `MynthNoImagesError`    | `MYNTH_NO_IMAGES`                                               | The task completed, but every image failed. `errors` says why                                   |
| `MynthTaskTimeoutError` | `MYNTH_TASK_TIMEOUT`                                            | The task did not settle within 30 minutes                                                       |
| `MynthResponseError`    | `MYNTH_INVALID_RESPONSE`                                        | A response did not have the expected shape                                                      |

When only some images fail, the result holds the successful ones and nothing
is thrown.

```ts
import { MynthAPIError, MynthNoImagesError } from "@mynthio/tanstack-ai-adapter";

try {
  await generateImage({ adapter: mynthImage("auto"), prompt });
} catch (error) {
  if (error instanceof MynthAPIError && error.code === "insufficient_balance") {
    // top up
  } else if (error instanceof MynthNoImagesError) {
    console.log(
      error.taskId,
      error.errors.map((e) => e.code),
    );
  }
}
```

A timeout or a cancelled request rejects with the abort reason instead.

## Bring your own key

`@mynthio/tanstack-ai-adapter/byok` exports `mynthByok` for TanStack AI's BYOK
flow. It holds no key and does not import the adapters, so it is safe in the
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

With TanStack AI 0.68 or newer, `keyedAdapter()` wraps the factory so a host
can pick the key per request:

```ts
import { byokMissing, keyedAdapter } from "@tanstack/ai/byok";
import { keyedAdapterFromRequest } from "@tanstack/ai/byok/server";

const mynth = keyedAdapter(mynthByok, (apiKey) => mynthImage("auto", { apiKey }));

const adapter = keyedAdapterFromRequest(request, [mynth]);
if (!adapter) return byokMissing(mynthByok);
```

See TanStack AI's [BYOK docs](https://tanstack.com/ai/latest/docs/advanced/byok)
for the client side (`defineByok` in `@tanstack/ai-client/byok`).

## Proxies and gateways

The connection settings use the names every TanStack AI adapter uses, so the
same gateway config works here:

```ts
const mynth = createMynthImage({
  baseURL: "https://gateway.example.com/mynth",
  defaultHeaders: { "cf-aig-authorization": `Bearer ${process.env.GATEWAY_TOKEN}` },
  fetch: instrumentedFetch, // optional: replaces the global fetch
});
```

`baseUrl` still works, but is deprecated. When both are set, `baseURL` wins.

## Available Models

The package exports the models it knows, with display names and capabilities:

```ts
import {
  isMynthImageModel,
  MYNTH_IMAGE_MODEL_META,
  MYNTH_IMAGE_MODELS,
} from "@mynthio/tanstack-ai-adapter";

for (const model of MYNTH_IMAGE_MODELS) {
  console.log(model, MYNTH_IMAGE_MODEL_META[model].label); // "krea/krea-2-large Krea 2 Large"
}

// Validate a model ID from a request before creating the adapter
const model = isMynthImageModel(body.model) ? body.model : "auto";
```

This is especially useful for building selectors, validating incoming model IDs, or keeping server and client code in sync.

Capability subsets, also available per model through `hasMynthImageCapability(model, capability)`:

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
- `config.destination?`: optional default destination, overriding `MYNTH_DESTINATION`

- `config.baseURL?`, `config.defaultHeaders?`, `config.fetch?`: see [Proxies and gateways](#proxies-and-gateways)

### `createMynthImage(config?)`

Creates a reusable provider factory that returns model-bound adapters.

### `mynthFiles(config?)`

Creates a files adapter for `uploadFile()`. Takes `apiKey`, `baseURL`, `defaultHeaders` and `fetch`.

### `mynthByok`

BYOK descriptor, exported from `@mynthio/tanstack-ai-adapter/byok`.

### Errors

`MynthError` and its subclasses `MynthAPIError`, `MynthTaskFailedError`,
`MynthNoImagesError`, `MynthTaskTimeoutError` and `MynthResponseError`. See
[Errors](#errors).

### Models

`MYNTH_IMAGE_MODEL_META` (display name and capabilities per model),
`MYNTH_IMAGE_MODELS`, `MYNTH_IMAGE_INPUT_MODELS`, `MYNTH_IMAGE_4K_MODELS` and
`MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS`, with the matching `MynthImageModel`,
`MynthImageInputModel`, `MynthImage4kModel` and `MynthImageNegativePromptModel`
types, plus the `isMynthImageModel()` and `hasMynthImageCapability()` guards.

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
pnpm check:models # compare the model table with the live Mynth catalog
```

## Contributing

Contributions are welcome. See [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).

## License

MIT
