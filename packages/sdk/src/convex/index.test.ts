import { httpRouter, type PublicHttpAction } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { MynthSDKTypes } from "../types.ts";
import { WEBHOOK_HANDLER_NAMES, WEBHOOK_PAYLOADS } from "../webhooks/payloads.fixture.ts";
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

const imageCompletedPayload = WEBHOOK_PAYLOADS["task.image.generate.completed"];

describe("mynthWebhookAction", () => {
  test.each(WEBHOOK_HANDLER_NAMES)(
    "dispatches %s to %s with the action context",
    async (event, handlerName) => {
      // Arrange
      const payload = WEBHOOK_PAYLOADS[event];
      const callback = vi.fn();
      const action = mynthWebhookAction({ [handlerName]: callback }, { webhookSecret: SECRET });

      // Act
      const response = await invoke(action, await createWebhookRequest(payload));

      // Assert
      expect({ status: response.status, calls: callback.mock.calls }).toEqual({
        status: 200,
        calls: [
          [
            expect.objectContaining({ taskId: payload.task.id }),
            { context: {}, request: expect.any(Request), deliveryId: DELIVERY_ID },
          ],
        ],
      });
    },
  );

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
        imageTaskCompleted: async (result, { context }) => {
          await context.runMutation(
            "images:save" as never,
            {
              taskId: result.taskId,
              images: result.images,
            } as never,
          );
        },
      },
      { webhookSecret: SECRET },
    );

    // Act
    const response = await invoke(action, await createWebhookRequest(imageCompletedPayload), ctx);

    // Assert
    expect({ status: response.status, calls: ctx.runMutation.mock.calls }).toEqual({
      status: 200,
      calls: [
        [
          "images:save",
          {
            taskId: "tsk_generate",
            images: [
              {
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
            ],
          },
        ],
      ],
    });
  });
});
