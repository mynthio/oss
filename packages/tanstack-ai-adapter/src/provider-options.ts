import type { MynthSDKTypes } from "@mynthio/sdk";
import type { MynthImageModel } from "./model-meta";

// ============================================================================
// Size Types
// ============================================================================

/**
 * Mynth size values that fit TanStack's top-level string size API.
 * Structured size objects remain available through modelOptions.size.
 */
export type MynthImageShorthandSize = "auto" | MynthSDKTypes.ImageGenerationRequestSizePreset;

// ============================================================================
// Provider Options
// ============================================================================

/**
 * Mynth-specific provider options for image generation.
 * These map to Mynth API request fields beyond what TanStack's
 * ImageGenerationOptions covers. Keep this focused on options that are truly
 * provider-specific; shared TanStack fields such as prompt, numberOfImages,
 * and shorthand size stay at the top level.
 */
export interface MynthImageProviderOptions {
  /** Output format and quality */
  output?: MynthSDKTypes.ImageGenerationRequestOutput;
  /** Structured prompt with negative/enhance */
  promptStructured?: MynthSDKTypes.PromptStructured;
  /** Public Access Token response configuration */
  access?: MynthSDKTypes.ImageGenerationRequestAccess;
  /** Image inputs (reference, init, context) */
  inputs?: (string | MynthSDKTypes.ImageGenerationRequestInput)[];
  /** Size config (presets, aspect ratio, auto) */
  size?: MynthSDKTypes.ImageGenerationRequestSize;
  /** Webhook configuration */
  webhook?: MynthSDKTypes.ImageGenerationRequestWebhook;
  /** Content rating configuration */
  contentRating?: MynthSDKTypes.ImageGenerationRequestContentRating;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ============================================================================
// TanStack Type Maps
// ============================================================================

/**
 * Type-only map from model name to its specific provider options.
 * All Mynth models share the same options since Mynth normalizes internally.
 */
export type MynthImageModelProviderOptionsByName = {
  [K in MynthImageModel]: MynthImageProviderOptions;
};

/**
 * Type-only map from model name to its supported size type.
 * Top-level TanStack size is limited to shorthand string values.
 * Use modelOptions.size for structured request sizes.
 */
export type MynthImageModelSizeByName = {
  [K in MynthImageModel]: MynthImageShorthandSize;
};
