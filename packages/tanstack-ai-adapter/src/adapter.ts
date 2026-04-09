import type { MynthSDKTypes } from "@mynthio/sdk";
import { MynthImage } from "@mynthio/sdk";
import type { GeneratedImage, ImageGenerationOptions, ImageGenerationResult } from "@tanstack/ai";
import { BaseImageAdapter } from "@tanstack/ai/adapters";

import type { MynthImageModel } from "./model-meta";
import type {
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "./provider-options";
import type { MynthImageConfig } from "./types";

/**
 * Factory function that creates model-bound Mynth image adapters.
 *
 * This mirrors the provider pattern used by other TanStack and AI SDK
 * integrations: configure once, choose the model when creating the adapter.
 */
export type MynthImageProvider = <TModel extends MynthImageModel>(
  model: TModel,
  config?: MynthImageConfig,
) => MynthImageAdapter<TModel>;

/**
 * Mynth Image Generation Adapter for TanStack AI.
 *
 * TanStack AI binds an adapter instance to a single model. This adapter then
 * translates TanStack's image-generation options into a Mynth SDK request and
 * returns TanStack's normalized image result shape.
 */
export class MynthImageAdapter<TModel extends MynthImageModel> extends BaseImageAdapter<
  TModel,
  MynthImageProviderOptions,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName
> {
  readonly name = "mynth" as const;

  private client: MynthImage;

  constructor(config: MynthImageConfig, model: TModel) {
    super({}, model);

    this.client = new MynthImage({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    });
  }

  override async generateImages(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageModelSizeByName[TModel]>,
  ): Promise<ImageGenerationResult> {
    const request = this.buildRequest(options);
    const task = await this.client.generate(request);

    return this.transformResponse(task, options.model);
  }

  private buildRequest(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>,
  ): MynthSDKTypes.ImageGenerationRequest {
    const { prompt, numberOfImages, size, modelOptions } = options;

    const request: MynthSDKTypes.ImageGenerationRequest = {
      prompt: modelOptions?.promptStructured ?? prompt,
      // TanStack adapters are model-bound; provider options should not override it.
      model: this.model as MynthSDKTypes.ImageGenerationModel,
    };

    if (numberOfImages !== undefined) {
      request.count = numberOfImages;
    }

    // Top-level TanStack size supports shorthand strings only.
    // Use modelOptions.size when you need Mynth's structured size objects.
    if (modelOptions?.size !== undefined) {
      request.size = modelOptions.size;
    } else if (size !== undefined) {
      request.size = size as MynthSDKTypes.ImageGenerationRequestSize;
    }

    if (modelOptions?.output !== undefined) {
      request.output = modelOptions.output;
    }

    if (modelOptions?.access !== undefined) {
      request.access = modelOptions.access;
    }

    if (modelOptions?.inputs !== undefined) {
      request.inputs = modelOptions.inputs;
    }

    if (modelOptions?.webhook !== undefined) {
      request.webhook = modelOptions.webhook;
    }

    if (modelOptions?.contentRating !== undefined) {
      request.content_rating = modelOptions.contentRating;
    }

    if (modelOptions?.metadata !== undefined) {
      request.metadata = modelOptions.metadata;
    }

    return request;
  }

  private transformResponse(
    task: Awaited<ReturnType<MynthImage["generate"]>>,
    fallbackModel: string,
  ): ImageGenerationResult {
    const revisedPrompt = task.result?.prompt_enhance?.positive;
    const images: Array<GeneratedImage> = task.getImages().map((img) => ({
      url: img.url,
      ...(revisedPrompt ? { revisedPrompt } : {}),
    }));

    return {
      id: task.id,
      model: task.result?.model ?? fallbackModel,
      images,
    };
  }
}

/**
 * Creates a reusable Mynth image provider.
 *
 * The returned function creates model-bound adapters and can still accept
 * per-call config overrides when needed.
 *
 * @param config - Optional shared configuration for all created adapters.
 * If apiKey is omitted, the Mynth SDK falls back to MYNTH_API_KEY.
 * @returns Provider function that creates configured Mynth image adapters
 *
 * @example
 * ```typescript
 * import { generateImage } from '@tanstack/ai'
 * import { createMynthImage } from '@mynthio/tanstack-ai-adapter'
 *
 * const mynth = createMynthImage({
 *   apiKey: 'mak_...',
 *   baseUrl: 'https://api.mynth.io',
 * })
 *
 * const result = await generateImage({
 *   adapter: mynth('black-forest-labs/flux.2-dev'),
 *   prompt: 'A serene mountain landscape at sunset',
 * })
 *
 * console.log(result.images[0].url)
 * ```
 */
export function createMynthImage(config: MynthImageConfig = {}): MynthImageProvider {
  return function mynthImageProvider<TModel extends MynthImageModel>(
    model: TModel,
    overrideConfig: MynthImageConfig = {},
  ): MynthImageAdapter<TModel> {
    return new MynthImageAdapter({ ...config, ...overrideConfig }, model);
  };
}

const defaultMynthImageProvider = createMynthImage();

/**
 * Creates a Mynth image adapter directly.
 *
 * This is the ergonomic shorthand for `createMynthImage()(model, config)`.
 *
 * @param model - The Mynth model name (e.g., 'black-forest-labs/flux.2-dev')
 * @param config - Optional adapter configuration, including apiKey overrides.
 * If apiKey is omitted, the Mynth SDK falls back to MYNTH_API_KEY.
 * @returns Configured Mynth image adapter instance
 * @throws Error if MYNTH_API_KEY is not found in environment
 *
 * @example
 * ```typescript
 * import { generateImage } from '@tanstack/ai'
 * import { mynthImage } from '@mynthio/tanstack-ai-adapter'
 *
 * const result = await generateImage({
 *   adapter: mynthImage('black-forest-labs/flux.2-dev'),
 *   prompt: 'A beautiful sunset over mountains',
 * })
 *
 * console.log(result.images[0].url)
 * ```
 */
export function mynthImage<TModel extends MynthImageModel>(
  model: TModel,
  config?: MynthImageConfig,
): MynthImageAdapter<TModel> {
  return defaultMynthImageProvider(model, config);
}
