/** A capability that changes which options a model accepts. */
export type MynthImageModelCapability =
  /** Takes image inputs: image-to-image, reference-guided, edit. */
  | "inputs"
  /** Takes a native negative prompt. */
  | "negative_prompt"
  /** Can output at 4k scale (`_4k` presets and `scale: "4k"`). */
  | "4k";

/** What the adapter knows about one Mynth image model. */
export interface MynthImageModelMeta {
  /** Display name, as Mynth's model catalog shows it. */
  readonly label: string;
  readonly capabilities: ReadonlyArray<MynthImageModelCapability>;
}

/**
 * Every Mynth image model this package version knows, with its display name
 * and capabilities. The model lists and the per-model option types are all
 * derived from this table, so a new model is one entry here.
 *
 * `pnpm check:models` compares it with the live catalog at
 * `GET https://api.mynth.io/models`.
 */
export const MYNTH_IMAGE_MODEL_META = {
  auto: { label: "Auto", capabilities: [] },
  "alibaba/qwen-image-2.0": { label: "Qwen Image 2.0", capabilities: ["inputs"] },
  "alibaba/qwen-image-2.0-pro": { label: "Qwen Image 2.0 Pro", capabilities: ["inputs"] },
  "alibaba/qwen-image-2.1-pro": { label: "Qwen Image 2.1 Pro", capabilities: ["inputs"] },
  "alibaba/qwen-image-3.0": { label: "Qwen Image 3.0", capabilities: ["inputs"] },
  "alibaba/qwen-image-3.0-pro": { label: "Qwen Image 3.0 Pro", capabilities: ["inputs"] },
  "bytedance/seedream-5.0-lite": { label: "Seedream 5.0 Lite", capabilities: ["inputs"] },
  "bytedance/seedream-pro": { label: "Seedream Pro", capabilities: ["inputs"] },
  "bytedance/seedream-v5-flash": { label: "Seedream 5.0 Flash", capabilities: ["inputs"] },
  "black-forest-labs/flux.1-dev": { label: "FLUX.1 Dev", capabilities: [] },
  "black-forest-labs/flux-1-schnell": { label: "FLUX.1 Schnell", capabilities: [] },
  "tongyi-mai/z-image": { label: "Z-Image", capabilities: ["inputs"] },
  "tongyi-mai/z-image-turbo": { label: "Z-Image Turbo", capabilities: [] },
  "black-forest-labs/flux.2-dev": { label: "FLUX.2 Dev", capabilities: ["inputs"] },
  "black-forest-labs/flux.2-pro": { label: "FLUX.2 Pro", capabilities: ["inputs"] },
  "black-forest-labs/flux.2-flex": { label: "FLUX.2 Flex", capabilities: ["inputs"] },
  "black-forest-labs/flux.2-max": { label: "FLUX.2 Max", capabilities: ["inputs"] },
  "black-forest-labs/flux.2-klein-4b": { label: "FLUX.2 Klein", capabilities: ["inputs"] },
  "black-forest-labs/flux-3": { label: "FLUX.3", capabilities: ["inputs", "4k"] },
  "black-forest-labs/flux-3-klein": { label: "FLUX.3 Klein", capabilities: ["inputs", "4k"] },
  "bria/fibo-edit-1.5": { label: "FIBO Edit 1.5", capabilities: ["inputs"] },
  "bria/fibo-generate-1.5": { label: "FIBO Generate 1.5", capabilities: [] },
  "circlestone-labs/anima": { label: "Anima", capabilities: ["inputs"] },
  "goofy-ai/prefect-pony-xl-lora": { label: "Prefect Pony XL LoRA", capabilities: [] },
  "john6666/bismuth-illustrious-mix": {
    label: "Bismuth Illustrious Mix",
    capabilities: ["negative_prompt"],
  },
  "maxfeifei8/one-obsession": { label: "One obsession", capabilities: ["negative_prompt"] },
  "klingai/kling-image-3.0": { label: "Kling IMAGE 3.0", capabilities: ["inputs"] },
  "klingai/kling-image-o3": { label: "Kling IMAGE O3", capabilities: ["inputs", "4k"] },
  "krea/krea-2-turbo": { label: "Krea 2 Turbo", capabilities: ["inputs"] },
  "krea/krea-2-medium": { label: "Krea 2 Medium", capabilities: ["inputs"] },
  "krea/krea-2-large": { label: "Krea 2 Large", capabilities: ["inputs"] },
  "luma/uni-1": { label: "Luma UNI-1", capabilities: ["inputs"] },
  "luma/uni-1-max": { label: "Luma UNI-1 Max", capabilities: ["inputs"] },
  "meta/muse-image": { label: "Muse Image", capabilities: ["inputs"] },
  "microsoft/mai-image-2.6": { label: "MAI Image 2.6", capabilities: ["inputs"] },
  "microsoft/mai-image-2.6-flash": { label: "MAI Image 2.6 Flash", capabilities: ["inputs"] },
  "minimax/h3": { label: "MiniMax H3", capabilities: ["inputs"] },
  "purplesmartai/pony-diffusion-v6-xl": {
    label: "Pony Diffusion V6 XL",
    capabilities: ["negative_prompt"],
  },
  "recraft/recraft-v4": { label: "Recraft V4", capabilities: [] },
  "recraft/recraft-v4.1-flash": { label: "Recraft V4.1 Flash", capabilities: [] },
  "recraft/recraft-v4-pro": { label: "Recraft V4 Pro", capabilities: [] },
  "reve/reve": { label: "Reve", capabilities: ["inputs"] },
  "reve/reve-remix": { label: "Reve Remix", capabilities: ["inputs"] },
  "sourceful/riverflow-2.0-pro": { label: "Riverflow 2.0 Pro", capabilities: ["inputs", "4k"] },
  "google/gemini-3.1-flash-lite-image": {
    label: "Gemini 3.1 Flash-Lite Image",
    capabilities: ["inputs"],
  },
  "google/gemini-3.1-flash-image": {
    label: "Gemini 3.1 Flash Image",
    capabilities: ["inputs", "4k"],
  },
  "google/gemini-3-pro-image-preview": {
    label: "Gemini 3 Pro Image Preview",
    capabilities: ["inputs", "4k"],
  },
  "google/gemini-nano-banana-2.1": {
    label: "Gemini Nano Banana 2.1",
    capabilities: ["inputs", "4k"],
  },
  "imagineart/imagineart-1.5-pro": { label: "ImagineArt 1.5 Pro", capabilities: ["4k"] },
  "imagineart/imagineart-2.0": { label: "ImagineArt 2.0", capabilities: ["inputs"] },
  "ideogram/ideogram-4.5": { label: "Ideogram 4.5", capabilities: ["inputs"] },
  "openai/gpt-image-2": { label: "GPT Image 2", capabilities: ["inputs"] },
  "openai/gpt-image-2.5-flare": { label: "GPT Image 2.5 Flare", capabilities: ["inputs"] },
  "openai/gpt-image-2.5-sunburst": { label: "GPT Image 2.5 Sunburst", capabilities: ["inputs"] },
  "wan/wan2.6-image": { label: "Wan 2.6", capabilities: [] },
  "wan/wan2.7-image": { label: "Wan 2.7 Image", capabilities: ["inputs"] },
  "wan/wan2.7-image-pro": { label: "Wan 2.7 Image Pro", capabilities: ["inputs", "4k"] },
  "xai/grok-imagine-image": { label: "Grok Imagine Image", capabilities: ["inputs"] },
  "xai/grok-imagine-image-2.0": { label: "Grok Imagine Image 2.0", capabilities: ["inputs"] },
  "xai/grok-imagine-image-quality": {
    label: "Grok Imagine Image Quality",
    capabilities: ["inputs"],
  },
} as const;

