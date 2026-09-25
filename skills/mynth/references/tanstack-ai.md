# TanStack AI Adapter

Use this when the app already uses `@tanstack/ai` and wants Mynth through `generateImage()`.

```bash
bun add @mynthio/tanstack-ai-adapter @tanstack/ai
```

```ts
import { generateImage } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

// example id: pick one from the live catalog (`npx @mynthio/cli models list`), not from MYNTH_IMAGE_MODELS
const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-pro"),
  prompt: "A sunset over mountains",
});

console.log(result.images); // [{ url: "..." }]
```

Create a reusable provider when the app centralizes API config:

```ts
import { createMynthImage } from "@mynthio/tanstack-ai-adapter";

const mynth = createMynthImage({ apiKey: "mak_..." });

const result = await generateImage({
  adapter: mynth("black-forest-labs/flux.2-pro"),
  prompt: "A neon cityscape",
});
```

Streaming:

```ts
import { generateImage, toServerSentEventsResponse } from "@tanstack/ai";
import { mynthImage } from "@mynthio/tanstack-ai-adapter";

const stream = generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-pro"),
  prompt: "A sunset",
  stream: true,
});

return toServerSentEventsResponse(stream);
```

Use TanStack's top-level fields for `prompt`, `numberOfImages`, and shorthand `size`. Pass Mynth-specific fields through `modelOptions`:

```ts
const result = await generateImage({
  adapter: mynthImage("black-forest-labs/flux.2-pro"),
  prompt: "A sunset",
  numberOfImages: 2,
  modelOptions: {
    output: { format: "png" },
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

`MYNTH_IMAGE_MODELS` is the id list built into the package version and includes `auto`. Do not use `mynthImage("auto")`: it is experimental. Image content parts become Mynth `inputs` only on models in `MYNTH_IMAGE_INPUT_MODELS`.
