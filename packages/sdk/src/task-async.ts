import type { MynthClient } from "./client";
import { TASK_DETAILS_PATH, TASK_STATUS_PATH } from "./constants";
import type { MynthSDKTypes } from "./types";

const POLLING_TIMEOUT_MS = 30 * 60 * 1000;
const FAST_POLLING_DURATION_MS = 12_000; // 12 seconds of fast polling
const FAST_POLLING_INTERVAL_MS = 2_500; // 2.5 seconds
const SLOW_POLLING_INTERVAL_MS = 5_000; // 5 seconds
// Consecutive, and reset by any clean poll, so this is an outage budget rather
// than a lifetime one: ~100s of an unreachable or erroring API at the polling
// intervals above. A created task is owed an answer, so it is worth waiting out
// a deploy or a cold cache instead of failing the caller's run.
const MAX_RETRY_COUNT = 20;

/**
 * Error thrown when task polling exceeds the maximum timeout duration.
 */
export class TaskAsyncTimeoutError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} polling timed out after ${POLLING_TIMEOUT_MS}ms`);
    this.name = "TaskAsyncTimeoutError";
  }
}

/**
 * Error thrown when access to a task is denied (invalid API key or PAT).
 */
export class TaskAsyncUnauthorizedError extends Error {
  constructor(taskId: string) {
    super(`Unauthorized access to task ${taskId}`);
    this.name = "TaskAsyncUnauthorizedError";
  }
}

/**
 * Error thrown when fetching task status fails after multiple retries.
 */
export class TaskAsyncFetchError extends Error {
  constructor(taskId: string, cause?: Error) {
    super(`Failed to fetch status for task ${taskId} after multiple retries`);
    this.name = "TaskAsyncFetchError";
    this.cause = cause;
  }
}

/**
 * Error thrown when fetching full task data fails.
 */
export class TaskAsyncTaskFetchError extends Error {
  constructor(taskId: string, status?: number, cause?: Error) {
    const suffix = status ? ` (status ${status})` : "";
    super(`Failed to fetch task ${taskId}${suffix}`);
    this.name = "TaskAsyncTaskFetchError";
    this.cause = cause;
  }
}

/**
 * Error thrown when a task fails before completion.
 */
export class TaskAsyncTaskFailedError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} failed`);
    this.name = "TaskAsyncTaskFailedError";
  }
}

type FetchStatusResult =
  | { ok: true; status: MynthSDKTypes.TaskStatus }
  | { ok: false; unauthorized: boolean; retryable: boolean; notFound?: boolean; error?: Error };

type FetchTaskResult =
  | { ok: true; data: MynthSDKTypes.TaskData }
  | { ok: false; unauthorized: boolean; retryable: boolean; status?: number; error?: Error };

/**
 * Public access information for a task, used for client-side polling.
 */
export type TaskAsyncAccess = {
  /** Public access token for client-side status polling */
  publicAccessToken?: string;
};

/**
 * Represents an async task that can be polled for completion.
 * Use `wait()` to poll until completion and get the typed result.
 *
 * @template ResultT - The result type returned once the task completes
 */
export class TaskAsync<ResultT> {
  /** The unique identifier for this task */
  public readonly id: string;

  private readonly client: MynthClient;

  private readonly _access: TaskAsyncAccess;

  private readonly resultFactory: (data: MynthSDKTypes.TaskData) => ResultT;

  private _completionPromise: Promise<ResultT> | null = null;

  constructor(
    id: string,
    options: {
      client: MynthClient;
      pat?: string;
      resultFactory: (data: MynthSDKTypes.TaskData) => ResultT;
    },
  ) {
    this.id = id;
    this.client = options.client;
    this._access = { publicAccessToken: options.pat };
    this.resultFactory = options.resultFactory;
  }

  /**
   * Public access information for client-side polling.
   * Contains the public access token if one was generated.
   */
  get access(): TaskAsyncAccess {
    return this._access;
  }

  toString(): string {
    return this.id;
  }

  /**
   * Polls the task until completion and returns the typed result.
   * Multiple calls to this method return the same promise.
   *
   * @throws {TaskAsyncTimeoutError} If polling exceeds the timeout
   * @throws {TaskAsyncUnauthorizedError} If access is denied
   * @throws {TaskAsyncFetchError} If fetching status fails repeatedly
   * @throws {TaskAsyncTaskFetchError} If fetching the completed task fails
   * @throws {TaskAsyncTaskFailedError} If the task fails before completion
   */
  public async wait(): Promise<ResultT> {
    // Lazy init - only start polling when explicitly requested
    if (!this._completionPromise) {
      this._completionPromise = this.pollUntilCompleted();
    }

    return this._completionPromise;
  }

