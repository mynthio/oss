/**
 * Type definitions for the Mynth SDK.
 * Import as `import type { MynthSDKTypes } from "@mynthio/sdk"`.
 */
export namespace MynthSDKTypes {
  /** Status of a generation task */
  export type TaskStatus = "pending" | "completed" | "failed";

  /** Type of task (currently only "image" is supported) */
  export type TaskType = "image";

  /** Full task data returned from the API */
  export type TaskData = {
    /** Unique task identifier */
    id: string;
    /** Current status of the task */
    status: TaskStatus;
    /** Type of task */
    type: TaskType;
    /** ID of the API key used (null for public access) */
    apiKeyId: string | null;
    /** ID of the user who created the task */
    userId: string;
    /** Total cost in string format (null if not yet calculated) */
    cost: string | null;
    /** Generation result (null if not completed) */
    result: ImageResult | null;
    /** Original generation request (null if not available) */
    request: ImageGenerationRequest;
    /** ISO 8601 timestamp of creation */
    createdAt: string;
    /** ISO 8601 timestamp of last update */
    updatedAt: string;
  };

  /** Available model identifiers */
  export type ImageGenerationModelId =
    | "alibaba/qwen-image-2.0"
    | "alibaba/qwen-image-2.0-pro"
    | "bytedance/seedream-5.0-lite"
    | "black-forest-labs/flux.1-dev"
    | "black-forest-labs/flux-1-schnell"
    | "black-forest-labs/flux.2-dev"
    | "black-forest-labs/flux.2-pro"
    | "black-forest-labs/flux.2-flex"
    | "black-forest-labs/flux.2-max"
    | "black-forest-labs/flux.2-klein-4b"
    | "google/gemini-3.1-flash-image"
    | "google/gemini-3-pro-image-preview"
    | "tongyi-mai/z-image-turbo"
    | "john6666/bismuth-illustrious-mix"
    | "purplesmartai/pony-diffusion-v6-xl"
    | "recraft/recraft-v4"
    | "recraft/recraft-v4-pro"
    | "wan/wan2.6-image"
    | "xai/grok-imagine-image";

  /** Model to use for generation ("auto" lets the system choose) */
  export type ImageGenerationModel = ImageGenerationModelId | "auto";

  /** Prompt enhancement mode for structured prompts */
  export type ImageGenerationRequestEnhance = false | "prefer_magic" | "prefer_native";

  /** Structured prompt with positive and optional negative text */
  export type PromptStructured = {
    /** Main prompt describing what to generate */
    positive: string;
    /** Elements to exclude from the generation */
    negative?: string;
    /** Prompt enhancement mode */
    enhance: ImageGenerationRequestEnhance;
  };

  export type GenerateImageOptionsIn = {
    prompt: string | PromptStructured;
  };

  export type GenerateImageOptions = {
    prompt: PromptStructured;
  };

  /**
   * Prompt input for image generation.
   * Can be a simple string or structured with positive/negative prompts.
   */
  export type ImageGenerationRequestPrompt = GenerateImageOptionsIn["prompt"];

  /** Output image format */
  export type ImageGenerationRequestOutputFormat = "png" | "jpg" | "webp";

  /** Output configuration for generated images */
  export type ImageGenerationRequestOutput = {
    /** Image format (default: "webp") */
    format?: ImageGenerationRequestOutputFormat;
    /** Quality 0-100 (default: 80) */
    quality?: number;
  };

  /** Custom webhook endpoint configuration */
  export type ImageGenerationRequestCustomWebhook = {
    /** URL to receive webhook notifications */
    url: string;
  };

  /** Public Access Token configuration */
  export type ImageGenerationRequestAccessPat = {
    /** Include a short-lived Public Access Token in the create-task response */
    enabled?: boolean;
  };

  /** Access-token configuration returned from the create-task response */
  export type ImageGenerationRequestAccess = {
    /** Controls whether the response includes a task-scoped Public Access Token */
    pat: ImageGenerationRequestAccessPat;
  };

  /** Webhook configuration */
  export type ImageGenerationRequestWebhook = {
    /** Enable/disable webhooks (disabling overrides dashboard settings) */
    enabled?: boolean;
    /** Additional custom webhook endpoints */
    custom?: ImageGenerationRequestCustomWebhook[];
  };

  /** Custom content rating level definition */
  export type ImageGenerationRequestContentRatingLevel<T extends string = string> = {
    /** Level identifier returned in the result */
    value: T;
    /** Human-readable description for the AI classifier */
    description: string;
  };

  /** Content rating configuration */
  export type ImageGenerationRequestContentRating = {
    /** Enable content rating classification */
    enabled?: boolean;
    /** Custom rating levels (uses default sfw/nsfw if not provided) */
    levels?: readonly ImageGenerationRequestContentRatingLevel[];
  };

  /** Available shorthand size presets */
  export type ImageGenerationRequestSizePreset =
    | "square"
    | "portrait"
    | "landscape"
    | "portrait_tall"
    | "landscape_wide"
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9"
    | "2:1"
    | "1:2"
    | "1:1_4k"
    | "2:3_4k"
    | "3:2_4k"
    | "3:4_4k"
    | "4:3_4k"
    | "4:5_4k"
    | "5:4_4k"
    | "9:16_4k"
    | "16:9_4k"
    | "21:9_4k"
    | "2:1_4k"
    | "1:2_4k";

  /** Optional 4k scale for aspect ratio size mode */
  export type ImageGenerationRequestSizeScale = "4k";

