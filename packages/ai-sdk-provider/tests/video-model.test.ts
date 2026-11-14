import type { Experimental_VideoModelV4CallOptions as VideoModelV4CallOptions } from "@ai-sdk/provider";
import { experimental_generateVideo } from "ai";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMynth } from "../src/index.ts";
import { MynthAPIError } from "@mynthio/sdk";
import type { MynthVideo } from "@mynthio/sdk";
import { MynthVideoModel } from "../src/mynth-video-model.ts";
import {
  apiError,
  BASE_URL,
  bodyOf,
  createMockApi,
  errorOf,
  ok,
  PNG_BYTES,
  videoRoutes,
  videoTask,
} from "./mock-api.ts";

const MODEL = "xai/grok-imagine-video-1.5-lite";

function callOptions(overrides: Partial<VideoModelV4CallOptions> = {}): VideoModelV4CallOptions {
  return {
    prompt: "A cat surfing",
    n: 1,
    aspectRatio: undefined,
    resolution: undefined,
    duration: undefined,
    fps: undefined,
    seed: undefined,
    image: undefined,
    frameImages: undefined,
    inputReferences: undefined,
    generateAudio: undefined,
    providerOptions: {},
    ...overrides,
  };
}

function setup(routes = videoRoutes()) {
  const api = createMockApi(routes);
  vi.stubGlobal("fetch", api.fetch);
  const model = createMynth({ apiKey: "mak_test", baseURL: BASE_URL }).video(MODEL);
  // The AI SDK downloads generated videos with its own fetch; send it to the mock instead.
  const download = async ({ url }: { url: URL }) => {
    const response = await api.fetch(url);
    return {
      data: new Uint8Array(await response.arrayBuffer()),
      mediaType: response.headers.get("content-type") ?? undefined,
    };
  };
  return { api, model, download };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("MynthVideoModel.doGenerate", () => {
  it("creates a task and returns the video URL", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate!(callOptions());

    // Assert
    expect(await bodyOf(api, "POST /video/generate")).toEqual({
      prompt: "A cat surfing",
      model: MODEL,
    });
    expect(result.videos).toEqual([
      { type: "url", url: "https://cdn.test/vid_1.mp4", mediaType: "video/mp4" },
    ]);
    expect(result.warnings).toEqual([]);
    expect(result.providerMetadata).toEqual({
      mynth: {
        taskId: "tsk_vid",
        cost: "0.12",
        model: MODEL,
        videos: [
          {
            id: "vid_1",
            url: null,
            mynthUrl: "https://cdn.test/vid_1.mp4",
            duration: 6,
            resolution: "480p",
            aspectRatio: "16:9",
            audio: true,
          },
        ],
      },
    });
  });

  it("maps duration, aspect ratio, resolution and audio", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate!(
      callOptions({
        duration: 8,
        aspectRatio: "9:16",
        resolution: "720x1280",
        generateAudio: false,
      }),
    );

    // Assert
    expect(await bodyOf(api, "POST /video/generate")).toEqual({
      prompt: "A cat surfing",
      model: MODEL,
      duration: 8,
      size: { type: "aspect_ratio", aspect_ratio: "9:16", resolution: "720p" },
      audio: false,
    });
    expect(result.warnings).toEqual([]);
  });

  it("takes the aspect ratio from the resolution when none is given", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    await model.doGenerate!(callOptions({ resolution: "1920x1080" }));

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).size).toEqual({
      type: "aspect_ratio",
      aspect_ratio: "16:9",
      resolution: "1080p",
    });
  });

  it("rounds an off-tier resolution up to the next tier, with a warning", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate!(callOptions({ resolution: "960x540" }));

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).size).toMatchObject({ resolution: "720p" });
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "compatibility", feature: "resolution" }),
    ]);
  });

  it("sends adaptive as auto, keeping the tier", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    await model.doGenerate!(callOptions({ aspectRatio: "adaptive", resolution: "1280x720" }));

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).size).toEqual({
      type: "auto",
      resolution: "720p",
    });
  });

  it("rounds a fractional duration, with a warning", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    const result = await model.doGenerate!(callOptions({ duration: 5.6 }));

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).duration).toBe(6);
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "compatibility", feature: "duration" }),
    ]);
  });

  it("warns that seed and fps are not supported", async () => {
    // Arrange
    const { model } = setup();

    // Act
    const result = await model.doGenerate!(callOptions({ seed: 1, fps: 24 }));

    // Assert
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "unsupported", feature: "seed" }),
      expect.objectContaining({ type: "unsupported", feature: "fps" }),
    ]);
  });

  it("maps image, frame images and image references to Mynth input roles", async () => {
    // Arrange
    const { api, model } = setup(
      videoRoutes({ "POST /image/upload": ok({ urls: ["https://cdn.test/uploaded.png"] }) }),
    );

    // Act
    const result = await model.doGenerate!(
      callOptions({
        image: { type: "url", url: "https://cdn.test/first.png" },
        frameImages: [
          {
            image: { type: "file", mediaType: "image/png", data: PNG_BYTES },
            frameType: "last_frame",
          },
        ],
        inputReferences: [
          { type: "url", url: "https://cdn.test/style.png", mediaType: "image/png" },
          { type: "url", url: "https://cdn.test/clip.mp4", mediaType: "video/mp4" },
        ],
      }),
    );

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).inputs).toEqual([
      {
        type: "image",
        as: "first_frame",
        source: { type: "url", url: "https://cdn.test/first.png" },
      },
      {
        type: "image",
        as: "last_frame",
        source: { type: "url", url: "https://cdn.test/uploaded.png" },
      },
      {
        type: "image",
        as: "reference",
        source: { type: "url", url: "https://cdn.test/style.png" },
      },
    ]);
    expect(result.warnings).toEqual([
      expect.objectContaining({ type: "unsupported", feature: "inputReferences" }),
    ]);
  });

  it("passes providerOptions.mynth through, and its size wins", async () => {
    // Arrange
    const { api, model } = setup();

    // Act
    await model.doGenerate!(
      callOptions({
        aspectRatio: "16:9",
        providerOptions: { mynth: { size: "9:16_720p", negative_prompt: "text" } },
      }),
    );

    // Assert
    expect(await bodyOf(api, "POST /video/generate")).toEqual({
      prompt: "A cat surfing",
      model: MODEL,
      size: "9:16_720p",
      negative_prompt: "text",
    });
  });

  it("rejects a providerOptions.mynth that is not an object", async () => {
    // Arrange
    const { api, model } = setup();

    // Act & Assert
    await expect(
      model.doGenerate!(callOptions({ providerOptions: { mynth: [] as never } })),
    ).rejects.toThrow(/providerOptions.mynth/);
    expect(api.requests).toHaveLength(0);
  });

  it("turns API errors into APICallError", async () => {
    // Arrange
    const { model } = setup(
      videoRoutes({
        "POST /video/generate": apiError(400, {
          code: "validation_error",
          message: "duration: must be at most 15",
          issues: [{ path: ["duration"], message: "must be at most 15" }],
        }),
      }),
    );

    // Act
    const error = await errorOf(model.doGenerate!(callOptions({ duration: 60 })));

    // Assert
    expect(error).toMatchObject({
      statusCode: 400,
      isRetryable: false,
      url: `${BASE_URL}/video/generate`,
      data: {
        code: "validation_error",
        issues: [{ path: ["duration"], message: "must be at most 15" }],
      },
    });
  });

  it("marks a 429 on the create as retryable", async () => {
    // Arrange
    const { model } = setup(
      videoRoutes({ "POST /video/generate": apiError(429, { code: "rate_limited" }) }),
    );

    // Act
    const error = await errorOf(model.doGenerate!(callOptions()));

    // Assert
    expect(error).toMatchObject({ statusCode: 429, isRetryable: true });
  });

  it("does not mark a 429 during the wait as retryable, so no second task is created", async () => {
    // Arrange: the create succeeds, then the wait fails with a 429. (The SDK backs
    // off on rate-limited polls itself; this pins what happens if one ever surfaces.)
    const generateAsync = vi.fn(async () => ({
      wait: async () => {
        throw new MynthAPIError("Rate limited", 429, "rate_limited");
      },
    }));
    const model = new MynthVideoModel(MODEL, {
      provider: "mynth.video",
      baseURL: BASE_URL,
      client: () => ({ generateAsync }) as unknown as MynthVideo,
    });

    // Act
    const error = await errorOf(model.doGenerate!(callOptions()));

    // Assert
    expect(error).toMatchObject({ statusCode: 429, isRetryable: false });
    expect(generateAsync).toHaveBeenCalledTimes(1);
  });

  it("turns a failed task into a non-retryable APICallError", async () => {
    // Arrange
    const { model } = setup(videoRoutes({ "GET /tasks/tsk_vid/status": ok({ status: "failed" }) }));

    // Act
    const error = await errorOf(model.doGenerate!(callOptions()));

    // Assert
    expect(error).toMatchObject({
      isRetryable: false,
      message: expect.stringContaining("tsk_vid"),
    });
  });

  it("throws when the task produced no video", async () => {
    // Arrange
    const { model } = setup(
      videoRoutes({
        "GET /tasks/tsk_vid": ok(
          videoTask({
            result: { videos: [{ status: "failed", error: { code: "provider_error" } }] },
          }),
        ),
      }),
    );

    // Act
    const error = await errorOf(model.doGenerate!(callOptions()));

    // Assert
    expect(error).toMatchObject({
      isRetryable: false,
      message: expect.stringContaining("provider_error"),
    });
  });

  it("does not create a task when already aborted", async () => {
    // Arrange
    const { api, model } = setup();
    const controller = new AbortController();
    controller.abort();

    // Act & Assert
    await expect(
      model.doGenerate!(callOptions({ abortSignal: controller.signal })),
    ).rejects.toThrow();
    expect(api.requests).toHaveLength(0);
  });
});

describe("experimental_generateVideo with a Mynth model", () => {
  it("returns the downloaded video and Mynth metadata", async () => {
    // Arrange
    const { model, download } = setup();

    // Act
    const { video, providerMetadata } = await experimental_generateVideo({
      model,
      download,
      prompt: "A cat surfing",
      duration: 6,
    });

    // Assert
    expect(video.mediaType).toBe("video/mp4");
    expect(video.uint8Array).toEqual(new Uint8Array([0, 0, 0, 24]));
    expect(providerMetadata.mynth).toMatchObject({ taskId: "tsk_vid" });
  });

  it("sends an image prompt as the first frame", async () => {
    // Arrange
    const { api, model, download } = setup();

    // Act
    await experimental_generateVideo({
      model,
      download,
      prompt: { image: "https://cdn.test/first.png", text: "The cat starts surfing" },
    });

    // Assert
    expect((await bodyOf(api, "POST /video/generate")).inputs).toEqual([
      {
        type: "image",
        as: "first_frame",
        source: { type: "url", url: "https://cdn.test/first.png" },
      },
    ]);
  });
});
