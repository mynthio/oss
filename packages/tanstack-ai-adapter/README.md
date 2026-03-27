# @mynthio/tanstack-ai-adapter

[![npm version](https://img.shields.io/npm/v/@mynthio/tanstack-ai-adapter)](https://www.npmjs.com/package/@mynthio/tanstack-ai-adapter)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](https://opensource.org/licenses/MIT)

TanStack AI image generation adapter for [Mynth](https://mynth.io).

It lets you use Mynth models with `generateImage()` while keeping TanStack AI's adapter pattern, normalized result shape, and full-stack streaming workflows.

## Features

- `mynthImage(model, config?)` for the common one-off case
- `createMynthImage(config?)` for reusable provider configuration
- Typed `MYNTH_IMAGE_MODELS` and `MynthImageModel` exports for model pickers and guards
- Support for both TanStack image options and Mynth-specific provider options
- Normalized image results, including `revisedPrompt` when Mynth enhances the prompt

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

You can also pass `apiKey` directly when creating the adapter. `baseUrl` is optional and useful for proxies, tests, or custom deployments.

## Quick Start

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
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
  prompt: "Ignored when promptStructured is provided",
  numberOfImages: 2,
  size: "landscape",
  modelOptions: {
    promptStructured: {
      positive: "Modern poster design for a jazz festival",
      negative: "watermark, blurry text",
      enhance: "prefer_magic",
    },
    size: {
      type: "aspect_ratio",
      aspectRatio: "4:5",
    },
    output: {
      format: "png",
      quality: 90,
    },
    inputs: ["https://example.com/reference-image.jpg"],
    webhook: {
      enabled: true,
    },
    access: {
      pat: {
        enabled: false,
      },
    },
    contentRating: {
      enabled: true,
    },
    metadata: {
      requestId: "req_123",
    },
  },
});
```

Notes:

- `modelOptions.promptStructured` overrides the plain `prompt`
- `modelOptions.size` overrides the top-level `size`
- Top-level `size` is for shorthand values such as `"auto"` and preset strings
- Use `modelOptions.size` when you need structured request sizes, including aspect ratios and an optional `scale: "4k"`
- `modelOptions.access` lets you disable the default Public Access Token response when you do not need browser-side polling

Use `scale: "4k"` when you want the higher tier and the model supports it.

## Available Models

The package exports both a runtime array and a type union for Mynth image models:

```ts
import { MYNTH_IMAGE_MODELS, type MynthImageModel } from "@mynthio/tanstack-ai-adapter";

const defaultModel: MynthImageModel = "auto";

for (const model of MYNTH_IMAGE_MODELS) {
  console.log(model);
}
```

This is especially useful for building selectors, validating incoming model IDs, or keeping server and client code in sync.

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
- `images[*].revisedPrompt`: included when Mynth returns an enhanced prompt

## API

### `mynthImage(model, config?)`

Creates a Mynth image adapter directly.

- `model`: a `MynthImageModel`
- `config.apiKey?`: optional override for `MYNTH_API_KEY`
- `config.baseUrl?`: optional base URL override

### `createMynthImage(config?)`

Creates a reusable provider factory that returns model-bound adapters.

### `MYNTH_IMAGE_MODELS`

Readonly array of supported Mynth image model IDs.

### `MynthImageModel`

Type union of all supported model IDs.

## Development

From [`public/oss`](../../):

```bash
bun install
bun run build
bun run test
bun run typecheck
```

Package-local commands also work from this directory:

```bash
bun run build
bun run test
bun run typecheck
```

## Contributing

Contributions are welcome. See [`../../CONTRIBUTING.md`](../../CONTRIBUTING.md).

## License

MIT
