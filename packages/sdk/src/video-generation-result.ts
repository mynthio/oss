import type { MynthSDKTypes } from "./types";

/**
 * Represents a completed video generation task.
 *
 * @template MetadataT - Type of the metadata attached to the request
 */
export class VideoGenerationResult<MetadataT = Record<string, unknown> | undefined> {
  /** Raw task data from the API */
  public readonly data: MynthSDKTypes.VideoGenerationTaskData;

  constructor(data: MynthSDKTypes.VideoGenerationTaskData) {
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
   * The generation result containing videos and model info.
   * Returns `null` if the task hasn't completed yet.
   */
  get result(): MynthSDKTypes.VideoResult | null {
    return this.data.result;
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
   * Get all successfully generated video URLs.
   * Convenience method that extracts just the URLs from successful videos.
   */
  get urls(): string[] {
    return this.getVideos().map((video) => video.url);
  }

  /**
   * Get generated videos from the task result.
   *
   * @param options.includeFailed - If true, includes failed video results
   * @returns Array of video results
   */
  getVideos(options: { includeFailed: true }): MynthSDKTypes.VideoResultVideo[];
  getVideos(options?: { includeFailed?: false }): MynthSDKTypes.VideoResultVideoSuccess[];
  getVideos(
    options: { includeFailed?: boolean } = {},
  ): MynthSDKTypes.VideoResultVideo[] | MynthSDKTypes.VideoResultVideoSuccess[] {
    if (options.includeFailed) return this.data.result?.videos ?? [];

    return (this.data.result?.videos.filter((video) => video.status === "success") ??
      []) as MynthSDKTypes.VideoResultVideoSuccess[];
  }

  /**
   * Get the metadata that was attached to the generation request.
   */
  getMetadata(): MetadataT {
    return this.data.request?.metadata as MetadataT;
  }
}
