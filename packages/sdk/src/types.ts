/**
 * Type definitions for the Mynth SDK.
 * Import as `import type { MynthSDKTypes } from "@mynthio/sdk"`.
 */
export namespace MynthSDKTypes {
  export type ApiResponse<DataT> = {
    data: DataT;
  };

  export type TaskStatus = "pending" | "completed" | "failed";

  export type TaskType = "image.generate" | "image.rate" | "image.alt";

  export type TaskBase = {
    id: string;
    status: TaskStatus;
    apiKeyId: string | null;
    userId: string;
    cost: string | null;
    createdAt: string;
    updatedAt: string;
    errors?: TaskError[];
  };

  export type TaskError = {
    code: string;
  };

  export type TaskData =
    | (TaskBase & {
        type: "image.generate";
        request: ImageGenerationRequest;
        result: ImageResult | null;
      })
    | (TaskBase & {
        type: "image.rate";
        request: ImageRateRequest;
        result: ImageRateTaskResult | null;
      })
    | (TaskBase & {
        type: "image.alt";
        request: ImageAltRequest;
        result: ImageAltTaskResult | null;
      });

  export type ImageGenerationTaskData = Extract<TaskData, { type: "image.generate" }>;
  export type ImageRateTaskData = Extract<TaskData, { type: "image.rate" }>;
  export type ImageAltTaskData = Extract<TaskData, { type: "image.alt" }>;

  // ============================================================
  // Models
  // ============================================================

  export type ModelPricing = {
    perImage: {
      base: string;
      "4k"?: string;
    };
    perInput?: string;
  };

  export type Model = {
    id: string;
    displayName: string | null;
    pricing: ModelPricing | null;
  };

  export type ModelsListResponse = ApiResponse<Model[]>;

  export type ImageGenerationModelId =
    | "alibaba/qwen-image-2.0"
    | "alibaba/qwen-image-2.0-pro"
    | "bytedance/seedream-5.0-lite"
    | "bytedance/seedream-pro"
    | "black-forest-labs/flux.1-dev"
    | "black-forest-labs/flux-1-schnell"
    | "black-forest-labs/flux.2-dev"
    | "black-forest-labs/flux.2-pro"
    | "black-forest-labs/flux.2-flex"
    | "black-forest-labs/flux.2-max"
    | "black-forest-labs/flux.2-klein-4b"
    | "black-forest-labs/flux-virtual-try-on"
    | "google/gemini-3.1-flash-lite-image"
    | "google/gemini-3.1-flash-image"
    | "google/gemini-3-pro-image-preview"
    | "ideogram/remove-background"
    | "imagineart/imagineart-1.5-pro"
    | "imagineart/imagineart-2.0"
    | "klingai/kling-image-3.0"
    | "klingai/kling-image-o3"
    | "krea/krea-2-turbo"
    | "krea/krea-2-medium"
    | "krea/krea-2-large"
    | "luma/uni-1"
    | "luma/uni-1-max"
    | "openai/gpt-image-2"
    | "prunaai/p-image-try-on"
    | "tongyi-mai/z-image"
    | "tongyi-mai/z-image-turbo"
    | "john6666/bismuth-illustrious-mix"
    | "maxfeifei8/one-obsession"
    | "purplesmartai/pony-diffusion-v6-xl"
    | "recraft/recraft-v4"
    | "recraft/recraft-v4-pro"
    | "reve/reve"
    | "reve/reve-remix"
    | "sourceful/riverflow-2.0-pro"
    | "wan/wan2.6-image"
    | "wan/wan2.7-image"
    | "wan/wan2.7-image-pro"
    | "xai/grok-imagine-image"
    | "xai/grok-imagine-image-quality";

  export type ImageGenerationModel = ImageGenerationModelId | "auto";

  export type GenerateImageOptionsIn = {
    prompt: string;
  };

  export type GenerateImageOptions = {
    prompt: string;
  };

  export type ImageGenerationRequestPrompt = GenerateImageOptionsIn["prompt"];

  export type ImageGenerationRequestOutputFormat = "png" | "jpg" | "webp";

  export type ImageGenerationRequestOutput = {
    format: ImageGenerationRequestOutputFormat;
    /** Output quality 1-100. Defaults to 80 when output is omitted. */
    quality: number;
  };

  export type ImageGenerationRequestCustomWebhook = {
    url: string;
  }[];

  export type ImageGenerationRequestAccessPat = {
    enabled?: boolean;
  };

  export type ImageGenerationRequestAccess = {
    pat: ImageGenerationRequestAccessPat;
  };

  export type ImageGenerationRequestWebhook = {
    dashboard?: false;
    custom?: ImageGenerationRequestCustomWebhook;
  };

