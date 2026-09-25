# Webhooks

Use webhooks when generated results must be persisted, billed, moderated, or attached to user records without relying on an open browser tab.

## Per-Request Custom Webhooks

Pass directly in the generate request (`image.generate`, `image.removeBackground`, `video.generate`; not rate/alt/review). Up to 5 URLs. These are not signed, so the SDK helpers reject them.

```ts
await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset",
  webhook: { custom: [{ url: "https://your-app.com/api/mynth-webhook" }] },
});
```

## Registered Webhooks

Create in the dashboard, the API, or the CLI. Registered webhooks are signed with HMAC-SHA256. The API needs a key with the `manage` scope.

```ts
await fetch("https://api.mynth.io/webhook", {
  method: "POST",
  headers: {
    Authorization: "Bearer mak_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://your-app.com/api/mynth-webhook",
    events: ["task.image.generate.completed"],
    enabled: true,
  }),
});
```

## Events

- `task.image.generate.completed` — generation succeeded
- `task.image.generate.failed` — generation failed
- `task.image.rate.completed` — rating task succeeded
- `task.image.rate.failed` — rating task failed
- `task.image.alt.completed` — alt text task succeeded
- `task.image.alt.failed` — alt text task failed
- `task.image.remove_background.completed` — background removal task succeeded
- `task.image.remove_background.failed` — background removal task failed
- `task.image.review.completed` / `task.image.review.failed` — review task settled
- `task.video.generate.completed` / `task.video.generate.failed` — video task settled
- `task.completed` — any task completed
- `task.failed` — any task failed
- `all` — all events

## Payload

On completion:

```json
{
  "event": "task.image.generate.completed",
  "task": { "id": "tsk_..." },
  "request": { "model": "black-forest-labs/flux.2-pro", "prompt": "A sunset", "count": 1 },
  "result": {
    "model": "black-forest-labs/flux.2-pro",
    "images": [
      {
        "status": "success",
        "id": "img_...",
        "url": "https://cdn.mynth.io/images/img_....webp",
        "mynth_url": "https://cdn.mynth.io/images/img_....webp",
        "size": "1536x1024",
        "format": "webp"
      }
    ]
  }
}
```

On failure:

```json
{
  "event": "task.image.generate.failed",
  "task": { "id": "tsk_..." },
  "request": { "model": "black-forest-labs/flux.2-pro", "prompt": "A sunset", "size": "16:9_4k" },
  "errors": [
    {
      "code": "CAPABILITY_NOT_SUPPORTED",
      "message": "The request uses options that are not supported for this model."
    }
  ]
}
```

A `.completed` generation can still hold failed images (for example `RESTRICTED_CONTENT` on one image). Check `status` on every item in `result.images` or `result.videos`.

## CLI

Run `mynth auth login` first. The key it stores has the `manage` scope these commands need.

```bash
mynth webhook create --url <url> --event <name...> [--api-key-id <id...>] [--oauth-events] [--disabled] [--json]
mynth webhook update <id> --url <url> --event <name...> [--enabled|--disabled] [--json]
mynth webhook delete <id> --yes [--json]
```

`--event` is repeatable (`--event task.completed --event task.failed`) or `--event all` for every event. By default an endpoint receives tasks from every API key, including CLI tasks. `--api-key-id` limits it to specific keys; `--oauth-events` adds tasks with no API key, such as playground runs. The signing `secret` is printed once by `create` (the dashboard keeps showing it); there is no list/get command and `update` cannot rotate it. `update` is a full replace: omitted sources reset to the defaults.

## Signature Verification (Registered Webhooks)

Headers: `X-Mynth-Event`, `X-Mynth-Delivery`, and `X-Mynth-Signature: t=<timestamp>,v1=<hex>`

Verify: `v1 == hex(HMAC-SHA256(key = full wbs_ secret, message = "{t}.{rawBody}"))`, compared in constant time, with `t` within 5 minutes. Use the raw body bytes; re-serialized JSON breaks the signature.

Deliveries retry for about 2.5 hours on any non-2xx (answer within 30 s) and can arrive more than once. Deduplicate on `X-Mynth-Delivery`; the SDK helpers pass it to every handler as `deliveryId` in the last argument.

For Next.js App Router, use the SDK helper:

```ts
// app/api/mynth-webhook/route.ts
import { mynthWebhookHandler } from "@mynthio/sdk/next";

export const POST = mynthWebhookHandler({
  imageTaskCompleted: async (payload, { request }) => {
    await saveImages(payload.task.id, payload.result.images);
    console.log(request.url);
  },
});
```

Set `MYNTH_WEBHOOK_SECRET`. Keep the route public, make side effects idempotent, and enqueue slow work. The helper only accepts signed, registered webhooks.

For TanStack Start, use `mynthWebhookHandler` from `@mynthio/sdk/tanstack-start` in a server route. For Convex, use `@mynthio/sdk/convex`; see [convex.md](convex.md). All helpers also take `imageReviewTask*` and `videoTask*` handlers.

## Request-Level Overrides

Disable registered webhooks for one request while still sending a custom webhook:

```ts
await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset",
  webhook: {
    dashboard: false,
    custom: [{ url: "https://your-app.com/api/mynth-webhook" }],
  },
});
```
