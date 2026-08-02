import type { MynthSDKTypes } from "./types";

/**
 * Represents the result of a completed image alt text task.
 */
export class ImageAltResult {
  /** The task ID created for this alt text request */
  public readonly taskId: string;

  /** Cost charged for the completed task */
  public readonly cost: string;

  /** The submitted image URL */
  public readonly url: string;

  /** Generated alt text */
  public readonly alt: string;

  constructor(data: { taskId: string; cost: string; url: string; alt: string }) {
    this.taskId = data.taskId;
    this.cost = data.cost;
    this.url = data.url;
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
      url: data.result.url,
      alt: data.result.alt,
    });
  }
}
