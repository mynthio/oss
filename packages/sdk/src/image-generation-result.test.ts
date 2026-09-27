import { describe, expect, test } from "vitest";

import { ImageGenerationResult } from "./image-generation-result.ts";
import type { MynthSDKTypes } from "./types.ts";

const deliveredImage: MynthSDKTypes.ImageResultImageSuccess = {
  status: "success",
  id: "img_1",
  url: "https://cdn.test/1.webp",
  mynth_url: "https://mynth.test/1.webp",
  size: "1024x1024",
  format: "webp",
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

const images = [deliveredImage, destinationOnlyImage, failedImage];

function createResult(result: MynthSDKTypes.ImageResult | null) {
  return new ImageGenerationResult({
    id: "task-123",
    status: "completed",
    result,
  } as MynthSDKTypes.ImageGenerationTaskData);
}

describe("ImageGenerationResult", () => {
  test("urls lists only successful images that have a URL", () => {
    // Arrange
    const result = createResult({ model: "black-forest-labs/flux.2-dev", images });

    // Act & Assert
    expect(result.urls).toEqual(["https://cdn.test/1.webp"]);
  });

  test("urls is empty before the task has a result", () => {
    // Arrange
    const result = createResult(null);

    // Act & Assert
    expect(result.urls).toEqual([]);
  });

  test("getImages returns only successful images by default", () => {
    // Arrange
    const result = createResult({ model: "black-forest-labs/flux.2-dev", images });

    // Act
    const successful = result.getImages();

    // Assert
    expect(successful).toEqual([deliveredImage, destinationOnlyImage]);
  });

  test("getImages includes failed images when asked", () => {
    // Arrange
    const result = createResult({ model: "black-forest-labs/flux.2-dev", images });

    // Act
    const all = result.getImages({ includeFailed: true });

    // Assert
    expect(all).toEqual(images);
  });
});
