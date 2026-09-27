import { describe, expect, test } from "vitest";

import { ImageRemoveBackgroundResult } from "./image-remove-background-result.ts";
import type { MynthSDKTypes } from "./types.ts";

describe("ImageRemoveBackgroundResult.fromTaskData", () => {
  test("throws while the task is not completed", () => {
    // Arrange
    const data = {
      id: "task-remove-background-123",
      status: "pending",
      cost: null,
      result: null,
    } as MynthSDKTypes.ImageRemoveBackgroundTaskData;

    // Act & Assert
    expect(() => ImageRemoveBackgroundResult.fromTaskData(data)).toThrow(
      "Image remove background task task-remove-background-123 is not completed",
    );
  });

  test("throws when the completed task has no cost", () => {
    // Arrange
    const data = {
      id: "task-remove-background-123",
      status: "completed",
      cost: null,
      result: {
        image: {
          id: "img_123",
          url: "https://cdn.test/cutout.png",
          mynth_url: "https://mynth.test/cutout.png",
          size: "1024x768",
          format: "png",
        },
      },
    } as MynthSDKTypes.ImageRemoveBackgroundTaskData;

    // Act & Assert
    expect(() => ImageRemoveBackgroundResult.fromTaskData(data)).toThrow(
      "Image remove background task task-remove-background-123 is missing cost",
    );
  });
});
