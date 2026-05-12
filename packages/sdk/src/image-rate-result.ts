import type { MynthSDKTypes } from "./types";

/** A successfully rated image */
type ImageRateResultItemSuccess<LevelT extends string> = {
  status: "success";
  url: string;
  level: LevelT;
};

type ImageRateResultItemError = {
  status: "failed";
  url: string;
  error: {
    code: string;
  };
};

/** Individual rating result — success or error */
export type ImageRateResultItem<LevelT extends string = string> =
  | ImageRateResultItemSuccess<LevelT>
  | ImageRateResultItemError;

/**
 * Represents the result of a synchronous image content rating request.
 *
 * @template LevelT - Union of possible rating level strings (e.g. `"sfw" | "nsfw"`)
 */
export class ImageRateResult<LevelT extends string = "sfw" | "nsfw"> {
  /** The task ID created for this rating request */
  public readonly taskId: string;

  /** Task metadata returned by the API */
  public readonly task: MynthSDKTypes.ImageRateResponse<LevelT>["task"];

  /** Raw results array from the API */
  public readonly results: ImageRateResultItem<LevelT>[];

  constructor(data: MynthSDKTypes.ImageRateResponse<LevelT>) {
    this.task = data.task;
    this.taskId = data.task.id;
    this.results = data.results;
  }

  /**
   * Get only the successfully rated images.
   */
  getRatings(): ImageRateResultItemSuccess<LevelT>[] {
    return this.results.filter(
      (r): r is ImageRateResultItemSuccess<LevelT> => r.status === "success",
    );
  }

  /**
   * Get only the images that failed to be rated.
   */
  getErrors(): ImageRateResultItemError[] {
    return this.results.filter((r): r is ImageRateResultItemError => r.status === "failed");
  }
}
