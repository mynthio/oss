import { describe, expect, test, vi } from "vitest";

import type { ImageGenerationResult } from "../image-generation-result.ts";
import type { ImageUpscaleResult } from "../image-upscale-result.ts";
import type { MynthSDKTypes } from "../types.ts";
import { handleWebhookRequest, type WebhookEventHandlers } from "./handler.ts";
import { WEBHOOK_PAYLOADS } from "./payloads.fixture.ts";

const SECRET = "wbs_test";
const DELIVERY_ID = "tsk_test:dashboard:wbh_test:task.image.generate.completed";

function currentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

async function sign(body: Uint8Array | string, secret = SECRET, timestamp = currentTimestamp()) {
  const encoder = new TextEncoder();
  const bodyBytes = typeof body === "string" ? encoder.encode(body) : body;
  const prefix = encoder.encode(`${timestamp}.`);
  const message = new Uint8Array(prefix.length + bodyBytes.length);
  message.set(prefix);
  message.set(bodyBytes, prefix.length);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", key, message);

  return Array.from(new Uint8Array(signed))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function createRequest(body: BodyInit, event: string, signature: string) {
  return new Request("https://example.com/mynth-webhook", {
    method: "POST",
    headers: {
      "X-Mynth-Event": event,
      "X-Mynth-Delivery": DELIVERY_ID,
      "X-Mynth-Signature": signature,
    },
    body,
  });
}

const event = "task.image.generate.completed";
const createContext = (deliveryId: string) => ({ deliveryId });
const body = JSON.stringify(WEBHOOK_PAYLOADS[event]);

describe("handleWebhookRequest", () => {
  test("passes the delivery ID to the context factory", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const request = createRequest(
      body,
      event,
      `t=${timestamp},v1=${await sign(body, SECRET, timestamp)}`,
    );
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(request, { imageTaskCompleted }, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[expect.objectContaining({ taskId: "tsk_generate" }), { deliveryId: DELIVERY_ID }]],
    });
  });

  test("rejects signed requests without a delivery ID", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const request = createRequest(
      body,
      event,
      `t=${timestamp},v1=${await sign(body, SECRET, timestamp)}`,
    );
    request.headers.delete("X-Mynth-Delivery");
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(request, { imageTaskCompleted }, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 400,
      calls: [],
    });
  });

  test("accepts any matching v1 signature so secrets can rotate", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const oldSignature = await sign(body, "wbs_old", timestamp);
    const newSignature = await sign(body, SECRET, timestamp);
    const request = createRequest(
      body,
      event,
      `t=${timestamp},v1=${oldSignature},v1=${newSignature}`,
    );
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(request, { imageTaskCompleted }, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls.length }).toEqual({
      status: 200,
      calls: 1,
    });
  });

  test("rejects signatures more than five minutes in the future", async () => {
    // Arrange
    const timestamp = currentTimestamp() + 301;
    const request = createRequest(
      body,
      event,
      `t=${timestamp},v1=${await sign(body, SECRET, timestamp)}`,
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects signatures made with another secret", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const request = createRequest(
      body,
      event,
      `t=${timestamp},v1=${await sign(body, "wbs_other", timestamp)}`,
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects signatures that are not 32-byte hex digests", async () => {
    // Arrange
    const request = createRequest(body, event, `t=${currentTimestamp()},v1=zz`);

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect(response.status).toBe(400);
  });

  test("verifies the raw body bytes and rejects bodies that are not UTF-8", async () => {
    // Arrange
    const rawBody = new Uint8Array([0xff, 0xfe, 0x7b, 0x7d]);
    const timestamp = currentTimestamp();
    const request = createRequest(
      rawBody,
      event,
      `t=${timestamp},v1=${await sign(rawBody, SECRET, timestamp)}`,
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect(response.status).toBe(400);
  });

  test("acknowledges signed events named after Object.prototype members without dispatching", async () => {
    // Arrange
    const prototypeEvent = "constructor";
    const prototypeBody = JSON.stringify({ event: prototypeEvent, task: { id: "tsk_test" } });
    const timestamp = currentTimestamp();
    const request = createRequest(
      prototypeBody,
      prototypeEvent,
      `t=${timestamp},v1=${await sign(prototypeBody, SECRET, timestamp)}`,
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, {
      webhookSecret: SECRET,
    });

    // Assert
    expect(response.status).toBe(200);
  });
});

/** Signs `payload` and runs it through the handler, the way Mynth delivers it. */
async function deliver(
  payload: { event: string },
  eventHandlers: WebhookEventHandlers<{ deliveryId: string }>,
) {
  const payloadBody = JSON.stringify(payload);
  const timestamp = currentTimestamp();
  const request = createRequest(
    payloadBody,
    payload.event,
    `t=${timestamp},v1=${await sign(payloadBody, SECRET, timestamp)}`,
  );

  return handleWebhookRequest(request, eventHandlers, createContext, { webhookSecret: SECRET });
}

