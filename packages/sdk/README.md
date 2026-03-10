# @mynthio/sdk

Official SDK for the [Mynth](https://mynth.io) AI image generation API.

## Installation

```bash
// Bun
bun add @mynthio/sdk

// PNPM
pnpm add @mynthio/sdk

// NPM
npm install @mynthio/sdk

// Yarn
yarn add @mynthio/sdk
```

## Quick Start

Add `MYNTH_API_KEY` to your environment variables:

```env
MYNTH_API_KEY=mak_...
```

Create mynth client. For example inside `/lib`

```typescript
// lib/mynth.ts
import Mynth from "@mynthio/sdk";

export const mynth = new Mynth();
```

Use client to generate images:

```typescript
import { mynth } from "./lib/mynth";

// Generate an image (by default it waits for completion)
const task = await mynth.generate({
  prompt: "A beautiful sunset over mountains",
  model: "black-forest-labs/flux.1-dev",
});

console.log(task.result.images);
```

Under the hood we poll for the status of the task, waiting until it's completed. When it's done, the `Task` instance is returned.

## Async Mode

Sometimes you don't want to wait for the task, and you just want to trigger generation. For example:

- You use webhooks to save data, and you just trigger generation
- You want to poll for images on client side

```typescript
import { mynth } from "./lib/mynth";

const taskAsync = await mynth.generate(
  {
    prompt: "A futuristic cityscape",
    model: "black-forest-labs/flux.1-dev",
  },
  { mode: "async" },
);

console.log("Task started:", taskAsync.id);

// If you want to to get the result later, use .toTask()
const completedTask = await taskAsync.toTask();
```

Async mode is especially useful for a client side polling. We support public access tokens, and fetching statuses from client side:

```typescript
import { mynth } from "./lib/mynth";

const taskAsync = await mynth.generate(
  {
    prompt: "A futuristic cityscape",
    model: "black-forest-labs/flux.1-dev",
  },
  { mode: "async" },
);

return {
  id: taskAsync.id,
  access: taskAsync.access;
}

// In frontend:
// TODO: Do proper example for SWR
const { data, error, isLoading } = useSWR(`/api/tasks/${response.id}/images`, fetcher, {
  refreshInterval: 1000 // Poll every 1 second
  // Token
})
```

## Available Models

We provide a helpful object with all supported models, including display names and capabilities so you can use it for validation or generating UIs.

```typescript
import { AVAILABLE_MODELS } from "@mynthio/sdk";

console.log(AVAILABLE_MODELS);
// [
//   {
//     id: "black-forest-labs/flux.1-dev",
//     label: "FLUX.1 Dev",
//     capabilities: ["magic_prompt", "steps"],
//   },
//  ...
```

## Request Options

```typescript
const task = await mynth.generate({
  prompt: {
    positive: "A serene lake at dawn",
    negative: "people, buildings", // Will be used only if supported by model
    magic: false, // Default `true`
  },
  model: "black-forest-labs/flux.1-dev",
  size: "landscape", //Default: "auto", Examples: "portrait", "square", "instagram", { width: 1024, height: 768 }
  count: 1, // Default 1
  output: {
    format: "webp", // Default "webp", Examples: "png", "jpg", "webp"
    quality: 80,
    upscale: 2, // 2x or 4x upscaling
  },
  webhook: {
    enabled: true, // Setting to false will disable webhooks set in dashboard and webhooks configured as `custom` in request
    custom: [{ url: "https://your-webhook.com/endpoint" }],
  },
  /**
   * Single level deep metadata you can attach. It will be send with webhook and returned with result.
   */
  metadata: {
    internalGenerationId: "gen_123",
    userId: "user_...",
  },
});
```

## Convex Integration

The SDK includes a Convex webhook handler for easy integration:

```typescript
import { mynthWebhookAction } from "@mynthio/sdk/convex";

export const mynthWebhook = mynthWebhookAction({
  imageTaskCompleted: async (payload, { context }) => {
    console.log("Image generated:", payload.result.images);
  },
});
```

Set `MYNTH_WEBHOOK_SECRET` in your environment variables.

## Error Handling

```typescript
import {
  Mynth,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
  TaskAsyncFetchError,
} from "@mynthio/sdk";

try {
  const task = await mynth.generate({ ... });
} catch (error) {
  if (error instanceof TaskAsyncTimeoutError) {
    console.error("Task polling timed out");
  } else if (error instanceof TaskAsyncUnauthorizedError) {
    console.error("Invalid API key or access denied");
  } else if (error instanceof TaskAsyncFetchError) {
    console.error("Network error while polling task status");
  }
}
```

## Documentation

For full documentation, visit [docs.mynth.io](https://docs.mynth.io).

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for development setup, commit message rules (Conventional Commits), and how the automated release process works.

## License

MIT
