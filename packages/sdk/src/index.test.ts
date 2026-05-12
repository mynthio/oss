import { afterEach, describe, expect, test, vi } from "vitest";

import { MynthImage, TaskAsync } from "./index";
import type { MynthSDKTypes } from "./types";

function jsonResponse(data: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

function createTaskData(
  overrides: Partial<MynthSDKTypes.ImageGenerationTaskData> = {},
): MynthSDKTypes.ImageGenerationTaskData {
  return {
    id: "task-123",
    status: "completed",
    type: "image.generate",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.01",
    result: {
      model: "black-forest-labs/flux.2-dev",
      images: [],
    } as MynthSDKTypes.ImageResult,
    request: {
      prompt: "test prompt",
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageGenerationTaskData;
}

describe("MynthImage generation", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("generateAsync returns a pollable task without waiting", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        taskId: "task-123",
        access: { publicAccessToken: "pat-123" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const task = await image.generateAsync({ prompt: "test prompt" });

    expect(task).toBeInstanceOf(TaskAsync);
    expect(task.id).toBe("task-123");
    expect(task.access.publicAccessToken).toBe("pat-123");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/image/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ prompt: "test prompt" }),
      }),
    );
  });

  test("generate waits for the completed task result", async () => {
    const taskData = createTaskData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ taskId: "task-123" }))
      .mockResolvedValueOnce(jsonResponse({ status: "completed" }))
      .mockResolvedValueOnce(jsonResponse(taskData));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const result = await image.generate({ prompt: "test prompt" });

    expect(result.id).toBe("task-123");
    expect(result.result?.model).toBe("black-forest-labs/flux.2-dev");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.test/tasks/task-123/status",
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      "https://api.test/tasks/task-123",
      expect.any(Object),
    );
  });
});
