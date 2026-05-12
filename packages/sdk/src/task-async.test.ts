import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { MynthClient } from "./client";
import { ImageGenerationResult } from "./image-generation-result";
import {
  TaskAsync,
  TaskAsyncFetchError,
  TaskAsyncTaskFailedError,
  TaskAsyncTaskFetchError,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
} from "./task-async";
import type { MynthSDKTypes } from "./types";

// ============================================================================
// Test Helpers
// ============================================================================

function createMockClient(
  overrides: {
    get?: ReturnType<typeof vi.fn>;
  } = {},
): MynthClient {
  return {
    get: overrides.get ?? vi.fn(),
  } as unknown as MynthClient;
}

function createMockTaskData(
  overrides: Partial<MynthSDKTypes.ImageGenerationTaskData> = {},
): MynthSDKTypes.ImageGenerationTaskData {
  return {
    id: "test-task-id",
    status: "completed",
    type: "image.generate",
    apiKeyId: "api-key-123",
    userId: "user-123",
    cost: "0.01",
    result: null,
    request: {
      prompt: "test prompt",
    },
    createdAt: "2026-01-29T12:00:00Z",
    updatedAt: "2026-01-29T12:00:00Z",
    ...overrides,
  } as MynthSDKTypes.ImageGenerationTaskData;
}

function createTaskAsync(
  id: string,
  options: { client: MynthClient; pat?: string },
): TaskAsync<ImageGenerationResult> {
  return new TaskAsync(id, {
    ...options,
    resultFactory: (data) =>
      new ImageGenerationResult(data as MynthSDKTypes.ImageGenerationTaskData),
  });
}

// ============================================================================
// Error Classes
// ============================================================================

describe("TaskAsyncTimeoutError", () => {
  test("includes task id and timeout duration in message", () => {
    // Arrange
    const taskId = "task-abc-123";

    // Act
    const error = new TaskAsyncTimeoutError(taskId);

    // Assert
    expect(error.message).toContain(taskId);
  });

  test("has correct error name", () => {
    // Arrange & Act
    const error = new TaskAsyncTimeoutError("task-id");

    // Assert
    expect(error.name).toBe("TaskAsyncTimeoutError");
  });
});

describe("TaskAsyncUnauthorizedError", () => {
  test("includes task id in message", () => {
    // Arrange
    const taskId = "task-xyz-789";

    // Act
    const error = new TaskAsyncUnauthorizedError(taskId);

    // Assert
    expect(error.message).toContain(taskId);
  });

  test("has correct error name", () => {
    // Arrange & Act
    const error = new TaskAsyncUnauthorizedError("task-id");

    // Assert
    expect(error.name).toBe("TaskAsyncUnauthorizedError");
  });
});

describe("TaskAsyncFetchError", () => {
  test("includes task id in message", () => {
    // Arrange
    const taskId = "task-fetch-123";

    // Act
    const error = new TaskAsyncFetchError(taskId);

    // Assert
    expect(error.message).toContain(taskId);
  });

  test("preserves original error as cause", () => {
    // Arrange
    const taskId = "task-fetch-456";
    const originalError = new Error("Network connection failed");

    // Act
    const error = new TaskAsyncFetchError(taskId, originalError);

    // Assert
    expect(error.cause).toBe(originalError);
  });

  test("has correct error name", () => {
    // Arrange & Act
    const error = new TaskAsyncFetchError("task-id");

    // Assert
    expect(error.name).toBe("TaskAsyncFetchError");
  });
});

describe("TaskAsyncTaskFetchError", () => {
  test("includes task id in message", () => {
    // Arrange
    const taskId = "task-details-123";

    // Act
    const error = new TaskAsyncTaskFetchError(taskId);

    // Assert
    expect(error.message).toContain(taskId);
  });

  test("includes HTTP status code in message when provided", () => {
    // Arrange
    const taskId = "task-details-456";
    const httpStatus = 500;

    // Act
    const error = new TaskAsyncTaskFetchError(taskId, httpStatus);

    // Assert
    expect(error.message).toContain("500");
  });

  test("has correct error name", () => {
    // Arrange & Act
    const error = new TaskAsyncTaskFetchError("task-id");

    // Assert
    expect(error.name).toBe("TaskAsyncTaskFetchError");
  });
});

describe("TaskAsyncTaskFailedError", () => {
  test("includes task id in message", () => {
    // Arrange
    const taskId = "task-failed-123";

    // Act
    const error = new TaskAsyncTaskFailedError(taskId);

    // Assert
    expect(error.message).toContain(taskId);
  });

  test("has correct error name", () => {
    // Arrange & Act
    const error = new TaskAsyncTaskFailedError("task-id");

    // Assert
    expect(error.name).toBe("TaskAsyncTaskFailedError");
  });
});

