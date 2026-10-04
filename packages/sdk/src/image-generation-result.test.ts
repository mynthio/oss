import { describe, expect, test } from "vitest";

import { toImageGenerationResult } from "./image-generation-result.ts";
import type { MynthSDKTypes } from "./types.ts";

const deliveredImage: MynthSDKTypes.ImageResultImageSuccess = {
  status: "success",
  id: "img_1",
  url: "https://cdn.test/1.webp",
  mynth_url: "https://mynth.test/1.webp",
  size: "1024x1024",
  format: "webp",
  rating: { status: "success", level: "sfw" },
};

// Delivered only to a user destination, so it has no public URL.
const destinationOnlyImage: MynthSDKTypes.ImageResultImageSuccess = {
  ...deliveredImage,
  id: "img_2",
  url: null,
};

const failedImage: MynthSDKTypes.ImageResultImageFailure = {
  status: "failed",
  error: { code: "PROVIDER_ERROR" },
};

const request: MynthSDKTypes.ImageGenerationRequest = {
  prompt: "a cat",
  metadata: { userId: "user_1" },
};

const result: MynthSDKTypes.ImageResult = {
  model: "black-forest-labs/flux.2-dev",
  images: [deliveredImage, destinationOnlyImage, failedImage],
  magic_prompt: { positive: "a cat, golden hour" },
};

describe("toImageGenerationResult", () => {
  test("maps the completed task", () => {
    // Arrange & Act
    const generation = toImageGenerationResult({
      taskId: "task-123",
      cost: "0.02",
      request,
      result,
    });

    // Assert
    expect({
      taskId: generation.taskId,
      cost: generation.cost,
      model: generation.model,
      magicPrompt: generation.magicPrompt,
      metadata: generation.metadata,
      raw: generation.raw,
    }).toEqual({
      taskId: "task-123",
      cost: "0.02",
      model: "black-forest-labs/flux.2-dev",
      magicPrompt: { positive: "a cat, golden hour" },
      metadata: { userId: "user_1" },
      raw: { request, result },
    });
  });

  test("splits successful images, with their rating, from failures", () => {
    // Arrange & Act
    const generation = toImageGenerationResult({
      taskId: "task-123",
      cost: "0.02",
      request,
      result,
    });

    // Assert
    expect({ images: generation.images, failures: generation.failures }).toStrictEqual({
      images: [
        {
          id: "img_1",
          url: "https://cdn.test/1.webp",
          mynthUrl: "https://mynth.test/1.webp",
          width: 1024,
          height: 1024,
          size: "1024x1024",
          format: "webp",
          mimeType: "image/webp",
          destination: undefined,
          rating: { status: "success", level: "sfw" },
        },
        {
          id: "img_2",
          url: null,
          mynthUrl: "https://mynth.test/1.webp",
          width: 1024,
          height: 1024,
          size: "1024x1024",
          format: "webp",
          mimeType: "image/webp",
          destination: undefined,
          rating: { status: "success", level: "sfw" },
        },
      ],
      failures: [{ code: "PROVIDER_ERROR" }],
    });
  });

  test("urls lists only successful images that have a URL", () => {
    // Arrange & Act
    const generation = toImageGenerationResult({
      taskId: "task-123",
      cost: "0.02",
      request,
      result,
    });

    // Assert
    expect(generation.urls).toEqual(["https://cdn.test/1.webp"]);
  });
});
