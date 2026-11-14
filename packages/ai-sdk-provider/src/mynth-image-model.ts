import type {
  ImageModelV4,
  ImageModelV4CallOptions,
  ImageModelV4Result,
  SharedV4Warning,
} from "@ai-sdk/provider";
import type { MynthImage, MynthSDKTypes } from "@mynthio/sdk";

import {
  closestAspectRatio,
  describeFailures,
  downloadBytes,
  headersWarning,
  noOutputError,
  parseAspectRatio,
  parseSize,
  readMynthOptions,
  requirePrompt,
  toAISDKError,
  toMynthInputSource,
} from "./shared.ts";

/** Image model ids Mynth serves. Any other string is passed through to the API. */
export type MynthImageModelId = MynthSDKTypes.ImageGenerationModel | (string & {});

/**
 * Mynth request fields for `providerOptions.mynth` on image calls, passed
 * through to `POST /image/generate`. `size` here wins over `size` and
 * `aspectRatio`. `prompt`, `model`, `count` and `inputs` come from the call.
 */
export type MynthImageProviderOptions = Omit<
  MynthSDKTypes.ImageGenerationRequest,
  "prompt" | "model" | "count" | "inputs"
>;

/** Mynth accepts up to 20 images per task. */
const MAX_IMAGES_PER_CALL = 20;

export type MynthImageModelConfig = {
  provider: string;
  baseURL: string;
  /** Creates the Mynth SDK client on first use, so a missing key fails the call, not the import. */
  client: () => MynthImage;
};

/** A Mynth image model for `generateImage()`. */
export class MynthImageModel implements ImageModelV4 {
  readonly specificationVersion = "v4" as const;
  readonly maxImagesPerCall: number = MAX_IMAGES_PER_CALL;
  readonly supportsFileInputs: boolean = true;
  readonly supportsMaskInputs: boolean = false;
  readonly modelId: MynthImageModelId;

  private readonly config: MynthImageModelConfig;

  constructor(modelId: MynthImageModelId, config: MynthImageModelConfig) {
    this.modelId = modelId;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  async doGenerate(options: ImageModelV4CallOptions): Promise<ImageModelV4Result> {
    const timestamp = new Date();
    const warnings: SharedV4Warning[] = [...headersWarning(options.headers)];
    const mynthOptions = readMynthOptions(options.providerOptions);

    if (options.seed !== undefined) {
      warnings.push({ type: "unsupported", feature: "seed", details: "Mynth has no seed." });
    }
    if (options.mask !== undefined) {
      warnings.push({
        type: "unsupported",
        feature: "mask",
        details: "Mynth has no mask input; pass the image in `files` and describe the edit.",
      });
    }

    const size = "size" in mynthOptions ? undefined : this.toMynthSize(options, warnings);
    const inputs = options.files?.map(toMynthInputSource);

    const request = {
      ...mynthOptions,
      prompt: requirePrompt(options.prompt),
      model: this.modelId,
      count: options.n,
      ...(size === undefined ? {} : { size }),
      ...(inputs === undefined || inputs.length === 0 ? {} : { inputs }),
    } as MynthSDKTypes.ImageGenerationClientRequest;

    // Create and wait are separate so an error after the task exists is never
    // retryable: a retry would create and charge a second task.
    let task;
    try {
      task = await this.config.client().generateAsync(request, { signal: options.abortSignal });
    } catch (error) {
      throw toAISDKError(error, this.config.baseURL, "/image/generate", { taskCreated: false });
    }

    let result;
    try {
      result = await task.wait({ signal: options.abortSignal });
    } catch (error) {
      throw toAISDKError(error, this.config.baseURL, "/image/generate", { taskCreated: true });
    }

    if (result.images.length === 0) {
      throw noOutputError(
        `Mynth task ${result.taskId} produced no images: ${describeFailures(result.failures)}`,
        this.config.baseURL,
        "/image/generate",
      );
    }
    if (result.failures.length > 0) {
      warnings.push({
        type: "other",
        message: `${result.failures.length} of ${options.n} images failed and were not charged: ${describeFailures(result.failures)}`,
      });
    }

    // The Mynth CDN URL is always set and public; a destination URL may not be.
    const images = await Promise.all(
      result.images.map((image) => downloadBytes(image.mynthUrl, options.abortSignal)),
    );

    return {
      images,
      warnings,
      response: { timestamp, modelId: result.model, headers: undefined },
      providerMetadata: {
        mynth: {
          taskId: result.taskId,
          cost: result.cost,
          model: result.model,
          images: result.images.map((image) => ({
            id: image.id,
            taskId: result.taskId,
            taskCost: result.cost,
            model: result.model,
            url: image.url,
            mynthUrl: image.mynthUrl,
            width: image.width,
            height: image.height,
            mimeType: image.mimeType,
          })),
        },
      },
    };
  }

  /**
   * Mynth sizes images by aspect ratio (plus an optional 4k scale), not by
   * pixels. `aspectRatio` maps to the closest ratio Mynth supports; a pixel
   * `size` is reduced to its ratio the same way.
   */
  private toMynthSize(
    options: ImageModelV4CallOptions,
    warnings: SharedV4Warning[],
  ): MynthSDKTypes.ImageGenerationRequestAspectRatio | undefined {
    if (options.aspectRatio !== undefined) {
      if (options.size !== undefined) {
        warnings.push({
          type: "unsupported",
          feature: "size",
          details: "Both size and aspectRatio were set; Mynth used aspectRatio.",
        });
      }
      const parsed = parseAspectRatio(options.aspectRatio);
      if (!parsed) {
        warnings.push({
          type: "unsupported",
          feature: "aspectRatio",
          details: `Could not read aspect ratio "${options.aspectRatio}"; Mynth used the model default.`,
        });
        return undefined;
      }
      const closest = closestAspectRatio(parsed.width, parsed.height);
      if (!closest.exact) {
        warnings.push({
          type: "compatibility",
          feature: "aspectRatio",
          details: `Mynth does not support ${options.aspectRatio}; used the closest supported ratio, ${closest.ratio}.`,
        });
      }
      return closest.ratio;
    }

    if (options.size !== undefined) {
      const parsed = parseSize(options.size);
      if (!parsed) {
        warnings.push({
          type: "unsupported",
          feature: "size",
          details: `Could not read size "${options.size}"; Mynth used the model default.`,
        });
        return undefined;
      }
      const closest = closestAspectRatio(parsed.width, parsed.height);
      warnings.push({
        type: "compatibility",
        feature: "size",
        details: `Mynth sizes images by aspect ratio, not pixels: ${options.size} was sent as ${closest.ratio}. Pass providerOptions.mynth.size for a 4k scale.`,
      });
      return closest.ratio;
    }

    return undefined;
  }
}
