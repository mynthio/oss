import { describe, expect, it } from "vitest";

import { parseImageGenerationTask, parseTaskStatus, parseUploadedUrls } from "../src/api.ts";
import { MynthResponseError } from "../src/errors.ts";
import { completedTask } from "./mock-api.ts";

describe("parseImageGenerationTask", () => {
  it("splits a completed task's images into successes and failures", () => {
    // Arrange
    const data = completedTask({
      result: {
        images: [
          { status: "success", url: null, mynth_url: "https://cdn.mynth.io/1.webp" },
          { status: "failed", error: { code: "content_policy", message: "Blocked" } },
        ],
      },
    });

    // Act
    const task = parseImageGenerationTask(data);

    // Assert
    expect(task).toMatchObject({
      images: [{ url: null, mynthUrl: "https://cdn.mynth.io/1.webp" }],
      failures: [{ code: "content_policy", message: "Blocked" }],
    });
  });

  it("reads the rewritten prompt of a magic prompt task", () => {
    // Arrange
    const data = completedTask({ result: { magic_prompt: { positive: "A richer prompt" } } });

    // Act
    const task = parseImageGenerationTask(data);

    // Assert
    expect(task).toMatchObject({ revisedPrompt: "A richer prompt" });
  });

  it("reads the errors of a failed task", () => {
    // Arrange
    const data = { id: "tsk_1", status: "failed", errors: [{ code: "provider_unavailable" }] };

    // Act
    const task = parseImageGenerationTask(data);

    // Assert
    expect(task).toEqual({
      id: "tsk_1",
      status: "failed",
      errors: [{ code: "provider_unavailable" }],
    });
  });

  it("rejects a completed task without a cost", () => {
    // Arrange
    const data = { ...completedTask(), cost: null };

    // Act
    const parse = () => parseImageGenerationTask(data);

    // Assert
    expect(parse).toThrow(MynthResponseError);
  });
});

describe("parseTaskStatus", () => {
  it("rejects an unknown status", () => {
    // Arrange
    const data = { status: "queued" };

    // Act
    const parse = () => parseTaskStatus(data);

    // Assert
    expect(parse).toThrow('unknown task status "queued"');
  });
});

describe("parseUploadedUrls", () => {
  it("rejects a response with fewer URLs than uploaded images", () => {
    // Arrange
    const data = { urls: ["https://cdn.mynth.io/1.png"] };

    // Act
    const parse = () => parseUploadedUrls(data, 2);

    // Assert
    expect(parse).toThrow("expected 2 upload URLs, got 1");
  });
});
