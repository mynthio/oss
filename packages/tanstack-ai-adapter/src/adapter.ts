import type { MynthSDKTypes } from "@mynthio/sdk";
import { MynthImage } from "@mynthio/sdk";
import type {
  GeneratedImage,
  ImageGenerationOptions,
  ImageGenerationResult,
  MediaInputRole,
  MediaPrompt,
} from "@tanstack/ai";
import { resolveMediaPrompt } from "@tanstack/ai";
import { BaseImageAdapter } from "@tanstack/ai/adapters";

import type { MynthImageModel } from "./model-meta";
import type {
  MynthImageModelInputModalitiesByName,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "./provider-options";
import type { MynthImageConfig } from "./types";

/**
 * Map a TanStack media-input role onto a Mynth image input role (`as`).
 *
 * TanStack's generic roles only partially overlap with Mynth's SDK input-role
 * set. Reference-like roles map to Mynth's `"reference"` guidance role; every
 * other role is omitted so Mynth treats the image as a source/edit input.
 */
function mapRoleToInputAs(
  role: MediaInputRole | undefined,
): MynthSDKTypes.ImageGenerationRequestInputAs | undefined {
  return role === "reference" || role === "character" ? "reference" : undefined;
}

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
  MynthImageModelSizeByName,
  MynthImageModelInputModalitiesByName
> {
  readonly name = "mynth" as const;

  private client: MynthImage;

  constructor(config: MynthImageConfig, model: TModel) {
    super(model);

    this.client = new MynthImage({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
      destination: config.destination,
    });
  }

  override async generateImages(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageModelSizeByName[TModel]>,
  ): Promise<ImageGenerationResult> {
    const request = this.buildRequest(options);

    options.logger?.request("Generating images with Mynth", {
      provider: this.name,
      model: request.model,
      count: request.count ?? 1,
      inputs: request.inputs?.length ?? 0,
    });

    try {
      const task = await this.client.generate(request);

      return this.transformResponse(task, options.model);
    } catch (error) {
      options.logger?.errors("Mynth image generation failed", {
        provider: this.name,
        model: request.model,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private buildRequest(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>,
  ): MynthSDKTypes.ImageGenerationRequest {
    const { prompt, numberOfImages, size, modelOptions } = options;

    const { text: promptText, inputs: promptInputs } = this.resolvePrompt(prompt);

    const request: MynthSDKTypes.ImageGenerationRequest = {
      prompt: modelOptions?.promptStructured?.positive ?? promptText,
      // TanStack adapters are model-bound; provider options should not override it.
      model: this.model as MynthSDKTypes.ImageGenerationModel,
    };

    if (modelOptions?.promptStructured?.negative !== undefined) {
      request.negative_prompt = modelOptions.promptStructured.negative;
    } else if (modelOptions?.negativePrompt !== undefined) {
      request.negative_prompt = modelOptions.negativePrompt;
    }

    if (modelOptions?.promptStructured?.enhance || modelOptions?.magicPrompt) {
      request.magic_prompt = true;
    }

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

    // Image inputs come from two sources: content parts in the TanStack prompt
    // (mapped above) and the provider-specific `modelOptions.inputs` escape
    // hatch. Prompt-derived inputs come first to preserve prompt order.
    const inputs = [...promptInputs, ...(modelOptions?.inputs ?? [])];
    if (inputs.length > 0) {
      request.inputs = inputs;
    }

    if (modelOptions?.webhook !== undefined) {
      request.webhook = modelOptions.webhook;
    }

    if (modelOptions?.rating !== undefined) {
      request.rating = modelOptions.rating;
    } else if (modelOptions?.contentRating !== undefined) {
      request.rating = modelOptions.contentRating;
    }

    if (modelOptions?.metadata !== undefined) {
      request.metadata = modelOptions.metadata;
    }

    if (modelOptions?.destination !== undefined) {
      request.destination = modelOptions.destination;
    }

    return request;
  }

  /**
   * Normalize a TanStack media prompt into Mynth's request shape.
   *
   * A plain string prompt yields just the text. An array prompt is decomposed
   * into its verbatim text and image content parts; each image part becomes a
   * Mynth `inputs` entry, carrying its data/URL source and an optional intent
   * derived from the part's `metadata.role`. Non-image media parts (video,
   * audio) are not supported by Mynth image generation and are ignored.
   */
  private resolvePrompt(prompt: MediaPrompt): {
    text: string;
    inputs: MynthSDKTypes.ImageGenerationRequestInput[];
  } {
    const resolved = resolveMediaPrompt(prompt);

    const inputs = resolved.images.map((image): MynthSDKTypes.ImageGenerationRequestInput => {
      const source = image.source;
      const url =
        source.type === "data" ? `data:${source.mimeType};base64,${source.value}` : source.value;

      const as = mapRoleToInputAs(image.metadata?.role);

      return {
        type: "image",
        source: { type: "url", url },
        ...(as ? { as } : {}),
      };
    });

    return { text: resolved.text, inputs };
  }

  private transformResponse(
    task: Awaited<ReturnType<MynthImage["generate"]>>,
    fallbackModel: string,
  ): ImageGenerationResult {
    const revisedPrompt = task.result?.magic_prompt?.positive;
    const images: Array<GeneratedImage> = task
      .getImages()
      .filter((img): img is typeof img & { url: string } => img.url !== null)
      .map((img) => ({
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
 *   adapter: mynth('krea/krea-2-large'),
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
 * @param model - The Mynth model name (e.g., 'krea/krea-2-large')
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
 *   adapter: mynthImage('krea/krea-2-large'),
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
