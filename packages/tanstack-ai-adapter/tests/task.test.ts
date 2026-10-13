import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MynthClient } from "../src/client.ts";
import { MynthTaskTimeoutError } from "../src/errors.ts";
import { waitForImageGenerationTask } from "../src/task.ts";
import {
  apiError,
  BASE_URL,
  completedTask,
  createMockApi,
  type MockApi,
  networkError,
  ok,
} from "./mock-api.ts";

const STATUS = "GET /tasks/tsk_1/status";
const TASK = "GET /tasks/tsk_1";
const pending = ok({ status: "pending" });
const completed = ok({ status: "completed" });

function createClient(api: MockApi): MynthClient {
  return new MynthClient({ apiKey: "mak_test", baseURL: BASE_URL, headers: {}, fetch: api.fetch });
}

/** Settle a wait while fake timers drive the polling. */
async function run<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

describe("waitForImageGenerationTask", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // No jitter, so the polling cadence is exact.
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the settled task once the status completes", async () => {
    // Arrange
    const api = createMockApi({
      [STATUS]: [pending, pending, completed],
      [TASK]: ok(completedTask()),
    });

    // Act
    const task = await run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    expect(task).toMatchObject({ id: "tsk_1", status: "completed" });
  });

  it("reads the full task only once the status settles", async () => {
    // Arrange
    const api = createMockApi({
      [STATUS]: [pending, pending, completed],
      [TASK]: ok(completedTask()),
    });

    // Act
    await run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    expect(api.requestsTo(TASK)).toHaveLength(1);
  });

  it("polls every second during the first ten seconds", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: pending });
    waitForImageGenerationTask(createClient(api), "tsk_1").catch(() => {});

    // Act
    await vi.advanceTimersByTimeAsync(9_000);

    // Assert
    expect(api.requestsTo(STATUS)).toHaveLength(9);
  });

  it("polls every five seconds after the first minute", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: pending });
    waitForImageGenerationTask(createClient(api), "tsk_1").catch(() => {});
    await vi.advanceTimersByTimeAsync(120_000);
    const before = api.requestsTo(STATUS).length;

    // Act
    await vi.advanceTimersByTimeAsync(60_000);

    // Assert
    expect(api.requestsTo(STATUS).length - before).toBe(12);
  });

  it.each([
    ["a network error", networkError()],
    ["a 5xx response", apiError(503)],
    ["a 404 from a cold cache", apiError(404)],
  ])("retries after %s", async (_, failure) => {
    // Arrange
    const api = createMockApi({
      [STATUS]: [failure, failure, completed],
      [TASK]: ok(completedTask()),
    });

    // Act
    const task = await run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    expect(task.status).toBe("completed");
  });

  it("retries a failed read of the settled task", async () => {
    // Arrange
    const api = createMockApi({
      [STATUS]: completed,
      [TASK]: [apiError(500), ok(completedTask())],
    });

    // Act
    const task = await run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    expect(task.status).toBe("completed");
  });

  it("gives up once polls keep failing for longer than the outage budget", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: apiError(503) });

    // Act
    const result = run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    await expect(result).rejects.toMatchObject({ status: 503 });
  });

  it.each([401, 403, 400])("fails at once on a %i response", async (status) => {
    // Arrange
    const api = createMockApi({ [STATUS]: apiError(status) });

    // Act
    await run(waitForImageGenerationTask(createClient(api), "tsk_1")).catch(() => {});

    // Assert
    expect(api.requestsTo(STATUS)).toHaveLength(1);
  });

  it("waits as long as Retry-After asks after a 429", async () => {
    // Arrange
    const api = createMockApi({
      [STATUS]: [apiError(429, {}, { "retry-after": "20" }), completed],
      [TASK]: ok(completedTask()),
    });
    waitForImageGenerationTask(createClient(api), "tsk_1").catch(() => {});
    await vi.advanceTimersByTimeAsync(1_500);

    // Act
    await vi.advanceTimersByTimeAsync(19_000);

    // Assert
    expect(api.requestsTo(STATUS)).toHaveLength(1);
  });

  it("keeps waiting through rate limiting beyond the outage budget", async () => {
    // Arrange
    const api = createMockApi({
      [STATUS]: [...Array.from({ length: 10 }, () => apiError(429)), completed],
      [TASK]: ok(completedTask()),
    });

    // Act
    const task = await run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    expect(task.status).toBe("completed");
  });

  it("times out when the task never settles", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: pending });

    // Act
    const result = run(waitForImageGenerationTask(createClient(api), "tsk_1"));

    // Assert
    await expect(result).rejects.toThrow(MynthTaskTimeoutError);
  });

  it("rejects with the abort reason", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: pending });
    const controller = new AbortController();
    const result = waitForImageGenerationTask(createClient(api), "tsk_1", {
      signal: controller.signal,
    });
    result.catch(() => {});

    // Act
    controller.abort(new Error("stop"));

    // Assert
    await expect(result).rejects.toThrow("stop");
  });

  it("reports every polled status", async () => {
    // Arrange
    const api = createMockApi({ [STATUS]: [pending, completed], [TASK]: ok(completedTask()) });
    const onStatus = vi.fn();

    // Act
    await run(waitForImageGenerationTask(createClient(api), "tsk_1", { onStatus }));

    // Assert
    expect(onStatus.mock.calls).toEqual([["pending"], ["completed"]]);
  });
});
