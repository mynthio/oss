import { afterEach, describe, expect, test, vi } from "vitest";

import { Mynth, MynthImage, TaskAsync } from "./index";
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

function createRateTaskData(
  overrides: Partial<MynthSDKTypes.ImageRateTaskData> = {},
): MynthSDKTypes.ImageRateTaskData {
  return {
    id: "task-rate-123",
    status: "completed",
    type: "image.rate",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.01",
    result: {
      results: [{ status: "success", url: "https://cdn.test/image.webp", level: "sfw" }],
    },
    request: {
      urls: ["https://cdn.test/image.webp"],
      mode: "nsfw_sfw",
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageRateTaskData;
}

function createAltTaskData(
  overrides: Partial<MynthSDKTypes.ImageAltTaskData> = {},
): MynthSDKTypes.ImageAltTaskData {
  return {
    id: "task-alt-123",
    status: "completed",
    type: "image.alt",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.01",
    result: {
      results: [
        {
          status: "success",
          url: "https://cdn.test/image.webp",
          alt: "A studio product photo of a ceramic mug.",
        },
      ],
    },
    request: {
      urls: ["https://cdn.test/image.webp"],
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageAltTaskData;
}

describe("MynthImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("generateAsync returns a pollable task without waiting", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          taskId: "task-123",
          access: { publicAccessToken: "pat-123" },
        },
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
      .mockResolvedValueOnce(jsonResponse({ data: { taskId: "task-123" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
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

  test("rateAsync returns a pollable rate task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            task: { id: "task-rate-123", status: "pending" },
          },
        },
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const task = await image.rateAsync({
      urls: ["https://cdn.test/image.webp"],
      mode: "nsfw_sfw",
    });

    // Assert
    expect({
      isTaskAsync: task instanceof TaskAsync,
      id: task.id,
      publicAccessToken: task.access.publicAccessToken,
      fetchCall: fetchMock.mock.calls[0],
    }).toEqual({
      isTaskAsync: true,
      id: "task-rate-123",
      publicAccessToken: undefined,
      fetchCall: [
        "https://api.test/image/rate",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            urls: ["https://cdn.test/image.webp"],
            mode: "nsfw_sfw",
            sync: false,
          }),
        }),
      ],
    });
  });

  test("rate waits for the completed rate task result", async () => {
    // Arrange
    const taskData = createRateTaskData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              task: { id: "task-rate-123", status: "pending" },
            },
          },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.rate({
      urls: ["https://cdn.test/image.webp"],
      mode: "nsfw_sfw",
    });

    // Assert
    expect({
      taskId: result.taskId,
      task: result.task,
      ratings: result.getRatings(),
      errors: result.getErrors(),
    }).toEqual({
      taskId: "task-rate-123",
      task: { id: "task-rate-123", status: "completed", cost: "0.01" },
      ratings: [{ status: "success", url: "https://cdn.test/image.webp", level: "sfw" }],
      errors: [],
    });
  });

  test("altAsync returns a pollable alt text task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            task: { id: "task-alt-123", status: "pending" },
          },
        },
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const task = await image.altAsync({
      urls: ["https://cdn.test/image.webp"],
    });

    // Assert
    expect({
      isTaskAsync: task instanceof TaskAsync,
      id: task.id,
      publicAccessToken: task.access.publicAccessToken,
      fetchCall: fetchMock.mock.calls[0],
    }).toEqual({
      isTaskAsync: true,
      id: "task-alt-123",
      publicAccessToken: undefined,
      fetchCall: [
        "https://api.test/image/alt",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            urls: ["https://cdn.test/image.webp"],
            sync: false,
          }),
        }),
      ],
    });
  });

  test("alt waits for the completed alt text task result", async () => {
    // Arrange
    const taskData = createAltTaskData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              task: { id: "task-alt-123", status: "pending" },
            },
          },
          { status: 202 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.alt({
      urls: ["https://cdn.test/image.webp"],
    });

    // Assert
    expect({
      taskId: result.taskId,
      task: result.task,
      altTexts: result.getAltTexts(),
      errors: result.getErrors(),
    }).toEqual({
      taskId: "task-alt-123",
      task: { id: "task-alt-123", status: "completed", cost: "0.01" },
      altTexts: [
        {
          status: "success",
          url: "https://cdn.test/image.webp",
          alt: "A studio product photo of a ceramic mug.",
        },
      ],
      errors: [],
    });
  });
});

describe("Mynth", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("models.list fetches the public model catalog without authorization", async () => {
    // Arrange
    const models: MynthSDKTypes.Model[] = [
      {
        id: "black-forest-labs/flux.2-pro",
        displayName: "FLUX.2 Pro",
        pricing: { perImage: { base: "0.05" } },
      },
    ];
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ data: models }));
    vi.stubGlobal("fetch", fetchMock);

    const mynth = new Mynth({ baseUrl: "https://api.test" });

    // Act
    const listedModels = await mynth.models.list();

    // Assert
    expect({
      models: listedModels,
      fetchCall: fetchMock.mock.calls[0],
    }).toEqual({
      models,
      fetchCall: [
        "https://api.test/models",
        {
          headers: {},
        },
      ],
    });
  });

  test("models.list throws an API error when the endpoint fails", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          error: "Models unavailable",
          code: "models_unavailable",
        },
        { status: 503 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const mynth = new Mynth({ baseUrl: "https://api.test" });

    // Act
    const listPromise = mynth.models.list();

    // Assert
    await expect(listPromise).rejects.toMatchObject({
      name: "MynthAPIError",
      message: "Models unavailable",
      status: 503,
      code: "models_unavailable",
    });
  });
});
