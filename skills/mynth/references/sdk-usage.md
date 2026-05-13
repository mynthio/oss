# SDK Usage

Use `@mynthio/sdk` from server-side JS/TS code.

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth();
```

## Generate

`generate()` waits until the task completes.

```ts
const task = await mynth.image.generate({
  prompt: "A sunset over mountains",
});

console.log(task.id);
console.log(task.urls); // ["https://cdn.mynth.io/..."]
console.log(task.result?.model);
console.log(task.getImages());
```

## Start Now, Finish Later

`generateAsync()` returns a task ID immediately. Use it for browser polling, background UI states, or webhook-driven persistence.

```ts
const taskAsync = await mynth.image.generateAsync({ prompt: "A sunset over mountains" });

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken);

const task = await taskAsync.wait();
console.log(task.urls);
```

## Request Shape

```ts
await mynth.image.generate({
  prompt: "A neon cityscape at night",
  model: "black-forest-labs/flux.2-dev", // or "auto"
  size: { type: "aspect_ratio", aspectRatio: "16:9" },
  count: 2,
  output: { format: "webp", quality: 80 },
  negative_prompt: "text, watermark",
  magic_prompt: true,
  inputs: ["https://example.com/reference.jpg"],
  metadata: { userId: "u_123" },
});
```

Useful size values:

- `"auto"`
- `"square"`, `"portrait"`, `"landscape"`, `"portrait_tall"`, `"landscape_wide"`
- `"1:1"`, `"2:3"`, `"3:2"`, `"3:4"`, `"4:3"`, `"4:5"`, `"5:4"`, `"9:16"`, `"16:9"`, `"21:9"`, `"2:1"`, `"1:2"`
- `{ type: "aspect_ratio", aspectRatio: "4:5", scale: "4k" }`

## Working With Results

```ts
const task = await mynth.image.generate({ prompt: "A cat astronaut" });

task.id;
task.status; // "pending" | "completed" | "failed"
task.isCompleted;
task.urls; // string[]
task.getImages(); // detailed image objects
task.result?.model; // resolved model
task.getMetadata(); // your metadata object
```

The SDK also exports `AVAILABLE_MODELS` and `MynthSDKTypes` for typed model selection and request objects.

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
