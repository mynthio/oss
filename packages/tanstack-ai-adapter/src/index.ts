// ============================================================================
// Image Adapter
// ============================================================================

export { createMynthImage, mynthImage, MynthImageAdapter } from "./adapter.ts";
export type { MynthImageProvider } from "./adapter.ts";

// ============================================================================
// Files Adapter
// ============================================================================

export { mynthFiles, MynthFilesAdapter } from "./files.ts";

// ============================================================================
// Errors
// ============================================================================

export {
  MynthAPIError,
  MynthError,
  MynthNoImagesError,
  MynthResponseError,
  MynthTaskFailedError,
  MynthTaskTimeoutError,
} from "./errors.ts";
export type { MynthAPIErrorIssue } from "./errors.ts";
export type { MynthTaskErrorEntry } from "./api.ts";

// ============================================================================
// Model Metadata
// ============================================================================

export {
  hasMynthImageCapability,
  isMynthImageModel,
  MYNTH_IMAGE_4K_MODELS,
  MYNTH_IMAGE_INPUT_MODELS,
  MYNTH_IMAGE_MODEL_META,
  MYNTH_IMAGE_MODELS,
  MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS,
} from "./model-meta.ts";
export type {
  MynthImage4kModel,
  MynthImageInputModel,
  MynthImageModel,
  MynthImageModelCapability,
  MynthImageModelMeta,
  MynthImageNegativePromptModel,
} from "./model-meta.ts";

// ============================================================================
// Provider Types
// ============================================================================

export type {
  MynthImageBaseShorthandSize,
  MynthImageBaseSize,
  MynthImageCommonOptions,
  MynthImageInputOptions,
  MynthImageMagicNegativePromptOptions,
  MynthImageModelInputModalitiesByName,
  MynthImageModelProviderOptionsByName,
  MynthImageModelSizeByName,
  MynthImageNativeNegativePromptOptions,
  MynthImageProviderOptions,
  MynthImageProviderOptionsFor,
  MynthImageShorthandSize,
} from "./provider-options.ts";
export type {
  MynthImageAspectRatio,
  MynthImageAspectRatioSize,
  MynthImageAutoSize,
  MynthImageInput,
  MynthImageInputRole,
  MynthImageOutput,
  MynthImageRating,
  MynthImageRatingLevel,
  MynthImageSize,
  MynthImageSizePreset,
  MynthImageWebhook,
} from "./api.ts";

// ============================================================================
// Configuration
// ============================================================================

export type { MynthClientConfig, MynthFilesConfig, MynthImageConfig } from "./config.ts";
