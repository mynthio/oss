import { describe, expect, it } from "vitest";

import { MynthClient } from "../src/client.ts";
import { MynthResponseError } from "../src/errors.ts";
import { apiError, BASE_URL, createMockApi, type MockApi, ok } from "./mock-api.ts";

function createClient(api: MockApi, headers: Record<string, string> = {}): MynthClient {
  return new MynthClient({ apiKey: "mak_test", baseURL: BASE_URL, headers, fetch: api.fetch });
}

describe("MynthClient", () => {
  it("unwraps the data envelope", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1/status": ok({ status: "pending" }) });

    // Act
    const data = await createClient(api).get("/tasks/tsk_1/status");

    // Assert
    expect(data).toEqual({ status: "pending" });
  });

  it("authenticates with the API key", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1": ok({}) });

    // Act
    await createClient(api).get("/tasks/tsk_1");

    // Assert
    expect(api.requests[0]?.headers.get("authorization")).toBe("Bearer mak_test");
  });

  it("sends the default headers", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1": ok({}) });

    // Act
    await createClient(api, { "cf-aig-authorization": "Bearer gw" }).get("/tasks/tsk_1");

    // Assert
    expect(api.requests[0]?.headers.get("cf-aig-authorization")).toBe("Bearer gw");
  });

  it("sends JSON bodies as JSON", async () => {
    // Arrange
    const api = createMockApi({ "POST /image/generate": ok({}) });

    // Act
    await createClient(api).postJson("/image/generate", { prompt: "a cat" });

    // Assert
    expect(api.requests[0]?.headers.get("content-type")).toBe("application/json");
  });

  it("turns an error response into a MynthAPIError", async () => {
    // Arrange
    const api = createMockApi({
      "POST /image/generate": apiError(400, {
        code: "validation_error",
        message: "size.scale: unsupported value",
        issues: [{ path: ["size", "scale"], message: "unsupported value" }],
      }),
    });

    // Act
    const result = createClient(api).postJson("/image/generate", {});

    // Assert
    await expect(result).rejects.toMatchObject({
      name: "MynthAPIError",
      status: 400,
      code: "validation_error",
      message: "size.scale: unsupported value",
      issues: [{ path: ["size", "scale"], message: "unsupported value" }],
    });
  });

  it("keeps the task an errored request created", async () => {
    // Arrange
    const api = createMockApi({
      "POST /image/generate": apiError(500, {
        code: "public_access_token_failed",
        task_id: "tsk_1",
      }),
    });

    // Act
    const result = createClient(api).postJson("/image/generate", {});

    // Assert
    await expect(result).rejects.toMatchObject({ taskId: "tsk_1" });
  });

  it("reads Retry-After in seconds", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1": apiError(429, {}, { "retry-after": "3" }) });

    // Act
    const result = createClient(api).get("/tasks/tsk_1");

    // Assert
    await expect(result).rejects.toMatchObject({ retryAfterMs: 3_000 });
  });

  it("describes an error response that is not JSON by its status", async () => {
    // Arrange
    const api = createMockApi({
      "GET /tasks/tsk_1": () => new Response("<html>Bad gateway</html>", { status: 502 }),
    });

    // Act
    const result = createClient(api).get("/tasks/tsk_1");

    // Assert
    await expect(result).rejects.toThrow("Mynth API request failed with status 502");
  });

  it("rejects a successful response that is not JSON", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1": () => new Response("ok") });

    // Act
    const result = createClient(api).get("/tasks/tsk_1");

    // Assert
    await expect(result).rejects.toThrow(MynthResponseError);
  });

  it("rejects a successful response without a data envelope", async () => {
    // Arrange
    const api = createMockApi({ "GET /tasks/tsk_1": () => Response.json({ status: "pending" }) });

    // Act
    const result = createClient(api).get("/tasks/tsk_1");

    // Assert
    await expect(result).rejects.toThrow(MynthResponseError);
  });
});
