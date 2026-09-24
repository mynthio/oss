import type { MynthSDKTypes } from "./types.ts";

/**
 * Represents the result of a completed image alt text task.
 */
export class ImageAltResult {
  /** The task ID created for this alt text request */
  public readonly taskId: string;

  /** Cost charged for the completed task */
  public readonly cost: string;

  /** Generated alt text */
  public readonly alt: string;

  constructor(data: { taskId: string; cost: string; alt: string }) {
    this.taskId = data.taskId;
    this.cost = data.cost;
    this.alt = data.alt;
  }

  static fromTaskData(data: MynthSDKTypes.ImageAltTaskData): ImageAltResult {
    if (data.status !== "completed" || data.result === null) {
      throw new Error(`Image alt task ${data.id} is not completed`);
    }

    if (data.cost === null) {
      throw new Error(`Image alt task ${data.id} is missing cost`);
    }

    return new ImageAltResult({
      taskId: data.id,
      cost: data.cost,
      alt: data.result.alt,
    });
  }
}
