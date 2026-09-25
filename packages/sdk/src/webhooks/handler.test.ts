import { describe, expect, test, vi } from "vitest";

import { handleWebhookRequest } from "./handler.ts";

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
const body = JSON.stringify({ event, task: { id: "tsk_test" } });

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
      calls: [[JSON.parse(body), { deliveryId: DELIVERY_ID }]],
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
