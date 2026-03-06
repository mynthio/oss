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
 * - `magic_prompt`: Supports automatic prompt enhancement
 * - `negative_prompt`: Supports negative prompts to exclude elements
 * - `steps`: Supports custom inference step count
 */
export type ModelCapability = "magic_prompt" | "negative_prompt" | "steps";

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
    id: "bytedance/seedream-5.0-lite",
    label: "Seedream 5.0 Lite",
    capabilities: [],
  },
  {
    id: "black-forest-labs/flux.1-dev",
    label: "FLUX.1 Dev",
    capabilities: ["magic_prompt", "steps"],
  },
  {
    id: "black-forest-labs/flux-1-schnell",
    label: "FLUX.1 Schnell",
    capabilities: ["magic_prompt"],
  },
  {
    id: "tongyi-mai/z-image-turbo",
    label: "Z Image Turbo",
    capabilities: ["magic_prompt", "steps"],
  },
  {
    id: "black-forest-labs/flux.2-dev",
    label: "FLUX.2 Dev",
    capabilities: ["magic_prompt", "steps"],
  },
  {
    id: "black-forest-labs/flux.2-klein-4b",
    label: "FLUX.2 Klein 4B",
    capabilities: [],
  },
  {
    id: "john6666/bismuth-illustrious-mix",
    label: "Bismuth Illustrious Mix",
    capabilities: ["magic_prompt", "negative_prompt", "steps"],
  },
  {
    id: "google/gemini-3.1-flash-image",
    label: "Nano Banana 2",
    capabilities: [],
  },
  {
    id: "google/gemini-3-pro-image-preview",
    label: "Nano Banana Pro",
    capabilities: [],
  },
  {
    id: "wan/wan2.6-image",
    label: "Wan 2.6 Image",
    capabilities: [],
  },
  {
    id: "xai/grok-imagine-image",
    label: "Grok Imagine Image",
    capabilities: [],
  },
];
