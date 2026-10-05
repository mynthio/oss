# Webhooks

Use webhooks when generated results must be persisted, billed, moderated, or attached to user records without relying on an open browser tab.

Deliveries follow [Standard Webhooks](https://www.standardwebhooks.com): `webhook-id`, `webhook-timestamp`, and on registered endpoints `webhook-signature`. The body is an event, `{ id, type, timestamp, data }`, where `data` is the task exactly as `GET /tasks/{id}` returns it.

## Registered vs Custom

|            | Registered                                 | Custom (per request)                            |
| ---------- | ------------------------------------------ | ----------------------------------------------- |
| Set up     | Dashboard, CLI, or `POST /webhooks`        | `webhook.custom` on the generate request        |
| Receives   | Every task matching its events and sources | Only that task, completed or failed             |
| Signed     | Yes, with its `whsec_` secret              | No. Put a secret token in the URL, check it     |
| Shown back | In full                                    | As `scheme://host` only, on the task and events |

URLs must be `https` on a public host. A URL that resolves to a private, loopback, or link-local address is refused at delivery and not retried.

## Registered Webhooks

Create in the dashboard, the API, or the CLI. The API needs a key with the `manage` scope.

```ts
const response = await fetch("https://api.mynth.io/webhooks", {
  method: "POST",
  headers: {
    Authorization: "Bearer mak_...",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    url: "https://your-app.com/api/mynth-webhook",
    events: ["task.image.generate.completed", "task.image.generate.failed"],
  }),
});

const { data } = await response.json();
// data.secret is "whsec_...": store it as MYNTH_WEBHOOK_SECRET. It is returned only here.
```

Other body fields: `enabled` (default `true`), `api_key_ids` (omitted or `null`: every API key; a list: only those keys; `[]`: no key), `include_session_tasks` (default `false`: also deliver tasks created without an API key, such as playground runs). `PUT /webhooks/{id}` is a full replace; `DELETE /webhooks/{id}` removes it.

## Events

- `task.image.generate.completed` / `task.image.generate.failed`
- `task.image.rate.completed` / `task.image.rate.failed`
- `task.image.alt.completed` / `task.image.alt.failed`
- `task.image.remove_background.completed` / `task.image.remove_background.failed`
- `task.image.upscale.completed` / `task.image.upscale.failed`
- `task.image.review.completed` / `task.image.review.failed`
- `task.video.generate.completed` / `task.video.generate.failed`
- `task.completed` — subscribe to any task completing
- `task.failed` — subscribe to any task failing
- `all` — subscribe to every event, including future task types (send it alone: `["all"]`)

The event `type` is always the exact `task.<type>.<status>` name, never `task.completed` or `all`. Answer `2xx` to a `type` you do not know.

## Event Body

```json
{
  "id": "evt_01KE7Y9M3R8T2QXN5BVC4WJ6HD",
  "type": "task.image.generate.completed",
  "timestamp": "2026-10-04T10:00:12.000Z",
  "data": {
    "id": "tsk_...",
    "type": "image.generate",
    "status": "completed",
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
    },
    "errors": null,
    "cost": "0.03000000",
    "user_id": "user_...",
    "api_key_id": "ak_...",
    "created_at": "2026-10-04T10:00:00.000Z",
    "updated_at": "2026-10-04T10:00:12.000Z"
  }
}
```

A failed event has `data.status: "failed"`, `data.result: null`, `data.cost: null`, and `data.errors: [{ "code": "capability_not_supported", "message": "..." }]`.

The body `id` equals the `webhook-id` header. `timestamp` is when the task settled (its `updated_at`), not when this attempt was sent.

A `.completed` generation can still hold failed images (for example `restricted_content` on one image). Check `status` on every item in `data.result.images` or `data.result.videos`.

## Delivery

Answer any `2xx` within 30 s; Mynth does not follow redirects. Anything else retries with exponential backoff (5 s doubling up to 1 h, jittered) for about 72 hours. Deliveries are at least once and unordered: deduplicate on `webhook-id`, which is the same on every retry and to every endpoint.

## Verifying (Registered Webhooks)

Prefer the SDK. The framework helpers verify and dispatch; `verifyWebhook()` verifies and returns the typed event for any other framework:

```ts
import { verifyWebhook, MynthWebhookVerificationError } from "@mynthio/sdk";

try {
  const event = await verifyWebhook({ body: await request.text(), headers: request.headers });
  // event.id: dedupe key; event.type: task.<type>.<status>; event.data: the task
} catch (error) {
  if (error instanceof MynthWebhookVerificationError) return new Response(null, { status: 400 });
  throw error;
}
```

Outside TypeScript, use any Standard Webhooks library with the `whsec_` secret as is. By hand: `webhook-signature` is a space-separated list of `v1,<base64>`; each is `base64(HMAC-SHA256(key = base64-decode(secret without "whsec_"), message = "{webhook-id}.{webhook-timestamp}.{rawBody}"))`. Accept when any `v1` entry matches in constant time and the timestamp is within 5 minutes. Use the raw body bytes; re-serialized JSON breaks the signature.

For Next.js App Router:

```ts
// app/api/mynth-webhook/route.ts
import { mynthWebhookHandler } from "@mynthio/sdk/next";

export const POST = mynthWebhookHandler({
  imageTaskCompleted: async (result, { event }) => {
    await saveImagesOnce(event.id, result.taskId, result.images);
  },
  imageTaskFailed: async (failure) => {
    console.error(failure.taskId, failure.errors);
  },
});
```

A completed callback receives the same result the SDK method returns (`result.taskId`, `result.cost`, `result.images`, `result.metadata`); a failed one receives `{ taskId, errors, metadata, raw }`, with `metadata` only for task types that take it. The last argument carries `request` and the verified `event`. `onEvent(event, context)` runs for every event, including types newer than the SDK.

Set `MYNTH_WEBHOOK_SECRET` (or pass `{ webhookSecret }`). Keep the route public, make side effects idempotent, and enqueue slow work.

For TanStack Start, use `mynthWebhookHandler` from `@mynthio/sdk/tanstack-start` in a server route. For Convex, use `@mynthio/sdk/convex`; see [convex.md](convex.md). All helpers take the same handlers: `imageTask*`, `imageRateTask*`, `imageAltTask*`, `imageReviewTask*`, `imageRemoveBackgroundTask*`, `imageUpscaleTask*`, `videoTask*`, each `Completed` and `Failed`.

## Per-Request Custom Webhooks

Pass directly in the generate request (`image.generate`, `image.removeBackground`, `image.upscale`, `video.generate`; not rate/alt/review). Up to 5 URLs. They receive this task's event whatever the registered endpoints subscribe to. They are not signed: put a long random token in the query string and check it. Only `scheme://host` is ever shown back, so the token stays private.

```ts
await mynth.image.generate({
  model: "black-forest-labs/flux.2-pro",
  prompt: "A sunset",
  webhook: {
    registered: false, // optional: skip registered webhooks for this task
    custom: [
      {
        url: `https://your-app.com/api/mynth-webhook?token=${process.env.MYNTH_CUSTOM_WEBHOOK_TOKEN}`,
      },
    ],
  },
});
```

The SDK helpers reject unsigned deliveries unless given `unsigned`, which replaces the signature check:

```ts
export const POST = mynthWebhookHandler(
  { imageTaskCompleted: async (result) => saveImages(result.taskId, result.images) },
  {
    unsigned: {
      verify: (request) =>
        safeEqual(
          new URL(request.url).searchParams.get("token") ?? "",
          process.env.MYNTH_CUSTOM_WEBHOOK_TOKEN!,
        ),
    },
  },
);
```

`verify` returning `false` answers `401`. Compare the token in constant time (`safeEqual` stands for your constant-time comparison).

## CLI

Run `mynth auth login` first. The key it stores has the `manage` scope these commands need.

```bash
mynth webhook create --url <url> --event <name...> [--api-key-id <id...>] [--include-session-tasks] [--disabled] [--json]
mynth webhook update <id> --url <url> --event <name...> [--api-key-id <id...>] [--include-session-tasks] [--enabled|--disabled] [--json]
mynth webhook delete <id> --yes [--json]
```

`--event` is repeatable (`--event task.completed --event task.failed`) or `--event all` for every event. By default an endpoint receives tasks from every API key, including CLI tasks. `--api-key-id` limits it to specific keys; `--include-session-tasks` adds tasks with no API key, such as playground runs. The `whsec_` signing secret is printed once by `create` (the dashboard keeps showing it); there is no list/get command and `update` cannot rotate it. `update` is a full replace: omitted sources reset to the defaults.

`mynth image generate --webhook-url <url>` adds a custom webhook; `--no-registered-webhooks` skips registered ones for that task.
