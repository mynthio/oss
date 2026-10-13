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
    size: { type: "aspect_ratio", aspect_ratio: "16:9" }, // overrides top-level size
    inputs: ["https://example.com/ref.jpg"],
    negativePrompt: "text, watermark", // maps to negative_prompt
    magicPrompt: true, // maps to magic_prompt
    rating: true,
    destination: "my-bucket",
    metadata: { userId: "u_123" },
  },
});
```

`MYNTH_IMAGE_MODELS` is the id list built into the package version and includes `auto`; `MYNTH_IMAGE_MODEL_META[id].label` is its display name, and `isMynthImageModel(value)` validates an id from a request. Do not use `mynthImage("auto")`: it is experimental. Image content parts become Mynth `inputs` only on models in `MYNTH_IMAGE_INPUT_MODELS`.

The adapter has no dependency on `@mynthio/sdk`: it calls the REST API itself and waits for the task. Do not add the SDK just for the adapter. Failures are `MynthError` subclasses with a `code` that TanStack AI puts on `RUN_ERROR`:

| Error                   | `code`                                                     |
| ----------------------- | ---------------------------------------------------------- |
| `MynthAPIError`         | the API's code, e.g. `insufficient_balance`; also `status` |
| `MynthTaskFailedError`  | `MYNTH_TASK_FAILED`, with the task's `errors`              |
| `MynthNoImagesError`    | `MYNTH_NO_IMAGES`, when every image failed                 |
| `MynthTaskTimeoutError` | `MYNTH_TASK_TIMEOUT`, after 30 minutes                     |

Proxies and gateways: pass `baseURL`, `defaultHeaders`, or a custom `fetch` in the adapter config.
