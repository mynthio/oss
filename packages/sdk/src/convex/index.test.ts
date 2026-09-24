import { httpRouter, type PublicHttpAction } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { MynthSDKTypes } from "../types.ts";
import { mynthWebhookAction } from "./index.ts";

const SECRET = "whsec_test";
const DELIVERY_ID = "tsk_test:dashboard:wbh_test:task.image.generate.completed";

const originalWebhookSecret = process.env.MYNTH_WEBHOOK_SECRET;

afterEach(() => {
  if (originalWebhookSecret === undefined) {
    delete process.env.MYNTH_WEBHOOK_SECRET;
  } else {
    process.env.MYNTH_WEBHOOK_SECRET = originalWebhookSecret;
  }
});

async function createSignature(body: string, secret = SECRET, timestamp = currentTimestamp()) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return `t=${timestamp},v1=${hex}`;
}

function currentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

async function createWebhookRequest(
  payload: MynthSDKTypes.WebhookPayload,
  options: { event?: string; timestamp?: number } = {},
) {
  const body = JSON.stringify(payload);

  return new Request("https://example.com/mynth-webhook", {
    method: "POST",
    headers: {
      "X-Mynth-Event": options.event ?? payload.event,
      "X-Mynth-Delivery": DELIVERY_ID,
      "X-Mynth-Signature": await createSignature(body, SECRET, options.timestamp),
    },
    body,
  });
}

/** Runs the wrapped handler the way the Convex runtime does, without its syscalls. */
function invoke(action: PublicHttpAction, request: Request, ctx: object = {}) {
  const { _handler } = action as unknown as {
    _handler: (ctx: object, request: Request) => Promise<Response>;
  };

  return _handler(ctx, request);
}

const imageCompletedPayload: MynthSDKTypes.WebhookTaskImageCompletedPayload = {
  event: "task.image.generate.completed",
  task: { id: "tsk_image" },
  request: { prompt: "A ceramic mug" } as MynthSDKTypes.WebhookTaskImageCompletedPayload["request"],
  result: { images: [] } as unknown as MynthSDKTypes.WebhookTaskImageCompletedPayload["result"],
};