type ModelMetaTable = typeof MYNTH_IMAGE_MODEL_META;

/** Union of all Mynth image model IDs. */
export type MynthImageModel = keyof ModelMetaTable;

type ModelWith<TCapability extends MynthImageModelCapability> = {
  [K in MynthImageModel]: TCapability extends ModelMetaTable[K]["capabilities"][number] ? K : never;
}[MynthImageModel];

/** Union of Mynth image model IDs that accept image inputs. */
export type MynthImageInputModel = ModelWith<"inputs">;

/** Union of Mynth image model IDs that take a native negative prompt. */
export type MynthImageNegativePromptModel = ModelWith<"negative_prompt">;

/** Union of Mynth image model IDs that can output at 4k scale. */
export type MynthImage4kModel = ModelWith<"4k">;

/** True when `model` is a Mynth image model ID this package knows. */
export function isMynthImageModel(model: unknown): model is MynthImageModel {
  return typeof model === "string" && Object.hasOwn(MYNTH_IMAGE_MODEL_META, model);
}

/** True when the model has the capability. */
export function hasMynthImageCapability<TCapability extends MynthImageModelCapability>(
  model: MynthImageModel,
  capability: TCapability,
): model is ModelWith<TCapability> {
  // Also the compile-time check that every table entry lists known capabilities.
  const capabilities: ReadonlyArray<MynthImageModelCapability> =
    MYNTH_IMAGE_MODEL_META[model].capabilities;
  return capabilities.includes(capability);
}

/**
 * All Mynth image model IDs, `auto` first. Handy for model pickers and for
 * validating IDs that arrive in a request.
 */
export const MYNTH_IMAGE_MODELS: ReadonlyArray<MynthImageModel> =
  Object.keys(MYNTH_IMAGE_MODEL_META).filter(isMynthImageModel);

/**
 * Models that accept image inputs. Image content parts in the TanStack
 * `prompt` compile only for these, and become Mynth `inputs`.
 */
export const MYNTH_IMAGE_INPUT_MODELS: ReadonlyArray<MynthImageInputModel> =
  MYNTH_IMAGE_MODELS.filter((model) => hasMynthImageCapability(model, "inputs"));

/**
 * Models that take a native negative prompt. Other models only use a
 * negative prompt to steer magic prompt.
 */
export const MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS: ReadonlyArray<MynthImageNegativePromptModel> =
  MYNTH_IMAGE_MODELS.filter((model) => hasMynthImageCapability(model, "negative_prompt"));

/** Models that can output at 4k scale (`_4k` size presets and `scale: "4k"`). */
export const MYNTH_IMAGE_4K_MODELS: ReadonlyArray<MynthImage4kModel> = MYNTH_IMAGE_MODELS.filter(
  (model) => hasMynthImageCapability(model, "4k"),
);
