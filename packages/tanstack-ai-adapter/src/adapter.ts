import { BaseImageAdapter } from "@tanstack/ai/adapters"
import Mynth from "@mynthio/sdk"
import type { MynthSDKTypes } from "@mynthio/sdk"
import type {
  ImageGenerationOptions,
  ImageGenerationResult,
  GeneratedImage,
} from "@tanstack/ai"
import type { MynthImageModel } from "./model-meta"
import type {
  MynthImageProviderOptions,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
} from "./provider-options"
import type { MynthImageConfig } from "./types"

/**
 * Mynth Image Generation Adapter for TanStack AI.
 *
 * Bridges TanStack AI's ImageAdapter interface with Mynth's
 * async job-based image generation API, internally handling
 * the create-task -> poll -> return-results lifecycle via the Mynth SDK.
 */
export class MynthImageAdapter<
  TModel extends MynthImageModel,
> extends BaseImageAdapter<
  TModel,
  MynthImageProviderOptions,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName
> {
  readonly name = "mynth" as const

  private client: Mynth

  constructor(config: MynthImageConfig, model: TModel) {
    super({}, model)
    this.client = new Mynth({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl,
    })
  }

  override async generateImages(
    options: ImageGenerationOptions<MynthImageProviderOptions>,
  ): Promise<ImageGenerationResult> {
    const request = this.buildRequest(options)
    const task = await this.client.generate(request)

    const successImages = task.getImages()
    const revisedPrompt = task.result?.prompt_enhance?.positive

    const images: Array<GeneratedImage> = successImages.map((img) => {
      const image: GeneratedImage = { url: img.url }
      if (revisedPrompt) {
        image.revisedPrompt = revisedPrompt
      }
      return image
    })

    return {
      id: task.id,
      model: task.result?.model ?? options.model,
      images,
    }
  }

  private buildRequest(
    options: ImageGenerationOptions<MynthImageProviderOptions>,
  ): MynthSDKTypes.ImageGenerationRequest {
    const { prompt, numberOfImages, size, modelOptions } = options

    const request: MynthSDKTypes.ImageGenerationRequest = {
      prompt: modelOptions?.promptStructured ?? prompt,
      model: (modelOptions?.model ?? this.model) as MynthSDKTypes.ImageGenerationModel,
    }

    if (numberOfImages !== undefined) {
      request.count = numberOfImages
    }

    // Use size from modelOptions (supports Mynth-specific formats) or from TanStack's size param
    if (modelOptions?.size !== undefined) {
      request.size = modelOptions.size
    } else if (size !== undefined) {
      request.size = size as MynthSDKTypes.ImageGenerationRequestSize
    }

    if (modelOptions?.output !== undefined) {
      request.output = modelOptions.output
    }

    if (modelOptions?.inputs !== undefined) {
      request.inputs = modelOptions.inputs
    }

    if (modelOptions?.webhook !== undefined) {
      request.webhook = modelOptions.webhook
    }

    if (modelOptions?.contentRating !== undefined) {
      request.content_rating = modelOptions.contentRating
    }

    if (modelOptions?.metadata !== undefined) {
      request.metadata = modelOptions.metadata
    }

    return request
  }
}

/**
 * Creates a Mynth image adapter with an explicit API key.
 *
 * @param model - The Mynth model name (e.g., 'black-forest-labs/flux.2-dev')
 * @param apiKey - Your Mynth API key
 * @param config - Optional additional configuration
 * @returns Configured Mynth image adapter instance
 *
 * @example
 * ```typescript
 * import { generateImage } from '@tanstack/ai'
 * import { createMynthImage } from '@mynthio/tanstack-ai-adapter'
 *
 * const result = await generateImage({
 *   adapter: createMynthImage('black-forest-labs/flux.2-dev', 'mak_...'),
 *   prompt: 'A serene mountain landscape at sunset',
 * })
 *
 * console.log(result.images[0].url)
 * ```
 */
export function createMynthImage<TModel extends MynthImageModel>(
  model: TModel,
  apiKey: string,
  config?: Omit<MynthImageConfig, "apiKey">,
): MynthImageAdapter<TModel> {
  return new MynthImageAdapter({ apiKey, ...config }, model)
}

/**
 * Creates a Mynth image adapter with automatic API key detection
 * from the MYNTH_API_KEY environment variable.
 *
 * @param model - The Mynth model name (e.g., 'black-forest-labs/flux.2-dev')
 * @param config - Optional configuration (excluding apiKey which is auto-detected)
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
  config?: Omit<MynthImageConfig, "apiKey">,
): MynthImageAdapter<TModel> {
  return new MynthImageAdapter({ ...config }, model)
}
