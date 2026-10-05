import { afterEach, describe, expect, test, vi } from "vitest";

import type { ImageGenerationResult } from "../image-generation-result.ts";
import type { ImageUpscaleResult } from "../image-upscale-result.ts";
import type { MynthSDKTypes } from "../types.ts";
import { signWebhook, WEBHOOK_EVENTS, WEBHOOK_SECRET, webhookRequest } from "./events.fixture.ts";
import { handleWebhookRequest, type WebhookEventHandlers } from "./handler.ts";

type Context = { event: MynthSDKTypes.WebhookEvent };

const createContext = (event: MynthSDKTypes.WebhookEvent): Context => ({ event });
const signed = { webhookSecret: WEBHOOK_SECRET };
const event = WEBHOOK_EVENTS["task.image.generate.completed"];

function currentTimestamp() {
  return Math.floor(Date.now() / 1000);
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("handleWebhookRequest with a signed delivery", () => {
  test("hands the callback the verified event in its context", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(
      await webhookRequest(event),
      { imageTaskCompleted },
      createContext,
      signed,
    );

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 200,
      calls: [[expect.objectContaining({ taskId: "tsk_generate" }), { event }]],
    });
  });

  test("reads the secret from MYNTH_WEBHOOK_SECRET when it is not passed", async () => {
    // Arrange
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", WEBHOOK_SECRET);

    // Act
    const response = await handleWebhookRequest(await webhookRequest(event), {}, createContext, {});

    // Assert
    expect(response.status).toBe(200);
  });

  test.each(["webhook-id", "webhook-timestamp", "webhook-signature"])(
    "rejects a delivery without %s",
    async (header) => {
      // Arrange
      const request = await webhookRequest(event);
      request.headers.delete(header);
      const imageTaskCompleted = vi.fn();

      // Act
      const response = await handleWebhookRequest(
        request,
        { imageTaskCompleted },
        createContext,
        signed,
      );

      // Assert
      expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
        status: 400,
        calls: [],
      });
    },
  );

  test("rejects a replay that keeps the body and signature but changes the webhook-id", async () => {
    // Arrange: a delivery ID the receiver has not seen yet, to slip past its dedup.
    const original = await webhookRequest(event);
    const replay = new Request(original.url, {
      method: "POST",
      headers: { ...Object.fromEntries(original.headers), "webhook-id": "evt_replayed" },
      body: JSON.stringify(event),
    });

    // Act
    const response = await handleWebhookRequest(replay, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects a body whose id is not the webhook-id", async () => {
    // Arrange
    const request = await webhookRequest(
      { id: event.id },
      { body: JSON.stringify({ ...event, id: "evt_other" }) },
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("accepts any matching v1 signature, so a list of them verifies", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const body = JSON.stringify(event);
    const other = await signWebhook(
      body,
      event.id,
      timestamp,
      "whsec_dGhpcyBpcyBhbm90aGVyIHNlY3JldCBlbnRpcmVseQ==",
    );
    const request = new Request("https://example.com/mynth-webhook", {
      method: "POST",
      headers: {
        "webhook-id": event.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v2,ignored ${other} ${await signWebhook(body, event.id, timestamp)}`,
      },
      body,
    });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(200);
  });

  test.each([
    ["more than five minutes old", -301],
    ["more than five minutes in the future", 301],
  ])("rejects a timestamp %s", async (_, offset) => {
    // Arrange
    const request = await webhookRequest(event, { timestamp: currentTimestamp() + offset });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("rejects a signature made with another secret", async () => {
    // Arrange
    const request = await webhookRequest(event, {
      secret: "whsec_dGhpcyBpcyBhbm90aGVyIHNlY3JldCBlbnRpcmVseQ==",
    });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("verifies the raw body bytes and rejects a body that is not UTF-8", async () => {
    // Arrange
    const timestamp = currentTimestamp();
    const body = new Uint8Array([0xff, 0xfe, 0xfd]);
    const key = await crypto.subtle.importKey(
      "raw",
      Uint8Array.from(atob(WEBHOOK_SECRET.slice(6)), (char) => char.charCodeAt(0)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const prefix = new TextEncoder().encode(`${event.id}.${timestamp}.`);
    const message = new Uint8Array([...prefix, ...body]);
    const signature = new Uint8Array(await crypto.subtle.sign("HMAC", key, message));
    const request = new Request("https://example.com/mynth-webhook", {
      method: "POST",
      headers: {
        "webhook-id": event.id,
        "webhook-timestamp": String(timestamp),
        "webhook-signature": `v1,${btoa(String.fromCharCode(...signature))}`,
      },
      body,
    });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("throws without a secret, so the misconfiguration is not answered as a bad request", async () => {
    // Arrange
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", "");

    // Act
    const handle = handleWebhookRequest(await webhookRequest(event), {}, createContext, {});

    // Assert
    await expect(handle).rejects.toThrow("MYNTH_WEBHOOK_SECRET is required");
  });

  test("acknowledges an event type newer than this SDK", async () => {
    // Arrange
    const newer = { ...event, id: "evt_newer", type: "task.audio.generate.completed" };
    const imageTaskCompleted = vi.fn();
    const onEvent = vi.fn();

    // Act
    const response = await handleWebhookRequest(
      await webhookRequest(newer),
      { imageTaskCompleted, onEvent },
      createContext,
      signed,
    );

    // Assert
    expect({
      status: response.status,
      typed: imageTaskCompleted.mock.calls.length,
      generic: onEvent.mock.calls.map(([received]) => received.type),
    }).toEqual({ status: 200, typed: 0, generic: ["task.audio.generate.completed"] });
  });

  test("acknowledges an event type named after an Object.prototype member without dispatching", async () => {
    // Arrange
    const prototypeEvent = { ...event, id: "evt_constructor", type: "constructor" };

    // Act
    const response = await handleWebhookRequest(
      await webhookRequest(prototypeEvent),
      {},
      createContext,
      signed,
    );

    // Assert
    expect(response.status).toBe(200);
  });

  test("hands onEvent the event before the typed callback runs", async () => {
    // Arrange
    const order: string[] = [];
    const onEvent = vi.fn(() => {
      order.push("onEvent");
    });
    const imageTaskCompleted = vi.fn(() => {
      order.push("imageTaskCompleted");
    });

    // Act
    await handleWebhookRequest(
      await webhookRequest(event),
      { onEvent, imageTaskCompleted },
      createContext,
      signed,
    );

    // Assert
    expect({ order, onEvent: onEvent.mock.calls[0] }).toEqual({
      order: ["onEvent", "imageTaskCompleted"],
      onEvent: [event, { event }],
    });
  });
});

describe("handleWebhookRequest with an unsigned delivery", () => {
  const url = "https://example.com/mynth-webhook?token=secret-token";
  const unsigned = {
    unsigned: {
      verify: (request: Request) =>
        new URL(request.url).searchParams.get("token") === "secret-token",
    },
  };

  test("rejects it with 400 unless unsigned deliveries are accepted", async () => {
    // Arrange
    const request = await webhookRequest(event, { url, signed: false });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, signed);

    // Assert
    expect(response.status).toBe(400);
  });

  test("dispatches it when verify accepts the request", async () => {
    // Arrange
    const request = await webhookRequest(event, { url, signed: false });
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(
      request,
      { imageTaskCompleted },
      createContext,
      unsigned,
    );

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls.length }).toEqual({
      status: 200,
      calls: 1,
    });
  });

  test("answers 401 when verify refuses the request", async () => {
    // Arrange
    const request = await webhookRequest(event, {
      url: "https://example.com/mynth-webhook?token=guess",
      signed: false,
    });
    const imageTaskCompleted = vi.fn();

    // Act
    const response = await handleWebhookRequest(
      request,
      { imageTaskCompleted },
      createContext,
      unsigned,
    );

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 401,
      calls: [],
    });
  });

  test("still needs the webhook-id and a body that matches it", async () => {
    // Arrange
    const request = await webhookRequest(
      { id: event.id },
      { url, signed: false, body: JSON.stringify({ ...event, id: "evt_other" }) },
    );

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, unsigned);

    // Assert
    expect(response.status).toBe(400);
  });

  test("needs no secret", async () => {
    // Arrange
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", "");
    const request = await webhookRequest(event, { url, signed: false });

    // Act
    const response = await handleWebhookRequest(request, {}, createContext, unsigned);

    // Assert
    expect(response.status).toBe(200);
  });
});

/** Signs `event` and runs it through the handler, the way Mynth delivers it. */
async function deliver(delivered: { id: string }, eventHandlers: WebhookEventHandlers<Context>) {
  return handleWebhookRequest(
    await webhookRequest(delivered),
    eventHandlers,
    createContext,
    signed,
  );
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
  ] as const)("%s hands %s the result polling returns", async (type, handlerName) => {
    // Arrange
    const completed = WEBHOOK_EVENTS[type];
    const callback = vi.fn();

    // Act
    await deliver(completed, { [handlerName]: callback });
    const [result] = callback.mock.calls[0] ?? [];

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      raw: result.raw,
    }).toEqual({
      taskId: completed.data.id,
      cost: completed.data.cost,
      raw: { request: completed.data.request, result: completed.data.result },
    });
  });

  test("builds output images and failures for image generation", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();

    // Act
    await deliver(WEBHOOK_EVENTS["task.image.generate.completed"], { imageTaskCompleted });
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
      failures: [{ code: "provider_error", message: "The provider failed." }],
      metadata: { productId: "sku_1" },
    });
  });

  test("builds an output image for upscales", async () => {
    // Arrange
    const imageUpscaleTaskCompleted = vi.fn();

    // Act
    await deliver(WEBHOOK_EVENTS["task.image.upscale.completed"], { imageUpscaleTaskCompleted });
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
  ] as const)("%s hands %s the failure with its metadata", async (type, handlerName) => {
    // Arrange
    const failed = WEBHOOK_EVENTS[type];
    const callback = vi.fn();

    // Act
    await deliver(failed, { [handlerName]: callback });

    // Assert
    expect(callback.mock.calls[0]?.[0]).toEqual({
      taskId: failed.data.id,
      errors: failed.data.errors,
      metadata: { productId: "sku_1" },
      raw: { request: failed.data.request },
    });
  });

  test.each([
    ["task.image.rate.failed", "imageRateTaskFailed"],
    ["task.image.alt.failed", "imageAltTaskFailed"],
    ["task.image.review.failed", "imageReviewTaskFailed"],
  ] as const)("%s hands %s the failure", async (type, handlerName) => {
    // Arrange
    const failed = WEBHOOK_EVENTS[type];
    const callback = vi.fn();

    // Act
    await deliver(failed, { [handlerName]: callback });

    // Assert
    expect(callback.mock.calls[0]?.[0]).toStrictEqual({
      taskId: failed.data.id,
      errors: failed.data.errors,
      raw: { request: failed.data.request },
    });
  });

  test("rejects a completed event without a cost so Mynth retries it", async () => {
    // Arrange
    const completed = WEBHOOK_EVENTS["task.image.alt.completed"];
    const withoutCost = { ...completed, data: { ...completed.data, cost: null } };
    const imageAltTaskCompleted = vi.fn();

    // Act
    const delivery = deliver(withoutCost, { imageAltTaskCompleted });

    // Assert
    await expect(delivery).rejects.toThrow("Webhook task tsk_alt is missing cost");
  });

  test("acknowledges an event it cannot build when no callback handles the event", async () => {
    // Arrange
    const completed = WEBHOOK_EVENTS["task.image.alt.completed"];
    const withoutCost = { ...completed, data: { ...completed.data, cost: null } };

    // Act
    const response = await deliver(withoutCost, { imageTaskCompleted: vi.fn() });

    // Assert
    expect(response.status).toBe(200);
  });
});
