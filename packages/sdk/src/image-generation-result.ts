import { type MynthOutputImage, toOutputImage } from "./output-image.ts";
import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * An image produced by image generation: an {@link MynthOutputImage} with its
 * content rating.
 *
 * @template RatingT - Type of the rating, inferred from the request's `rating`
 */
export type MynthGeneratedImage<RatingT = MynthSDKTypes.ImageResultRating | undefined> =
  MynthOutputImage<MynthSDKTypes.ImageGenerationRequestOutputFormat> & {
    /** Content rating. `undefined` when the request did not ask for one. */
    rating: RatingT;
  };

/**
 * A completed image generation task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 * @template RatingT - Type of the rating response
 */
export type ImageGenerationResult<
  MetadataT = Record<string, unknown> | undefined,
  RatingT = MynthSDKTypes.ImageResultRating | undefined,
> = {
  /** The task ID created for this request */
  taskId: string;
  /** Cost charged for the completed task */
  cost: string;
  /** Model that generated the images. Resolved to a concrete model when the request used `auto`. */
  model: MynthSDKTypes.ImageGenerationModelId;
  /** Successfully generated images, in order */
  images: MynthGeneratedImage<RatingT>[];
  /**
   * Why images failed. A completed task can hold failed images; they are not
   * in `images`.
   */
  failures: MynthSDKTypes.TaskError[];
  /**
   * The `url` of each successful image. Skips images whose `url` is `null`;
   * read `images` to reach their `mynthUrl`.
   */
  urls: string[];
  /** The prompt Mynth rewrote, when the request enabled `magic_prompt` */
  magicPrompt: MynthSDKTypes.ImageResultMagicPrompt | undefined;
  /** Metadata attached to the request */
  metadata: MetadataT;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.ImageGenerationRequest; result: MynthSDKTypes.ImageResult };
};

/** Map a completed image generation task. */
export function toImageGenerationResult<
  MetadataT = Record<string, unknown> | undefined,
  RatingT = MynthSDKTypes.ImageResultRating | undefined,
>(
  task: MynthCompletedTask<MynthSDKTypes.ImageGenerationRequest, MynthSDKTypes.ImageResult>,
): ImageGenerationResult<MetadataT, RatingT> {
  const images: MynthGeneratedImage<RatingT>[] = [];
  const failures: MynthSDKTypes.TaskError[] = [];

  for (const image of task.result.images) {
    if (image.status === "success") {
      // The request's `rating` config decides this type; the API honours it.
      images.push({ ...toOutputImage(image), rating: image.rating as RatingT });
    } else {
      failures.push(image.error);
    }
  }

  return {
    taskId: task.taskId,
    cost: task.cost,
    model: task.result.model,
    images,
    failures,
    urls: images.flatMap((image) => (image.url === null ? [] : [image.url])),
    magicPrompt: task.result.magic_prompt,
    metadata: task.request.metadata as MetadataT,
    raw: { request: task.request, result: task.result },
  };
}