  /** Supported aspect ratio strings */
  export type ImageGenerationRequestAspectRatio =
    | "1:1"
    | "2:3"
    | "3:2"
    | "3:4"
    | "4:3"
    | "4:5"
    | "5:4"
    | "9:16"
    | "16:9"
    | "21:9"
    | "2:1"
    | "1:2";

  /** Structured aspect ratio size configuration */
  export type ImageGenerationRequestSizeAspectRatio = {
    type: "aspect_ratio";
    aspectRatio: ImageGenerationRequestAspectRatio;
    scale?: ImageGenerationRequestSizeScale;
  };

  /** Structured auto size configuration */
  export type ImageGenerationRequestSizeAuto = {
    type: "auto";
    prefer: "mynth" | "native";
  };

  /** Image input source */
  export type ImageGenerationRequestInputSource = {
    type: "url";
    url: string;
  };

  /** Supported input roles */
  export type ImageGenerationRequestInputRole = "context" | "init" | "reference";

  /** Structured image input */
  export type ImageGenerationRequestInput = {
    type: "image";
    role: ImageGenerationRequestInputRole;
    source: ImageGenerationRequestInputSource;
  };

  /**
   * Image size specification.
   * Can be a preset name, auto, or structured aspect-ratio size object with optional 4k scale.
   */
  export type ImageGenerationRequestSize =
    | ImageGenerationRequestSizePreset
    | ImageGenerationRequestSizeAspectRatio
    | ImageGenerationRequestSizeAuto
    | "auto";

  /**
   * Image generation request parameters.
   */
  export type ImageGenerationRequest = {
    /** Text prompt or structured prompt object */
    prompt: ImageGenerationRequestPrompt;
    /** Model to use (default: "auto") */
    model?: ImageGenerationModel;
    /** Image size/dimensions (default: "auto") */
    size?: ImageGenerationRequestSize;
    /** Number of images to generate (default: 1) */
    count?: number;
    /** Output format and quality settings */
    output?: ImageGenerationRequestOutput;
    /** Webhook notification settings */
    webhook?: ImageGenerationRequestWebhook;
    /** Content rating classification settings */
    content_rating?: ImageGenerationRequestContentRating;
    /** Public Access Token response configuration */
    access?: ImageGenerationRequestAccess;
    /** Optional input images as URL shortcuts or structured objects */
    inputs?: (string | ImageGenerationRequestInput)[];
    /** Custom metadata to attach (returned in results and webhooks). Max 2KB. */
    metadata?: Record<string, unknown>;
  };

  /** Default content rating levels */
  export type ImageResultContentRatingDefaultLevel = "sfw" | "nsfw";

  /** Content rating result */
  export type ImageResultContentRating =
    | {
        mode: "default";
        level: ImageResultContentRatingDefaultLevel;
      }
    | {
        mode: "custom";
        level: string;
      };

  /** Successfully generated image */
  export type ImageResultImageSuccess = {
    status: "succeeded";
    /** Image ID */
    id: string;
    /** CDN URL of the generated image */
    url: string;
    /** Resolved output image size (for example: "1024x1024") */
    size?: string;
    /** Cost for this image in string format */
    cost: string;
    /** Content rating if classification was enabled */
    content_rating?: ImageResultContentRating;
  };

  /** Failed image generation */
  export type ImageResultImageFailure = {
    status: "failed";
    /** Error message describing the failure */
    error: string;
  };

  /** Individual image result (success or failure) */
  export type ImageResultImage = ImageResultImageSuccess | ImageResultImageFailure;

  /** Cost breakdown for the generation */
  export type ImageResultCost = {
    /** Cost of image generation */
    images: string;
    /** Total task cost */
    total: string;
    /** Reserved for future prompt-enhancement pricing metadata */
    magic_prompt?: string;
  };

  /** Auto size resolution info (when size was determined automatically) */
  export type ImageResultSizeAuto = {
    /** Source that determined the size */
    source: "native" | "mynth";
    /** Resolved size value (e.g. "1024x1024") */
    value?: string;
  };

  /** Prompt enhancement info (when prompt was enhanced) */
  export type ImageResultPromptEnhance = {
    /** Source that performed the enhancement */
    source: "native" | "mynth";
    /** Enhanced positive prompt */
    positive?: string;
    /** Enhanced negative prompt */
    negative?: string;
  };

  /** Complete generation result */
  export type ImageResult = {
    /** Array of generated images (may include failures) */
    images: ImageResultImage[];
    /** Cost breakdown */
    cost: ImageResultCost;
    /** Model that was used */
    model: ImageGenerationModelId;
    /** Auto size resolution info (present when size was determined automatically) */
    size_auto?: ImageResultSizeAuto;
    /** Prompt enhancement info (present when prompt was enhanced) */
    prompt_enhance?: ImageResultPromptEnhance;
  };

  /**
   * Webhook payload for task completion
   */
  export type WebhookTaskImageCompletedPayload = {
    task: { id: string };
    event: "task.image.completed";
    result: ImageResult;
    request: ImageGenerationRequest;
  };

  /**
   * Webhook payload for task failure
   */
  export type WebhookTaskImageFailedPayload = {
    task: { id: string };
    event: "task.image.failed";
    request: ImageGenerationRequest;
  };

  /**
   * Webhook payload union
   */
  export type WebhookPayload = WebhookTaskImageCompletedPayload | WebhookTaskImageFailedPayload;
}
