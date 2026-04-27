import type { MynthSDKTypes } from "@mynthio/sdk";

/**
 * All Mynth image model IDs as a const array.
 *
 * Keeping this as a runtime array makes it easy for apps to build selectors
 * while `satisfies` ensures every exported model ID remains valid for the SDK.
 */
export const MYNTH_IMAGE_MODELS = [
  "auto",
  "alibaba/qwen-image-2.0",
  "alibaba/qwen-image-2.0-pro",
  "bytedance/seedream-5.0-lite",
  "black-forest-labs/flux.1-dev",
  "black-forest-labs/flux-1-schnell",
  "tongyi-mai/z-image-turbo",
  "black-forest-labs/flux.2-dev",
  "black-forest-labs/flux.2-pro",
  "black-forest-labs/flux.2-flex",
  "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-klein-4b",
  "john6666/bismuth-illustrious-mix",
  "purplesmartai/pony-diffusion-v6-xl",
  "recraft/recraft-v4",
  "recraft/recraft-v4-pro",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image-preview",
  "imagineart/imagineart-1.5-pro",
  "openai/gpt-image-2",
  "wan/wan2.6-image",
  "xai/grok-imagine-image",
] as const satisfies ReadonlyArray<MynthSDKTypes.ImageGenerationModel>;

/**
 * Union of all Mynth image model IDs.
 */
export type MynthImageModel = (typeof MYNTH_IMAGE_MODELS)[number];
