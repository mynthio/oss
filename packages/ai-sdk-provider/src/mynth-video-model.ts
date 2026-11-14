import type {
  SharedV4Warning,
  Experimental_VideoModelV4 as VideoModelV4,
  Experimental_VideoModelV4CallOptions as VideoModelV4CallOptions,
  Experimental_VideoModelV4File as VideoModelV4File,
  Experimental_VideoModelV4Result as VideoModelV4Result,
} from "@ai-sdk/provider";
import type { MynthSDKTypes, MynthVideo } from "@mynthio/sdk";

import {
  closestAspectRatio,
  describeFailures,
  headersWarning,
  noOutputError,
  parseAspectRatio,
  parseSize,
  readMynthOptions,
  requirePrompt,
  toAISDKError,
  toMynthInputSource,
} from "./shared.ts";

/** Video model ids Mynth serves. Any other string is passed through to the API. */
export type MynthVideoModelId = MynthSDKTypes.VideoGenerationModelId | (string & {});

/**
 * Mynth request fields for `providerOptions.mynth` on video calls, passed
 * through to `POST /video/generate`. `size` here wins over `aspectRatio` and
 * `resolution`. `prompt`, `model` and `inputs` come from the call.
 */
export type MynthVideoProviderOptions = Omit<
  MynthSDKTypes.VideoGenerationRequest,
  "prompt" | "model" | "inputs"
>;

export type MynthVideoModelConfig = {
  provider: string;
  baseURL: string;
  /** Creates the Mynth SDK client on first use, so a missing key fails the call, not the import. */
  client: () => MynthVideo;
};

type VideoInput = MynthSDKTypes.VideoGenerationClientInput | string | Blob;

/** The pixel height of each Mynth resolution tier's short side. */
const TIERS: readonly { tier: MynthSDKTypes.VideoGenerationRequestResolution; side: number }[] = [
  { tier: "480p", side: 480 },
  { tier: "720p", side: 720 },
  { tier: "1080p", side: 1080 },
  { tier: "4k", side: 2160 },
];

/** A Mynth video model for `experimental_generateVideo()`. */
export class MynthVideoModel implements VideoModelV4 {
  readonly specificationVersion = "v4" as const;
  /** A Mynth video task renders one video. */
  readonly maxVideosPerCall: number = 1;
  readonly modelId: MynthVideoModelId;

  private readonly config: MynthVideoModelConfig;

  constructor(modelId: MynthVideoModelId, config: MynthVideoModelConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doGenerate(options: VideoModelV4CallOptions): Promise<VideoModelV4Result> {
    const timestamp = new Date();
    const warnings: SharedV4Warning[] = [...headersWarning(options.headers)];
    const mynthOptions = readMynthOptions(options.providerOptions);

    if (options.seed !== undefined) {
      warnings.push({ type: "unsupported", feature: "seed", details: "Mynth has no seed." });
    }
    if (options.fps !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "fps",
        details: "Mynth renders at each model's own frame rate.",
      });
    }

    const size = "size" in mynthOptions ? undefined : this.toMynthSize(options, warnings);
    const inputs = this.toMynthInputs(options, warnings);
    const duration = this.toMynthDuration(options.duration, warnings);

    const request = {
      ...mynthOptions,
      prompt: requirePrompt(options.prompt),
      model: this.modelId,
      ...(duration === undefined ? {} : { duration }),
      ...(size === undefined ? {} : { size }),
      ...(options.generateAudio === undefined ? {} : { audio: options.generateAudio }),
      ...(inputs.length === 0 ? {} : { inputs }),
    } as MynthSDKTypes.VideoGenerationClientRequest;

    // Create and wait are separate so an error after the task exists is never
    // retryable: a retry would create and charge a second task.
    let task;
    try {
      // Creating the task cannot be cancelled once sent; the wait can.
      options.abortSignal?.throwIfAborted();
      task = await this.config.client().generateAsync(request);
    } catch (error) {
      throw toAISDKError(error, this.config.baseURL, "/video/generate", { taskCreated: false });
    }

    let result;
    try {
      result = await task.wait({ signal: options.abortSignal });
    } catch (error) {
      throw toAISDKError(error, this.config.baseURL, "/video/generate", { taskCreated: true });
    }

    if (result.videos.length === 0) {
      throw noOutputError(
        `Mynth task ${result.taskId} produced no video: ${describeFailures(result.failures)}`,
        this.config.baseURL,
        "/video/generate",
      );
    }