  private async pollUntilCompleted(): Promise<ResultT> {
    const startTime = Date.now();
    let retryCount = 0;
    let useApiKeyFallback = false;
    let lastError: Error | undefined;

    while (true) {
      const elapsed = Date.now() - startTime;

      if (elapsed >= POLLING_TIMEOUT_MS) {
        throw new TaskAsyncTimeoutError(this.id);
      }

      const result = await this.fetchStatus(useApiKeyFallback);

      if (result.ok) {
        if (result.status === "completed") {
          const fetched = await this.fetchTask();

          if (fetched.ok) {
            return this.resultFactory(fetched.data);
          }

          if (fetched.unauthorized) {
            throw new TaskAsyncUnauthorizedError(this.id);
          }

          // The task settled, so its record is owed to us as much as its status
          // was: a 404 or 5xx here is a blip, and shares the same budget.
          retryCount++;

          if (!fetched.retryable || retryCount >= MAX_RETRY_COUNT) {
            throw new TaskAsyncTaskFetchError(this.id, fetched.status, fetched.error);
          }
        } else if (result.status === "failed") {
          throw new TaskAsyncTaskFailedError(this.id);
        } else {
          // A clean poll means the API is healthy again: the budget counts
          // consecutive failures, not failures over the life of the wait.
          retryCount = 0;
        }
      } else {
        // 401, 403 and 404 can all mean "this token cannot see the task", so
        // spend the one-shot API key fallback before judging the response.
        if (
          (result.unauthorized || result.notFound) &&
          this._access.publicAccessToken &&
          !useApiKeyFallback
        ) {
          useApiKeyFallback = true;
          continue; // Retry immediately with API key
        }

        if (result.unauthorized) {
          // Both PAT and API key failed, or no PAT was used
          throw new TaskAsyncUnauthorizedError(this.id);
        }

        if (result.retryable) {
          retryCount++;
          lastError = result.error;

          if (retryCount >= MAX_RETRY_COUNT) {
            throw new TaskAsyncFetchError(this.id, lastError);
          }
        }
      }

      // Calculate polling interval with slight randomness
      const isInFastPhase = elapsed < FAST_POLLING_DURATION_MS;
      const baseInterval = isInFastPhase ? FAST_POLLING_INTERVAL_MS : SLOW_POLLING_INTERVAL_MS;
      const jitter = Math.random() * 500; // 0-500ms randomness
      const interval = baseInterval + jitter;

      // Don't wait longer than remaining timeout
      const remainingTime = POLLING_TIMEOUT_MS - elapsed;
      const waitTime = Math.min(interval, remainingTime);

      await this.sleep(waitTime);
    }
  }

  private async fetchStatus(useApiKey: boolean): Promise<FetchStatusResult> {
    const accessToken =
      useApiKey || !this._access.publicAccessToken ? undefined : this._access.publicAccessToken;

    try {
      const response = await this.client.get<
        MynthSDKTypes.ApiResponse<{
          status: MynthSDKTypes.TaskStatus;
        }>
      >(TASK_STATUS_PATH(this.id), {
        accessToken,
      });

      if (response.ok) {
        return { ok: true, status: response.data.data.status };
      }

      // 401 or 403 are unauthorized
      if (response.status === 401 || response.status === 403) {
        return { ok: false, unauthorized: true, retryable: false };
      }

      // 404 usually means a cold or replicating cache rather than a verdict: the
      // task was created, so retry instead of failing the wait. (A PAT that
      // cannot see the task also answers 404, hence `notFound` — the caller
      // retries once with the API key before spending the retry budget.)
      if (response.status === 404) {
        return { ok: false, unauthorized: false, retryable: true, notFound: true };
      }

      // 5xx errors are retryable
      if (response.status >= 500) {
        return { ok: false, unauthorized: false, retryable: true };
      }

      // Other 4xx errors are not retryable
      return { ok: false, unauthorized: false, retryable: false };
    } catch (error) {
      // Network errors, connection failures etc. are retryable
      return {
        ok: false,
        unauthorized: false,
        retryable: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private async fetchTask(): Promise<FetchTaskResult> {
    try {
      const response = await this.client.get<MynthSDKTypes.ApiResponse<MynthSDKTypes.TaskData>>(
        TASK_DETAILS_PATH(this.id),
      );

      if (response.ok) {
        return { ok: true, data: response.data.data };
      }

      // 401 or 403 are unauthorized
      if (response.status === 401 || response.status === 403) {
        return { ok: false, unauthorized: true, retryable: false };
      }

      // 404 and 5xx errors are retryable, for the same reason they are on the
      // status endpoint: a settled task does not stop existing.
      if (response.status === 404 || response.status >= 500) {
        return { ok: false, unauthorized: false, retryable: true, status: response.status };
      }

      // Other 4xx errors are not retryable
      return { ok: false, unauthorized: false, retryable: false, status: response.status };
    } catch (error) {
      // Network errors, connection failures etc. are retryable
      return {
        ok: false,
        unauthorized: false,
        retryable: true,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
