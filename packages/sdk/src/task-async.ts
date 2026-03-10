import type { MynthClient } from "./client";
import { TASK_DETAILS_PATH, TASK_STATUS_PATH } from "./constants";
import { Task } from "./task";
import type { MynthSDKTypes } from "./types";

const POLLING_TIMEOUT_MS = 1000 * 60 * 5; // 5 minutes
const FAST_POLLING_DURATION_MS = 12_000; // 12 seconds of fast polling
const FAST_POLLING_INTERVAL_MS = 2_500; // 2.5 seconds
const SLOW_POLLING_INTERVAL_MS = 5_000; // 5 seconds
const MAX_RETRY_COUNT = 7;

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
  constructor(taskId: string, status?: number) {
    const suffix = status ? ` (status ${status})` : "";
    super(`Failed to fetch task ${taskId}${suffix}`);
    this.name = "TaskAsyncTaskFetchError";
  }
}

/**
 * Error thrown when a task fails during generation.
 */
export class TaskAsyncTaskFailedError extends Error {
  constructor(taskId: string) {
    super(`Task ${taskId} failed during generation`);
    this.name = "TaskAsyncTaskFailedError";
  }
}

type FetchStatusResult =
  | { ok: true; status: MynthSDKTypes.TaskStatus }
  | { ok: false; unauthorized: boolean; retryable: boolean; error?: Error };

/**
 * Public access information for a task, used for client-side polling.
 */
export type TaskAsyncAccess = {
  /** Public access token for client-side status polling */
  publicAccessToken?: string;
};

/**
 * Represents an async task that can be polled for completion.
 * Use `toTask()` to wait for completion and get the full task result.
 *
 * @template MetadataT - Type of the metadata attached to the request
 * @template ContentRatingT - Type of the content rating response
 */
export class TaskAsync<
  MetadataT = Record<string, unknown> | undefined,
  ContentRatingT = MynthSDKTypes.ImageResultContentRating | undefined,
> {
  /** The unique identifier for this task */
  public readonly id: string;

  private readonly client: MynthClient;

  private readonly _access: TaskAsyncAccess;

  private _completionPromise: Promise<Task<MetadataT, ContentRatingT>> | null = null;

  constructor(id: string, options: { client: MynthClient; pat?: string }) {
    this.id = id;

    this.client = options.client;
    this._access = { publicAccessToken: options.pat };
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
   * Polls the task until completion and returns the full Task object.
   * Multiple calls to this method return the same promise.
   *
   * @throws {TaskAsyncTimeoutError} If polling exceeds the timeout
   * @throws {TaskAsyncUnauthorizedError} If access is denied
   * @throws {TaskAsyncFetchError} If fetching status fails repeatedly
   * @throws {TaskAsyncTaskFailedError} If the task fails during generation
   */
  public async toTask(): Promise<Task<MetadataT, ContentRatingT>> {
    // Lazy init - only start polling when explicitly requested
    if (!this._completionPromise) {
      this._completionPromise = this.pollUntilCompleted();
    }

    return this._completionPromise;
  }

  private async pollUntilCompleted(): Promise<Task<MetadataT, ContentRatingT>> {
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
        retryCount = 0;

        if (result.status === "completed") {
          const taskData = await this.fetchTask();
          return new Task(taskData);
        }

        if (result.status === "failed") {
          throw new TaskAsyncTaskFailedError(this.id);
        }
      } else {
        if (result.unauthorized) {
          // If using PAT and got unauthorized, try falling back to API key
          if (this._access.publicAccessToken && !useApiKeyFallback) {
            useApiKeyFallback = true;
            continue; // Retry immediately with API key
          }
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
      const response = await this.client.get<{
        status: MynthSDKTypes.TaskStatus;
      }>(TASK_STATUS_PATH(this.id), {
        accessToken,
      });

      if (response.ok) {
        return { ok: true, status: response.data.status };
      }

      // 401 or 403 are unauthorized
      if (response.status === 401 || response.status === 403) {
        return { ok: false, unauthorized: true, retryable: false };
      }

      // 404 means task not found or no access - treat as unauthorized
      if (response.status === 404) {
        return { ok: false, unauthorized: true, retryable: false };
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

  private async fetchTask(): Promise<MynthSDKTypes.TaskData> {
    const response = await this.client.get<MynthSDKTypes.TaskData>(TASK_DETAILS_PATH(this.id));

    if (response.ok) {
      return response.data;
    }

    if (response.status === 401 || response.status === 403) {
      throw new TaskAsyncUnauthorizedError(this.id);
    }

    if (response.status === 404) {
      throw new TaskAsyncUnauthorizedError(this.id);
    }

    throw new TaskAsyncTaskFetchError(this.id, response.status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
