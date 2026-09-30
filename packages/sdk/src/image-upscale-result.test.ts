import { describe, expect, test } from "vitest";

import { ImageUpscaleResult } from "./image-upscale-result.ts";
import type { MynthSDKTypes } from "./types.ts";

describe("ImageUpscaleResult.fromTaskData", () => {
  test("throws while the task is not completed", () => {
    // Arrange
    const data = {
      id: "task-upscale-123",
      status: "pending",
      cost: null,
      result: null,
    } as MynthSDKTypes.ImageUpscaleTaskData;

    // Act & Assert
    expect(() => ImageUpscaleResult.fromTaskData(data)).toThrow(
      "Image upscale task task-upscale-123 is not completed",
    );
  });

  test("throws when the completed task has no cost", () => {
    // Arrange
    const data = {
      id: "task-upscale-123",
      status: "completed",
      cost: null,
      result: {
        image: {
          id: "img_123",
          url: "https://cdn.test/upscaled.png",
          mynth_url: "https://mynth.test/upscaled.png",
          size: "2048x1536",
          format: "png",
        },
      },
    } as MynthSDKTypes.ImageUpscaleTaskData;

    // Act & Assert
    expect(() => ImageUpscaleResult.fromTaskData(data)).toThrow(
      "Image upscale task task-upscale-123 is missing cost",
    );
  });
});
