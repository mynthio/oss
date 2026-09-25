// tests/model-meta.test.ts checks every list below against the SDK's AVAILABLE_MODELS.

/**
 * All Mynth image model IDs as a const array.
 *
 * Keeping this as a runtime array makes it easy for apps to build selectors.
 */
export const MYNTH_IMAGE_MODELS = [
  "auto",
  "alibaba/qwen-image-2.0",
  "alibaba/qwen-image-2.0-pro",
  "alibaba/qwen-image-3.0",
  "alibaba/qwen-image-3.0-pro",
  "bytedance/seedream-5.0-lite",
  "bytedance/seedream-pro",
  "bytedance/seedream-v5-flash",
  "black-forest-labs/flux.1-dev",
  "black-forest-labs/flux-1-schnell",
  "tongyi-mai/z-image",
  "tongyi-mai/z-image-turbo",
  "black-forest-labs/flux.2-dev",
  "black-forest-labs/flux.2-pro",
  "black-forest-labs/flux.2-flex",
  "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-klein-4b",
  "bria/fibo-edit-1.5",
  "bria/fibo-generate-1.5",
  "circlestone-labs/anima",
  "john6666/bismuth-illustrious-mix",
  "maxfeifei8/one-obsession",
  "klingai/kling-image-3.0",
  "klingai/kling-image-o3",
  "krea/krea-2-turbo",
  "krea/krea-2-medium",
  "krea/krea-2-large",
  "luma/uni-1",
  "luma/uni-1-max",
  "meta/muse-image",
  "microsoft/mai-image-2.6",
  "microsoft/mai-image-2.6-flash",
  "minimax/h3",
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
  "openai/gpt-image-2.5-flare",
  "openai/gpt-image-2.5-sunburst",
  "wan/wan2.6-image",
  "wan/wan2.7-image",
  "wan/wan2.7-image-pro",
  "xai/grok-imagine-image",
  "xai/grok-imagine-image-2.0",
  "xai/grok-imagine-image-quality",
] as const;

/**
 * Union of all Mynth image model IDs.
 */
export type MynthImageModel = (typeof MYNTH_IMAGE_MODELS)[number];

/**
 * Mynth image models that accept image inputs (image-to-image,
 * reference-guided, edit). These are the models for which TanStack AI
 * allows passing image content parts in the `prompt`; the adapter maps those
 * parts onto Mynth's `inputs`. Mirrors the `inputs` capability in the SDK's
 * `AVAILABLE_MODELS`.
 */
export const MYNTH_IMAGE_INPUT_MODELS = [
  "alibaba/qwen-image-2.0",
  "alibaba/qwen-image-2.0-pro",
  "alibaba/qwen-image-3.0",
  "alibaba/qwen-image-3.0-pro",
  "bytedance/seedream-5.0-lite",
  "bytedance/seedream-pro",
  "bytedance/seedream-v5-flash",
  "tongyi-mai/z-image",
  "black-forest-labs/flux.2-dev",
  "black-forest-labs/flux.2-pro",
  "black-forest-labs/flux.2-flex",
  "black-forest-labs/flux.2-max",
  "black-forest-labs/flux.2-klein-4b",
  "bria/fibo-edit-1.5",
  "circlestone-labs/anima",
  "klingai/kling-image-3.0",
  "klingai/kling-image-o3",
  "krea/krea-2-turbo",
  "krea/krea-2-medium",
  "krea/krea-2-large",
  "luma/uni-1",
  "luma/uni-1-max",
  "meta/muse-image",
  "microsoft/mai-image-2.6",
  "microsoft/mai-image-2.6-flash",
  "minimax/h3",
  "reve/reve",
  "reve/reve-remix",
  "sourceful/riverflow-2.0-pro",
  "google/gemini-3.1-flash-lite-image",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image-preview",
  "imagineart/imagineart-2.0",
  "openai/gpt-image-2",
  "openai/gpt-image-2.5-flare",
  "openai/gpt-image-2.5-sunburst",
  "wan/wan2.7-image",
  "wan/wan2.7-image-pro",
  "xai/grok-imagine-image",
  "xai/grok-imagine-image-2.0",
  "xai/grok-imagine-image-quality",
] as const;

/**
 * Union of Mynth image model IDs that accept image inputs.
 */
export type MynthImageInputModel = (typeof MYNTH_IMAGE_INPUT_MODELS)[number];

/**
 * Mynth image models that take a native negative prompt. Other models only use
 * a negative prompt to steer magic prompt. Mirrors the `negative_prompt`
 * capability in the SDK's `AVAILABLE_MODELS`.
 */
export const MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS = [
  "john6666/bismuth-illustrious-mix",
  "maxfeifei8/one-obsession",
  "purplesmartai/pony-diffusion-v6-xl",
] as const;

/**
 * Union of Mynth image model IDs that take a native negative prompt.
 */
export type MynthImageNegativePromptModel = (typeof MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS)[number];

/**
 * Mynth image models that can output at 4k scale (`_4k` size presets and
 * `scale: "4k"`). Mirrors the `4k` capability in the SDK's `AVAILABLE_MODELS`.
 */
export const MYNTH_IMAGE_4K_MODELS = [
  "klingai/kling-image-o3",
  "sourceful/riverflow-2.0-pro",
  "google/gemini-3.1-flash-image",
  "google/gemini-3-pro-image-preview",
  "imagineart/imagineart-1.5-pro",
  "wan/wan2.7-image-pro",
] as const;

/**
 * Union of Mynth image model IDs that can output at 4k scale.
 */
export type MynthImage4kModel = (typeof MYNTH_IMAGE_4K_MODELS)[number];
