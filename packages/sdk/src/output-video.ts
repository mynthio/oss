import type { MynthSDKTypes } from "./types.ts";

/**
 * A video produced by a Mynth video generation task.
 */
export type MynthOutputVideo = {
  /** Video ID */
  id: string;
  /**
   * Public URL of the video. `null` when it could not be delivered there.
   * Write `url ?? mynthUrl` where any URL will do.
   */
  url: string | null;
  /** Mynth CDN URL. Always set, and served for 7 days. */
  mynthUrl: string;
  /** Cost charged for this video */
  cost: string;
  /** Duration in seconds */
  duration: number;
  /** Resolution tier the video was rendered at */
  resolution: MynthSDKTypes.VideoGenerationRequestResolution;
  /** Aspect ratio the video was generated at, e.g. `"16:9"`. `null` when the first frame set it. */
  aspectRatio: string | null;
  /** Whether the video has generated audio */
  audio: boolean;
};

/** Map a successful video from the API wire format. */
export function toOutputVideo(video: MynthSDKTypes.VideoResultVideoSuccess): MynthOutputVideo {
  return {
    id: video.id,
    url: video.url,
    mynthUrl: video.mynth_url,
    cost: video.cost,
    duration: video.duration,
    resolution: video.resolution,
    aspectRatio: video.aspect_ratio,
    audio: video.audio,
  };
}
