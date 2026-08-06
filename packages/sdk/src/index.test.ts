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
      url: "https://cdn.test/image.webp",
      level: "sfw",
    },
    request: {
      url: "https://cdn.test/image.webp",
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
      url: "https://cdn.test/image.webp",
      alt: "A studio product photo of a ceramic mug.",
    },
    request: {
      url: "https://cdn.test/image.webp",
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageAltTaskData;
}

function createReviewTaskData(
  overrides: Partial<MynthSDKTypes.ImageReviewTaskData> = {},
): MynthSDKTypes.ImageReviewTaskData {
  return {
    id: "task-review-123",
    status: "completed",
    type: "image.review",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.02",
    result: {
      url: "https://cdn.test/image.webp",
      score: 3,
      summary: "Strong composition with one visible artifact.",
      findings: [
        {
          finding: "The left hand has an extra finger.",
          category: "anatomy",
          severity: "major",
          where: "Left side of the image",
          confidence: "high",
        },
      ],
      strengths: [{ strength: "Balanced composition", confidence: "high" }],
    },
    request: {
      url: "https://cdn.test/image.webp",
      effort: "high",
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageReviewTaskData;
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

  test("upload sends images as multipart form data", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          urls: ["https://cdn.test/uploaded.webp"],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const file = new File(["image-bytes"], "input.webp", { type: "image/webp" });
    const blob = new Blob(["more-image-bytes"], { type: "image/png" });

    // Act
    const result = await image.upload([file, blob]);

    // Assert
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const formFiles = (request.body as FormData).getAll("images") as File[];
    expect({
      result,
      url: fetchMock.mock.calls[0]?.[0],
      method: request.method,
      headers: request.headers,
      files: formFiles.map(({ name, type }) => ({ name, type })),
    }).toEqual({
      result: { urls: ["https://cdn.test/uploaded.webp"] },
      url: "https://api.test/image/upload",
      method: "POST",
      headers: { Authorization: "Bearer mak_test" },
      files: [
        { name: "input.webp", type: "image/webp" },
        { name: "image", type: "image/png" },
      ],
    });
  });

  test("generateAsync uploads local files in inputs before generate", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            urls: ["https://cdn.test/uploaded-1.webp", "https://cdn.test/uploaded-2.webp"],
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            taskId: "task-123",
          },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const file = new File(["image-bytes"], "input.webp", { type: "image/webp" });
    const blob = new Blob(["more-image-bytes"], { type: "image/png" });

    // Act
    await image.generateAsync({
      prompt: "use these",
      inputs: [
        "https://cdn.test/existing.webp",
        file,
        {
          type: "image",
          as: "reference",
          source: { type: "file", file: blob },
        },
      ],
    });

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.test/image/upload");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.test/image/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          prompt: "use these",
          inputs: [
            "https://cdn.test/existing.webp",
            "https://cdn.test/uploaded-1.webp",
            {
              type: "image",
              as: "reference",
              source: { type: "url", url: "https://cdn.test/uploaded-2.webp" },
            },
          ],
        }),
      }),
    );
  });

  test.each([
    {
      name: "rateAsync",
      path: "https://api.test/image/rate",
      taskId: "task-rate-123",
      call: (image: MynthImage, file: File) => image.rateAsync({ file, mode: "nsfw_sfw" }),
      body: {
        mode: "nsfw_sfw",
        url: "https://cdn.test/uploaded.webp",
      },
    },
    {
      name: "altAsync",
      path: "https://api.test/image/alt",
      taskId: "task-alt-123",
      call: (image: MynthImage, file: File) => image.altAsync({ file }),
      body: {
        url: "https://cdn.test/uploaded.webp",
      },
    },
    {
      name: "reviewAsync",
      path: "https://api.test/image/review",
      taskId: "task-review-123",
      call: (image: MynthImage, file: File) => image.reviewAsync({ file, effort: "low" }),
      body: {
        effort: "low",
        url: "https://cdn.test/uploaded.webp",
      },
    },
  ])("$name uploads files before POST", async ({ path, taskId, call, body }) => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { urls: ["https://cdn.test/uploaded.webp"] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { taskId, estimatedCost: "0.0002" } }, { status: 201 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const file = new File(["image-bytes"], "input.webp", { type: "image/webp" });

    // Act
    const task = await call(image, file);

    // Assert
    expect({
      id: task.id,
      uploadUrl: fetchMock.mock.calls[0]?.[0],
      postCall: fetchMock.mock.calls[1],
    }).toEqual({
      id: taskId,
      uploadUrl: "https://api.test/image/upload",
      postCall: [
        path,
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(body),
        }),
      ],
    });
  });

  test("rateAsync returns a pollable rate task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            taskId: "task-rate-123",
            estimatedCost: "0.0002",
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const task = await image.rateAsync({
      url: "https://cdn.test/image.webp",
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
            url: "https://cdn.test/image.webp",
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
              taskId: "task-rate-123",
              estimatedCost: "0.0002",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.rate({
      url: "https://cdn.test/image.webp",
    });

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      url: result.url,
      level: result.level,
    }).toEqual({
      taskId: "task-rate-123",
      cost: "0.01",
      url: "https://cdn.test/image.webp",
      level: "sfw",
    });
  });

  test("altAsync returns a pollable alt text task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            taskId: "task-alt-123",
            estimatedCost: "0.0004",
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const task = await image.altAsync({
      url: "https://cdn.test/image.webp",
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
            url: "https://cdn.test/image.webp",
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
              taskId: "task-alt-123",
              estimatedCost: "0.0004",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.alt({
      url: "https://cdn.test/image.webp",
    });

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      url: result.url,
      alt: result.alt,
    }).toEqual({
      taskId: "task-alt-123",
      cost: "0.01",
      url: "https://cdn.test/image.webp",
      alt: "A studio product photo of a ceramic mug.",
    });
  });

  test("review waits for the completed quality review result", async () => {
    // Arrange
    const taskData = createReviewTaskData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              taskId: "task-review-123",
              estimatedCost: "0.02",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.review({
      url: "https://cdn.test/image.webp",
      effort: "high",
    });

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      url: result.url,
      score: result.score,
      summary: result.summary,
      findings: result.findings,
      strengths: result.strengths,
    }).toEqual({
      taskId: "task-review-123",
      cost: "0.02",
      url: "https://cdn.test/image.webp",
      score: 3,
      summary: "Strong composition with one visible artifact.",
      findings: [
        {
          finding: "The left hand has an extra finger.",
          category: "anatomy",
          severity: "major",
          where: "Left side of the image",
          confidence: "high",
        },
      ],
      strengths: [{ strength: "Balanced composition", confidence: "high" }],
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
