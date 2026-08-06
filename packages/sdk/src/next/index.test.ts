import { afterEach, describe, expect, test, vi } from "vitest";

import { mynthWebhookHandler } from "./index";

const SECRET = "wbs_test";
const originalWebhookSecret = process.env.MYNTH_WEBHOOK_SECRET;

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

async function createWebhookRequest(
  body: string,
  event: string,
  options: { secret?: string; timestamp?: number; signature?: string } = {},
) {
  return new Request("https://example.com/api/mynth-webhook", {
    method: "POST",
    headers: {
      "X-Mynth-Event": event,
      "X-Mynth-Signature":
        options.signature ??
        (await createSignature(body, options.secret, options.timestamp ?? currentTimestamp())),
    },
    body,
  });
}

function currentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

function payload(event: string) {
  return { event, task: { id: "tsk_test" } };
}

function restoreWebhookSecret() {
  if (originalWebhookSecret === undefined) {
    delete process.env.MYNTH_WEBHOOK_SECRET;
  } else {
    process.env.MYNTH_WEBHOOK_SECRET = originalWebhookSecret;
  }
}

afterEach(() => {
  restoreWebhookSecret();
});

describe("mynthWebhookHandler", () => {
  test("dispatches image generation completion events with request context", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler({ imageTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image generation failure events", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.failed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageTaskFailed = vi.fn();
    const handler = mynthWebhookHandler({ imageTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageTaskFailed.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image rating completion events", async () => {
    // Arrange
    const eventPayload = payload("task.image.rate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageRateTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler({ imageRateTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageRateTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image rating failure events", async () => {
    // Arrange
    const eventPayload = payload("task.image.rate.failed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageRateTaskFailed = vi.fn();
    const handler = mynthWebhookHandler({ imageRateTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageRateTaskFailed.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image alt text completion events", async () => {
    // Arrange
    const eventPayload = payload("task.image.alt.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageAltTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler({ imageAltTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageAltTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image alt text failure events", async () => {
    // Arrange
    const eventPayload = payload("task.image.alt.failed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageAltTaskFailed = vi.fn();
    const handler = mynthWebhookHandler({ imageAltTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageAltTaskFailed.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image review completion events", async () => {
    // Arrange
    const eventPayload = payload("task.image.review.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageReviewTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler({ imageReviewTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageReviewTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("dispatches image review failure events", async () => {
    // Arrange
    const eventPayload = payload("task.image.review.failed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const imageReviewTaskFailed = vi.fn();
    const handler = mynthWebhookHandler({ imageReviewTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageReviewTaskFailed.mock.calls }).toEqual({
      status: 200,
      calls: [[eventPayload, { request }]],
    });
  });

  test("reads the webhook secret when the request arrives", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const handler = mynthWebhookHandler({});
    process.env.MYNTH_WEBHOOK_SECRET = SECRET;

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(200);
  });

  test("rejects requests when the webhook secret is not configured", async () => {
    // Arrange
    delete process.env.MYNTH_WEBHOOK_SECRET;
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const handler = mynthWebhookHandler({});

    // Act & Assert
    await expect(handler(request)).rejects.toThrow("MYNTH_WEBHOOK_SECRET is required");
  });

  test("rejects requests without signature headers", async () => {
    // Arrange
    const request = new Request("https://example.com/api/mynth-webhook", {
      method: "POST",
      body: JSON.stringify(payload("task.image.generate.completed")),
    });
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects invalid signatures", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event, {
      signature: `t=${currentTimestamp()},v1=invalid`,
    });
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects signatures older than five minutes", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event, {
      timestamp: currentTimestamp() - 301,
    });
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects malformed JSON", async () => {
    // Arrange
    const request = await createWebhookRequest("{", "task.image.generate.completed");
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects malformed webhook envelopes", async () => {
    // Arrange
    const body = JSON.stringify({ event: "task.image.generate.completed" });
    const request = await createWebhookRequest(body, "task.image.generate.completed");
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects mismatched event headers", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(
      JSON.stringify(eventPayload),
      "task.image.generate.failed",
    );
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(400);
  });

  test("acknowledges signed events that the SDK does not recognize", async () => {
    // Arrange
    const eventPayload = payload("task.video.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const handler = mynthWebhookHandler({}, { webhookSecret: SECRET });

    // Act
    const response = await handler(request);

    // Assert
    expect(response.status).toBe(200);
  });

  test("propagates event handler failures for webhook retries", async () => {
    // Arrange
    const eventPayload = payload("task.image.generate.completed");
    const request = await createWebhookRequest(JSON.stringify(eventPayload), eventPayload.event);
    const handler = mynthWebhookHandler(
      {
        imageTaskCompleted: async () => {
          throw new Error("Database unavailable");
        },
      },
      { webhookSecret: SECRET },
    );

    // Act & Assert
    await expect(handler(request)).rejects.toThrow("Database unavailable");
  });
});
