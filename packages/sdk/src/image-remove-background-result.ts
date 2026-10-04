import { type MynthOutputImage, toOutputImage } from "./output-image.ts";
import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed image background removal task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 */
export type ImageRemoveBackgroundResult<MetadataT = Record<string, unknown> | undefined> = {
  /** The task ID created for this request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** The image with its background removed */
  image: MynthOutputImage<MynthSDKTypes.ImageRemoveBackgroundOutputFormat>;
  /** Metadata attached to the request */
  metadata: MetadataT;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: {
    request: MynthSDKTypes.ImageRemoveBackgroundRequest;
    result: MynthSDKTypes.ImageRemoveBackgroundTaskResult;
  };
};

/** Map a completed image background removal task. */
export function toImageRemoveBackgroundResult<MetadataT = Record<string, unknown> | undefined>(
  task: MynthCompletedTask<
    MynthSDKTypes.ImageRemoveBackgroundRequest,
    MynthSDKTypes.ImageRemoveBackgroundTaskResult
  >,
): ImageRemoveBackgroundResult<MetadataT> {
  return {
    taskId: task.taskId,
    cost: task.cost,
    image: toOutputImage(task.result.image),
    metadata: task.request.metadata as MetadataT,
    raw: { request: task.request, result: task.result },
  };
}
