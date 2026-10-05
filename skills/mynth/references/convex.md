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
  imageTaskCompleted: async (result, { context }) => {
    await context.runMutation(internal.images.save, {
      taskId: result.taskId,
      images: result.images,
    });
  },
  imageTaskFailed: async (failure) => {
    console.error("Task failed:", failure.taskId);
  },
  imageRateTaskCompleted: async (result, { context }) => {
    await context.runMutation(internal.images.saveRating, {
      taskId: result.taskId,
      level: result.level,
    });
  },
  imageAltTaskCompleted: async (result, { context }) => {
    await context.runMutation(internal.images.saveAltText, {
      taskId: result.taskId,
      alt: result.alt,
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
    imageTaskCompleted: async (result) => {
      /* ... */
    },
  },
  { webhookSecret: "whsec_..." },
);
```

The helper verifies the Standard Webhooks signature (`webhook-id`, `webhook-timestamp`, `webhook-signature`) and routes:

- `task.image.generate.completed` to `imageTaskCompleted`
- `task.image.generate.failed` to `imageTaskFailed`
- `task.image.rate.completed` to `imageRateTaskCompleted`
- `task.image.rate.failed` to `imageRateTaskFailed`
- `task.image.alt.completed` to `imageAltTaskCompleted`
- `task.image.alt.failed` to `imageAltTaskFailed`
- `task.image.remove_background.completed` to `imageRemoveBackgroundTaskCompleted`
- `task.image.remove_background.failed` to `imageRemoveBackgroundTaskFailed`
- `task.image.upscale.completed` to `imageUpscaleTaskCompleted`
- `task.image.upscale.failed` to `imageUpscaleTaskFailed`
- `task.image.review.completed` / `.failed` to `imageReviewTaskCompleted` / `imageReviewTaskFailed`
- `task.video.generate.completed` / `.failed` to `videoTaskCompleted` / `videoTaskFailed`

`mynthWebhookAction` returns a Convex HTTP action; pass it to `http.route` directly, without `httpAction`. It answers `400` for a missing or bad signature, a timestamp more than five minutes off, or a body whose `id` is not the `webhook-id`, and `200` for a signed event without a handler. A handler that throws fails the request, so Mynth retries. The secret is read when each request arrives, and a missing one throws.

Each handler's last argument is `{ context, request, event }`. `event.id` is the `webhook-id`, the same on every retry: store it to skip events already handled.

For a per-request custom webhook (unsigned), pass `{ unsigned: { verify } }` instead of a secret, and check a token you put in the URL's query string with a constant-time comparison:

```ts
export const mynthWebhook = mynthWebhookAction(
  {
    imageTaskCompleted: async (result, { context }) => {
      /* ... */
    },
  },
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

`verify` returning `false` answers `401`.
