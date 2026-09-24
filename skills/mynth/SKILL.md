---
name: mynth
description: >
  Use when adding or migrating AI image or video generation with Mynth, the
  unified media generation API and SDK. Covers @mynthio/sdk, the REST API,
  choosing a model from the live catalog, Public Access Tokens for browser
  polling, webhooks, image content rating, alt text, review, background
  removal, Destinations (deliver to S3/R2/Bunny), Next.js, TanStack Start,
  Convex, and the @mynthio/tanstack-ai-adapter. Trigger for Mynth-specific
  setup, provider replacement, multi-model image or video generation, task
  polling, content moderation of images, or webhook sync.
---

# Mynth Media Generation

Mynth is one API in front of many image and video models. A generation request creates a task and returns its ID. The file arrives later: wait in the SDK, poll the task, or receive a webhook. A task-scoped Public Access Token (PAT) lets browser code poll without the API key.

## Quick Start (JS/TS server)

```bash
bun add @mynthio/sdk
```

```env
MYNTH_API_KEY=mak_...
```

```ts
import Mynth from "@mynthio/sdk";

const mynth = new Mynth(); // reads MYNTH_API_KEY

const task = await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro", // example id: choose one from the catalog (see below)
  prompt: "A sunset over mountains",
});
console.log(task.urls); // ["https://cdn.mynth.io/images/img_....webp"]
```

Pass `{ apiKey, baseUrl }` only when the project already centralizes secrets or needs a proxy/test base URL. Never expose the API key to browser code: start the task on the server with `generateAsync()` and return the task ID plus `task.access.publicAccessToken` for browser polling.

## Choose a Model

Every generation request needs an explicit `model` id in `vendor/name` form.

- Do not omit `model` and do not send `"auto"`. An omitted image `model` falls back to `auto`, which is experimental: it picks poorly, ignores inputs and size, and holds a flat $0.20 per image. Video has no `auto`; `model` is required.
- Do not pick an id from memory or from this skill. The catalog changes. `black-forest-labs/flux.2-pro` in these examples is a placeholder.

Read the live catalog. None of these need an API key:

```bash
npx @mynthio/cli models list --type image                       # or --type video
npx @mynthio/cli models list --type image --capability img2img --4k --max-price 0.05
npx @mynthio/cli models list --search flux --json
```

Or `GET https://api.mynth.io/models` (modes, input rules, pricing) or `https://mynth.io/models.json`.

1. Filter by what the feature needs: `img->img` in `modes` for edits and reference images, a `4k` price for `_4k` sizes, `pricing.perImage.base` (or `perSecond` for video) for budget.
2. If the user has not named a model, show two or three candidates with their price and what they support, and let the user choose. The catalog does not rank models; quality depends on the user's prompts.
3. Use the chosen id in the code you write. Ask the user whether they want it saved for later generations, and where, rather than deciding that yourself.

Rating, alt text, review, and background removal take no `model`. Mynth picks those.

## Pick the Reference

| Task                               | Reference                                                           |
| ---------------------------------- | ------------------------------------------------------------------- |
| Analyze a repo for Mynth migration | [analyze-repo.md](references/analyze-repo.md)                       |
| Use the SDK (JS/TS with server)    | [sdk-usage.md](references/sdk-usage.md)                             |
| Use the REST API (non-JS, mobile)  | [rest-api.md](references/rest-api.md)                               |
| Use with TanStack AI               | [tanstack-ai.md](references/tanstack-ai.md)                         |
| Set up webhooks (Next.js, others)  | [webhooks.md](references/webhooks.md)                               |
| Use with Convex                    | [convex.md](references/convex.md)                                   |
| Client-side polling with PATs      | [public-access-tokens.md](references/public-access-tokens.md)       |
| Rate/moderate image content        | [image-rating.md](references/image-rating.md)                       |
| Generate image alt text            | [image-alt.md](references/image-alt.md)                             |
| Remove an image background         | [image-remove-background.md](references/image-remove-background.md) |
| Deliver images to user storage     | [destinations.md](references/destinations.md)                       |

Not covered by a reference: video generation, image review, and the TanStack Start webhook helper. Read the docs for those:

- https://mynth.io/docs/guides/generate-video.md
- https://mynth.io/docs/guides/review-images.md
- https://mynth.io/docs/sdks/integrations/tanstack-start.md

The docs are the source of truth for paths and fields. Every page is markdown at `https://mynth.io/docs/<slug>.md`; the index is `https://mynth.io/llms.txt`. No account needed.

## Integration Choice

- JS/TS server code: `@mynthio/sdk`
- Non-JS, mobile, or edge code without the SDK: REST API
- TanStack AI `generateImage()`: `@mynthio/tanstack-ai-adapter`
- Next.js webhook handling: `@mynthio/sdk/next`
- TanStack Start webhook handling: `@mynthio/sdk/tanstack-start`
- Convex webhook handling: `@mynthio/sdk/convex`

## Core Flow

1. Submit a generation request with an API key and an explicit `model`.
2. Poll task status and result with the API key or task-scoped PAT, or wait with the SDK.
3. Use webhooks when the app needs durable database sync.
4. On a completed task, check `status` on every image or video: one item can fail while the task completes.
5. Generated files are served for 7 days. Copy them, or use a destination, if the app keeps them longer.

Keep implementations small: do not recreate provider routing, queue workers, polling proxy endpoints, format conversion, content-rating logic, or storage upload pipelines unless the app has a reason Mynth does not cover.
