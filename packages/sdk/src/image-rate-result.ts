import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed image content rating task.
 *
 * @template LevelT - Union of possible rating level strings (e.g. `"sfw" | "nsfw"`)
 */
export type ImageRateResult<LevelT extends string = "sfw" | "nsfw"> = {
  /** The task ID created for this rating request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** Assigned rating level */
  level: LevelT;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.ImageRateRequest; result: MynthSDKTypes.ImageRateTaskResult };
};

/** Map a completed image content rating task. */
export function toImageRateResult<LevelT extends string = "sfw" | "nsfw">(
  task: MynthCompletedTask<MynthSDKTypes.ImageRateRequest, MynthSDKTypes.ImageRateTaskResult>,
): ImageRateResult<LevelT> {
  return {
    taskId: task.taskId,
    cost: task.cost,
    // The request's levels decide this type; the API answers with one of them.
    level: task.result.level as LevelT,
    raw: { request: task.request, result: task.result },
  };
}
