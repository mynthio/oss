import { APICallError, type ImageModelV4CallOptions } from "@ai-sdk/provider";
import { generateImage } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMynth } from "../src/index.ts";
import {
  apiError,
  BASE_URL,
  bodyOf,
  createMockApi,
  errorOf,
  imageRoutes,
  imageTask,
  ok,
  PNG_BYTES,
} from "./mock-api.ts";

const MODEL = "black-forest-labs/flux-1-schnell";

function callOptions(overrides: Partial<ImageModelV4CallOptions> = {}): ImageModelV4CallOptions {
  return {
    prompt: "A cat",
    n: 1,
    size: undefined,
    aspectRatio: undefined,
    seed: undefined,
    files: undefined,
    mask: undefined,
    providerOptions: {},
    ...overrides,
  };
}

function setup(routes = imageRoutes()) {
  const api = createMockApi(routes);
  vi.stubGlobal("fetch", api.fetch);
  const model = createMynth({ apiKey: "mak_test", baseURL: BASE_URL }).image(MODEL);
  return { api, model };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MynthImageModel.doGenerate", () => {
  it("creates a task and returns the downloaded image bytes", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ n: 1 }));

    // Assert
    expect(await bodyOf(api, "POST /image/generate")).toEqual({
      prompt: "A cat",
      model: MODEL,
      count: 1,
    });
    expect(result.images).toEqual([PNG_BYTES]);
    expect(result.warnings).toEqual([]);
    expect(result.response.modelId).toBe(MODEL);
    expect(result.providerMetadata).toEqual({
      mynth: {
        taskId: "tsk_img",
        cost: "0.004",
        model: MODEL,
        images: [
          {
            id: "img_1",
            taskId: "tsk_img",
            taskCost: "0.004",
            model: MODEL,
            url: "https://cdn.test/img_1.webp",
            mynthUrl: "https://cdn.test/img_1.webp",
            width: 1024,
            height: 1024,
            mimeType: "image/webp",
          },
        ],
      },
    });
  });

  it("sends a supported aspect ratio as the Mynth size", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ aspectRatio: "16:9" }));

    // Assert
    expect((await bodyOf(api, "POST /image/generate")).size).toBe("16:9");
    expect(result.warnings).toEqual([]);
  });

  it("maps an unsupported aspect ratio to the closest one, with a warning", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ aspectRatio: "7:4" }));

    // Assert
    expect((await bodyOf(api, "POST /image/generate")).size).toBe("16:9");
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "compatibility", feature: "aspectRatio" }),
    ]);
  });

  it("reduces a pixel size to its aspect ratio, with a warning", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ size: "1536x1024" }));

    // Assert
    expect((await bodyOf(api, "POST /image/generate")).size).toBe("3:2");
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "compatibility", feature: "size" }),
    ]);
  });

  it("prefers aspectRatio over size and says so", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ size: "1024x1024", aspectRatio: "9:16" }));

    // Assert
    expect((await bodyOf(api, "POST /image/generate")).size).toBe("9:16");
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "unsupported", feature: "size" }),
    ]);
  });

  it("passes providerOptions.mynth through, and its size wins", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    await model.doGenerate(
      callOptions({
        aspectRatio: "16:9",
        providerOptions: {
          mynth: { size: "16:9_4k", magic_prompt: true, negative_prompt: "blurry" },
        },
      }),
    );

    // Assert
    expect(await bodyOf(api, "POST /image/generate")).toEqual({
      prompt: "A cat",
      model: MODEL,
      count: 1,
      size: "16:9_4k",
      magic_prompt: true,
      negative_prompt: "blurry",
    });
  });

  it("warns that seed and mask are not supported", async () => {
    // Arrange
    const { model } = setup();

    // Act
    const result = await model.doGenerate(
      callOptions({ seed: 42, mask: { type: "url", url: "https://cdn.test/mask.png" } }),
    );

    // Assert
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "unsupported", feature: "seed" }),
      expect.objectContaining({ type: "unsupported", feature: "mask" }),
    ]);
  });

  it("warns about caller headers, which the Mynth SDK does not send", async () => {
    // Arrange
    const { model } = setup();

    // Act
    const result = await model.doGenerate(callOptions({ headers: { "x-trace": "1" } }));

    // Assert
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "unsupported", feature: "headers" }),
    ]);
  });

  it("sends URL files as inputs and uploads byte files first", async () => {
    // Arrange
    const { api, model } = setup(
      imageRoutes({ "POST /image/upload": ok({ urls: ["https://cdn.test/uploaded.png"] }) }),
    );

    // Act
    await model.doGenerate(
      callOptions({
        files: [
          { type: "url", url: "https://cdn.test/source.png" },
          { type: "file", mediaType: "image/png", data: PNG_BYTES },
        ],
      }),
    );

    // Assert
    expect(api.requestsTo("POST /image/upload")).toHaveLength(1);
    expect((await bodyOf(api, "POST /image/generate")).inputs).toEqual([
      "https://cdn.test/source.png",
      "https://cdn.test/uploaded.png",
    ]);
  });

  it("decodes base64 files before uploading them", async () => {
    // Arrange
    const { api, model } = setup(
      imageRoutes({ "POST /image/upload": ok({ urls: ["https://cdn.test/uploaded.png"] }) }),
    );

    // Act
    await model.doGenerate(
      callOptions({ files: [{ type: "file", mediaType: "image/png", data: "iVBORw0KGgo=" }] }),
    );

    // Assert
    const form = await api.requestsTo("POST /image/upload")[0]!.clone().formData();
    const upload = form.get("images") as Blob;
    expect(new Uint8Array(await upload.arrayBuffer())).toEqual(PNG_BYTES);
    expect(upload.type).toBe("image/png");
  });

  it("requires a prompt", async () => {
    // Arrange
    const { api, model } = setup();

    // Act & Assert
    await expect(model.doGenerate(callOptions({ prompt: undefined }))).rejects.toThrow(/prompt/);
    expect(api.requests).toHaveLength(0);
  });

  it("turns a 402 into a non-retryable APICallError with the Mynth code", async () => {
    // Arrange
    const { model } = setup(
      imageRoutes({
        "POST /image/generate": apiError(402, {
          code: "insufficient_balance",
          message: "Insufficient balance",
        }),
      }),
    );

    // Act
    const error = await errorOf(model.doGenerate(callOptions()));

    // Assert
    expect(APICallError.isInstance(error)).toBe(true);
    expect(error).toMatchObject({
      statusCode: 402,
      isRetryable: false,
      url: `${BASE_URL}/image/generate`,
      data: { code: "insufficient_balance" },
    });
  });

  it("marks a 429 as retryable", async () => {
    // Arrange
    const { model } = setup(
      imageRoutes({ "POST /image/generate": apiError(429, { code: "rate_limited" }) }),
    );

    // Act
    const error = await errorOf(model.doGenerate(callOptions()));

    // Assert
    expect(error).toMatchObject({ statusCode: 429, isRetryable: true });
  });

  it("warns when some images failed and returns the rest", async () => {
    // Arrange
    const task = imageTask();
    const images = (task.result as { images: unknown[] }).images;
    const { model } = setup(
      imageRoutes({
        "GET /tasks/tsk_img": ok(
          imageTask({
            result: {
              images: [...images, { status: "failed", error: { code: "content_filtered" } }],
            },
          }),
        ),
      }),
    );

    // Act
    const result = await model.doGenerate(callOptions({ n: 2 }));

    // Assert
    expect(result.images).toHaveLength(1);
    expect(result.warnings).toEqual([
      expect.objectContaining({
        type: "other",
        message: expect.stringContaining("content_filtered"),
      }),
    ]);
  });

  it("throws when every image failed", async () => {
    // Arrange
    const { model } = setup(
      imageRoutes({
        "GET /tasks/tsk_img": ok(
          imageTask({
            result: { images: [{ status: "failed", error: { code: "content_filtered" } }] },
          }),
        ),
      }),
    );

    // Act
    const error = await errorOf(model.doGenerate(callOptions()));

    // Assert
    expect(error).toMatchObject({
      isRetryable: false,
      message: expect.stringContaining("content_filtered"),
    });
  });
});

describe("generateImage with a Mynth model", () => {
  it("returns the image and Mynth metadata", async () => {
    // Arrange
    const { model } = setup();

    // Act
    const { image, providerMetadata } = await generateImage({ model, prompt: "A cat" });

    // Assert
    expect(image.uint8Array).toEqual(PNG_BYTES);
    expect(providerMetadata.mynth?.images).toEqual([
      expect.objectContaining({ id: "img_1", taskId: "tsk_img", taskCost: "0.004" }),
    ]);
  });
});
