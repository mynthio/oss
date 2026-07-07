import type { MynthSDKTypes } from "./types";

/** A successfully generated image alt text item */
type ImageAltResultItemSuccess = {
  status: "success";
  url: string;
  alt: string;
};

type ImageAltResultItemError = {
  status: "failed";
  url: string;
  error: {
    code: string;
  };
};

/** Individual alt text result - success or error */
export type ImageAltResultItem = ImageAltResultItemSuccess | ImageAltResultItemError;

/**
 * Represents the result of a completed image alt text task.
 */
export class ImageAltResult {
  /** The task ID created for this alt text request */
  public readonly taskId: string;

  /** Task metadata returned by the API */
  public readonly task: MynthSDKTypes.ImageAltResponse["task"];

  /** Raw results array from the API */
  public readonly results: ImageAltResultItem[];

  constructor(data: MynthSDKTypes.ImageAltResponse) {
    this.task = data.task;
    this.taskId = data.task.id;
    this.results = data.results;
  }

  static fromTaskData(data: MynthSDKTypes.ImageAltTaskData): ImageAltResult {
    if (data.status !== "completed" || data.result === null) {
      throw new Error(`Image alt task ${data.id} is not completed`);
    }

    if (data.cost === null) {
      throw new Error(`Image alt task ${data.id} is missing cost`);
    }

    return new ImageAltResult({
      task: {
        id: data.id,
        status: "completed",
        cost: data.cost,
      },
      results: data.result.results,
    });
  }

  /**
   * Get only the successfully generated alt text items.
   */
  getAltTexts(): ImageAltResultItemSuccess[] {
    return this.results.filter((r): r is ImageAltResultItemSuccess => r.status === "success");
  }

  /**
   * Get only the images that failed to get alt text.
   */
  getErrors(): ImageAltResultItemError[] {
    return this.results.filter((r): r is ImageAltResultItemError => r.status === "failed");
  }
}