  export type ImageGenerationRequestRatingLevel<T extends string = string> = {
    value: T;
    description: string;
  };

  export type ImageGenerationRequestRating =
    | true
    | ImageRateRequestRatingDefault
    | {
        mode: "custom";
        levels: readonly ImageGenerationRequestRatingLevel[];
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

  export type ImageGenerationRequestSizeScale = "base" | "4k";

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
  };

  // ============================================================
  // Image Upload
  // ============================================================

  export type ImageUploadInput = Blob | File;

  export type ImageUploadResponse = {
    urls: string[];
  };

  /** Image input source (API wire format) */
  export type ImageGenerationRequestInputSource = {
    type: "url";
    url: string;
  };

  export type ImageGenerationRequestInputAs =
    | "auto"
    | "person"
    | "garment"
    | "pose"
    | "source"
    | "reference";

  /** Structured image input (API wire format) */
  export type ImageGenerationRequestInput = {
    type: "image";
    as?: ImageGenerationRequestInputAs;
    source: ImageGenerationRequestInputSource;
  };

  /** Structured image input for the SDK client (may include local files) */
  export type ImageGenerationClientInput = Omit<ImageGenerationRequestInput, "source"> & {
    source: ImageGenerationRequestInputSource | { type: "file"; file: ImageUploadInput };
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
   * Image generation request parameters (API wire format).
   */
  export type ImageGenerationRequest = {
    prompt: ImageGenerationRequestPrompt;
    negative_prompt?: string;
    magic_prompt?: true;
    model?: ImageGenerationModel;
    size?: ImageGenerationRequestSize;
    count?: number;
    output?: ImageGenerationRequestOutput;
    webhook?: ImageGenerationRequestWebhook;
    rating?: ImageGenerationRequestRating;
    access?: ImageGenerationRequestAccess;
    inputs?: (string | ImageGenerationRequestInput)[];
    metadata?: Record<string, unknown>;
    destination?: string;
  };

  /**
   * Image generation request parameters for the SDK client.
   * Accepts local files in `inputs`; they are uploaded before the API call.
   */
  export type ImageGenerationClientRequest = Omit<ImageGenerationRequest, "inputs"> & {
    inputs?: (string | ImageUploadInput | ImageGenerationClientInput)[];
  };

  export type ImageResultRatingDefaultLevel = "sfw" | "nsfw";

  export type ImageResultRatingFailure = {
    status: "failed";
    error: {
      code: string;
    };
  };

  export type ImageResultRating =
    | {
        status: "success";
        level: ImageResultRatingDefaultLevel;
      }
    | {
        status: "success";
        level: string;
      }
    | ImageResultRatingFailure;

  export type ImageResultDestination =
    | {
        status: "success";
        name: string;
      }
    | {
        status: "failed";
        name: string;
        error: {
          code: string;
          message?: string;
          provider_response?: string;
        };
      };

  export type ImageResultImageSuccess = {
    status: "success";
    id: string;
    url: string | null;
    mynth_url: string;
    size: string;
    cost: string;
    destination?: ImageResultDestination;
    rating?: ImageResultRating;
  };

  export type ImageResultImageFailure = {
    status: "failed";
    error: {
      code: string;
      message?: string;
    };
  };

  export type ImageResultImage = ImageResultImageSuccess | ImageResultImageFailure;

  export type ImageResultMagicPrompt = {
    positive: string;
    negative?: string;
  };

  export type ImageResult = {
    model: ImageGenerationModelId;
    images: ImageResultImage[];
    magic_prompt?: ImageResultMagicPrompt;
  };

  // ============================================================
  // Image Rate
  // ============================================================

  /** Custom rating level definition */
  export type ImageRateRequestLevel<T extends string = string> = {
    /** Level value returned in results */
    value: T;
    /** Human-readable description for the rating model */
    description: string;
  };

  /** Request body for the image rate endpoint (API wire format) */
  export type ImageRateRequestBase = {
    /** Image URLs to rate (1–10) */
    urls: string[];
  };

  export type ImageRateRequestRatingDefault = {
    /** Default sfw/nsfw classifier */
    mode: "nsfw_sfw";
  };

  export type ImageRateRequestRatingCustom = {
    /** Custom classifier levels */
    mode: "custom";
    levels: readonly ImageRateRequestLevel[];
  };

  export type ImageRateRequest = ImageRateRequestBase &
    (ImageRateRequestRatingDefault | ImageRateRequestRatingCustom);

  /** Image sources for rate/alt SDK methods: remote URLs or local files */
  export type ImageClientUrlsOrFiles =
    | { urls: string[]; files?: never }
    | { files: ImageUploadInput | readonly ImageUploadInput[]; urls?: never };

  /**
   * Image rate request for the SDK client.
   * Pass either `urls` or `files` (files are uploaded before the API call).
   */
  export type ImageRateClientRequest = ImageClientUrlsOrFiles &
    (ImageRateRequestRatingDefault | ImageRateRequestRatingCustom);

  /** A successfully rated image */
  export type ImageRateResponseItemSuccess<LevelT extends string = string> = {
    status: "success";
    url: string;
    level: LevelT;
  };

  export type ImageRateResponseItemError = {
    status: "failed";
    url: string;
    error: {
      code: string;
    };
  };

  /** Individual rating result item */
  export type ImageRateResponseItem<LevelT extends string = string> =
    | ImageRateResponseItemSuccess<LevelT>
    | ImageRateResponseItemError;

  /** API response from the image rate endpoint */
  export type ImageRateResponse<LevelT extends string = string> = {
    task: {
      id: string;
      status: "completed";
      cost: string;
    };
    results: ImageRateResponseItem<LevelT>[];
  };

  /** Pending response from the image rate endpoint when async mode is used */
  export type ImageRatePendingResponse = {
    task: {
      id: string;
      status: "pending";
    };
  };

  export type ImageRateTaskResult<LevelT extends string = string> = {
    results: ImageRateResponseItem<LevelT>[];
  };

  // ============================================================
  // Image Alt
  // ============================================================

  /** Request body for the image alt endpoint (API wire format) */
  export type ImageAltRequest = {
    /** Image URLs to generate alt text for (1-10) */
    urls: string[];
  };

  /**
   * Image alt request for the SDK client.
   * Pass either `urls` or `files` (files are uploaded before the API call).
   */
  export type ImageAltClientRequest = ImageClientUrlsOrFiles;

  /** A successfully generated image alt text item */
  export type ImageAltResponseItemSuccess = {
    status: "success";
    url: string;
    alt: string;
  };

  export type ImageAltResponseItemError = {
    status: "failed";
    url: string;
    error: {
      code: string;
    };
  };

  /** Individual alt text result item */
  export type ImageAltResponseItem = ImageAltResponseItemSuccess | ImageAltResponseItemError;

  /** API response from the image alt endpoint */
  export type ImageAltResponse = {
    task: {
      id: string;
      status: "completed";
      cost: string;
    };
    results: ImageAltResponseItem[];
  };

  /** Pending response from the image alt endpoint when async mode is used */
  export type ImageAltPendingResponse = {
    task: {
      id: string;
      status: "pending";
    };
  };

  export type ImageAltTaskResult = {
    results: ImageAltResponseItem[];
  };

  // ============================================================
  // Webhooks
  // ============================================================

  /**
   * Webhook payload for image generation task completion.
   */
  export type WebhookTaskImageCompletedPayload = {
    task: { id: string };
    event: "task.image.generate.completed";
    result: ImageResult;
    request: ImageGenerationRequest;
  };

  /**
   * Webhook payload for image generation task failure.
   */
  export type WebhookTaskImageFailedPayload = {
    task: { id: string };
    event: "task.image.generate.failed";
    request: ImageGenerationRequest;
  };

  /**
   * Webhook payload for image rating task completion.
   */
  export type WebhookTaskImageRateCompletedPayload<LevelT extends string = string> = {
    task: { id: string };
    event: "task.image.rate.completed";
    result: ImageRateTaskResult<LevelT>;
    request: ImageRateRequest;
  };

  /**
   * Webhook payload for image rating task failure.
   */
  export type WebhookTaskImageRateFailedPayload = {
    task: { id: string };
    event: "task.image.rate.failed";
    request: ImageRateRequest;
  };

  /**
   * Webhook payload for image alt text task completion.
   */
  export type WebhookTaskImageAltCompletedPayload = {
    task: { id: string };
    event: "task.image.alt.completed";
    result: ImageAltTaskResult;
    request: ImageAltRequest;
  };

  /**
   * Webhook payload for image alt text task failure.
   */
  export type WebhookTaskImageAltFailedPayload = {
    task: { id: string };
    event: "task.image.alt.failed";
    request: ImageAltRequest;
  };

  /**
   * Webhook payload union.
   */
  export type WebhookPayload =
    | WebhookTaskImageCompletedPayload
    | WebhookTaskImageFailedPayload
    | WebhookTaskImageRateCompletedPayload
    | WebhookTaskImageRateFailedPayload
    | WebhookTaskImageAltCompletedPayload
    | WebhookTaskImageAltFailedPayload;
}
