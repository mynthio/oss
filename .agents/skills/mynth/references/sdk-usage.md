# SDK Usage

Use `@mynthio/sdk` from server-side JS/TS code.

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth(); // reads MYNTH_API_KEY (and optional MYNTH_DESTINATION)
```

Constructor options: `{ apiKey?, baseUrl?, destination? }`.

## Generate

`generate()` waits until the task completes (polls up to 5 minutes).

```ts
const task = await mynth.image.generate({
  prompt: "A sunset over mountains",
});

console.log(task.urls); // ["https://cdn.mynth.io/..."]
console.log(task.result?.model); // resolved model
console.log(task.getImages());
```

## Start Now, Finish Later

`generateAsync()` returns a task ID immediately. Use it for browser polling, background UI states, or webhook-driven persistence.

```ts
const taskAsync = await mynth.image.generateAsync({ prompt: "A sunset over mountains" });

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken); // safe to send to browser

const task = await taskAsync.wait(); // optional: still wait server-side
```

## Request Shape

```ts
await mynth.image.generate({
  prompt: "A neon cityscape at night", // required, max 8192 chars
  model: "black-forest-labs/flux.2-dev", // default "auto" (picked from prompt)
  size: { type: "aspect_ratio", aspectRatio: "16:9" },
  count: 2, // 1-20, default 1
  output: { format: "webp", quality: 80 }, // png | jpg | webp; default webp/80
  negative_prompt: "text, watermark",
  magic_prompt: true, // Mynth-side prompt enhancement
  inputs: ["https://example.com/reference.jpg"], // reference/init images, max 20
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

Inputs accept URL strings or structured objects when the role matters:

```ts
inputs: [{ type: "image", role: "init", source: { type: "url", url: "https://..." } }];
// role: "auto" | "init" | "reference"
```

## Working With Results

```ts
const task = await mynth.image.generate({ prompt: "A cat astronaut" });

task.id;
task.status; // "pending" | "completed" | "failed"
task.isCompleted;
task.isFailed;
task.urls; // string[] — successful image URLs only
task.getImages(); // successful images: { url, mynth_url, cost, size, rating?, destination? }
task.getImages({ includeFailed: true }); // include failed images with error codes
task.result?.model; // resolved model ID
task.getMetadata(); // your metadata object
```

Each image has `url` (may be `null` when delivered only to a user destination) and `mynth_url` (always the Mynth CDN URL). `task.urls` skips `null` entries; use `getImages()` and read `mynth_url` when destinations are involved.

The SDK also exports `AVAILABLE_MODELS` (model IDs with capability flags like `inputs`, `negative_prompt`, `4k`, `mynth_magic_prompt`) and `MynthSDKTypes` for typed model selection and request objects.

## Error Handling

```ts
import { MynthAPIError, TaskAsyncTimeoutError, TaskAsyncTaskFailedError } from "@mynthio/sdk";

try {
  const task = await mynth.image.generate({ prompt: "..." });
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
