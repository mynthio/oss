# Webhooks

Use webhooks when generated results must be persisted, billed, moderated, or attached to user records without relying on an open browser tab.

## Per-Request Custom Webhooks

Pass directly in the generate request. These are not signed.

```ts
await mynth.image.generate({
  prompt: "A sunset",
  webhook: { custom: [{ url: "https://your-app.com/api/mynth-webhook" }] },
});
```

## Registered Webhooks

Create in the dashboard or API. Registered webhooks are signed with HMAC-SHA256.

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
- `task.completed` — any task completed
- `task.failed` — any task failed
- `all` — all events

## Payload

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

## CLI

Webhook commands require OAuth login (`mynth auth login`); API keys are rejected by these routes.

```bash
mynth webhook create --url <url> --event <name...> [--disabled] [--json]
mynth webhook update <id> --url <url> --event <name...> [--enabled|--disabled] [--json]
mynth webhook delete <id> --yes [--json]
```

`--event` is repeatable (`--event task.completed --event task.failed`) or `--event all` for every event. The signing `secret` is shown only once, in the `create` output — save it then; there is no list/get command and `update` cannot rotate it. `update` is a full replace (all fields required).

## Signature Verification (Registered Webhooks)

Headers: `X-Mynth-Event` and `X-Mynth-Signature: t=<timestamp>,v1=<hex>`

Verify: `HMAC-SHA256("{timestamp}.{rawBody}", webhookSecret)`

For Convex, use `@mynthio/sdk/convex`; see [convex.md](convex.md).

## Request-Level Overrides

Disable registered webhooks for one request while still sending a custom webhook:

```ts
await mynth.image.generate({
  prompt: "A sunset",
  webhook: {
    dashboard: false,
    custom: [{ url: "https://your-app.com/api/mynth-webhook" }],
  },
});
```
