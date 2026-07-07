import { describe, expect, test, vi } from "vitest";

import type { MynthSDKTypes } from "../types";
import { mynthWebhookAction } from "./index";

const SECRET = "whsec_test";

async function createSignature(body: string, secret = SECRET) {
  const timestamp = "1760000000";
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

async function createWebhookRequest(payload: MynthSDKTypes.WebhookPayload) {
  const body = JSON.stringify(payload);

  return new Request("https://example.com/mynth-webhook", {
    method: "POST",
    headers: {
      "X-Mynth-Event": payload.event,
      "X-Mynth-Signature": await createSignature(body),
    },
    body,
  });
}

describe("mynthWebhookAction", () => {
  test("dispatches image rating completion events", async () => {
    // Arrange
    const imageRateTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageRateCompletedPayload = {
      event: "task.image.rate.completed",
      task: { id: "tsk_rate" },
      request: {
        mode: "nsfw_sfw",
        urls: ["https://cdn.example.com/image.webp"],
      },
      result: {
        results: [
          {
            status: "success",
            url: "https://cdn.example.com/image.webp",
            level: "sfw",
          },
        ],
      },
    };
    const action = mynthWebhookAction({ imageRateTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await action({} as never, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRateTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request) }]],
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
        urls: ["https://cdn.example.com/image.webp"],
      },
    };
    const action = mynthWebhookAction({ imageRateTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await action({} as never, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageRateTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request) }]],
    });
  });

  test("dispatches image alt text completion events", async () => {
    // Arrange
    const imageAltTaskCompleted = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageAltCompletedPayload = {
      event: "task.image.alt.completed",
      task: { id: "tsk_alt" },
      request: {
        urls: ["https://cdn.example.com/image.webp"],
      },
      result: {
        results: [
          {
            status: "success",
            url: "https://cdn.example.com/image.webp",
            alt: "A studio product photo of a ceramic mug.",
          },
        ],
      },
    };
    const action = mynthWebhookAction({ imageAltTaskCompleted }, { webhookSecret: SECRET });

    // Act
    const response = await action({} as never, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageAltTaskCompleted.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request) }]],
    });
  });

  test("dispatches image alt text failure events", async () => {
    // Arrange
    const imageAltTaskFailed = vi.fn();
    const payload: MynthSDKTypes.WebhookTaskImageAltFailedPayload = {
      event: "task.image.alt.failed",
      task: { id: "tsk_alt" },
      request: {
        urls: ["https://cdn.example.com/image.webp"],
      },
    };
    const action = mynthWebhookAction({ imageAltTaskFailed }, { webhookSecret: SECRET });

    // Act
    const response = await action({} as never, await createWebhookRequest(payload));

    // Assert
    expect({
      status: response.status,
      calls: imageAltTaskFailed.mock.calls,
    }).toEqual({
      status: 200,
      calls: [[payload, { context: {}, request: expect.any(Request) }]],
    });
  });
});
