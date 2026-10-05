import { afterEach, describe, expect, expectTypeOf, test, vi } from "vitest";

import { Mynth, MynthImage, MynthVideo, TaskAsync } from "./index.ts";
import type { MynthSDKTypes } from "./types.ts";

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
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.01",
    result: {
      model: "black-forest-labs/flux.2-dev",
      images: [],
    } as MynthSDKTypes.ImageResult,
    request: {
      prompt: "test prompt",
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
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
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.01",
    result: {
      level: "sfw",
    },
    request: {
      url: "https://cdn.test/image.webp",
      mode: "nsfw_sfw",
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
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
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.01",
    result: {
      alt: "A studio product photo of a ceramic mug.",
    },
    request: {
      url: "https://cdn.test/image.webp",
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
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
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.02",
    result: {
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
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageReviewTaskData;
}

function createRemoveBackgroundTaskData(
  overrides: Partial<MynthSDKTypes.ImageRemoveBackgroundTaskData> = {},
): MynthSDKTypes.ImageRemoveBackgroundTaskData {
  return {
    id: "task-remove-background-123",
    status: "completed",
    type: "image.remove_background",
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.02",
    result: {
      image: {
        id: "img_123",
        url: "https://cdn.test/cutout.png",
        mynth_url: "https://mynth.test/cutout.png",
        size: "1024x768",
        format: "png",
      },
    },
    request: {
      url: "https://cdn.test/image.jpg",
      metadata: { productId: "sku_1" },
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageRemoveBackgroundTaskData;
}

function createUpscaleTaskData(
  overrides: Partial<MynthSDKTypes.ImageUpscaleTaskData> = {},
): MynthSDKTypes.ImageUpscaleTaskData {
  return {
    id: "task-upscale-123",
    status: "completed",
    type: "image.upscale",
    api_key_id: "api-key-123",
    user_id: "user-123",
    cost: "0.03",
    result: {
      image: {
        id: "img_123",
        url: "https://cdn.test/upscaled.png",
        mynth_url: "https://mynth.test/upscaled.png",
        size: "2048x1536",
        format: "png",
      },
    },
    request: {
      url: "https://cdn.test/image.jpg",
      size: "2x",
      effort: "low",
      metadata: { productId: "sku_1" },
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageUpscaleTaskData;
}

describe("MynthImage", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("reads the API key from MYNTH_API_KEY when none is passed", async () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", "mak_env");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { task_id: "task-123" } }));
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ baseUrl: "https://api.test" });

    // Act
    await image.generateAsync({ prompt: "test prompt" });

    // Assert
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      Authorization: "Bearer mak_env",
    });
  });

  test("throws when no API key is passed or set in the environment", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", undefined);

    // Act & Assert
    expect(() => new MynthImage()).toThrow("Mynth API key is required");
  });

  test("rejects a file input when the upload returns no URL", async () => {
    // Arrange
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ data: { urls: [] } })));
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const file = new File(["image-bytes"], "input.webp", { type: "image/webp" });

    // Act
    const promise = image.altAsync({ file });

    // Assert
    await expect(promise).rejects.toThrow("Image upload returned no URL");
  });

  test("generateAsync returns a pollable task without waiting", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          task_id: "task-123",
          public_access_token: "pat-123",
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
      .mockResolvedValueOnce(jsonResponse({ data: { task_id: "task-123" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: taskData }));
    vi.stubGlobal("fetch", fetchMock);

    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const result = await image.generate({ prompt: "test prompt" });

    expect(result.taskId).toBe("task-123");
    expect(result.model).toBe("black-forest-labs/flux.2-dev");
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

  test("generate returns image classes typed by the request's rating levels", async () => {
    // Arrange
    const taskData = createTaskData({
      result: {
        model: "black-forest-labs/flux.2-dev",
        images: [
          {
            status: "success",
            id: "img_1",
            url: null,
            mynth_url: "https://mynth.test/1.png",
            size: "1024x768",
            format: "png",
            rating: { status: "success", level: "mature" },
          },
        ],
      },
    });
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(jsonResponse({ data: { task_id: "task-123" } }))
        .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
        .mockResolvedValueOnce(jsonResponse({ data: taskData })),
    );
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.generate({
      prompt: "test prompt",
      rating: {
        mode: "custom",
        levels: [
          { value: "safe", description: "No explicit content" },
          { value: "mature", description: "Adult themes" },
        ],
      },
    });
    const [generated] = result.images;

    // Assert
    expectTypeOf(generated!.rating).toEqualTypeOf<
      { status: "success"; level: "safe" | "mature" } | MynthSDKTypes.ImageResultRatingFailure
    >();
    expect({
      width: generated?.width,
      height: generated?.height,
      rating: generated?.rating,
    }).toEqual({
      width: 1024,
      height: 768,
      rating: { status: "success", level: "mature" },
    });
  });

  test("generate forwards the abort signal to the create request", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { task_id: "task-123" } }))
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: createTaskData() }));
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const controller = new AbortController();

    // Act
    await image.generate({ prompt: "test prompt" }, { signal: controller.signal });

    // Assert
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "https://api.test/image/generate",
      expect.objectContaining({ method: "POST", signal: controller.signal }),
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
            task_id: "task-123",
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
    {
      name: "removeBackgroundAsync",
      path: "https://api.test/image/remove-background",
      taskId: "task-remove-background-123",
      call: (image: MynthImage, file: File) =>
        image.removeBackgroundAsync({ file, output: { format: "webp" } }),
      body: {
        output: { format: "webp" },
        url: "https://cdn.test/uploaded.webp",
      },
    },
    {
      name: "upscaleAsync",
      path: "https://api.test/image/upscale",
      taskId: "task-upscale-123",
      call: (image: MynthImage, file: File) =>
        image.upscaleAsync({ file, size: "4x", effort: "high" }),
      body: {
        size: "4x",
        effort: "high",
        url: "https://cdn.test/uploaded.webp",
      },
    },
  ])("$name uploads files before POST", async ({ path, taskId, call, body }) => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ data: { urls: ["https://cdn.test/uploaded.webp"] } }))
      .mockResolvedValueOnce(
        jsonResponse({ data: { task_id: taskId, estimated_cost: "0.0002" } }, { status: 201 }),
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
            task_id: "task-rate-123",
            estimated_cost: "0.0002",
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
              task_id: "task-rate-123",
              estimated_cost: "0.0002",
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
      level: result.level,
    }).toEqual({
      taskId: "task-rate-123",
      cost: "0.01",
      level: "sfw",
    });
  });

  test("altAsync returns a pollable alt text task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            task_id: "task-alt-123",
            estimated_cost: "0.0004",
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
              task_id: "task-alt-123",
              estimated_cost: "0.0004",
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
      alt: result.alt,
    }).toEqual({
      taskId: "task-alt-123",
      cost: "0.01",
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
              task_id: "task-review-123",
              estimated_cost: "0.02",
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
      score: result.score,
      summary: result.summary,
      findings: result.findings,
      strengths: result.strengths,
    }).toEqual({
      taskId: "task-review-123",
      cost: "0.02",
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

describe("MynthImage.removeBackground", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("waits for the result and exposes the image and typed metadata", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              task_id: "task-remove-background-123",
              estimated_cost: "0.02",
              public_access_token: "pat_test",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: createRemoveBackgroundTaskData() }));
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.removeBackground({
      url: "https://cdn.test/image.jpg",
      metadata: { productId: "sku_1" },
    });
    const productId: string = result.metadata.productId;

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      image: result.image,
      productId,
    }).toEqual({
      taskId: "task-remove-background-123",
      cost: "0.02",
      image: {
        id: "img_123",
        url: "https://cdn.test/cutout.png",
        mynthUrl: "https://mynth.test/cutout.png",
        width: 1024,
        height: 768,
        size: "1024x768",
        format: "png",
        mimeType: "image/png",
        destination: undefined,
      },
      productId: "sku_1",
    });
  });

  test("sends the default destination and hands back the public access token", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            task_id: "task-remove-background-123",
            estimated_cost: "0.02",
            public_access_token: "pat_test",
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({
      apiKey: "mak_test",
      baseUrl: "https://api.test",
      destination: "bunny-prod",
    });

    // Act
    const taskAsync = await image.removeBackgroundAsync({ url: "https://cdn.test/image.jpg" });

    // Assert
    expect({
      id: taskAsync.id,
      access: taskAsync.access,
      body: JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    }).toEqual({
      id: "task-remove-background-123",
      access: { publicAccessToken: "pat_test" },
      body: { url: "https://cdn.test/image.jpg", destination: "bunny-prod" },
    });
  });
});

