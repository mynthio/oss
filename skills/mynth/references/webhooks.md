# Webhooks

## Two Options

### 1. Per-Request Custom Webhooks

Pass directly in the generate request. No signing. Up to 5 endpoints.

```ts
await mynth.generate({
  prompt: "A sunset",
  webhook: { custom: [{ url: "https://your-app.com/api/mynth-webhook" }] },
});
```

### 2. Dashboard-Registered Webhooks

Create via API, stored in database. Signed with HMAC-SHA256. Auto-disabled after consecutive failures.

```ts
await fetch("https://api.mynth.io/webhook/", {
  method: "POST",
  headers: {
    Authorization: "Bearer mak_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://your-app.com/api/mynth-webhook",
    events: ["task.image.generate.completed", "task.image.generate.failed"],
    enabled: true,
  }),
});
```

## Events

- `task.image.generate.completed` — generation succeeded
- `task.image.generate.failed` — generation failed
- `task.completed` — any task completed
- `task.failed` — any task failed
- `all` — all events

## Payload Shape

On completion:

```json
{
  "event": "task.image.generate.completed",
  "task": { "id": "tsk_..." },
  "result": {
    "images": [{ "url": "https://cdn.mynth.io/..." }],
    "model": "black-forest-labs/flux.2-dev"
  },
  "request": { "prompt": "A sunset", "model": "auto" }
}
```

On failure:

```json
{
  "event": "task.image.generate.failed",
  "task": { "id": "tsk_..." },
  "request": { "prompt": "A sunset" }
}
```

## Signature Verification (Registered Webhooks)

Headers: `X-Mynth-Event` and `X-Mynth-Signature: t=<timestamp>,v1=<hex>`

Verify: `HMAC-SHA256("{timestamp}.{rawBody}", webhookSecret)`

## Convex

Use `@mynthio/sdk/convex` for automatic signature verification — see [convex.md](convex.md).

## Disable Dashboard Webhooks per Request

```ts
await mynth.generate({
  prompt: "A sunset",
  webhook: { enabled: false }, // disables dashboard webhooks for this task
  webhook: { custom: [{ url: "..." }] }, // still sends to custom endpoints
});
```
