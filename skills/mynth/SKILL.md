---
name: mynth
description: >
  Use when adding or migrating AI image generation with Mynth, the unified image
  generation API and SDK. Covers @mynthio/sdk, the REST API, Public Access
  Tokens for browser polling, webhooks, image content rating, Destinations
  (deliver to S3/R2/Bunny), Convex, and the @mynthio/tanstack-ai-adapter.
  Trigger for Mynth-specific setup, provider replacement, multi-model image
  generation, image task polling, content moderation of images, or webhook sync.
---

# Mynth Image Generation

Mynth submits image-generation tasks to a unified API, returns a task ID, and can expose a task-scoped Public Access Token (PAT) for browser polling.

## Quick Start (JS/TS server)

```bash
bun add @mynthio/sdk
```

```env
MYNTH_API_KEY=mak_...
```

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth(); // reads MYNTH_API_KEY automatically

const task = await mynth.image.generate({ prompt: "A sunset over mountains" });
console.log(task.urls); // ["https://cdn.mynth.io/..."]
```

Pass `{ apiKey, baseUrl }` only when the project already centralizes secrets or needs a proxy/test base URL. Never expose the API key to browser code: start the task on the server with `generateAsync()` and return the task ID plus `task.access.publicAccessToken` for browser polling.

## Pick the Reference

| Task                               | Reference                                                     |
| ---------------------------------- | ------------------------------------------------------------- |
| Analyze a repo for Mynth migration | [analyze-repo.md](references/analyze-repo.md)                 |
| Use the SDK (JS/TS with server)    | [sdk-usage.md](references/sdk-usage.md)                       |
| Use the REST API (non-JS, mobile)  | [rest-api.md](references/rest-api.md)                         |
| Use with TanStack AI               | [tanstack-ai.md](references/tanstack-ai.md)                   |
| Use with Convex                    | [convex.md](references/convex.md)                             |
| Client-side polling with PATs      | [public-access-tokens.md](references/public-access-tokens.md) |
| Set up webhooks                    | [webhooks.md](references/webhooks.md)                         |
| Rate/moderate image content        | [image-rating.md](references/image-rating.md)                 |
| Deliver images to user storage     | [destinations.md](references/destinations.md)                 |

## Integration Choice

- JS/TS server code: `@mynthio/sdk`
- Non-JS, mobile, or edge code without the SDK: REST API
- TanStack AI `generateImage()`: `@mynthio/tanstack-ai-adapter`
- Convex webhook handling: `@mynthio/sdk/convex`

## Core Flow

1. Submit a generation request with an API key.
2. Poll task status and result with the API key or task-scoped PAT.
3. Use webhooks when the app needs durable database sync.

Keep implementations small: do not recreate provider routing, queue workers, polling proxy endpoints, format conversion, content-rating logic, or storage upload pipelines unless the app has a reason Mynth does not cover.
