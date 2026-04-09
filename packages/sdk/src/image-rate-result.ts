import type { MynthSDKTypes } from "./types";

/** A successfully rated image */
type ImageRateResultItemSuccess<LevelT extends string> = {
  /** The submitted image URL */
  url: string;
  /** The assigned rating level */
  rating: LevelT;
};

/** An image that could not be rated */
type ImageRateResultItemError = {
  error_code: string;
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

  /** Raw results array from the API */
  public readonly results: ImageRateResultItem<LevelT>[];

  constructor(data: MynthSDKTypes.ImageRateResponse<LevelT>) {
    this.taskId = data.taskId;
    this.results = data.results;
  }

  /**
   * Get only the successfully rated images.
   */
  getRatings(): ImageRateResultItemSuccess<LevelT>[] {
    return this.results.filter((r): r is ImageRateResultItemSuccess<LevelT> => "url" in r);
  }

  /**
   * Get only the images that failed to be rated.
   */
  getErrors(): ImageRateResultItemError[] {
    return this.results.filter((r): r is ImageRateResultItemError => "error_code" in r);
  }
}
