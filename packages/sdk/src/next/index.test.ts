import { afterEach, describe, expect, test, vi } from "vitest";

import { WEBHOOK_HANDLER_NAMES, WEBHOOK_PAYLOADS } from "../webhooks/payloads.fixture.ts";
import { mynthWebhookHandler } from "./index.ts";

const SECRET = "wbs_test";
const DELIVERY_ID = "tsk_test:dashboard:wbh_test:task.image.generate.completed";
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
      "X-Mynth-Delivery": DELIVERY_ID,
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

function payload(event: keyof typeof WEBHOOK_PAYLOADS) {
  return WEBHOOK_PAYLOADS[event];
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
  test.each(WEBHOOK_HANDLER_NAMES)(
    "dispatches %s to %s with request context",
    async (event, handlerName) => {
      // Arrange
      const eventPayload = WEBHOOK_PAYLOADS[event];
      const request = await createWebhookRequest(JSON.stringify(eventPayload), event);
      const callback = vi.fn();
      const handler = mynthWebhookHandler({ [handlerName]: callback }, { webhookSecret: SECRET });

      // Act
      const response = await handler(request);

      // Assert
      expect({ status: response.status, calls: callback.mock.calls }).toEqual({
        status: 200,
        calls: [
          [
            expect.objectContaining({ taskId: eventPayload.task.id }),
            { request, deliveryId: DELIVERY_ID },
          ],
        ],
      });
    },
  );

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
