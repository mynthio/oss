import { type MynthOutputVideo, toOutputVideo } from "./output-video.ts";
import type { MynthCompletedTask } from "./task-result.ts";
import type { MynthSDKTypes } from "./types.ts";

/**
 * A completed video generation task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 */
export type VideoGenerationResult<MetadataT = Record<string, unknown> | undefined> = {
  /** The task ID created for this request */
  taskId: string;
  /** Cost charged for the completed task. Failed videos are refunded. */
  cost: string;
  /** Model that generated the videos */
  model: MynthSDKTypes.VideoGenerationModelId;
  /** Successfully generated videos, in order */
  videos: MynthOutputVideo[];
  /**
   * Why videos failed. A completed task can hold failed videos; they are not
   * in `videos`.
   */
  failures: MynthSDKTypes.TaskError[];
  /**
   * The `url` of each successful video. Skips videos whose `url` is `null`;
   * read `videos` to reach their `mynthUrl`.
   */
  urls: string[];
  /** Metadata attached to the request */
  metadata: MetadataT;
  /** The request and result as the API returned them, for fields the SDK does not map yet */
  raw: { request: MynthSDKTypes.VideoGenerationRequest; result: MynthSDKTypes.VideoResult };
};

/** Map a completed video generation task. */
export function toVideoGenerationResult<MetadataT = Record<string, unknown> | undefined>(
  task: MynthCompletedTask<MynthSDKTypes.VideoGenerationRequest, MynthSDKTypes.VideoResult>,
): VideoGenerationResult<MetadataT> {
  const videos: MynthOutputVideo[] = [];
  const failures: MynthSDKTypes.TaskError[] = [];

  for (const video of task.result.videos) {
    if (video.status === "success") {
      videos.push(toOutputVideo(video));
    } else {
      failures.push(video.error);
    }
  }

  return {
    taskId: task.taskId,
    cost: task.cost,
    model: task.result.model,
    videos,
    failures,
    urls: videos.flatMap((video) => (video.url === null ? [] : [video.url])),
    metadata: task.request.metadata as MetadataT,
    raw: { request: task.request, result: task.result },
  };
}
