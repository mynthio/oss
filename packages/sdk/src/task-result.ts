import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed task, as every result class is built from it. Polled task data
 * and webhook payloads both come down to this shape.
 */
export type MynthCompletedTask<RequestT, ResultT> = {
  taskId: string;
  /** USD charged for the task */
  cost: string;
  request: RequestT;
  result: ResultT;
};

type TaskFailureBase<RequestT> = {
  /** The failed task's ID */
  taskId: string;
  /** Why the task failed. At least one entry. */
  errors: MynthSDKTypes.TaskError[];
  /** The request as the API echoed it */
  raw: { request: RequestT };
};

/** Present only for task types whose request takes `metadata`. */
type TaskFailureMetadata<RequestT> = RequestT extends { metadata?: infer MetadataT }
  ? "metadata" extends keyof RequestT
    ? {
        /** Metadata attached to the request */
        metadata: MetadataT | undefined;
      }
    : unknown
  : unknown;

/**
 * A failed task, as a `...Failed` webhook callback receives it.
 *
 * @template RequestT - The task type's request
 */
export type MynthTaskFailure<RequestT = unknown> = TaskFailureBase<RequestT> &
  TaskFailureMetadata<RequestT>;

/**
 * Read a completed task from polled task data.
 *
 * @param label - Names the task in errors, e.g. `"Image upscale"`
 * @throws {Error} If the task has not completed, or completed without a cost
 */
export function completedTaskFromData<RequestT, ResultT>(
  data: Pick<MynthSDKTypes.TaskBase, "id" | "status" | "cost"> & {
    request: RequestT;
    result: ResultT | null;
  },
  label: string,
): MynthCompletedTask<RequestT, ResultT> {
  if (data.status !== "completed" || data.result === null) {
    throw new Error(`${label} task ${data.id} is not completed`);
  }

  if (data.cost === null) {
    throw new Error(`${label} task ${data.id} is missing cost`);
  }

  return { taskId: data.id, cost: data.cost, request: data.request, result: data.result };
}

/**
 * Read a completed task from a `...Completed` webhook payload.
 *
 * @throws {Error} If the payload has no cost
 */
export function completedTaskFromWebhook<RequestT, ResultT>(payload: {
  task: MynthSDKTypes.WebhookTaskCompleted;
  request: RequestT;
  result: ResultT;
}): MynthCompletedTask<RequestT, ResultT> {
  // The type promises a cost, but deliveries signed before Mynth sent one do not
  // carry it. Fail loudly rather than hand callbacks a result without a cost.
  if (typeof payload.task.cost !== "string") {
    throw new Error(`Webhook for task ${payload.task.id} is missing cost`);
  }

  return {
    taskId: payload.task.id,
    cost: payload.task.cost,
    request: payload.request,
    result: payload.result,
  };
}

/**
 * Read a failed task from a `...Failed` webhook payload. Callers add
 * `metadata` for task types whose request takes it.
 */
export function taskFailureFromWebhook<RequestT>(payload: {
  task: { id: string };
  request: RequestT;
  errors: MynthSDKTypes.TaskError[];
}): TaskFailureBase<RequestT> {
  return { taskId: payload.task.id, errors: payload.errors, raw: { request: payload.request } };
}
