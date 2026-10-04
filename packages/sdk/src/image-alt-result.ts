import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed image alt text task.
 */
export type ImageAltResult = {
  /** The task ID created for this alt text request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** Generated alt text */
  alt: string;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.ImageAltRequest; result: MynthSDKTypes.ImageAltTaskResult };
};

/** Map a completed image alt text task. */
export function toImageAltResult(
  task: MynthCompletedTask<MynthSDKTypes.ImageAltRequest, MynthSDKTypes.ImageAltTaskResult>,
): ImageAltResult {
  return {
    taskId: task.taskId,
    cost: task.cost,
    alt: task.result.alt,
    raw: { request: task.request, result: task.result },
  };
}
