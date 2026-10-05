import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed task, as every result class is built from it. Polled task data
 * and webhook events both come down to this shape.
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
 * Read a completed task from a `...completed` webhook event. Its `data` is
 * the task as `GET /tasks/{id}` returns it.
 *
 * @throws {Error} If the event's task has not completed, or has no cost
 */
export function completedTaskFromWebhook<RequestT, ResultT>(event: {
  data: Pick<MynthSDKTypes.TaskBase, "id" | "status" | "cost"> & {
    request: RequestT;
    result: ResultT | null;
  };
}): MynthCompletedTask<RequestT, ResultT> {
  return completedTaskFromData(event.data, "Webhook");
}

/**
 * Read a failed task from a `...failed` webhook event. Callers add
 * `metadata` for task types whose request takes it.
 */
export function taskFailureFromWebhook<RequestT>(event: {
  data: { id: string; request: RequestT; errors: MynthSDKTypes.TaskError[] };
}): TaskFailureBase<RequestT> {
  return {
    taskId: event.data.id,
    errors: event.data.errors,
    raw: { request: event.data.request },
  };
}
