import { z } from "zod";
import { ApiError } from "../errors.ts";
import { sleep } from "../utils/async.ts";
import type { ApiClient } from "./client.ts";
import {
  task,
  taskListItem,
  taskResult,
  taskStatus,
  type Task,
  type TaskListItem,
  type TaskResult,
  type TaskStatus,
} from "./schemas.ts";

export const DEFAULT_WAIT_TIMEOUT_MS = 5 * 60 * 1000;

// Most tasks settle within seconds, so poll tightly at first and then back off
// to keep long generations cheap.
const FAST_PHASE_MS = 12_000;
const FAST_INTERVAL_MS = 2_500;
const SLOW_INTERVAL_MS = 5_000;
const JITTER_MS = 500;

export const getTask = (client: ApiClient, id: string): Promise<Task> =>
  client.fetch("task fetch", `/tasks/${id}`, task);

export const listTasks = (
  client: ApiClient,
  query: { readonly limit?: number; readonly after?: string } = {},
): Promise<ReadonlyArray<TaskListItem>> =>
  client.fetch("task list", "/tasks", z.array(taskListItem), { query });

/** Cache-backed; this is what polling loops hit. */
export const getTaskStatus = (client: ApiClient, id: string): Promise<TaskStatus> =>
  client
    .fetch("task status", `/tasks/${id}/status`, z.object({ status: taskStatus }))
    .then((data) => data.status);

/** Just the task's output — lighter than the full task record. */
export const getTaskResult = (client: ApiClient, id: string): Promise<TaskResult> =>
  client.fetch("task result", `/tasks/${id}/result`, taskResult);

/**
 * Polls until the task settles, then returns the full task. A `failed` task is
 * returned rather than thrown, so callers can render the failure and pick their
 * own exit code.
 */
export const waitForTask = async (
  client: ApiClient,
  id: string,
  timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
): Promise<Task> => {
  const startedAt = Date.now();

  while (true) {
    const status = await getTaskStatus(client, id);
    if (status !== "pending") return getTask(client, id);

    const elapsed = Date.now() - startedAt;
    if (elapsed >= timeoutMs) {
      throw new ApiError(
        `task ${id} did not complete within ${Math.round(timeoutMs / 1000)}s; it may still finish, check \`mynth task get ${id}\``,
        { status: 0 },
      );
    }

    const interval = elapsed < FAST_PHASE_MS ? FAST_INTERVAL_MS : SLOW_INTERVAL_MS;
    await sleep(interval + Math.floor(Math.random() * JITTER_MS));
  }
};
