import { describe, expect, test } from "vitest";

import { ImageRateResult } from "./image-rate-result.ts";
import type { MynthSDKTypes } from "./types.ts";

describe("ImageRateResult.fromTaskData", () => {
  test("throws while the task is not completed", () => {
    // Arrange
    const data = {
      id: "task-rate-123",
      status: "pending",
      cost: null,
      result: null,
    } as MynthSDKTypes.ImageRateTaskData;

    // Act & Assert
    expect(() => ImageRateResult.fromTaskData(data)).toThrow(
      "Image rate task task-rate-123 is not completed",
    );
  });

  test("throws when the completed task has no cost", () => {
    // Arrange
    const data = {
      id: "task-rate-123",
      status: "completed",
      cost: null,
      result: { level: "sfw" },
    } as MynthSDKTypes.ImageRateTaskData;

    // Act & Assert
    expect(() => ImageRateResult.fromTaskData(data)).toThrow(
      "Image rate task task-rate-123 is missing cost",
    );
  });
});
