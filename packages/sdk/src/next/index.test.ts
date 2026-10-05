import { afterEach, describe, expect, test, vi } from "vitest";

import {
  WEBHOOK_EVENTS,
  WEBHOOK_HANDLER_NAMES,
  WEBHOOK_SECRET,
  webhookRequest,
} from "../webhooks/events.fixture.ts";
import { mynthWebhookHandler } from "./index.ts";

const signed = { webhookSecret: WEBHOOK_SECRET };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mynthWebhookHandler", () => {
  test.each(WEBHOOK_HANDLER_NAMES)(
    "dispatches %s to %s with the request and the event",
    async (type, handlerName) => {
      // Arrange
      const event = WEBHOOK_EVENTS[type];
      const request = await webhookRequest(event);
      const callback = vi.fn();
      const handler = mynthWebhookHandler({ [handlerName]: callback }, signed);

      // Act
      const response = await handler(request);

      // Assert
      expect({ status: response.status, calls: callback.mock.calls }).toEqual({
        status: 200,
        calls: [[expect.objectContaining({ taskId: event.data.id }), { request, event }]],
      });
    },
  );

  test("reads the webhook secret when the request arrives", async () => {
    // Arrange
    const handler = mynthWebhookHandler({});
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", WEBHOOK_SECRET);

    // Act
    const response = await handler(await webhookRequest(WEBHOOK_EVENTS["task.image.alt.failed"]));

    // Assert
    expect(response.status).toBe(200);
  });

  test("rejects an unsigned request by default", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler({ imageTaskCompleted }, signed);
    const request = await webhookRequest(WEBHOOK_EVENTS["task.image.generate.completed"], {
      signed: false,
    });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls }).toEqual({
      status: 400,
      calls: [],
    });
  });

  test("accepts an unsigned request that the unsigned option verifies", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();
    const handler = mynthWebhookHandler(
      { imageTaskCompleted },
      {
        unsigned: {
          verify: (request) => new URL(request.url).searchParams.get("token") === "secret",
        },
      },
    );
    const request = await webhookRequest(WEBHOOK_EVENTS["task.image.generate.completed"], {
      url: "https://example.com/api/mynth-webhook?token=secret",
      signed: false,
    });

    // Act
    const response = await handler(request);

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls.length }).toEqual({
      status: 200,
      calls: 1,
    });
  });

  test("propagates event handler failures for webhook retries", async () => {
    // Arrange
    const handler = mynthWebhookHandler(
      {
        imageTaskCompleted: () => {
          throw new Error("database unavailable");
        },
      },
      signed,
    );

    // Act
    const handle = handler(await webhookRequest(WEBHOOK_EVENTS["task.image.generate.completed"]));

    // Assert
    await expect(handle).rejects.toThrow("database unavailable");
  });
});