describe("mynthWebhookAction", () => {
  test("dispatches image rating completion events", async () => {
    // Arrange
    const imageRateTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageRateCompletedPayload = {
      event: "task.image.rate.completed",
      task: { id: "tsk_rate" },
      request: {
        mode: "nsfw_sfw",
        url: "https://cdn.example.com/image.webp",
      },
      result: {
        level: "sfw",
      },
    };
    const action = mynthWebhookAction({ imageRateTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRateTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image rating failure events", async () => {
    // Arrange
    const imageRateTaskFailed = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageRateFailedPayload = {
      event: "task.image.rate.failed",
      task: { id: "tsk_rate" },
      request: {
        mode: "nsfw_sfw",
        url: "https://cdn.example.com/image.webp",
      },
      errors: [
        { code: "RESTRICTED_CONTENT", message: "The request was blocked by content moderation." },
      ],
    };
    const action = mynthWebhookAction({ imageRateTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRateTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image alt text completion events", async () => {
    // Arrange
    const imageAltTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageAltCompletedPayload = {
      event: "task.image.alt.completed",
      task: { id: "tsk_alt" },
      request: {
        url: "https://cdn.example.com/image.webp",
      },
      result: {
        alt: "A studio product photo of a ceramic mug.",
      },
    };
    const action = mynthWebhookAction({ imageAltTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageAltTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image alt text failure events", async () => {
    // Arrange
    const imageAltTaskFailed = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageAltFailedPayload = {
      event: "task.image.alt.failed",
      task: { id: "tsk_alt" },
      request: {
        url: "https://cdn.example.com/image.webp",
      },
      errors: [
        { code: "RESTRICTED_CONTENT", message: "The request was blocked by content moderation." },
      ],
    };
    const action = mynthWebhookAction({ imageAltTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageAltTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image review completion events", async () => {
    // Arrange
    const imageReviewTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageReviewCompletedPayload = {
      event: "task.image.review.completed",
      task: { id: "tsk_review" },
      request: {
        url: "https://cdn.example.com/image.webp",
        effort: "high",
      },
      result: {
        score: 3,
        summary: "Strong composition with one visible artifact.",
        findings: [
          {
            finding: "The left hand has an extra finger.",
            category: "anatomy",
            severity: "major",
            where: "Left side of the image",
            confidence: "high",
          },
        ],
        strengths: [{ strength: "Balanced composition", confidence: "high" }],
      },
    };
    const action = mynthWebhookAction({ imageReviewTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageReviewTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image review failure events", async () => {
    // Arrange
    const imageReviewTaskFailed = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageReviewFailedPayload = {
      event: "task.image.review.failed",
      task: { id: "tsk_review" },
      request: {
        url: "https://cdn.example.com/image.webp",
        effort: "low",
      },
      errors: [{ code: "REVIEW_FAILED", message: "Image review failed." }],
    };
    const action = mynthWebhookAction({ imageReviewTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageReviewTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image remove background completion events", async () => {
    // Arrange
    const imageRemoveBackgroundTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageRemoveBackgroundCompletedPayload = {
      event: "task.image.remove_background.completed",
      task: { id: "tsk_remove_background" },
      request: { url: "https://cdn.example.com/image.jpg" },
      result: {
        image: {
          id: "img_1",
          url: "https://cdn.example.com/cutout.png",
          mynth_url: "https://mynth.example.com/cutout.png",
          size: "1024x768",
          format: "png",
        },
      },
    };
    const action = mynthWebhookAction(
      { imageRemoveBackgroundTaskCompleted },
      { webhookSecret: SECRET },
    );

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRemoveBackgroundTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("dispatches image remove background failure events", async () => {
    // Arrange
    const imageRemoveBackgroundTaskFailed = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageRemoveBackgroundFailedPayload = {
      event: "task.image.remove_background.failed",
      task: { id: "tsk_remove_background" },
      request: { url: "https://cdn.example.com/image.jpg" },
      errors: [{ code: "PROVIDER_ERROR" }],
    };
    const action = mynthWebhookAction(
      { imageRemoveBackgroundTaskFailed },
      { webhookSecret: SECRET },
    );

    // Act
    const response = await invoke(action, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRemoveBackgroundTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID }]],
    });
  });

  test("returns a Convex HTTP action that httpRouter accepts", () => {
    // Arrange
    const http = httpRouter();
    const action = mynthWebhookAction({}, { webhookSecret: SECRET });

    // Act
    http.route({ path: "/mynth-webhook", method: "POST", handler: action });

    // Assert
    expect(http.lookup("/mynth-webhook", "POST")?.[0]).toBe(action);
  });

  test("reads the webhook secret when the request arrives, not when the action is created", async () => {
    // Arrange
    delete process.env.MYNTH_WEBHOOK_SECRET;
    const action = mynthWebhookAction({});
    process.env.MYNTH_WEBHOOK_SECRET = SECRET;

    // Act
    const response = await invoke(action, await createWebhookRequest(imageCompletedPayload));

    // Assert
    expect(response.status).toBe(200);
  });

  test("rejects signatures older than five minutes", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();
    const action = mynthWebhookAction({ imageTaskCompleted }, { webhookSecret: SECRET });
    const request = await createWebhookRequest(imageCompletedPayload, {
      timestamp: currentTimestamp() - 301,
    });

    // Act
    const response = await invoke(action, request);

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 400,
      calls: [],
    });
  });

  test("rejects mismatched event headers", async () => {
    // Arrange
    const imageTaskFailed = vi.fn();
    const action = mynthWebhookAction({ imageTaskFailed }, { webhookSecret: SECRET });
    const request = await createWebhookRequest(imageCompletedPayload, {
      event: "task.image.generate.failed",
    });

    // Act
    const response = await invoke(action, request);

    // Assert
    expect({ status: response.status, calls: imageTaskFailed.mock.calls }).toEqual({
      status: 400,
      calls: [],
    });
  });

  test("passes the Convex action context to handlers", async () => {
    // Arrange
    const ctx = { runMutation: vi.fn() };
    const action = mynthWebhookAction(
      {
        imageTaskCompleted: async (payload, { context }) => {
          await context.runMutation("images:save" as never, { taskId: payload.task.id } as never);
        },
      },
      { webhookSecret: SECRET },
    );

    // Act
    const response = await invoke(action, await createWebhookRequest(imageCompletedPayload), ctx);

    // Assert
    expect({ status: response.status, calls: ctx.runMutation.mock.calls }).toEqual({
      status: 200,
      calls: [["images:save", { taskId: "tsk_image" }]],
    });
  });
});
