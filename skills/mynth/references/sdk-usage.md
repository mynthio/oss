# SDK Usage

Use `@mynthio/sdk` from server-side JS/TS code.

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth(); // reads MYNTH_API_KEY (and optional MYNTH_DESTINATION)
```

Constructor options: `{ apiKey?, baseUrl?, destination? }`.

## Generate

`generate()` waits until the task completes (polls up to 30 minutes).

```ts
const task = await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro", // example id; choose from the catalog (SKILL.md)
  prompt: "A sunset over mountains",
});

console.log(task.urls); // ["https://cdn.mynth.io/..."]
console.log(task.result?.model); // resolved model
console.log(task.getImages());
```

## Start Now, Finish Later

`generateAsync()` returns a task ID immediately. Use it for browser polling, background UI states, or webhook-driven persistence.

```ts
const taskAsync = await mynth.image.generateAsync({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset over mountains",
});

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken); // safe to send to browser

const task = await taskAsync.wait(); // optional: still wait server-side
```

## Request Shape

```ts
await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro", // always pass a catalog id; omitted means experimental "auto"
  prompt: "A neon cityscape at night", // required, max 8192 chars
  size: { type: "aspect_ratio", aspectRatio: "16:9" },
  count: 2, // 1-20, default 1
  output: { format: "webp" }, // png | jpg | webp; default: the provider's format
  negative_prompt: "text, watermark",
  magic_prompt: true, // Mynth-side prompt enhancement
  inputs: ["https://example.com/reference.jpg"], // needs a model with img->img; max 20
  rating: true, // rate generated images; see image-rating.md
  destination: "my-bucket", // deliver to user storage; see destinations.md
  metadata: { userId: "u_123" },
});
```

Size values:

- `"auto"`
- Presets: `"square"`, `"portrait"`, `"landscape"`, `"portrait_tall"`, `"landscape_wide"`
- Ratios: `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`, `"2:1"`, `"1:2"` — append `_4k` for 4k (e.g. `"16:9_4k"`)
- Structured: `{ type: "aspect_ratio", aspectRatio: "4:5", scale: "4k" }`

Inputs accept URL strings or structured objects:

```ts
inputs: [{ type: "image", source: { type: "url", url: "https://..." } }];
```

Each input can declare a role with `as` to guide the model. Valid values are `auto` (default), `source`, and `reference`. Most models treat every input the same way. Unified models such as Luma UNI-1 instead split inputs by **caller-declared role**:

- `as: "source"` — the image to transform or edit.
- `as: "reference"` — guidance only (style, character, composition).

A reference-only request (every input is `reference`) runs as text-to-image, just guided by references; a request with any `source` (or any untagged input, which defaults to `source`) runs as edit. Omit `as` to let Mynth default it — for Luma the first untagged input becomes the source and the rest become references.

```ts
// Luma: edit one source image, guided by two references
inputs: [
  { type: "image", as: "source", source: { type: "url", url: "https://.../product.png" } },
  { type: "image", as: "reference", source: { type: "url", url: "https://.../style.png" } },
  { type: "image", as: "reference", source: { type: "url", url: "https://.../mood.png" } },
];

// Luma: text-to-image guided only by references, no source to edit
inputs: [
  { type: "image", as: "reference", source: { type: "url", url: "https://.../style.png" } },
  { type: "image", as: "reference", source: { type: "url", url: "https://.../mood.png" } },
];
```

## Working With Results

```ts
const task = await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A cat astronaut",
});

task.id;
task.status; // "pending" | "completed" | "failed"
task.isCompleted;
task.isFailed;
task.urls; // string[] — successful image URLs only
task.getImages(); // successful images: { id, url, mynth_url, size, format, rating? }
task.getImages({ includeFailed: true }); // include failed images with error codes
task.result?.model; // resolved model ID
task.getMetadata(); // your metadata object
```

Each image has `url` (your storage when a destination was named, `null` if that upload failed) and `mynth_url` (always the Mynth CDN URL, served for 7 days). `task.urls` skips `null` entries; use `getImages()` and read `mynth_url` when destinations are involved.

A completed task can hold failed images: `urls` and `getImages()` skip them. Compare `getImages().length` with `count`, or read `getImages({ includeFailed: true })` for each `error.code`.

## Models

Read the live catalog with `mynth.models.list()` (no API key needed) to find ids, modes, input rules, and prices. See "Choose a Model" in [SKILL.md](../SKILL.md).

The SDK also exports `AVAILABLE_MODELS` and `AVAILABLE_VIDEO_MODELS`, but they are fixed at the package's build time and `AVAILABLE_MODELS` includes `auto`. Use them for types or a picker's defaults, not as the source of which models exist. `MynthSDKTypes` holds the request and result types.

## Video

```ts
const video = await mynth.video.generate({
  model: "bytedance/seedance-2.0-mini", // example id; required, video has no auto
  prompt: "A lighthouse beam sweeping over waves",
  duration: 5,
  resolution: "720p",
});

video.urls;
```

`video.generate()` waits up to an hour. In request handlers use `video.generateAsync()` and finish in a webhook. `video.estimate()` prices a body. Video takes no `destination`. Details: https://mynth.io/docs/guides/generate-video.md

## Alt Text

Use `mynth.image.alt()` to generate short alt text for an existing image URL.

```ts
const result = await mynth.image.alt({
  url: "https://example.com/image.webp",
});

result.alt;
result.cost;
```

Use `altAsync()` to start the task and wait later:

```ts
const taskAsync = await mynth.image.altAsync({
  url: "https://example.com/image.webp",
});

const result = await taskAsync.wait();
console.log(result.alt);
```

## Remove Background

Use `mynth.image.removeBackground()` to get a transparent version of an existing image. Mynth picks the model. See [image-remove-background.md](image-remove-background.md) for output formats, destinations, and the async variant.

```ts
const result = await mynth.image.removeBackground({
  url: "https://example.com/product.jpg",
});

result.image.url;
```

## Error Handling

```ts
import { MynthAPIError, TaskAsyncTimeoutError, TaskAsyncTaskFailedError } from "@mynthio/sdk";

try {
  const task = await mynth.image.generate({ model: "black-forest-labs/flux.2-pro", prompt: "..." });
} catch (error) {
  if (error instanceof MynthAPIError) {
    console.error(error.status, error.code, error.message);
  } else if (error instanceof TaskAsyncTimeoutError) {
    console.error("Polling timed out");
  } else if (error instanceof TaskAsyncTaskFailedError) {
    console.error("Task failed");
  }
}
```

Also exported: `TaskAsyncUnauthorizedError` (bad API key/PAT) and `TaskAsyncFetchError` (network failures after retries).
