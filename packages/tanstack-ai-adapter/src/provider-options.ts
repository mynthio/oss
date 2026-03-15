import type { MynthSDKTypes } from "@mynthio/sdk"
import type { MynthImageModel } from "./model-meta"

/**
 * Mynth-specific provider options for image generation.
 * These map to Mynth API request fields beyond what TanStack's
 * ImageGenerationOptions covers.
 */
export interface MynthImageProviderOptions {
  /** Model selection: specific ID or "auto" */
  model?: MynthSDKTypes.ImageGenerationModel
  /** Output format and quality */
  output?: MynthSDKTypes.ImageGenerationRequestOutput
  /** Structured prompt with negative/enhance */
  promptStructured?: MynthSDKTypes.PromptStructured
  /** Image inputs (reference, init, context) */
  inputs?: (string | MynthSDKTypes.ImageGenerationRequestInput)[]
  /** Size config (presets, aspect ratio, auto) */
  size?: MynthSDKTypes.ImageGenerationRequestSize
  /** Webhook configuration */
  webhook?: MynthSDKTypes.ImageGenerationRequestWebhook
  /** Content rating configuration */
  contentRating?: MynthSDKTypes.ImageGenerationRequestContentRating
  /** Custom metadata */
  metadata?: Record<string, unknown>
}

/**
 * Type-only map from model name to its specific provider options.
 * All Mynth models share the same options since Mynth normalizes internally.
 */
export type MynthImageModelProviderOptionsByName = {
  [K in MynthImageModel]: MynthImageProviderOptions
}

/**
 * Type-only map from model name to its supported size type.
 * Mynth handles size resolution server-side, so all models accept string.
 */
export type MynthImageModelSizeByName = {
  [K in MynthImageModel]: string
}
