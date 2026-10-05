import { describe, expect, test } from "vitest";

import type { MynthSDKTypes } from "./types.ts";
import { toVideoGenerationResult } from "./video-generation-result.ts";

describe("toVideoGenerationResult", () => {
  test("splits successful videos from failures", () => {
    // Arrange
    const request: MynthSDKTypes.VideoGenerationRequest = {
      model: "prunaai/p-video",
      prompt: "A cat surfing",
    };
    const result: MynthSDKTypes.VideoResult = {
      model: "prunaai/p-video",
      videos: [
        {
          status: "success",
          id: "vid_1",
          url: "https://cdn.test/video.mp4",
          mynth_url: "https://mynth.test/video.mp4",
          cost: "0.42",
          duration: 8,
          resolution: "1080p",
          audio: false,
        },
        { status: "failed", error: { code: "provider_error" } },
      ],
    };

    // Act
    const video = toVideoGenerationResult({ taskId: "tsk_video", cost: "0.42", request, result });

    // Assert
    expect(video).toStrictEqual({
      taskId: "tsk_video",
      cost: "0.42",
      model: "prunaai/p-video",
      videos: [
        {
          id: "vid_1",
          url: "https://cdn.test/video.mp4",
          mynthUrl: "https://mynth.test/video.mp4",
          cost: "0.42",
          duration: 8,
          resolution: "1080p",
          audio: false,
        },
      ],
      failures: [{ code: "provider_error" }],
      urls: ["https://cdn.test/video.mp4"],
      metadata: undefined,
      raw: { request, result },
    });
  });

  test("keeps a video without a public URL out of urls", () => {
    // Arrange
    const request: MynthSDKTypes.VideoGenerationRequest = {
      model: "prunaai/p-video",
      prompt: "A cat surfing",
    };
    const result: MynthSDKTypes.VideoResult = {
      model: "prunaai/p-video",
      videos: [
        {
          status: "success",
          id: "vid_1",
          url: null,
          mynth_url: "https://mynth.test/video.mp4",
          cost: "0.42",
          duration: 8,
          resolution: "1080p",
          audio: false,
        },
      ],
    };

    // Act
    const video = toVideoGenerationResult({ taskId: "tsk_video", cost: "0.42", request, result });

    // Assert
    expect({
      urls: video.urls,
      mynthUrl: video.videos[0]?.mynthUrl,
      url: video.videos[0]?.url,
    }).toEqual({
      urls: [],
      mynthUrl: "https://mynth.test/video.mp4",
      url: null,
    });
  });
});