describe("MynthImage.upscale", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("waits for the result and exposes the image and typed metadata", async () => {
    // Arrange
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(
          {
            data: {
              task_id: "task-upscale-123",
              estimated_cost: "0.03",
              public_access_token: "pat_test",
            },
          },
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { status: "completed" } }))
      .mockResolvedValueOnce(jsonResponse({ data: createUpscaleTaskData() }));
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const result = await image.upscale({
      url: "https://cdn.test/image.jpg",
      size: "2x",
      effort: "low",
      metadata: { productId: "sku_1" },
    });
    const productId: string = result.metadata.productId;

    // Assert
    expect({
      taskId: result.taskId,
      cost: result.cost,
      image: result.image,
      productId,
    }).toEqual({
      taskId: "task-upscale-123",
      cost: "0.03",
      image: {
        id: "img_123",
        url: "https://cdn.test/upscaled.png",
        mynthUrl: "https://mynth.test/upscaled.png",
        width: 2048,
        height: 1536,
        size: "2048x1536",
        format: "png",
        mimeType: "image/png",
        destination: undefined,
      },
      productId: "sku_1",
    });
  });

  test("sends the default destination and hands back the public access token", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse(
        {
          data: {
            task_id: "task-upscale-123",
            estimated_cost: "0.15",
            public_access_token: "pat_test",
          },
        },
        { status: 201 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    const image = new MynthImage({
      apiKey: "mak_test",
      baseUrl: "https://api.test",
      destination: "bunny-prod",
    });

    // Act
    const taskAsync = await image.upscaleAsync({
      url: "https://cdn.test/image.jpg",
      size: { type: "scale", factor: 4 },
      effort: "high",
    });

    // Assert
    expect({
      id: taskAsync.id,
      access: taskAsync.access,
      body: JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string),
    }).toEqual({
      id: "task-upscale-123",
      access: { publicAccessToken: "pat_test" },
      body: {
        url: "https://cdn.test/image.jpg",
        size: { type: "scale", factor: 4 },
        effort: "high",
        destination: "bunny-prod",
      },
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
        display_name: "FLUX.2 Pro",
        type: "image",
        modes: {
          "txt->img": {},
          "img->img": { inputs: { rules: [{ type: "image", max: 4 }], max_total: 4 } },
        },
        pricing: { per_image: { base: "0.05" } },
      },
      {
        id: "bytedance/seedance-2.0-mini",
        display_name: "Seedance 2.0 Mini",
        type: "video",
        modes: {
          "txt->vid": {},
          "img->vid": {
            inputs: { rules: [{ type: "image", kind: "first_frame", min: 1, max: 1 }] },
          },
        },
        pricing: { per_second: { "480p": "0.036", "720p": "0.081" } },
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
          error: { code: "models_unavailable", message: "Models unavailable" },
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

describe("MynthAPIError", () => {
  test("keeps the message, code, and issues of a validation error", async () => {
    // Arrange
    const issues = [{ path: ["size"], message: 'size "16:9_8k" is not supported.' }];
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(
          {
            error: {
              code: "validation_error",
              message: 'size "16:9_8k" is not supported.',
              issues,
            },
          },
          { status: 400 },
        ),
      ),
    );
    const mynth = new Mynth({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const promise = mynth.image.generateAsync({ prompt: "cat" });

    // Assert
    await expect(promise).rejects.toMatchObject({
      name: "MynthAPIError",
      message: 'size "16:9_8k" is not supported.',
      status: 400,
      code: "validation_error",
      issues,
    });
  });

  test("reports the status when the error body is not JSON", async () => {
    // Arrange
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(new Response("<html>Bad Gateway</html>", { status: 502 })),
    );
    const mynth = new Mynth({ apiKey: "mak_test", baseUrl: "https://api.test" });

    // Act
    const promise = mynth.image.generateAsync({ prompt: "cat" });

    // Assert
    await expect(promise).rejects.toMatchObject({
      name: "MynthAPIError",
      message: "Request failed with status 502",
      status: 502,
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
    api_key_id: "api-key-123",
    user_id: "user-123",
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
          error: { code: "provider_error" },
        },
      ],
    },
    request: {
      model: "google/gemini-omni-flash-1.1",
      prompt: "test prompt",
      metadata: { generationId: "gen_1" },
    },
    created_at: "2026-01-29T12:00:00Z",
    updated_at: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.VideoGenerationTaskData;
}

describe("MynthVideo", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  test("throws when no API key is passed or set in the environment", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", undefined);

    // Act & Assert
    expect(() => new MynthVideo()).toThrow("Mynth API key is required");
  });

  test("generateAsync returns a pollable task without waiting", async () => {
    // Arrange
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        data: {
          task_id: "task-video-123",
          estimated_cost: "0.42",
          public_access_token: "pat-video",
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
        jsonResponse({ data: { task_id: "task-video-123", estimated_cost: "0.42" } }),
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
      taskId: result.taskId,
      cost: result.cost,
      urls: result.urls,
      videos: result.videos,
      failures: result.failures,
      metadata: result.metadata,
      model: result.model,
    }).toEqual({
      taskId: "task-video-123",
      cost: "0.42",
      urls: ["https://cdn.test/video.mp4"],
      videos: [
        {
          id: "vid_1",
          url: "https://cdn.test/video.mp4",
          mynthUrl: "https://mynthcdn.test/video.mp4",
          cost: "0.42",
          duration: 8,
          resolution: "1080p",
          audio: true,
        },
      ],
      failures: [{ code: "provider_error" }],
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
        jsonResponse({ data: { task_id: "task-video-123", estimated_cost: "0.42" } }),
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
        data: { estimated_cost: "0.42", currency: "usd", estimate_kind: "exact" },
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
    expect(estimate).toEqual({ estimated_cost: "0.42", currency: "usd", estimate_kind: "exact" });
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
