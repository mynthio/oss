import type { MynthSDKTypes } from "@mynthio/sdk";
import type {
  MynthImage4kModel,
  MynthImageInputModel,
  MynthImageModel,
  MynthImageNegativePromptModel,
} from "./model-meta.ts";

// ============================================================================
// Size Types
// ============================================================================

type Mynth4kSizePreset = Extract<MynthSDKTypes.ImageGenerationRequestSizePreset, `${string}_4k`>;

/**
 * Mynth size values that fit TanStack's top-level string size API.
 * Structured size objects remain available through modelOptions.size.
 */
export type MynthImageShorthandSize = "auto" | MynthSDKTypes.ImageGenerationRequestSizePreset;

/**
 * Shorthand sizes for models without 4k output: every preset except `_4k`.
 */
export type MynthImageBaseShorthandSize = Exclude<MynthImageShorthandSize, Mynth4kSizePreset>;

/**
 * Structured sizes for models without 4k output: no `_4k` presets and no
 * `scale: "4k"`.
 */
export type MynthImageBaseSize =
  | MynthImageBaseShorthandSize
  | MynthSDKTypes.ImageGenerationRequestSizeAuto
  | (Omit<MynthSDKTypes.ImageGenerationRequestSizeAspectRatio, "scale"> & { scale?: "base" });

// ============================================================================
// Provider Options
// ============================================================================

/**
 * Mynth-specific options every model accepts. Shared TanStack fields such as
 * prompt, numberOfImages and shorthand size stay at the top level.
 */
export interface MynthImageCommonOptions {
  /** Enable Mynth-side prompt enhancement. The enhanced prompt comes back as `revisedPrompt`. */
  magicPrompt?: boolean;
  /** Output format and quality */
  output?: MynthSDKTypes.ImageGenerationRequestOutput;
  /** Public Access Token response configuration */
  access?: MynthSDKTypes.ImageGenerationRequestAccess;
  /** Webhook configuration */
  webhook?: MynthSDKTypes.ImageGenerationRequestWebhook;
  /** Image rating configuration */
  rating?: MynthSDKTypes.ImageGenerationRequestRating;
  /** Custom metadata */
  metadata?: Record<string, unknown>;
  /** Destination name (slug) for delivering this generation. Overrides any adapter-level or env default. */
  destination?: string;
}

/**
 * Image inputs for models that accept them, in addition to the prompt's image
 * parts. Entries can be URLs, `Blob`/`File` values (uploaded before the
 * request), or structured inputs with an explicit `as` role.
 */
export interface MynthImageInputOptions {
  inputs?: NonNullable<MynthSDKTypes.ImageGenerationClientRequest["inputs"]>;
}

/**
 * Negative prompt for models that take one natively. `auto` accepts it too
 * and also uses it to pick a model.
 */
export interface MynthImageNativeNegativePromptOptions {
  /** Negative prompt sent as `negative_prompt` to the Mynth API. */
  negativePrompt?: string;
}

/**
 * Models without a native negative prompt only use one to steer magic prompt,
 * so `negativePrompt` requires `magicPrompt: true`.
 */
export type MynthImageMagicNegativePromptOptions =
  | { negativePrompt?: never }
  | {
      magicPrompt: true;
      /** Negative prompt that magic prompt steers the enhanced prompt away from. */
      negativePrompt?: string;
    };

/**
 * Mynth provider options for one model. Options the model cannot use are
 * compile-time errors: image inputs on text-only models, 4k sizes on models
 * without 4k output, and a negative prompt without magic prompt on models
 * that have no native negative prompt.
 */
export type MynthImageProviderOptionsFor<TModel extends MynthImageModel> =
  MynthImageCommonOptions & {
    /** Size config (presets, aspect ratio, auto). Overrides the top-level `size`. */
    size?: TModel extends MynthImage4kModel
      ? MynthSDKTypes.ImageGenerationRequestSize
      : MynthImageBaseSize;
  } & (TModel extends MynthImageInputModel ? MynthImageInputOptions : unknown) &
    (TModel extends MynthImageNegativePromptModel | "auto"
      ? MynthImageNativeNegativePromptOptions
      : MynthImageMagicNegativePromptOptions);

/**
 * Every Mynth provider option, as the adapter receives them at runtime. Use
 * {@link MynthImageProviderOptionsFor} for the options a given model accepts.
 */
export interface MynthImageProviderOptions
  extends MynthImageCommonOptions, MynthImageInputOptions, MynthImageNativeNegativePromptOptions {
  /** Size config (presets, aspect ratio, auto). Overrides the top-level `size`. */
  size?: MynthSDKTypes.ImageGenerationRequestSize;
}

// ============================================================================
// TanStack Type Maps
// ============================================================================

/**
 * Type-only map from model name to the provider options it accepts.
 */
export type MynthImageModelProviderOptionsByName = {
  [K in MynthImageModel]: MynthImageProviderOptionsFor<K>;
};

/**
 * Type-only map from model name to its top-level shorthand sizes.
 * Use modelOptions.size for structured request sizes.
 */
export type MynthImageModelSizeByName = {
  [K in MynthImageModel]: K extends MynthImage4kModel
    ? MynthImageShorthandSize
    : MynthImageBaseShorthandSize;
};

/**
 * Type-only map from model name to the non-text prompt modalities it accepts.
 *
 * Models that support image inputs accept `"image"` content parts in the
 * TanStack `prompt` (image-to-image, reference-guided, edit); the
 * adapter maps those parts onto Mynth's `inputs`. Text-only models map to an
 * empty tuple so passing image parts fails at compile time.
 */
export type MynthImageModelInputModalitiesByName = {
  [K in MynthImageModel]: K extends MynthImageInputModel ? readonly ["image"] : readonly [];
};
