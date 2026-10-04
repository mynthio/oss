import type { MynthSDKTypes } from "./types.ts";

/**
 * A video produced by a Mynth video generation task.
 */
export type MynthOutputVideo = {
  /** Video ID */
  id: string;
  /** Public URL of the video */
  url: string;
  /** Mynth CDN URL. Always set, and served for 7 days. */
  mynthUrl: string;
  /** Cost charged for this video */
  cost: string;
  /** Duration in seconds */
  duration: number;
  /** Resolution tier the video was rendered at */
  resolution: MynthSDKTypes.VideoGenerationRequestResolution;
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
    audio: video.audio,
  };
}
