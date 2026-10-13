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

import {
  type ImageGenerationRequest,
  type MynthImageInput,
  type MynthImageInputRole,
  parseTaskCreated,
} from "./api.ts";
import { MynthClient } from "./client.ts";
import { type MynthImageConfig, resolveClientConfig, resolveDestination } from "./config.ts";
import { MynthNoImagesError, MynthTaskFailedError } from "./errors.ts";
import type { MynthImageModel } from "./model-meta.ts";
import type {
  MynthImageModelInputModalitiesByName,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "./provider-options.ts";
import type { SettledImageGenerationTask } from "./task.ts";
import { waitForImageGenerationTask } from "./task.ts";
import { resolveImageInputs } from "./uploads.ts";

const GENERATE_PATH = "/image/generate";

/**
 * Map a TanStack media-input role onto a Mynth input role (`as`).
 *
 * Reference-like roles map to Mynth's `"reference"` guidance role, and a part
 * without a role is left for Mynth to route. Mynth has no mask, control or
 * frame inputs, so those roles are rejected rather than sent as plain images.
 */
function toInputRole(role: MediaInputRole | undefined): MynthImageInputRole | undefined {
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
 * only fetches http(s) URLs, so inline bytes go up as a file first.
 */
function toInputSource(
  source: ContentPartSource,
): { type: "url"; url: string } | { type: "file"; file: Blob } {
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
 * TanStack AI binds an adapter instance to a single model. The adapter
 * creates a Mynth image generation task, uploads any local input images
 * first, waits for the task to settle, and returns TanStack's normalized
 * image result.
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

  private readonly client: MynthClient;
  private readonly destination: string | undefined;

  /**
   * @throws {Error} When no API key is passed and `MYNTH_API_KEY` is unset
   */
  constructor(config: MynthImageConfig, model: TModel) {
    super(model);

    this.client = new MynthClient(resolveClientConfig(config));
    this.destination = resolveDestination(config);
  }

  override async generateImages(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageModelSizeByName[TModel]>,
  ): Promise<ImageGenerationResult> {
    const { logger, abortSignal: signal } = options;

    try {
      const { inputs, ...request } = this.buildRequest(options);

      logger.request(
        `activity=image provider=${this.name} model=${this.model} count=${request.count ?? 1} inputs=${inputs.length}`,
        { provider: this.name, model: this.model },
      );

      const body: ImageGenerationRequest = {
        ...request,
        ...(inputs.length > 0
          ? { inputs: await resolveImageInputs(this.client, inputs, { signal }) }
          : {}),
      };
      const { taskId } = parseTaskCreated(
        await this.client.postJson(GENERATE_PATH, body, { signal }),
      );

      const task = await waitForImageGenerationTask(this.client, taskId, {
        signal,
        onStatus: (status) =>
          logger.provider(`provider=${this.name} task=${taskId} status=${status}`, {
            taskId,
            status,
          }),
      });

      return this.transformResponse(task);
    } catch (error) {
      // A timeout or a cancelled request is not a Mynth failure; TanStack AI
      // reports it as an abort.
      if (!signal?.aborted) {
        // Narrow before logging: never hand a raw error to user loggers.
        logger.errors(`${this.name}.generateImages fatal`, {
          error: toRunErrorPayload(error, `${this.name}.generateImages failed`),
          source: `${this.name}.generateImages`,
        });
      }
      throw error;
    }
  }

  /** Map TanStack's options onto the Mynth request, inputs kept apart for upload. */
  private buildRequest(
    options: ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>,
  ): Omit<ImageGenerationRequest, "inputs"> & { inputs: MynthImageInput[] } {
    const { prompt, numberOfImages, size, modelOptions = {} } = options;
    const { text, inputs: promptInputs } = this.resolvePrompt(prompt);
    const requestSize = modelOptions.size ?? size;
    const destination = modelOptions.destination ?? this.destination;

    return {
      prompt: text,
      // TanStack adapters are model-bound; provider options cannot override it.
      model: this.model,
      // Prompt image parts come first to keep prompt order, then `modelOptions.inputs`.
      inputs: [...promptInputs, ...(modelOptions.inputs ?? [])],
      ...(numberOfImages !== undefined ? { count: numberOfImages } : {}),
      ...(requestSize !== undefined ? { size: requestSize } : {}),
      ...(modelOptions.negativePrompt !== undefined
        ? { negative_prompt: modelOptions.negativePrompt }
        : {}),
      ...(modelOptions.magicPrompt !== undefined ? { magic_prompt: modelOptions.magicPrompt } : {}),
      ...(modelOptions.output !== undefined ? { output: modelOptions.output } : {}),
      ...(modelOptions.generatePublicAccessToken !== undefined
        ? { generate_public_access_token: modelOptions.generatePublicAccessToken }
        : {}),
      ...(modelOptions.webhook !== undefined ? { webhook: modelOptions.webhook } : {}),
      ...(modelOptions.rating !== undefined ? { rating: modelOptions.rating } : {}),
      ...(modelOptions.metadata !== undefined ? { metadata: modelOptions.metadata } : {}),
      ...(destination !== undefined ? { destination } : {}),
    };
  }

  /**
   * Split a TanStack media prompt into its verbatim text and its image parts.
   * Each image part becomes a Mynth input with a role from `metadata.role`.
   * Mynth image generation takes no video or audio, so those parts throw.
   */
  private resolvePrompt(prompt: MediaPrompt): { text: string; inputs: MynthImageInput[] } {
    const resolved = resolveMediaPrompt(prompt);

    if (resolved.videos.length > 0 || resolved.audios.length > 0) {
      throw new Error(
        `Mynth image generation accepts only text and image prompt parts (model ${this.model}).`,
      );
    }

    const inputs = resolved.images.map((image): MynthImageInput => {
      const as = toInputRole(image.metadata?.role);
      const source = toInputSource(image.source);

      return as === undefined ? { type: "image", source } : { type: "image", as, source };
    });

    return { text: resolved.text, inputs };
  }

  private transformResponse(task: SettledImageGenerationTask): ImageGenerationResult {
    if (task.status === "failed") {
      throw new MynthTaskFailedError(task.id, task.errors);
    }

    if (task.images.length === 0) {
      throw new MynthNoImagesError(task.id, task.failures);
    }

    const { revisedPrompt } = task;
    const images = task.images.map((image): GeneratedImage => ({
      // `url` is the destination URL, or null when a destination upload
      // failed or has no public URL; the Mynth CDN copy is always there.
      url: image.url ?? image.mynthUrl,
      ...(revisedPrompt ? { revisedPrompt } : {}),
    }));

    return {
      id: task.id,
      model: task.model,
      images,
      usage: buildUsage(task.cost, images.length),
    };
  }
}

/**
 * Mynth bills per generated image and reports the task's total cost in USD.
 * Image generation has no tokens, so the token fields are zero.
 */
function buildUsage(cost: string, imageCount: number): TokenUsage {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    billed: { quantity: imageCount, unit: "images" },
    cost: Number(cost),
  };
}

/**
 * Creates a reusable Mynth image provider.
 *
 * The returned function creates model-bound adapters and can still accept
 * per-call config overrides when needed.
 *
 * @param config - Optional shared configuration for all created adapters.
 * If apiKey is omitted, the adapters read MYNTH_API_KEY.
 * @returns Provider function that creates configured Mynth image adapters
 *
 * @example
 * ```typescript
 * import { generateImage } from '@tanstack/ai'
 * import { createMynthImage } from '@mynthio/tanstack-ai-adapter'
 *
 * const mynth = createMynthImage({
 *   apiKey: 'mak_...',
 *   baseURL: 'https://api.mynth.io',
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

/**
 * Creates a Mynth image adapter directly.
 *
 * This is the ergonomic shorthand for `createMynthImage()(model, config)`.
 *
 * @param model - The Mynth model name (e.g., 'krea/krea-2-large')
 * @param config - Optional adapter configuration, including apiKey overrides.
 * If apiKey is omitted, the adapter reads MYNTH_API_KEY.
 * @returns Configured Mynth image adapter instance
 * @throws Error if no apiKey is passed and MYNTH_API_KEY is not set
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
  config: MynthImageConfig = {},
): MynthImageAdapter<TModel> {
  return new MynthImageAdapter(config, model);
}
