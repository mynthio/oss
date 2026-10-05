import { expect, test, vi } from "vitest";

import { WEBHOOK_EVENTS, WEBHOOK_SECRET, webhookRequest } from "../webhooks/events.fixture.ts";
import { mynthWebhookHandler } from "./index.ts";

test("dispatches events with the TanStack Start route context and the event", async () => {
  // Arrange
  const event = WEBHOOK_EVENTS["task.image.generate.completed"];
  const request = await webhookRequest(event);
  const routeContext = { request, params: { id: "1" }, context: { userId: "user_1" } };
  const imageTaskCompleted = vi.fn();
  const handler = mynthWebhookHandler({ imageTaskCompleted }, { webhookSecret: WEBHOOK_SECRET });

  // Act
  const response = await handler(routeContext);

  // Assert
  expect({
    status: response.status,
    calls: imageTaskCompleted.mock.calls,
    bodyUnread: request.bodyUsed === false,
  }).toEqual({
    status: 200,
    calls: [[expect.objectContaining({ taskId: "tsk_generate" }), { ...routeContext, event }]],
    bodyUnread: true,
  });
});
