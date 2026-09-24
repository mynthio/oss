# Convex Integration

Use this only for handling signed Mynth webhooks in Convex HTTP actions. For generation calls from Convex functions, use the regular SDK client from [sdk-usage.md](sdk-usage.md).

```bash
bun add @mynthio/sdk
```

Define in your `convex/http.ts`:

```ts
import { httpRouter } from "convex/server";
import { mynthWebhookAction } from "@mynthio/sdk/convex";

import { internal } from "./_generated/api";

const http = httpRouter();

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
    await context.runMutation(internal.images.saveRating, {
      taskId: payload.task.id,
      level: payload.result.level,
    });
  },
  imageAltTaskCompleted: async (payload, { context }) => {
    await context.runMutation(internal.images.saveAltText, {
      taskId: payload.task.id,
      alt: payload.result.alt,
    });
  },
});

http.route({ path: "/mynth-webhook", method: "POST", handler: mynthWebhook });

export default http;
```

Register `https://<deployment>.convex.site/mynth-webhook` as the webhook URL. Generate from a Convex **action** (queries and mutations cannot make network calls), usually with `generateAsync()` and an explicit `model`, and save the result in the webhook.

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
- `task.image.remove_background.completed` to `imageRemoveBackgroundTaskCompleted`
- `task.image.remove_background.failed` to `imageRemoveBackgroundTaskFailed`
- `task.image.review.completed` / `.failed` to `imageReviewTaskCompleted` / `imageReviewTaskFailed`
- `task.video.generate.completed` / `.failed` to `videoTaskCompleted` / `videoTaskFailed`

`mynthWebhookAction` returns a Convex HTTP action; pass it to `http.route` directly, without `httpAction`. It answers `400` for a missing or bad signature, a timestamp more than five minutes off, or an `X-Mynth-Event` header that does not match the body, and `200` for a signed event without a handler. A handler that throws fails the request, so Mynth retries. The secret is read when each request arrives, and a missing one throws.
