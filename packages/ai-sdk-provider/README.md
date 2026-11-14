# @mynthio/ai-sdk-provider

[Mynth](https://mynth.io) image and video generation for the [Vercel AI SDK](https://ai-sdk.dev).
One API key gives you Mynth's catalog of image models through `generateImage()` and its video
models through `experimental_generateVideo()`.

It is a thin layer over [`@mynthio/sdk`](https://www.npmjs.com/package/@mynthio/sdk): uploads,
safe retries of creates and task polling come from there.

## Setup

```bash
npm install @mynthio/ai-sdk-provider ai
```

Create an API key at [mynth.io](https://mynth.io) and set it as `MYNTH_API_KEY`. Mynth is
prepaid: a call answers `402 insufficient_balance` until the account has credit.

## Provider instance

```ts
import { mynth } from "@mynthio/ai-sdk-provider";
```

The default instance reads `MYNTH_API_KEY` when a model first generates. To configure it:

```ts
import { createMynth } from "@mynthio/ai-sdk-provider";

const mynth = createMynth({
  apiKey: process.env.MY_MYNTH_KEY, // defaults to MYNTH_API_KEY
  baseURL: "https://api.mynth.io", // the default
});
```

## Images

```ts
import { generateImage } from "ai";
import { mynth } from "@mynthio/ai-sdk-provider";

const { image } = await generateImage({
  model: mynth.image("black-forest-labs/flux.2-pro"),
  prompt: "A lighthouse on a cliff at dusk, oil painting",
  aspectRatio: "16:9",
});
```

Pass `files` to edit images or guide them with references; byte files are uploaded for you:

```ts
const { image } = await generateImage({
  model: mynth.image("google/gemini-nano-banana-2.1"),
  prompt: { text: "Make it winter", images: ["https://example.com/house.png"] },
});
```

Model ids are listed at [mynth.io/models](https://mynth.io/models). Pass `"auto"` to let Mynth pick.

## Video

```ts
import { experimental_generateVideo as generateVideo } from "ai";
import { mynth } from "@mynthio/ai-sdk-provider";

const { video } = await generateVideo({
  model: mynth.video("xai/grok-imagine-video-1.5-lite"),
  prompt: "A cat surfing a wave at sunset",
  duration: 6,
  aspectRatio: "16:9",
  resolution: "1280x720",
});
```

Image to video: pass the first frame as the prompt image, or use `frameImages` for a first and last
frame.

```ts
const { video } = await generateVideo({
  model: mynth.video("google/gemini-omni-flash-1.1"),
  prompt: { image: "https://example.com/cat.png", text: "The cat starts surfing" },
});
```

Video renders take minutes. `experimental_generateVideo` waits for the task, polling Mynth as the
`@mynthio/sdk` does; pass `abortSignal` to stop waiting (the task keeps running on Mynth).

## How AI SDK options map to Mynth

| AI SDK option                     | Mynth                                                                                            |
| --------------------------------- | ------------------------------------------------------------------------------------------------ |
| `n` (images)                      | `count`, up to 20 per task                                                                       |
| `aspectRatio`                     | `size`, the closest ratio Mynth supports (a warning when it is not exact)                        |
| `size` (images)                   | Reduced to its aspect ratio, with a warning: Mynth sizes images by ratio, not pixels             |
| `files` (images)                  | `inputs`                                                                                         |
| `resolution` (video)              | The resolution tier from the short side: 480p, 720p, 1080p or 4k (a warning when it is off-tier) |
| `aspectRatio: "adaptive"` (video) | `size: "auto"`: the input image sets the shape                                                   |
| `duration` (video)                | `duration`, in whole seconds                                                                     |
| `image`, `frameImages` (video)    | `inputs` as `first_frame` / `last_frame`                                                         |
| `inputReferences` (video)         | `inputs` as `reference`. Video references are skipped with a warning                             |
| `generateAudio` (video)           | `audio`                                                                                          |
| `seed`, `mask`, `fps`, `headers`  | Not supported; the call goes ahead with a warning                                                |

Anything else Mynth accepts goes in `providerOptions.mynth` and is sent as is. A `size` there wins
over `aspectRatio`, `size` and `resolution`:

```ts
import type { MynthImageProviderOptions } from "@mynthio/ai-sdk-provider";

await generateImage({
  model: mynth.image("black-forest-labs/flux.2-pro"),
  prompt: "A lighthouse at dusk",
  providerOptions: {
    mynth: {
      size: "16:9_4k",
      magic_prompt: true,
      negative_prompt: "text, watermark",
    } satisfies MynthImageProviderOptions,
  },
});
```

## Results and costs

`providerMetadata.mynth` carries the Mynth task: for images, each entry in `images` has its `id`,
`taskId`, `taskCost`, `model`, URLs and size; for video, `taskId`, `cost`, `model` and `videos`.
`cost` is what the task charged, in USD. Images and videos stay on the Mynth CDN for 7 days.

## Errors

Mynth API errors arrive as `APICallError` with `statusCode` and `data.code` (for example
`insufficient_balance` or `validation_error`, with `data.issues`). Only a 429 is retryable: a create
that failed with a 5xx was already retried by `@mynthio/sdk` with the same idempotency key, and an AI
SDK retry would start a second, separately charged task.

## License

MIT
