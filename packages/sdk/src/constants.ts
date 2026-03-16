/** Base URL for the Mynth API */
export const API_URL = "https://api.mynth.io";

/** Environment variable name for the API key */
export const API_KEY_ENV_VAR = "MYNTH_API_KEY";

export const GENERATE_IMAGE_PATH = "/image/generate";
export const TASK_PATH = "/tasks";
export const TASK_DETAILS_PATH = (id: string) => `${TASK_PATH}/${id}`;
export const TASK_STATUS_PATH = (id: string) => `${TASK_PATH}/${id}/status`;

/**
 * Model capabilities that affect available generation options.
 * - `mynth_magic_prompt`: Supports Mynth-side prompt enhancement
 * - `enhance_prompt`: Supports provider-native prompt enhancement
 * - `inputs`: Supports reference/input images
 * - `custom_resolution`: Supports custom width/height requests
 * - `negative_prompt`: Supports negative prompts to exclude elements
 * - `cfg_scale`: Supports custom CFG scale
 * - `scheduler`: Supports custom scheduler selection
 * - `auto_size`: Supports provider-driven auto sizing
 * - `steps`: Supports custom inference step count
 */
export type ModelCapability =
  | "steps"
  | "inputs"
  | "custom_resolution"
  | "mynth_magic_prompt"
  | "enhance_prompt"
  | "negative_prompt"
  | "cfg_scale"
  | "scheduler"
  | "auto_size";

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
    capabilities: ["inputs", "enhance_prompt", "custom_resolution"],
  },
  {
    id: "alibaba/qwen-image-2.0-pro",
    label: "Qwen Image 2.0 Pro",
    capabilities: ["inputs", "enhance_prompt", "custom_resolution"],
  },
  {
    id: "bytedance/seedream-5.0-lite",
    label: "Seedream 5.0 Lite",
    capabilities: ["inputs"],
  },
  {
    id: "black-forest-labs/flux.1-dev",
    label: "FLUX.1 Dev",
    capabilities: ["steps", "mynth_magic_prompt"],
  },
  {
    id: "black-forest-labs/flux-1-schnell",
    label: "FLUX.1 Schnell",
    capabilities: ["steps", "mynth_magic_prompt"],
  },
  {
    id: "tongyi-mai/z-image-turbo",
    label: "Z Image Turbo",
    capabilities: ["steps", "mynth_magic_prompt"],
  },
  {
    id: "black-forest-labs/flux.2-dev",
    label: "FLUX.2 Dev",
    capabilities: ["mynth_magic_prompt"],
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "FLUX.2 Klein 4B",
    capabilities: ["inputs"],
  },
  {
    id: "john6666/bismuth-illustrious-mix",
    label: "Bismuth Illustrious Mix",
    capabilities: ["steps", "negative_prompt", "cfg_scale", "scheduler", "mynth_magic_prompt"],
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
    id: "google/gemini-3.1-flash-image",
    label: "Nano Banana 2",
    capabilities: ["inputs", "enhance_prompt", "auto_size"],
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    capabilities: ["enhance_prompt"],
  },
  {
    id: "wan/wan2.6-image",
    label: "Wan 2.6 Image",
    capabilities: [],
  },
  {
    id: "xai/grok-imagine-image",
    label: "Grok Imagine Image",
    capabilities: ["auto_size"],
  },
];
