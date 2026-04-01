# SDK Usage

## Client Creation

```ts
import Mynth from "@mynthio/sdk";

// Reads MYNTH_API_KEY from env
const mynth = new Mynth();

// Or pass explicitly
const mynth = new Mynth({
  apiKey: "mak_...",
  baseUrl: "https://api.mynth.io",
});
```

## Sync Generation (default)

Waits for completion, returns a completed task:

```ts
const task = await mynth.generate({
  prompt: "A sunset over mountains",
});

console.log(task.id);
console.log(task.urls); // ["https://cdn.mynth.io/..."]
console.log(task.result?.model);
console.log(task.getImages());
```

## Async Generation

Returns immediately with a task ID and PAT (public access token):

```ts
const taskAsync = await mynth.generate({ prompt: "A sunset over mountains" }, { mode: "async" });

console.log(taskAsync.id);
console.log(taskAsync.access.publicAccessToken);

// Poll until done
const task = await taskAsync.toTask();
console.log(task.urls);
```

## Request Shape

```ts
await mynth.generate({
  prompt: "A neon cityscape at night",
  model: "black-forest-labs/flux.2-dev", // or "auto"
  size: { type: "aspect_ratio", aspectRatio: "16:9" },
  count: 2,
  output: { format: "webp", quality: 80 },
  inputs: ["https://example.com/reference.jpg"],
  metadata: { userId: "u_123" },
});
```

### Prompt

A string, or structured:

```ts
prompt: {
  positive: "Studio product shot",
  negative: "blurry, text",
  enhance: "prefer_magic",
}
```

### Size

- Presets: `"landscape"`, `"portrait"`, `"square"`, `"instagram"`
- `"auto"` — Mynth resolves optimal aspect ratio
- Aspect ratios: `"1:1"`, `"16:9"`, `"4:3"`, `"9:16"`, `"2:3"`, `"3:2"`, etc.
- Optional `scale: "4k"` for higher resolution on supporting models

Mynth applies best resolution presets by default. No raw pixel resolution — use aspect ratios.

See all models and capabilities: [mynth.io/models](https://mynth.io/models)

### Output

Format and quality are processed via sharp:

```ts
output: { format: "webp", quality: 80 }
```

Supported formats: `png`, `jpg`, `webp`.

## Working With Results

```ts
const task = await mynth.generate({ prompt: "A cat astronaut" });

task.id;
task.status; // "pending" | "completed" | "failed"
task.isCompleted;
task.urls; // string[]
task.getImages(); // detailed image objects
task.result?.model; // resolved model
task.getMetadata(); // your metadata object
```

## Error Handling

```ts
import { MynthAPIError, TaskAsyncTimeoutError, TaskAsyncTaskFailedError } from "@mynthio/sdk";

try {
  const task = await mynth.generate({ prompt: "..." });
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
