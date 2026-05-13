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

/**
 * Backward-compatible structured prompt shape.
 *
 * Mynth's current API accepts `prompt`, `negative_prompt`, and
 * `magic_prompt`. The adapter still accepts this shape and expands it into
 * those request fields.
 */
export interface MynthImagePromptStructured {
  positive: string;
  negative?: string;
  enhance?: boolean | "prefer_magic";
}

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
  /** Structured prompt with negative/enhance. Prefer `negativePrompt` and `magicPrompt` for new code. */
  promptStructured?: MynthImagePromptStructured;
  /** Negative prompt sent as `negative_prompt` to the Mynth API. */
  negativePrompt?: string;
  /** Enable Mynth-side prompt enhancement. */
  magicPrompt?: true;
  /** Public Access Token response configuration */
  access?: MynthSDKTypes.ImageGenerationRequestAccess;
  /** Image inputs (reference, init, context) */
  inputs?: (string | MynthSDKTypes.ImageGenerationRequestInput)[];
  /** Size config (presets, aspect ratio, auto) */
  size?: MynthSDKTypes.ImageGenerationRequestSize;
  /** Webhook configuration */
  webhook?: MynthSDKTypes.ImageGenerationRequestWebhook;
  /** Image rating configuration */
  rating?: MynthSDKTypes.ImageGenerationRequestRating;
  /** Deprecated alias for `rating`. */
  contentRating?: MynthSDKTypes.ImageGenerationRequestRating;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Destination name (slug) for delivering this generation. Overrides any adapter-level or env default. */
  destination?: string;
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
