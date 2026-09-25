import type { MynthSDKTypes } from "@mynthio/sdk";
import { MynthImage } from "@mynthio/sdk";
import type {
  ContentPartSource,
  GeneratedImage,
  ImageGenerationOptions,
  ImageGenerationResult,
  MediaInputRole,
  MediaPrompt,
  TokenUsage,
} from "@tanstack/ai";
import { fileReferenceFor, resolveMediaPrompt } from "@tanstack/ai";
import { BaseImageAdapter, normalizeFileUploadInput } from "@tanstack/ai/adapters";
import { toRunErrorPayload } from "@tanstack/ai/adapter-internals";

import { MynthNoImagesError } from "./errors.ts";
import type { MynthImageModel } from "./model-meta.ts";
import type {
  MynthImageModelInputModalitiesByName,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "./provider-options.ts";
import type { MynthImageConfig } from "./types.ts";

type MynthImageClientInput = MynthSDKTypes.ImageGenerationClientInput;
type MynthImageTask = Awaited<ReturnType<MynthImage["generate"]>>;

/**
 * Map a TanStack media-input role onto a Mynth image input role (`as`).
 *
 * Reference-like roles map to Mynth's `"reference"` guidance role, and a part
 * without a role is left for Mynth to route. Mynth has no mask, control or
 * frame inputs, so those roles are rejected rather than sent as plain images.
 */
function mapRoleToInputAs(
  role: MediaInputRole | undefined,
): MynthSDKTypes.ImageGenerationRequestInputAs | undefined {
  switch (role) {
    case undefined:
      return undefined;
    case "reference":
    case "character":
      return "reference";
    default:
      throw new Error(
        `Mynth does not support "${role}" image inputs. ` +
          `Use the "reference" or "character" role, or no role for a source image.`,
      );
  }
}

/**
 * Turn a TanStack content source into a Mynth input source. The Mynth API
 * only fetches http(s) URLs, so inline bytes go up as a file that the SDK
 * uploads before creating the task.
 */
function toInputSource(source: ContentPartSource): MynthImageClientInput["source"] {
  switch (source.type) {
    case "url":
      return { type: "url", url: source.value };
    case "data":
      return {
        type: "file",
        file: normalizeFileUploadInput({ data: source.value, mimeType: source.mimeType }).blob,
      };
    case "file":
      // A Mynth handle is an uploaded image URL; throws for other providers' handles.
      return { type: "url", url: fileReferenceFor(source, "mynth") };
  }
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
  /** Consumes image URLs uploaded with `mynthFiles()`. */
  override readonly supportsFileSources: boolean = true;

  private readonly client: MynthImage;

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
    const { logger, abortSignal } = options;

    try {
      const request = this.buildRequest(options);

      logger.request(
        `activity=image provider=${this.name} model=${this.model} count=${request.count ?? 1} inputs=${request.inputs?.length ?? 0}`,
        { provider: this.name, model: this.model },
      );

      const task = await this.client.generate(request, { signal: abortSignal });

      return this.transformResponse(task);
    } catch (error) {
      logger.errors(`${this.name}.generateImages fatal`, {
        error: toRunErrorPayload(error, `${this.name}.generateImages failed`),
        source: `${this.name}.generateImages`,
      });
      throw error;
    }
  }

  private buildRequest(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>,
  ): MynthSDKTypes.ImageGenerationClientRequest {
    const { prompt, numberOfImages, size, modelOptions = {} } = options;
    const { text, inputs: promptInputs } = this.resolvePrompt(prompt);

    // Prompt image parts come first to preserve prompt order, then the
    // provider-specific `modelOptions.inputs`.
    const inputs = [...promptInputs, ...(modelOptions.inputs ?? [])];
    const requestSize = modelOptions.size ?? size;

    return {
      prompt: text,
      // TanStack adapters are model-bound; provider options cannot override it.
      model: this.model,
      ...(numberOfImages !== undefined ? { count: numberOfImages } : {}),
      ...(requestSize !== undefined ? { size: requestSize } : {}),
      ...(inputs.length > 0 ? { inputs } : {}),
      ...(modelOptions.negativePrompt !== undefined
        ? { negative_prompt: modelOptions.negativePrompt }
        : {}),
      ...(modelOptions.magicPrompt !== undefined ? { magic_prompt: modelOptions.magicPrompt } : {}),
      ...(modelOptions.output !== undefined ? { output: modelOptions.output } : {}),
      ...(modelOptions.access !== undefined ? { access: modelOptions.access } : {}),
      ...(modelOptions.webhook !== undefined ? { webhook: modelOptions.webhook } : {}),
      ...(modelOptions.rating !== undefined ? { rating: modelOptions.rating } : {}),
      ...(modelOptions.metadata !== undefined ? { metadata: modelOptions.metadata } : {}),
      ...(modelOptions.destination !== undefined ? { destination: modelOptions.destination } : {}),
    };
  }

  /**
   * Normalize a TanStack media prompt into Mynth's request shape.
   *
   * A plain string prompt yields just the text. An array prompt is decomposed
   * into its verbatim text and image content parts; each image part becomes a
   * Mynth `inputs` entry with a role derived from the part's `metadata.role`.
   * Mynth image generation takes no video or audio, so those parts throw.
   */
  private resolvePrompt(prompt: MediaPrompt): {
    text: string;
    inputs: MynthImageClientInput[];
  } {
    const resolved = resolveMediaPrompt(prompt);

    if (resolved.videos.length > 0 || resolved.audios.length > 0) {
      throw new Error(
        `Mynth image generation accepts only text and image prompt parts (model ${this.model}).`,
      );
    }

    const inputs = resolved.images.map((image): MynthImageClientInput => {
      const as = mapRoleToInputAs(image.metadata?.role);
      const source = toInputSource(image.source);

      return as === undefined ? { type: "image", source } : { type: "image", as, source };
    });

    return { text: resolved.text, inputs };
  }

  private transformResponse(task: MynthImageTask): ImageGenerationResult {
    const succeeded = task.getImages();

    if (succeeded.length === 0) {
      const errors = task
        .getImages({ includeFailed: true })
        .flatMap((image) => (image.status === "failed" ? [image.error] : []));

      throw new MynthNoImagesError(task.id, errors);
    }

    const revisedPrompt = task.result?.magic_prompt?.positive;
    const images: Array<GeneratedImage> = succeeded.map((image) => ({
      // `url` is the destination URL, or null when a destination upload
      // failed or has no public URL; the Mynth CDN copy is always there.
      url: image.url ?? image.mynth_url,
      ...(revisedPrompt ? { revisedPrompt } : {}),
    }));

    return {
      id: task.id,
      model: task.result?.model ?? this.model,
      images,
      usage: this.buildUsage(task, images.length),
    };
  }

  /**
   * Mynth bills per generated image and reports the task's total cost in USD.
   * Image generation has no tokens, so the token fields are zero.
   */
  private buildUsage(task: MynthImageTask, imageCount: number): TokenUsage {
    const cost = task.data.cost === null ? undefined : Number(task.data.cost);

    return {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      billed: { quantity: imageCount, unit: "images" },
      ...(cost !== undefined && Number.isFinite(cost) ? { cost } : {}),
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
