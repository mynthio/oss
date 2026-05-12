import type { MynthSDKTypes } from "./types";

type TypedImageResultImageSuccess<RatingT> = Omit<
  MynthSDKTypes.ImageResultImageSuccess,
  "rating"
> & {
  rating?: RatingT;
};

type TypedImageResultImageFailure = MynthSDKTypes.ImageResultImageFailure;

type TypedImageResultImage<RatingT> =
  | TypedImageResultImageSuccess<RatingT>
  | TypedImageResultImageFailure;

type TypedImageResult<RatingT> = Omit<MynthSDKTypes.ImageResult, "images"> & {
  images: TypedImageResultImage<RatingT>[];
};

/**
 * Represents a completed image generation task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 * @template RatingT - Type of the rating response
 */
export class ImageGenerationResult<
  MetadataT = Record<string, unknown> | undefined,
  RatingT = MynthSDKTypes.ImageResultRating | undefined,
> {
  /** Raw task data from the API */
  public readonly data: MynthSDKTypes.ImageGenerationTaskData;

  constructor(data: MynthSDKTypes.ImageGenerationTaskData) {
    this.data = data;
  }

  /** Unique identifier for this task */
  get id(): string {
    return this.data.id;
  }

  /** Current status of the task */
  get status(): MynthSDKTypes.TaskStatus {
    return this.data.status;
  }

  /**
   * The generation result containing images, cost, and model info.
   * Returns `null` if the task hasn't completed yet.
   */
  get result(): TypedImageResult<RatingT> | null {
    return this.data.result as TypedImageResult<RatingT> | null;
  }

  /** Whether the task completed successfully */
  get isCompleted(): boolean {
    return this.data.status === "completed";
  }

  /** Whether the task failed */
  get isFailed(): boolean {
    return this.data.status === "failed";
  }

  /**
   * Get all successfully generated image URLs.
   * Convenience method that extracts just the URLs from successful images.
   * Images delivered only to a user destination may have a `null` url and are omitted here;
   * use `getImages()` and read `mynth_url` to access the CDN URL directly.
   */
  get urls(): string[] {
    return (
      this.data.result?.images
        .filter((img): img is MynthSDKTypes.ImageResultImageSuccess => img.status === "success")
        .map((img) => img.url)
        .filter((url): url is string => url !== null) ?? []
    );
  }

  /**
   * Get generated images from the task result.
   *
   * @param options.includeFailed - If true, includes failed image results
   * @returns Array of image results
   */
  getImages(options: { includeFailed: true }): TypedImageResultImage<RatingT>[];
  getImages(options?: { includeFailed?: false }): TypedImageResultImageSuccess<RatingT>[];
  getImages(
    options: { includeFailed?: boolean } = {},
  ): TypedImageResultImage<RatingT>[] | TypedImageResultImageSuccess<RatingT>[] {
    if (options.includeFailed)
      return (this.data.result?.images ?? []) as TypedImageResultImage<RatingT>[];

    return (this.data.result?.images.filter((image) => image.status === "success") ??
      []) as TypedImageResultImageSuccess<RatingT>[];
  }

  /**
   * Get the metadata that was attached to the generation request.
   */
  getMetadata(): MetadataT {
    return this.data.request?.metadata as MetadataT;
  }
}
