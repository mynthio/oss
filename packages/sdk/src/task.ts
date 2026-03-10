import type { MynthSDKTypes } from "./types";

/** Typed image result with custom content rating type */
type TypedImageResultImageSuccess<ContentRatingT> = Omit<
  MynthSDKTypes.ImageResultImageSuccess,
  "content_rating"
> & {
  content_rating?: ContentRatingT;
};

type TypedImageResultImageFailure = MynthSDKTypes.ImageResultImageFailure;

type TypedImageResultImage<ContentRatingT> =
  | TypedImageResultImageSuccess<ContentRatingT>
  | TypedImageResultImageFailure;

/** Typed result with custom content rating type on images */
type TypedImageResult<ContentRatingT> = Omit<MynthSDKTypes.ImageResult, "images"> & {
  images: TypedImageResultImage<ContentRatingT>[];
};

/**
 * Represents a completed image generation task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 * @template ContentRatingT - Type of the content rating response
 */
export class Task<
  MetadataT = Record<string, unknown> | undefined,
  ContentRatingT = MynthSDKTypes.ImageResultContentRating | undefined,
> {
  /** Raw task data from the API */
  public readonly data: MynthSDKTypes.TaskData;

  constructor(data: MynthSDKTypes.TaskData) {
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
  get result(): TypedImageResult<ContentRatingT> | null {
    return this.data.result as TypedImageResult<ContentRatingT> | null;
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
   */
  get urls(): string[] {
    return (
      this.data.result?.images
        .filter((img): img is MynthSDKTypes.ImageResultImageSuccess => img.status === "succeeded")
        .map((img) => img.url) ?? []
    );
  }

  /**
   * Get generated images from the task result.
   *
   * @param options.includeFailed - If true, includes failed image results
   * @returns Array of image results
   */
  getImages(options: { includeFailed: true }): TypedImageResultImage<ContentRatingT>[];
  getImages(options?: { includeFailed?: false }): TypedImageResultImageSuccess<ContentRatingT>[];
  getImages(
    options: { includeFailed?: boolean } = {},
  ): TypedImageResultImage<ContentRatingT>[] | TypedImageResultImageSuccess<ContentRatingT>[] {
    if (options.includeFailed)
      return (this.data.result?.images ?? []) as TypedImageResultImage<ContentRatingT>[];

    return (this.data.result?.images.filter((image) => image.status === "succeeded") ??
      []) as TypedImageResultImageSuccess<ContentRatingT>[];
  }

  /**
   * Get the metadata that was attached to the generation request.
   */
  getMetadata(): MetadataT {
    return this.data.request?.metadata as MetadataT;
  }
}
