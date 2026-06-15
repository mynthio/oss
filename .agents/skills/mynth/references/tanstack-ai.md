# TanStack AI Adapter

Use this when the app already uses `@tanstack/ai` and wants Mynth through `generateImage()`.

```bash
bun add @mynthio/tanstack-ai-adapter @tanstack/ai
```

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset over mountains",
});

console.log(result.images); // [{ url: "..." }]
```

Create a reusable provider when the app centralizes API config:

```ts
import { createMynthImage } from "@mynthio/tanstack-ai-adapter";

const mynth = createMynthImage({ apiKey: "mak_..." });

const result = await generateImage({
  adapter: mynth("google/gemini-3.1-flash-image"),
  prompt: "A neon cityscape",
});
```

Streaming:

```ts
import { generateImage, toServerSentEventsResponse } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const stream = generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset",
  stream: true,
});

return toServerSentEventsResponse(stream);
```

Use TanStack's top-level fields for `prompt`, `numberOfImages`, and shorthand `size`. Pass Mynth-specific fields through `modelOptions`:

```ts
const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-dev"),
  prompt: "A sunset",
  numberOfImages: 2,
  modelOptions: {
    output: { format: "png", quality: 100 },
    size: { type: "aspect_ratio", aspectRatio: "16:9" }, // overrides top-level size
    inputs: ["https://example.com/ref.jpg"],
    negativePrompt: "text, watermark", // maps to negative_prompt
    magicPrompt: true, // maps to magic_prompt
    rating: true,
    destination: "my-bucket",
    metadata: { userId: "u_123" },
  },
});
```
