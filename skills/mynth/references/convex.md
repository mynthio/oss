# Convex Integration

## Installation

```bash
bun add @mynthio/sdk
```

## Webhook Handler

Define in your `convex/http.ts`:

```ts
import { mynthWebhookAction } from "@mynthio/sdk/convex";

export const mynthWebhook = mynthWebhookAction({
  imageTaskCompleted: async (payload, { context }) => {
    await context.runMutation(internal.images.save, {
      taskId: payload.task.id,
      images: payload.result.images,
    });
  },
  imageTaskFailed: async (payload) => {
    console.error("Task failed:", payload.task.id);
  },
});
```

## Environment Variable

Set `MYNTH_WEBHOOK_SECRET` in your Convex environment. Or pass `webhookSecret` explicitly:

```ts
export const mynthWebhook = mynthWebhookAction(
  {
    imageTaskCompleted: async (payload) => {
      /* ... */
    },
  },
  { webhookSecret: "wbs_..." },
);
```

## Events

- `imageTaskCompleted` — fires when generation succeeds. `payload.result.images` contains the generated images.
- `imageTaskFailed` — fires when generation fails. `payload.task.id` identifies the failed task.

Signature verification (HMAC-SHA256, `X-Mynth-Signature` header) is handled automatically.
