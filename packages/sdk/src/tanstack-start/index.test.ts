import { expect, test, vi } from "vitest";

import { mynthWebhookHandler } from "./index";

const SECRET = "wbs_test";

async function createRequest(body: string) {
  const timestamp = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`));
  const hex = Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  return new Request("https://example.com/api/webhooks/mynth/project_test", {
    method: "POST",
    headers: {
      "X-Mynth-Event": "task.image.generate.completed",
      "X-Mynth-Signature": `t=${timestamp},v1=${hex}`,
    },
    body,
  });
}

test("dispatches events with the TanStack Start route context", async () => {
  // Arrange
  const payload = { event: "task.image.generate.completed", task: { id: "tsk_test" } };
  const request = await createRequest(JSON.stringify(payload));
  const routeContext = {
    request,
    params: { projectId: "project_test" },
    context: { requestId: "request_test" },
  };
  const imageTaskCompleted = vi.fn();
  const handler = mynthWebhookHandler({ imageTaskCompleted }, { webhookSecret: SECRET });

  // Act
  const response = await handler(routeContext);

  // Assert
  expect({
    status: response.status,
    calls: imageTaskCompleted.mock.calls,
    requestBodyUsed: request.bodyUsed,
  }).toEqual({
    status: 200,
    calls: [[payload, routeContext]],
    requestBodyUsed: false,
  });
});
