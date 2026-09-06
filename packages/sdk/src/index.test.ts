import { afterEach, describe, expect, test, vi } from "vitest";

import { Mynth, MynthImage, MynthVideo, TaskAsync } from "./index";
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
        type: "image",
        modes: {
          "txt->img": {},
          "img->img": { inputs: { rules: [{ type: "image", max: 4 }], maxTotal: 4 } },
        },
        pricing: { perImage: { base: "0.05" } },
      },
      {
        id: "bytedance/seedance-2.0-mini",
        displayName: "Seedance 2.0 Mini",
        type: "video",
        modes: {
          "txt->vid": {},
          "img->vid": {
            inputs: { rules: [{ type: "image", kind: "first_frame", min: 1, max: 1 }] },
          },
        },
        pricing: { perSecond: { "480p": "0.036", "720p": "0.081" } },
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

function createVideoTaskData(
  overrides: Partial<MynthSDKTypes.VideoGenerationTaskData> = {},
): MynthSDKTypes.VideoGenerationTaskData {
  return {
    id: "task-video-123",
    status: "completed",
    type: "video.generate",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.42",
    result: {
      model: "google/gemini-omni-flash-1.1",
      videos: [
        {
          status: "success",
          id: "vid_1",
          url: "https://cdn.test/video.mp4",
          mynth_url: "https://mynthcdn.test/video.mp4",
          cost: "0.42",
          duration: 8,
          resolution: "1080p",
          audio: true,
        },
        {
          status: "failed",
          error: { code: "PROVIDER_ERROR" },
        },
      ],
    },
    request: {
      model: "google/gemini-omni-flash-1.1",
      prompt: "test prompt",
      metadata: { generationId: "gen_1" },
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.VideoGenerationTaskData;
}

describe("MynthVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("generateAsync returns a pollable task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          taskId: "task-video-123",
          estimatedCost: "0.42",
          access: { publicAccessToken: "pat-video" },
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const video = new MynthVideo({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const task = await video.generateAsync({
      model: "google/gemini-omni-flash-1.1",
      prompt: "a cat surfing",
      duration: 8,
      resolution: "1080p",
      audio: true,
    });

    // Assert
    expect(task).toBeInstanceOf(TaskAsync);
    expect(task.id).toBe("task-video-123");
    expect(task.access.publicAccessToken).toBe("pat-video");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/video/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "google/gemini-omni-flash-1.1",
          prompt: "a cat surfing",
          duration: 8,
          resolution: "1080p",
          audio: true,
        }),
      }),
    );
  });

  test("generate waits for the completed task and exposes video results", async () => {
    // Arrange
    const taskData = createVideoTaskData();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ data: { taskId: "task-video-123", estimatedCost: "0.42" } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const video = new MynthVideo({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await video.generate({
      model: "google/gemini-omni-flash-1.1",
      prompt: "test prompt",
      metadata: { generationId: "gen_1" },
    });

    // Assert
    expect({
      id: result.id,
      isCompleted: result.isCompleted,
      urls: result.urls,
      successCount: result.getVideos().length,
      allCount: result.getVideos({ includeFailed: true }).length,
      metadata: result.getMetadata(),
      model: result.result?.model,
    }).toEqual({
      id: "task-video-123",
      isCompleted: true,
      urls: ["https://cdn.test/video.mp4"],
      successCount: 1,
      allCount: 2,
      metadata: { generationId: "gen_1" },
      model: "google/gemini-omni-flash-1.1",
    });
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.test/tasks/task-video-123/status",
      expect.any(Object),
    );
  });

  test("generateAsync uploads local files in inputs before generate", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          data: { urls: ["https://cdn.test/first.webp", "https://cdn.test/last.webp"] },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ data: { taskId: "task-video-123", estimatedCost: "0.42" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const video = new MynthVideo({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const first = new File(["first-frame"], "first.webp", { type: "image/webp" });
    const last = new Blob(["last-frame"], { type: "image/png" });

    // Act
    await video.generateAsync({
      model: "bytedance/seedance-2.0-mini",
      prompt: "morph between the frames",
      inputs: [first, { type: "image", as: "last_frame", source: { type: "file", file: last } }],
    });

    // Assert
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.test/image/upload");
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://api.test/video/generate",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          model: "bytedance/seedance-2.0-mini",
          prompt: "morph between the frames",
          inputs: [
            "https://cdn.test/first.webp",
            {
              type: "image",
              as: "last_frame",
              source: { type: "url", url: "https://cdn.test/last.webp" },
            },
          ],
        }),
      }),
    );
  });

  test("estimate prices a request without creating a task", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: { estimatedCost: "0.42", currency: "usd", estimateKind: "exact" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const video = new MynthVideo({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const estimate = await video.estimate({
      model: "prunaai/p-video",
      prompt: "a neon city street",
    });

    // Assert
    expect(estimate).toEqual({ estimatedCost: "0.42", currency: "usd", estimateKind: "exact" });
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://api.test/video/generate/estimate");
  });

  test("mynth.video reuses a single client instance", () => {
    // Arrange
    const mynth = new Mynth({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act & Assert
    expect(mynth.video).toBeInstanceOf(MynthVideo);
    expect(mynth.video).toBe(mynth.video);
  });
});