    return {
      videos: result.videos.map((video) => ({
        type: "url" as const,
        // The Mynth CDN URL is always set and public; a destination URL may not be.
        url: video.mynthUrl,
        mediaType: "video/mp4",
      })),
      warnings,
      response: { timestamp, modelId: result.model, headers: undefined },
      providerMetadata: {
        mynth: {
          taskId: result.taskId,
          cost: result.cost,
          model: result.model,
          videos: result.videos.map((video) => ({
            id: video.id,
            url: video.url,
            mynthUrl: video.mynthUrl,
            duration: video.duration,
            resolution: video.resolution,
            aspectRatio: video.aspectRatio,
            audio: video.audio,
          })),
        },
      },
    };
  }

  /** Mynth takes whole seconds. */
  private toMynthDuration(
    duration: number | undefined,
    warnings: SharedV4Warning[],
  ): number | undefined {
    if (duration === undefined || Number.isInteger(duration)) return duration;
    const rounded = Math.max(1, Math.round(duration));
    warnings.push({
      type: "compatibility",
      feature: "duration",
      details: `Mynth takes whole seconds: ${duration}s was sent as ${rounded}s.`,
    });
    return rounded;
  }

  /**
   * Mynth sizes video by aspect ratio and resolution tier. `aspectRatio` maps
   * to the closest supported ratio (`adaptive` lets the input image decide);
   * `resolution` picks the tier from its short side, and its ratio is used
   * when `aspectRatio` is not set.
   */
  private toMynthSize(
    options: VideoModelV4CallOptions,
    warnings: SharedV4Warning[],
  ): MynthSDKTypes.VideoGenerationRequestSize | undefined {
    let ratio: MynthSDKTypes.ImageGenerationRequestAspectRatio | "auto" | undefined;
    let tier: MynthSDKTypes.VideoGenerationRequestResolution | undefined;

    if (options.aspectRatio === "adaptive") {
      ratio = "auto";
    } else if (options.aspectRatio !== undefined) {
      const parsed = parseAspectRatio(options.aspectRatio);
      if (parsed) {
        const closest = closestAspectRatio(parsed.width, parsed.height);
        ratio = closest.ratio;
        if (!closest.exact) {
          warnings.push({
            type: "compatibility",
            feature: "aspectRatio",
            details: `Mynth does not support ${options.aspectRatio}; used the closest supported ratio, ${closest.ratio}.`,
          });
        }
      } else {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Could not read aspect ratio "${options.aspectRatio}"; Mynth used the model default.`,
        });
      }
    }

    if (options.resolution !== undefined) {
      const parsed = parseSize(options.resolution);
      if (parsed) {
        const short = Math.min(parsed.width, parsed.height);
        const match = TIERS.find(({ side }) => short <= side) ?? TIERS[TIERS.length - 1]!;
        tier = match.tier;
        if (match.side !== short) {
          warnings.push({
            type: "compatibility",
            feature: "resolution",
            details: `Mynth renders in resolution tiers: ${options.resolution} was sent as ${match.tier}.`,
          });
        }
        if (ratio === undefined) {
          const closest = closestAspectRatio(parsed.width, parsed.height);
          ratio = closest.ratio;
        }
      } else {
        warnings.push({
          type: "unsupported",
          feature: "resolution",
          details: `Could not read resolution "${options.resolution}"; Mynth used the model default.`,
        });
      }
    }

    if (ratio === undefined && tier === undefined) return undefined;
    if (ratio === undefined || ratio === "auto") {
      return tier === undefined ? { type: "auto" } : { type: "auto", resolution: tier };
    }
    return tier === undefined
      ? { type: "aspect_ratio", aspect_ratio: ratio }
      : { type: "aspect_ratio", aspect_ratio: ratio, resolution: tier };
  }

  /** `image` and frame images become frame inputs; image references become `reference` inputs. */
  private toMynthInputs(
    options: VideoModelV4CallOptions,
    warnings: SharedV4Warning[],
  ): VideoInput[] {
    const inputs: VideoInput[] = [];

    const add = (file: VideoModelV4File, as: MynthSDKTypes.VideoGenerationRequestInputAs) => {
      const source = toMynthInputSource(file);
      inputs.push({
        type: "image",
        as,
        source:
          typeof source === "string"
            ? { type: "url", url: source }
            : { type: "file", file: source },
      });
    };

    if (options.image !== undefined) add(options.image, "first_frame");
    for (const frame of options.frameImages ?? []) add(frame.image, frame.frameType);

    for (const reference of options.inputReferences ?? []) {
      const mediaType = reference.mediaType ?? "";
      if (mediaType.startsWith("video/")) {
        warnings.push({
          type: "unsupported",
          feature: "inputReferences",
          details: "Mynth takes image references only; a video reference was skipped.",
        });
        continue;
      }
      add(reference, "reference");
    }

    return inputs;
  }
}
