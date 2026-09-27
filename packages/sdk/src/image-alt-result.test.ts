import { describe, expect, test } from "vitest";

import { ImageAltResult } from "./image-alt-result.ts";
import type { MynthSDKTypes } from "./types.ts";

describe("ImageAltResult.fromTaskData", () => {
  test("throws while the task is not completed", () => {
    // Arrange
    const data = {
      id: "task-alt-123",
      status: "pending",
      cost: null,
      result: null,
    } as MynthSDKTypes.ImageAltTaskData;

    // Act & Assert
    expect(() => ImageAltResult.fromTaskData(data)).toThrow(
      "Image alt task task-alt-123 is not completed",
    );
  });

  test("throws when the completed task has no cost", () => {
    // Arrange
    const data = {
      id: "task-alt-123",
      status: "completed",
      cost: null,
      result: { alt: "A mug." },
    } as MynthSDKTypes.ImageAltTaskData;

    // Act & Assert
    expect(() => ImageAltResult.fromTaskData(data)).toThrow(
      "Image alt task task-alt-123 is missing cost",
    );
  });
});
