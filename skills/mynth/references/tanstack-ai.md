# Tanstack AI Adapter

## Installation

```bash
bun add @mynthio/tanstack-ai-adapter @tanstack/ai
```

## Quick Start

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset over mountains",
});

console.log(result.images); // [{ url: "..." }]
```

## Reusable Provider

Create a provider instance for reuse across multiple generations:

```ts
import { createMynthImage } from "@mynthio/tanstack-ai-adapter";

const mynth = createMynthImage({ apiKey: "mak_..." });

const result = await generateImage({
  adapter: mynth("google/gemini-3.1-flash-image"),
  prompt: "A neon cityscape",
});
```

## Streaming (SSE)

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";
import { toServerSentEventsResponse } from "@tanstack/ai";

const stream = generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset",
  stream: true,
});

return toServerSentEventsResponse(stream);
```

## Mynth-Specific Options

Pass Mynth options via `modelOptions`:

```ts
const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset",
  modelOptions: {
    mynth: {
      output: { format: "png", quality: 100 },
      inputs: ["https://example.com/ref.jpg"],
      metadata: { userId: "u_123" },
    },
  },
});
```