describe("handleWebhookRequest callback arguments", () => {
  test.each([
    ["task.image.generate.completed", "imageTaskCompleted"],
    ["task.image.rate.completed", "imageRateTaskCompleted"],
    ["task.image.alt.completed", "imageAltTaskCompleted"],
    ["task.image.review.completed", "imageReviewTaskCompleted"],
    ["task.image.remove_background.completed", "imageRemoveBackgroundTaskCompleted"],
    ["task.image.upscale.completed", "imageUpscaleTaskCompleted"],
    ["task.video.generate.completed", "videoTaskCompleted"],
  ] as const)("%s hands %s the result polling returns", async (event, handlerName) => {
    // Arrange
    const payload = WEBHOOK_PAYLOADS[event];
    const callback = vi.fn();

    // Act
    await deliver(payload, { [handlerName]: callback });
    const [result] = callback.mock.calls[0] ?? [];

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      raw: result.raw,
    }).toEqual({
      taskId: payload.task.id,
      cost: payload.task.cost,
      raw: { request: payload.request, result: payload.result },
    });
  });

  test("builds output images and failures for image generation", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();

    // Act
    await deliver(WEBHOOK_PAYLOADS["task.image.generate.completed"], { imageTaskCompleted });
    const result: ImageGenerationResult = imageTaskCompleted.mock.calls[0]?.[0];

    // Assert
    expect({
      image: result.images[0],
      failures: result.failures,
      metadata: result.metadata,
    }).toEqual({
      image: {
        id: "img_1",
        url: null,
        mynthUrl: "https://mynth.test/1.png",
        width: 1024,
        height: 768,
        size: "1024x768",
        format: "png",
        mimeType: "image/png",
        destination: undefined,
        rating: undefined,
      },
      failures: [{ code: "PROVIDER_ERROR", message: "The provider failed." }],
      metadata: { productId: "sku_1" },
    });
  });

  test("builds an output image for upscales", async () => {
    // Arrange
    const imageUpscaleTaskCompleted = vi.fn();

    // Act
    await deliver(WEBHOOK_PAYLOADS["task.image.upscale.completed"], { imageUpscaleTaskCompleted });
    const result: ImageUpscaleResult = imageUpscaleTaskCompleted.mock.calls[0]?.[0];

    // Assert
    expect({
      width: result.image.width,
      metadata: result.metadata,
    }).toEqual({ width: 1024, metadata: { productId: "sku_1" } });
  });

  test.each([
    ["task.image.generate.failed", "imageTaskFailed"],
    ["task.image.remove_background.failed", "imageRemoveBackgroundTaskFailed"],
    ["task.image.upscale.failed", "imageUpscaleTaskFailed"],
    ["task.video.generate.failed", "videoTaskFailed"],
  ] as const)("%s hands %s the failure with its metadata", async (event, handlerName) => {
    // Arrange
    const payload = WEBHOOK_PAYLOADS[event];
    const callback = vi.fn();

    // Act
    await deliver(payload, { [handlerName]: callback });

    // Assert
    expect(callback.mock.calls[0]?.[0]).toEqual({
      taskId: payload.task.id,
      errors: payload.errors,
      metadata: { productId: "sku_1" },
      raw: { request: payload.request },
    });
  });

  test.each([
    ["task.image.rate.failed", "imageRateTaskFailed"],
    ["task.image.alt.failed", "imageAltTaskFailed"],
    ["task.image.review.failed", "imageReviewTaskFailed"],
  ] as const)("%s hands %s the failure", async (event, handlerName) => {
    // Arrange
    const payload = WEBHOOK_PAYLOADS[event];
    const callback = vi.fn();

    // Act
    await deliver(payload, { [handlerName]: callback });

    // Assert
    expect(callback.mock.calls[0]?.[0]).toStrictEqual({
      taskId: payload.task.id,
      errors: payload.errors,
      raw: { request: payload.request },
    });
  });

  test("rejects a completed payload without a cost so Mynth retries it", async () => {
    // Arrange
    const { task, ...rest } = WEBHOOK_PAYLOADS["task.image.alt.completed"];
    const payload = { ...rest, task: { id: task.id } };
    const imageAltTaskCompleted = vi.fn();

    // Act
    const delivery = deliver(payload, { imageAltTaskCompleted });

    // Assert
    await expect(delivery).rejects.toThrow("Webhook for task tsk_alt is missing cost");
  });

  test("acknowledges a payload it cannot build when no callback handles the event", async () => {
    // Arrange
    const { task, ...rest } = WEBHOOK_PAYLOADS["task.image.alt.completed"];
    const payload: Omit<MynthSDKTypes.WebhookTaskImageAltCompletedPayload, "task"> & {
      task: { id: string };
    } = { ...rest, task: { id: task.id } };

    // Act
    const response = await deliver(payload, { imageTaskCompleted: vi.fn() });

    // Assert
    expect(response.status).toBe(200);
  });
});
