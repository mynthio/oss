import { describe, expect, test } from "vitest";

import { ImageReviewResult } from "./image-review-result.ts";
import type { MynthSDKTypes } from "./types.ts";

describe("ImageReviewResult.fromTaskData", () => {
  test("throws while the task is not completed", () => {
    // Arrange
    const data = {
      id: "task-review-123",
      status: "pending",
      cost: null,
      result: null,
    } as MynthSDKTypes.ImageReviewTaskData;

    // Act & Assert
    expect(() => ImageReviewResult.fromTaskData(data)).toThrow(
      "Image review task task-review-123 is not completed",
    );
  });

  test("throws when the completed task has no cost", () => {
    // Arrange
    const data = {
      id: "task-review-123",
      status: "completed",
      cost: null,
      result: { score: 4, summary: "Clean." },
    } as MynthSDKTypes.ImageReviewTaskData;

    // Act & Assert
    expect(() => ImageReviewResult.fromTaskData(data)).toThrow(
      "Image review task task-review-123 is missing cost",
    );
  });
});
