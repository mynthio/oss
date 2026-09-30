import type { MynthSDKTypes } from "./types.ts";

/**
 * Represents the result of a completed image upscale task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 */
export class ImageUpscaleResult<MetadataT = Record<string, unknown> | undefined> {
  /** The task ID created for this request */
  public readonly taskId: string;

  /** Cost charged for the completed task */
  public readonly cost: string;

  /** The upscaled image */
  public readonly image: MynthSDKTypes.ImageUpscaleResultImage;

  /** Metadata attached to the request */
  public readonly metadata: MetadataT;

  constructor(data: {
    taskId: string;
    cost: string;
    image: MynthSDKTypes.ImageUpscaleResultImage;
    metadata: MetadataT;
  }) {
    this.taskId = data.taskId;
    this.cost = data.cost;
    this.image = data.image;
    this.metadata = data.metadata;
  }

  static fromTaskData<MetadataT = Record<string, unknown> | undefined>(
    data: MynthSDKTypes.ImageUpscaleTaskData,
  ): ImageUpscaleResult<MetadataT> {
    if (data.status !== "completed" || data.result === null) {
      throw new Error(`Image upscale task ${data.id} is not completed`);
    }

    if (data.cost === null) {
      throw new Error(`Image upscale task ${data.id} is missing cost`);
    }

    return new ImageUpscaleResult<MetadataT>({
      taskId: data.id,
      cost: data.cost,
      image: data.result.image,
      metadata: data.request.metadata as MetadataT,
    });
  }
}
