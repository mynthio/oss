/** Base URL for the Mynth API */
export const API_URL = "https://api.mynth.io";

/** Environment variable name for the API key */
export const API_KEY_ENV_VAR = "MYNTH_API_KEY";

/** Environment variable name for the default destination (by name/slug) */
export const DESTINATION_ENV_VAR = "MYNTH_DESTINATION";

export const GENERATE_IMAGE_PATH = "/image/generate";
export const UPLOAD_IMAGE_PATH = "/image/upload";
export const RATE_IMAGE_PATH = "/image/rate";
export const ALT_IMAGE_PATH = "/image/alt";
export const REVIEW_IMAGE_PATH = "/image/review";
export const GENERATE_VIDEO_PATH = "/video/generate";
export const ESTIMATE_VIDEO_PATH = "/video/generate/estimate";
export const MODELS_PATH = "/models";
export const TASK_PATH = "/tasks";
export const TASK_DETAILS_PATH = (id: string) => `${TASK_PATH}/${id}`;
export const TASK_RESULT_PATH = (id: string) => `${TASK_PATH}/${id}/result`;
export const TASK_STATUS_PATH = (id: string) => `${TASK_PATH}/${id}/status`;

/**
 * Model capabilities that affect available generation options.
 * - `negative_prompt`: Supports structured negative prompts
 * - `inputs`: Supports input images
 * - `4k`: Supports 4k resolution output
 * - `native_enhance_prompt`: Supports provider-native prompt enhancement
 */
export type ModelCapability = "inputs" | "negative_prompt" | "4k" | "native_enhance_prompt";

/**
 * Information about an available image generation model.
 */
export type AvailableModel = {
  /** Unique model identifier used in API requests */
  id: string;
  /** Human-readable display name */
  label: string;
  /** List of supported capabilities */
  capabilities: readonly ModelCapability[];
};

/**
 * List of all available image generation models with their capabilities.
 * Use this to build model selectors or validate model IDs.
 */
