import type { MynthSDKTypes } from "./types.ts";

/**
 * Represents the result of a completed image content rating task.
 *
 * @template LevelT - Union of possible rating level strings (e.g. `"sfw" | "nsfw"`)
 */
export class ImageRateResult<LevelT extends string = "sfw" | "nsfw"> {
  /** The task ID created for this rating request */
  public readonly taskId: string;

  /** Cost charged for the completed task */
  public readonly cost: string;

  /** Assigned rating level */
  public readonly level: LevelT;

  constructor(data: { taskId: string; cost: string; level: LevelT }) {
    this.taskId = data.taskId;
    this.cost = data.cost;
    this.level = data.level;
  }

  static fromTaskData<LevelT extends string = "sfw" | "nsfw">(
    data: MynthSDKTypes.ImageRateTaskData,
  ): ImageRateResult<LevelT> {
    if (data.status !== "completed" || data.result === null) {
      throw new Error(`Image rate task ${data.id} is not completed`);
    }

    if (data.cost === null) {
      throw new Error(`Image rate task ${data.id} is missing cost`);
    }

    return new ImageRateResult<LevelT>({
      taskId: data.id,
      cost: data.cost,
      level: data.result.level as LevelT,
    });
  }
}
