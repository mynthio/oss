import { httpRouter, type PublicHttpAction } from "convex/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import {
  WEBHOOK_EVENTS,
  WEBHOOK_HANDLER_NAMES,
  WEBHOOK_SECRET,
  webhookRequest,
} from "../webhooks/events.fixture.ts";
import { mynthWebhookAction } from "./index.ts";

const signed = { webhookSecret: WEBHOOK_SECRET };
const imageCompleted = WEBHOOK_EVENTS["task.image.generate.completed"];

afterEach(() => {
  vi.unstubAllEnvs();
});

/** Runs the wrapped handler the way the Convex runtime does, without its syscalls. */
function invoke(action: PublicHttpAction, request: Request, ctx: object = {}) {
  const { _handler } = action as unknown as {
    _handler: (ctx: object, request: Request) => Promise<Response>;
  };

  return _handler(ctx, request);
}

describe("mynthWebhookAction", () => {
  test.each(WEBHOOK_HANDLER_NAMES)(
    "dispatches %s to %s with the Convex context, the request and the event",
    async (type, handlerName) => {
      // Arrange
      const event = WEBHOOK_EVENTS[type];
      const callback = vi.fn();
      const action = mynthWebhookAction({ [handlerName]: callback }, signed);

      // Act
      const response = await invoke(action, await webhookRequest(event));

      // Assert
      expect({ status: response.status, calls: callback.mock.calls }).toEqual({
        status: 200,
        calls: [
          [
            expect.objectContaining({ taskId: event.data.id }),
            { context: {}, request: expect.any(Request), event },
          ],
        ],
      });
    },
  );

  test("returns a Convex HTTP action that httpRouter accepts", () => {
    // Arrange
    const http = httpRouter();
    const action = mynthWebhookAction({}, signed);

    // Act
    http.route({ path: "/mynth-webhook", method: "POST", handler: action });

    // Assert
    expect(http.lookup("/mynth-webhook", "POST")?.[0]).toBe(action);
  });

  test("reads the webhook secret when the request arrives, not when the action is created", async () => {
    // Arrange
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", "");
    const action = mynthWebhookAction({});
    vi.stubEnv("MYNTH_WEBHOOK_SECRET", WEBHOOK_SECRET);

    // Act
    const response = await invoke(action, await webhookRequest(imageCompleted));

    // Assert
    expect(response.status).toBe(200);
  });

  test("accepts unsigned deliveries to a custom URL with the unsigned option", async () => {
    // Arrange
    const imageTaskCompleted = vi.fn();
    const action = mynthWebhookAction(
      { imageTaskCompleted },
      {
        unsigned: {
          verify: (request) => new URL(request.url).searchParams.get("token") === "secret",
        },
      },
    );
    const request = await webhookRequest(imageCompleted, {
      url: "https://example.convex.site/webhooks/mynth?token=secret",
      signed: false,
    });

    // Act
    const response = await invoke(action, request);

    // Assert
    expect({ status: response.status, calls: imageTaskCompleted.mock.calls.length }).toEqual({
      status: 200,
      calls: 1,
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
      signed,
    );

    // Act
    const response = await invoke(action, await webhookRequest(imageCompleted), ctx);

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