export const AVAILABLE_MODELS: readonly AvailableModel[] = [
  {
    id: "auto",
    label: "Auto",
    capabilities: [],
  },
  {
    id: "alibaba/qwen-image-2.0",
    label: "Qwen Image 2.0",
    capabilities: ["inputs", "native_enhance_prompt"],
  },
  {
    id: "alibaba/qwen-image-2.0-pro",
    label: "Qwen Image 2.0 Pro",
    capabilities: ["inputs", "native_enhance_prompt"],
  },
  {
    id: "alibaba/qwen-image-3.0",
    label: "Qwen Image 3.0",
    capabilities: ["inputs", "native_enhance_prompt"],
  },
  {
    id: "alibaba/qwen-image-3.0-pro",
    label: "Qwen Image 3.0 Pro",
    capabilities: ["inputs", "native_enhance_prompt"],
  },
  {
    id: "bytedance/seedream-5.0-lite",
    label: "Seedream 5.0 Lite",
    capabilities: ["inputs"],
  },
  {
    id: "bytedance/seedream-pro",
    label: "Seedream Pro",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.1-dev",
    label: "FLUX.1 Dev",
    capabilities: [],
  },
  {
    id: "black-forest-labs/flux-1-schnell",
    label: "FLUX.1 Schnell",
    capabilities: [],
  },
  {
    id: "tongyi-mai/z-image",
    label: "Z Image",
    capabilities: ["inputs"],
  },
  {
    id: "tongyi-mai/z-image-turbo",
    label: "Z Image Turbo",
    capabilities: [],
  },
  {
    id: "black-forest-labs/flux.2-dev",
    label: "FLUX.2 Dev",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.2-pro",
    label: "FLUX.2 Pro",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.2-flex",
    label: "FLUX.2 Flex",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.2-max",
    label: "FLUX.2 Max",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "FLUX.2 Klein 4B",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux-virtual-try-on",
    label: "FLUX Virtual Try-On",
    capabilities: ["inputs"],
  },
  {
    id: "bria/fibo-edit-1.5",
    label: "FIBO Edit 1.5",
    capabilities: ["inputs"],
  },
  {
    id: "bria/fibo-generate-1.5",
    label: "FIBO Generate 1.5",
    capabilities: [],
  },
  {
    id: "ideogram/remove-background",
    label: "Ideogram Remove Background",
    capabilities: ["inputs"],
  },
  {
    id: "john6666/bismuth-illustrious-mix",
    label: "Bismuth Illustrious Mix",
    capabilities: ["negative_prompt"],
  },
  {
    id: "maxfeifei8/one-obsession",
    label: "One obsession",
    capabilities: ["negative_prompt"],
  },
  {
    id: "klingai/kling-image-3.0",
    label: "Kling IMAGE 3.0",
    capabilities: ["inputs"],
  },
  {
    id: "klingai/kling-image-o3",
    label: "Kling IMAGE O3",
    capabilities: ["inputs", "4k"],
  },
  {
    id: "krea/krea-2-turbo",
    label: "Krea 2 Turbo",
    capabilities: ["inputs"],
  },
  {
    id: "krea/krea-2-medium",
    label: "Krea 2 Medium",
    capabilities: ["inputs"],
  },
  {
    id: "krea/krea-2-large",
    label: "Krea 2 Large",
    capabilities: ["inputs"],
  },
  {
    id: "luma/uni-1",
    label: "Luma UNI-1",
    capabilities: ["inputs"],
  },
  {
    id: "luma/uni-1-max",
    label: "Luma UNI-1 Max",
    capabilities: ["inputs"],
  },
  {
    id: "meta/muse-image",
    label: "Muse Image",
    capabilities: ["inputs"],
  },
  {
    id: "minimax/h3",
    label: "MiniMax H3",
    capabilities: ["inputs"],
  },
  {
    id: "purplesmartai/pony-diffusion-v6-xl",
    label: "Pony Diffusion V6 XL",
    capabilities: ["negative_prompt"],
  },
  {
    id: "recraft/recraft-v4",
    label: "Recraft V4",
    capabilities: [],
  },
  {
    id: "recraft/recraft-v4-pro",
    label: "Recraft V4 Pro",
    capabilities: [],
  },
  {
    id: "recraft/recraft-v4-style",
    label: "Recraft V4 Styles",
    capabilities: ["inputs"],
  },
  {
    id: "recraft/recraft-v4-style-pro",
    label: "Recraft V4 Styles Pro",
    capabilities: ["inputs"],
  },
  {
    id: "reve/reve",
    label: "Reve",
    capabilities: ["inputs"],
  },
  {
    id: "reve/reve-remix",
    label: "Reve Remix",
    capabilities: ["inputs"],
  },
  {
    id: "sourceful/riverflow-2.0-pro",
    label: "Riverflow 2.0 Pro",
    capabilities: ["inputs", "4k", "native_enhance_prompt"],
  },
  {
    id: "google/gemini-3.1-flash-lite-image",
    label: "Nano Banana 2 Lite",
    capabilities: ["inputs", "native_enhance_prompt"],
  },
  {
    id: "google/gemini-3.1-flash-image",
    label: "Nano Banana 2",
    capabilities: ["inputs", "4k", "native_enhance_prompt"],
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    capabilities: ["inputs", "4k", "native_enhance_prompt"],
  },
  {
    id: "imagineart/imagineart-1.5-pro",
    label: "ImagineArt 1.5 Pro",
    capabilities: ["4k"],
  },
  {
    id: "imagineart/imagineart-2.0",
    label: "ImagineArt 2.0",
    capabilities: ["inputs"],
  },
  {
    id: "openai/gpt-image-2",
    label: "GPT Image 2",
    capabilities: ["inputs"],
  },
  {
    id: "openai/gpt-image-2.5-flare",
    label: "GPT Image 2.5 Flare",
    capabilities: ["inputs"],
  },
  {
    id: "openai/gpt-image-2.5-sunburst",
    label: "GPT Image 2.5 Sunburst",
    capabilities: ["inputs"],
  },
  {
    id: "prunaai/p-image-try-on",
    label: "P-Image Try-On",
    capabilities: ["inputs"],
  },
  {
    id: "wan/wan2.6-image",
    label: "Wan 2.6 Image",
    capabilities: [],
  },
  {
    id: "wan/wan2.7-image",
    label: "Wan 2.7 Image",
    capabilities: ["inputs"],
  },
  {
    id: "wan/wan2.7-image-pro",
    label: "Wan 2.7 Image Pro",
    capabilities: ["inputs", "4k"],
  },
  {
    id: "xai/grok-imagine-image",
    label: "Grok Imagine Image",
    capabilities: ["inputs"],
  },
  {
    id: "xai/grok-imagine-image-2.0",
    label: "Grok Imagine Image 2.0",
    capabilities: ["inputs"],
  },
  {
    id: "xai/grok-imagine-image-quality",
    label: "Grok Imagine Image Quality",
    capabilities: ["inputs"],
  },
];

