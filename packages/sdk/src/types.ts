/**
 * Type definitions for the Mynth SDK.
 * Import as `import type { MynthSDKTypes } from "@mynthio/sdk"`.
 */
export namespace MynthSDKTypes {
  export type ApiResponse<DataT> = {
    data: DataT;
  };

  export type TaskStatus = "pending" | "completed" | "failed";

  export type TaskType = "image.generate" | "image.rate";

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
      });

  export type ImageGenerationTaskData = Extract<TaskData, { type: "image.generate" }>;
  export type ImageRateTaskData = Extract<TaskData, { type: "image.rate" }>;

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
    | "black-forest-labs/flux.1-dev"
    | "black-forest-labs/flux-1-schnell"
    | "black-forest-labs/flux.2-dev"
    | "black-forest-labs/flux.2-pro"
    | "black-forest-labs/flux.2-flex"
    | "black-forest-labs/flux.2-max"
    | "black-forest-labs/flux.2-klein-4b"
    | "black-forest-labs/flux-virtual-try-on"
    | "google/gemini-3.1-flash-image"
    | "google/gemini-3-pro-image-preview"
    | "imagineart/imagineart-1.5-pro"
    | "krea/krea-2-turbo"
    | "krea/krea-2-medium"
    | "krea/krea-2-large"
    | "openai/gpt-image-2"
    | "prunaai/p-image-try-on"
    | "tongyi-mai/z-image-turbo"
    | "john6666/bismuth-illustrious-mix"
    | "purplesmartai/pony-diffusion-v6-xl"
    | "recraft/recraft-v4"
    | "recraft/recraft-v4-pro"
    | "wan/wan2.6-image"
    | "xai/grok-imagine-image";

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

  /** Image input source */
  export type ImageGenerationRequestInputSource = {
    type: "url";
    url: string;
  };

  export type ImageGenerationRequestInputAs =
    | "auto"
    | "person"
    | "garment"
    | "pose"
    | "style"
    | "background"
    | "product"
    | "object"
    | "character";

  /** Structured image input */
  export type ImageGenerationRequestInput = {
    type: "image";
    as?: ImageGenerationRequestInputAs;
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

  /** Request body for the image rate endpoint */
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
   * Webhook payload union.
   */
  export type WebhookPayload =
    | WebhookTaskImageCompletedPayload
    | WebhookTaskImageFailedPayload
    | WebhookTaskImageRateCompletedPayload
    | WebhookTaskImageRateFailedPayload;
}
