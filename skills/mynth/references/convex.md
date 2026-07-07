# Convex Integration

Use this only for handling signed Mynth webhooks in Convex HTTP actions. For generation calls from Convex functions, use the regular SDK client from [sdk-usage.md](sdk-usage.md).

```bash
bun add @mynthio/sdk
```

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
  imageRateTaskCompleted: async (payload, { context }) => {
    await context.runMutation(internal.images.saveRatings, {
      taskId: payload.task.id,
      results: payload.result.results,
    });
  },
  imageAltTaskCompleted: async (payload, { context }) => {
    await context.runMutation(internal.images.saveAltTexts, {
      taskId: payload.task.id,
      results: payload.result.results,
    });
  },
});
```

Set `MYNTH_WEBHOOK_SECRET` in Convex, or pass it explicitly:

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

The helper verifies `X-Mynth-Signature` and routes:

- `task.image.generate.completed` to `imageTaskCompleted`
- `task.image.generate.failed` to `imageTaskFailed`
- `task.image.rate.completed` to `imageRateTaskCompleted`
- `task.image.rate.failed` to `imageRateTaskFailed`
- `task.image.alt.completed` to `imageAltTaskCompleted`
- `task.image.alt.failed` to `imageAltTaskFailed`