/**
 * Polling profile for video tasks.
 *
 * Video generation runs for minutes rather than seconds, so there is no fast
 * opening phase to spend requests on, the steady interval is longer, and the
 * wait budget is an hour instead of the 30 minutes image tasks get.
 */
export const VIDEO_POLLING = {
  timeoutMs: 60 * 60 * 1000,
  fastDurationMs: 0,
  intervalMs: 10_000,
} as const;

/**
 * Information about an available video generation model.
 *
 * Video models reject requests outside their declared resolution, duration and
 * audio support, so this metadata is what you validate a request against (or
 * build a model picker from) before spending a round trip.
 */
export type AvailableVideoModel = {
  /** Unique model identifier used in API requests */
  id: string;
  /** Human-readable display name */
  label: string;
  /** Resolution tiers the model accepts */
  resolutions: readonly VideoResolutionTier[];
  /** Tier used when the request omits `resolution` */
  defaultResolution: VideoResolutionTier;
  /** Accepted duration range in whole seconds, and the default */
  duration: { default: number; min: number; max: number };
  /** Whether the model can generate native audio */
  audio: boolean;
  /**
   * Input roles accepted for image-to-video.
   * Empty when the model is text-to-video only.
   */
  inputs: readonly VideoInputRole[];
  /** Maximum number of input images */
  maxInputs: number;
};

export type VideoResolutionTier = "480p" | "720p" | "1080p" | "4k";

export type VideoInputRole = "first_frame" | "last_frame" | "reference";

/**
 * List of all available video generation models with their capabilities.
 * Unlike images, video generation has no `auto` model: pick one explicitly.
 */
// ponytail: every current model takes a contiguous duration range. A model with
// a fixed set of durations needs a `values` field here and in the picker.
export const AVAILABLE_VIDEO_MODELS: readonly AvailableVideoModel[] = [
  {
    id: "bytedance/seedance-2.0-mini",
    label: "Seedance 2.0 Mini",
    resolutions: ["480p", "720p"],
    defaultResolution: "720p",
    duration: { default: 5, min: 4, max: 15 },
    audio: true,
    inputs: ["first_frame", "last_frame"],
    maxInputs: 2,
  },
  {
    id: "google/gemini-omni-flash-1.1",
    label: "Gemini Omni Flash 1.1",
    resolutions: ["720p", "1080p", "4k"],
    defaultResolution: "720p",
    duration: { default: 8, min: 3, max: 10 },
    audio: true,
    inputs: ["first_frame", "last_frame"],
    maxInputs: 2,
  },
  {
    id: "prunaai/p-video",
    label: "P-Video",
    resolutions: ["720p", "1080p"],
    defaultResolution: "720p",
    duration: { default: 5, min: 1, max: 10 },
    audio: true,
    inputs: ["first_frame"],
    maxInputs: 1,
  },
];
