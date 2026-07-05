import { MynthApiError } from "../domain/Errors.ts";
import {
  TaskListResponseSchema,
  TaskResponseSchema,
  TaskStatusSchema,
  type TaskData,
  type TaskListItem,
} from "../domain/Schemas.ts";
import { MynthApi, readJson, readText } from "./MynthApi.ts";

export const DEFAULT_WAIT_TIMEOUT_MS = 5 * 60 * 1000;
const WAIT_FAST_PHASE_MS = 12_000;
const WAIT_FAST_INTERVAL_MS = 2_500;
const WAIT_SLOW_INTERVAL_MS = 5_000;

const sleep = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

export class TaskService {
  constructor(private readonly api: MynthApi) {}

  async getTask(taskId: string): Promise<TaskData> {
    const response = await this.api.execute(`/tasks/${taskId}`);

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await readText(response);
      throw new MynthApiError({
        message: `task fetch failed (${response.status}): ${bodyText || "no body"}`,
        status: response.status,
      });
    }

    const parsed = TaskResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid task response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async listTasks(
    args: { limit?: number; after?: string } = {},
  ): Promise<ReadonlyArray<TaskListItem>> {
    const params = new URLSearchParams();
    if (args.limit !== undefined) params.set("limit", String(args.limit));
    if (args.after !== undefined) params.set("after", args.after);
    const query = params.size > 0 ? `?${params}` : "";
    const response = await this.api.execute(`/tasks${query}`);

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await readText(response);
      throw new MynthApiError({
        message: `task list failed (${response.status}): ${bodyText || "no body"}`,
        status: response.status,
      });
    }

    const parsed = TaskListResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid task list response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async getTaskStatus(taskId: string): Promise<"pending" | "completed" | "failed"> {
    const response = await this.api.execute(`/tasks/${taskId}/status`);

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await readText(response);
      throw new MynthApiError({
        message: `task status failed (${response.status}): ${bodyText || "no body"}`,
        status: response.status,
      });
    }

    const parsed = TaskStatusSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid task status response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data.status;
  }

  // Polls the cache-backed /status endpoint, then fetches the full task once
  // it settles.
  async waitForTask(taskId: string, timeoutMs = DEFAULT_WAIT_TIMEOUT_MS): Promise<TaskData> {
    const startTime = Date.now();
    while (true) {
      const status = await this.getTaskStatus(taskId);
      if (status !== "pending") return this.getTask(taskId);

      const elapsed = Date.now() - startTime;
      if (elapsed >= timeoutMs) {
        throw new MynthApiError({
          message: `task ${taskId} did not complete within ${Math.round(timeoutMs / 1000)}s`,
          status: 0,
        });
      }

      const base = elapsed < WAIT_FAST_PHASE_MS ? WAIT_FAST_INTERVAL_MS : WAIT_SLOW_INTERVAL_MS;
      await sleep(base + Math.floor(Math.random() * 500));
    }
  }
}

export type { TaskData, TaskListItem };