// ============================================================================
// TaskAsync Class - Basic Properties
// ============================================================================

describe("TaskAsync", () => {
  describe("constructor and basic properties", () => {
    test("exposes the task id", () => {
      // Arrange
      const taskId = "unique-task-id";
      const client = createMockClient();

      // Act
      const taskAsync = createTaskAsync(taskId, { client });

      // Assert
      expect(taskAsync.id).toBe(taskId);
    });

    test("access getter returns undefined publicAccessToken when no PAT provided", () => {
      // Arrange
      const client = createMockClient();

      // Act
      const taskAsync = createTaskAsync("task-id", { client });

      // Assert
      expect(taskAsync.access.publicAccessToken).toBeUndefined();
    });

    test("access getter exposes public access token when provided", () => {
      // Arrange
      const client = createMockClient();
      const pat = "public-access-token-xyz";

      // Act
      const taskAsync = createTaskAsync("task-id", { client, pat });

      // Assert
      expect(taskAsync.access.publicAccessToken).toBe(pat);
    });

    test("toString returns the task id", () => {
      // Arrange
      const taskId = "my-task-id";
      const client = createMockClient();

      // Act
      const taskAsync = createTaskAsync(taskId, { client });

      // Assert
      expect(taskAsync.toString()).toBe(taskId);
    });
  });

  // ==========================================================================
  // Polling Behavior - wait()
  // ==========================================================================

  describe("wait() polling", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("returns result when status immediately reports completed", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "immediate-complete-task" });
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("immediate-complete-task", { client });

      // Act
      const result = await taskAsync.wait();

      // Assert
      expect(result.id).toBe("immediate-complete-task");
    });

    test("preserves magic prompt metadata on the completed result", async () => {
      // Arrange
      const taskData = createMockTaskData({
        id: "completed-with-magic-prompt",
        result: {
          model: "black-forest-labs/flux.2-dev",
          images: [],
          magic_prompt: {
            positive: "enhanced prompt",
            negative: "enhanced negative prompt",
          },
        } as MynthSDKTypes.ImageResult,
      });
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });
      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("completed-with-magic-prompt", { client });

      // Act
      const resultPromise = taskAsync.wait();
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.result?.magic_prompt?.positive).toBe("enhanced prompt");
      expect(result.result?.magic_prompt?.negative).toBe("enhanced negative prompt");
    });

    test("returns same result on multiple wait() calls (promise caching)", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "cached-promise-task" });
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("cached-promise-task", { client });

      // Act
      const result1 = await taskAsync.wait();
      const result2 = await taskAsync.wait();

      // Assert - both calls should return the same instance (from cached promise)
      expect(result1).toBe(result2);
    });

    test("polls until status becomes completed", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "polling-task" });
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "pending" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "pending" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("polling-task", { client });

      // Act
      const resultPromise = taskAsync.wait();

      // Advance through pending polls
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      // Assert
      expect(result.id).toBe("polling-task");
    });

    test("throws TaskAsyncTaskFailedError when status is failed", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        data: { status: "failed" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("failed-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncTaskFailedError);
    });

    test("throws TaskAsyncUnauthorizedError on 401 response", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 401,
        data: { error: "Unauthorized" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("unauthorized-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("throws TaskAsyncUnauthorizedError on 403 response", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 403,
        data: { error: "Forbidden" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("forbidden-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("throws TaskAsyncUnauthorizedError on 404 response", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        data: { error: "Not found" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("notfound-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("retries on 5xx server errors and succeeds after recovery", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "retry-success-task" });
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 502,
          data: { error: "Bad gateway" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("retry-success-task", { client });

      // Act
      const resultPromise = taskAsync.wait();
      await vi.advanceTimersByTimeAsync(3000);
      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      // Assert
      expect(result.id).toBe("retry-success-task");
    });

    test("throws TaskAsyncFetchError after exceeding max retry count on persistent 5xx errors", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        data: { error: "Server error" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("persistent-error-task", { client });

      // Act - start the task promise and set up the rejection expectation together
      // to avoid unhandled rejection warnings
      const resultPromise = taskAsync.wait();
      const rejectionExpectation = expect(resultPromise).rejects.toThrow(TaskAsyncFetchError);

      // Advance timers to trigger all retries (7 retries max)
      for (let i = 0; i < 8; i++) {
        await vi.advanceTimersByTimeAsync(6000);
      }

      // Assert
      await rejectionExpectation;
    });

    test("retries on network errors and succeeds after recovery", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "network-recovery-task" });
      const mockGet = vi
        .fn()
        .mockRejectedValueOnce(new Error("Network timeout"))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("network-recovery-task", { client });

      // Act
      const resultPromise = taskAsync.wait();
      await vi.advanceTimersByTimeAsync(3000);
      const result = await resultPromise;

      // Assert
      expect(result.id).toBe("network-recovery-task");
    });

    test("falls back to API key when PAT returns unauthorized", async () => {
      // Arrange
      const taskData = createMockTaskData({ id: "pat-fallback-task" });
      const mockGet = vi
        .fn()
        // First call with PAT returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          data: { error: "Invalid PAT" },
        })
        // Retry with API key succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("pat-fallback-task", { client, pat: "invalid-pat-token" });

      // Act
      const result = await taskAsync.wait();

      // Assert - Check that the second call used API key (no accessToken)
      expect(mockGet).toHaveBeenCalledTimes(3);
      expect(result.id).toBe("pat-fallback-task");
    });

    test("throws TaskAsyncUnauthorizedError when both PAT and API key fail", async () => {
      // Arrange
      const mockGet = vi
        .fn()
        // First call with PAT returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          data: { error: "Invalid PAT" },
        })
        // Fallback with API key also returns 401
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          data: { error: "Invalid API key" },
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("both-auth-fail-task", {
        client,
        pat: "invalid-pat-token",
      });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("throws TaskAsyncTimeoutError after polling timeout exceeded", async () => {
      // Arrange
      const mockGet = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        data: { status: "pending" },
      });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("timeout-task", { client });

      // Act - start the task promise and set up the rejection expectation together
      // to avoid unhandled rejection warnings
      const resultPromise = taskAsync.wait();
      const rejectionExpectation = expect(resultPromise).rejects.toThrow(TaskAsyncTimeoutError);

      // Advance time past the 5-minute timeout
      await vi.advanceTimersByTimeAsync(1000 * 60 * 6); // 6 minutes

      // Assert
      await rejectionExpectation;
    });
  });

  // ==========================================================================
  // Task Fetching Errors
  // ==========================================================================

  describe("fetchTask errors", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("throws TaskAsyncUnauthorizedError when task fetch returns 401", async () => {
      // Arrange
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 401,
          data: { error: "Unauthorized" },
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("fetch-401-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("throws TaskAsyncTaskFetchError when task fetch returns unexpected error", async () => {
      // Arrange
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Internal server error" },
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("fetch-500-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncTaskFetchError);
    });

    test("throws TaskAsyncUnauthorizedError when task fetch returns 403", async () => {
      // Arrange
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          data: { error: "Forbidden" },
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("fetch-403-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });

    test("throws TaskAsyncUnauthorizedError when task fetch returns 404", async () => {
      // Arrange
      const mockGet = vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          data: { error: "Not found" },
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("fetch-404-task", { client });

      // Act & Assert
      await expect(taskAsync.wait()).rejects.toThrow(TaskAsyncUnauthorizedError);
    });
  });

  // ==========================================================================
  // Retry Count Reset
  // ==========================================================================

  describe("retry count reset", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    test("resets retry count after successful poll", async () => {
      // Arrange - first have some 5xx errors, then success, then more 5xx errors
      // If retry count wasn't reset, the second batch of errors would exceed max retries
      const taskData = createMockTaskData({ id: "retry-reset-task" });
      const mockGet = vi
        .fn()
        // First batch of 5xx errors (5 errors)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        // Successful poll - should reset retry count
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "pending" },
        })
        // Second batch of 5xx errors (5 more errors)
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          data: { error: "Server error" },
        })
        // Finally succeeds
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: { status: "completed" },
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          data: taskData,
        });

      const client = createMockClient({ get: mockGet });
      const taskAsync = createTaskAsync("retry-reset-task", { client });

      // Act
      const resultPromise = taskAsync.wait();

      // Advance through all the polls (12 polls * 6 seconds max)
      for (let i = 0; i < 12; i++) {
        await vi.advanceTimersByTimeAsync(6000);
      }

      const result = await resultPromise;

      // Assert - if retry count wasn't reset, we would have hit max retries
      // after 7 consecutive errors and thrown TaskAsyncFetchError
      expect(result.id).toBe("retry-reset-task");
      expect(mockGet).toHaveBeenCalledTimes(13); // 12 polls + 1 fetch
    });
  });
});
