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
  "bytedance/seedream-pro",
  "black-forest-labs/flux.1-dev",
  "black-forest-labs/flux-1-schnell",
  "tongyi-mai/z-image",
  "tongyi-mai/z-image-turbo",
  "black-forest-labs/flux.2-dev",
  "black-forest-labs/flux.2-pro",
  "black-forest-labs/flux.2-flex",
  "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-klein-4b",
  "black-forest-labs/flux-virtual-try-on",
  "ideogram/remove-background",
  "john6666/bismuth-illustrious-mix",
  "maxfeifei8/one-obsession",
  "klingai/kling-image-3.0",
  "klingai/kling-image-o3",
  "krea/krea-2-turbo",
  "krea/krea-2-medium",
  "krea/krea-2-large",
  "luma/uni-1",
  "luma/uni-1-max",
  "purplesmartai/pony-diffusion-v6-xl",
  "recraft/recraft-v4",
  "recraft/recraft-v4-pro",
  "reve/reve",
  "reve/reve-remix",
  "sourceful/riverflow-2.0-pro",
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image-preview",
  "imagineart/imagineart-1.5-pro",
  "imagineart/imagineart-2.0",
  "openai/gpt-image-2",
  "prunaai/p-image-try-on",
  "wan/wan2.6-image",
  "wan/wan2.7-image",
  "wan/wan2.7-image-pro",
  "xai/grok-imagine-image",
  "xai/grok-imagine-image-quality",
] as const satisfies ReadonlyArray<MynthSDKTypes.ImageGenerationModel>;

/**
 * Union of all Mynth image model IDs.
 */
export type MynthImageModel = (typeof MYNTH_IMAGE_MODELS)[number];

/**
 * Mynth image models that accept image inputs (image-to-image,
 * reference-guided, edit, try-on). These are the models for which TanStack AI
 * allows passing image content parts in the `prompt`; the adapter maps those
 * parts onto Mynth's `inputs`. Mirrors the `inputs` capability in the SDK's
 * `AVAILABLE_MODELS`.
 */
export const MYNTH_IMAGE_INPUT_MODELS = [
  "alibaba/qwen-image-2.0",
  "alibaba/qwen-image-2.0-pro",
  "bytedance/seedream-5.0-lite",
  "bytedance/seedream-pro",
  "tongyi-mai/z-image",
  "black-forest-labs/flux.2-dev",
  "black-forest-labs/flux.2-pro",
  "black-forest-labs/flux.2-flex",
  "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-klein-4b",
  "black-forest-labs/flux-virtual-try-on",
  "ideogram/remove-background",
  "klingai/kling-image-3.0",
  "klingai/kling-image-o3",
  "krea/krea-2-turbo",
  "krea/krea-2-medium",
  "krea/krea-2-large",
  "luma/uni-1",
  "luma/uni-1-max",
  "reve/reve",
  "reve/reve-remix",
  "sourceful/riverflow-2.0-pro",
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image-preview",
  "imagineart/imagineart-2.0",
  "openai/gpt-image-2",
  "prunaai/p-image-try-on",
  "wan/wan2.7-image",
  "wan/wan2.7-image-pro",
  "xai/grok-imagine-image",
  "xai/grok-imagine-image-quality",
] as const satisfies ReadonlyArray<MynthImageModel>;

/**
 * Union of Mynth image model IDs that accept image inputs.
 */
export type MynthImageInputModel = (typeof MYNTH_IMAGE_INPUT_MODELS)[number];
