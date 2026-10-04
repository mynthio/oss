import { type MynthOutputImage, toOutputImage } from "./output-image.ts";
import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed image upscale task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 */
export type ImageUpscaleResult<MetadataT = Record<string, unknown> | undefined> = {
  /** The task ID created for this request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** The upscaled image */
  image: MynthOutputImage<MynthSDKTypes.ImageUpscaleOutputFormat>;
  /** Metadata attached to the request */
  metadata: MetadataT;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.ImageUpscaleRequest; result: MynthSDKTypes.ImageUpscaleTaskResult };
};

/** Map a completed image upscale task. */
export function toImageUpscaleResult<MetadataT = Record<string, unknown> | undefined>(
  task: MynthCompletedTask<MynthSDKTypes.ImageUpscaleRequest, MynthSDKTypes.ImageUpscaleTaskResult>,
): ImageUpscaleResult<MetadataT> {
  return {
    taskId: task.taskId,
    cost: task.cost,
    image: toOutputImage(task.result.image),
    metadata: task.request.metadata as MetadataT,
    raw: { request: task.request, result: task.result },
  };
}
