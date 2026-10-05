import type { VideoResolutionTier } from "./constants.ts";

/**
 * Type definitions for the Mynth SDK.
 * Import as `import type { MynthSDKTypes } from "@mynthio/sdk"`.
 */
export namespace MynthSDKTypes {
  export type ApiResponse<DataT> = {
    data: DataT;
  };

  export type TaskStatus = "pending" | "completed" | "failed";

  export type TaskType =
    | "image.generate"
    | "image.rate"
    | "image.alt"
    | "image.review"
    | "image.remove_background"
    | "image.upscale"
    | "video.generate";

  /** A task as `GET /tasks/{id}` returns it, and as every webhook event carries it in `data`. */
  export type TaskBase = {
    id: string;
    status: TaskStatus;
    /** USD charged. Set once the task completes. */
    cost: string | null;
    /** Why the task failed. `null` unless `status` is `failed`. */
    errors: TaskError[] | null;
    user_id: string;
    /** The API key that created the task. `null` for tasks created without one. */
    api_key_id: string | null;
    created_at: string;
    updated_at: string;
  };

  /**
   * Task-level error entry.
   * `code` is a stable lowercase snake_case identifier; `message` is optional
   * human-readable prose and must not be parsed.
   */
  export type TaskError = {
    code: string;
    message?: string;
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
      })
    | (TaskBase & {
        type: "image.review";
        request: ImageReviewRequest;
        result: ImageReviewTaskResult | null;
      })
    | (TaskBase & {
        type: "image.remove_background";
        request: ImageRemoveBackgroundRequest;
        result: ImageRemoveBackgroundTaskResult | null;
      })
    | (TaskBase & {
        type: "image.upscale";
        request: ImageUpscaleRequest;
        result: ImageUpscaleTaskResult | null;
      })
    | (TaskBase & {
        type: "video.generate";
        request: VideoGenerationRequest;
        result: VideoResult | null;
      });

  export type ImageGenerationTaskData = Extract<TaskData, { type: "image.generate" }>;
  export type ImageRateTaskData = Extract<TaskData, { type: "image.rate" }>;
  export type ImageAltTaskData = Extract<TaskData, { type: "image.alt" }>;
  export type ImageReviewTaskData = Extract<TaskData, { type: "image.review" }>;
  export type ImageRemoveBackgroundTaskData = Extract<
    TaskData,
    { type: "image.remove_background" }
  >;
  export type ImageUpscaleTaskData = Extract<TaskData, { type: "image.upscale" }>;
  export type VideoGenerationTaskData = Extract<TaskData, { type: "video.generate" }>;

  // ============================================================
  // Models
  // ============================================================

  /** Roles an image-model input rule can require. */
  export type ImageModelInputKind = "source" | "reference";

  /** Roles a video-model input rule can require. */
  export type VideoModelInputKind = "first_frame" | "last_frame" | "reference" | "source";

  export type ModelInputRule<Kind extends string = ImageModelInputKind | VideoModelInputKind> = {
    type: "image";
    /** Role the input plays. Absent means the rule accepts any image. */
    kind?: Kind;
    min?: number;
    max: number;
  };

  export type ModelMode<Kind extends string = ImageModelInputKind | VideoModelInputKind> = {
    inputs?: {
      rules: ModelInputRule<Kind>[];
      max_total?: number;
    };
  };

  export type ImageModelPricing = {
    per_image: {
      base: string;
      "4k"?: string;
    };
    per_input?: string;
  };

  export type VideoModelPricing = {
    /** USD per second, keyed by resolution tier. Tiers the model cannot produce are absent. */
    per_second: Partial<Record<VideoResolutionTier, string>>;
    /** Present only when audio is billed on top of the per-second video rate. */
    audio?: { per_second: string };
  };

  export type ModelPricing = ImageModelPricing | VideoModelPricing;

  export type ImageModel = {
    id: string;
    display_name: string | null;
    type: "image";
    modes: Partial<Record<"txt->img" | "img->img", ModelMode<ImageModelInputKind>>>;
    pricing: ImageModelPricing | null;
  };

  export type VideoModel = {
    id: string;
    display_name: string | null;
    type: "video";
    modes: Partial<Record<"txt->vid" | "img->vid", ModelMode<VideoModelInputKind>>>;
    pricing: VideoModelPricing | null;
  };

  /** Narrow on `type` to reach the media-specific modes and pricing. */
  export type Model = ImageModel | VideoModel;

  export type ModelsListResponse = ApiResponse<Model[]>;

  export type ImageGenerationModelId =
    | "alibaba/qwen-image-2.0"
    | "alibaba/qwen-image-2.0-pro"
    | "alibaba/qwen-image-3.0"
    | "alibaba/qwen-image-3.0-pro"
    | "bytedance/seedream-5.0-lite"
    | "bytedance/seedream-pro"
    | "bytedance/seedream-v5-flash"
    | "black-forest-labs/flux.1-dev"
    | "black-forest-labs/flux-1-schnell"
    | "black-forest-labs/flux.2-dev"
    | "black-forest-labs/flux.2-pro"
    | "black-forest-labs/flux.2-flex"
    | "black-forest-labs/flux.2-max"
    | "black-forest-labs/flux.2-klein-4b"
    | "black-forest-labs/flux-3"
    | "bria/fibo-edit-1.5"
    | "bria/fibo-generate-1.5"
    | "circlestone-labs/anima"
    | "goofy-ai/prefect-pony-xl-lora"
    | "google/gemini-3.1-flash-lite-image"
    | "google/gemini-3.1-flash-image"
    | "google/gemini-3-pro-image-preview"
    | "imagineart/imagineart-1.5-pro"
    | "imagineart/imagineart-2.0"
    | "ideogram/ideogram-4.5"
    | "klingai/kling-image-3.0"
    | "klingai/kling-image-o3"
    | "krea/krea-2-turbo"
    | "krea/krea-2-medium"
    | "krea/krea-2-large"
    | "luma/uni-1"
    | "luma/uni-1-max"
    | "meta/muse-image"
    | "microsoft/mai-image-2.6"
    | "microsoft/mai-image-2.6-flash"
    | "minimax/h3"
    | "openai/gpt-image-2"
    | "openai/gpt-image-2.5-flare"
    | "openai/gpt-image-2.5-sunburst"
    | "tongyi-mai/z-image"
    | "tongyi-mai/z-image-turbo"
    | "john6666/bismuth-illustrious-mix"
    | "maxfeifei8/one-obsession"
    | "purplesmartai/pony-diffusion-v6-xl"
    | "recraft/recraft-v4"
    | "recraft/recraft-v4.1-flash"
    | "recraft/recraft-v4-pro"
    | "reve/reve"
    | "reve/reve-remix"
    | "sourceful/riverflow-2.0-pro"
    | "wan/wan2.6-image"
    | "wan/wan2.7-image"
    | "wan/wan2.7-image-pro"
    | "xai/grok-imagine-image"
    | "xai/grok-imagine-image-2.0"
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
    /** Converts the result to this format. When omitted, the provider's format is kept. */
    format?: ImageGenerationRequestOutputFormat;
  };

  /**
   * Webhooks that receive this task's events unsigned. Use https and a public
   * host, and put a secret token in the query string to verify deliveries.
   */
  export type ImageGenerationRequestCustomWebhook = {
    url: string;
  }[];

  export type ImageGenerationRequestWebhook = {
    /** `false` skips the webhooks registered on the account for this task. */
    registered?: boolean;
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
    aspect_ratio: ImageGenerationRequestAspectRatio;
    scale?: ImageGenerationRequestSizeScale;
  };

  /** Structured auto size configuration */
  export type ImageGenerationRequestSizeAuto = {
    type: "auto";
  };

  // ============================================================
  // Output Images
  // ============================================================

  /** Formats Mynth delivers images in. */
  export type ImageFormat = "png" | "jpg" | "webp";

  /** MIME type of each image format, e.g. for a `Content-Type` header. */
  export type ImageMimeType<FormatT extends ImageFormat = ImageFormat> = {
    png: "image/png";
    jpg: "image/jpeg";
    webp: "image/webp";
  }[FormatT];

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

  export type ImageGenerationRequestInputAs = "auto" | "source" | "reference";

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
    magic_prompt?: boolean;
    model?: ImageGenerationModel;
    size?: ImageGenerationRequestSize;
    count?: number;
    output?: ImageGenerationRequestOutput;
    webhook?: ImageGenerationRequestWebhook;
    rating?: ImageGenerationRequestRating;
    /** Return a public access token for browser-side polling. Defaults to `false`. */
    generate_public_access_token?: boolean;
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
    format: ImageGenerationRequestOutputFormat;
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
    /** Level value returned in the result */
    value: T;
    /** Human-readable description for the rating model */
    description: string;
  };

  /** Request body for the image rate endpoint (API wire format) */
  export type ImageRateRequestBase = {
    /** Image URL to rate */
    url: string;
  };

  export type ImageRateRequestRatingDefault = {
    /** Default sfw/nsfw classifier. When omitted, the API defaults to nsfw_sfw. */
    mode?: "nsfw_sfw";
  };

  export type ImageRateRequestRatingCustom = {
    /** Custom classifier levels */
    mode: "custom";
    levels: readonly ImageRateRequestLevel[];
  };

  export type ImageRateRequest = ImageRateRequestBase &
    (ImageRateRequestRatingDefault | ImageRateRequestRatingCustom);

  /** Image source for rate/alt SDK methods: a remote URL or a local file */
  export type ImageClientUrlOrFile =
    | { url: string; file?: never }
    | { file: ImageUploadInput; url?: never };

  /**
   * Image rate request for the SDK client.
   * Pass either `url` or `file` (files are uploaded before the API call).
   * Mode defaults to `nsfw_sfw` when omitted.
   */
  export type ImageRateClientRequest = ImageClientUrlOrFile &
    (ImageRateRequestRatingDefault | ImageRateRequestRatingCustom);

  /** Create-task response from the image rate endpoint */
  export type ImageRateCreatedResponse = {
    task_id: string;
    estimated_cost: string;
  };

  export type ImageRateTaskResult<LevelT extends string = string> = {
    level: LevelT;
  };

  // ============================================================
  // Image Alt
  // ============================================================

  /** Request body for the image alt endpoint (API wire format) */
  export type ImageAltRequest = {
    /** Image URL to generate alt text for */
    url: string;
  };

  /**
   * Image alt request for the SDK client.
   * Pass either `url` or `file` (files are uploaded before the API call).
   */
  export type ImageAltClientRequest = ImageClientUrlOrFile;

  /** Create-task response from the image alt endpoint */
  export type ImageAltCreatedResponse = {
    task_id: string;
    estimated_cost: string;
  };

  export type ImageAltTaskResult = {
    alt: string;
  };

  // ============================================================
  // Image Review
  // ============================================================

  /** Reviewer panel used for image quality analysis. */
  export type ImageReviewEffort = "low" | "high";

  export type ImageReviewSeverity = "critical" | "major" | "minor";

  export type ImageReviewConfidence = "low" | "medium" | "high";

  /** Request body for the image review endpoint (API wire format). */
  export type ImageReviewRequest = {
    /** Image URL to review. */
    url: string;
    /** Reviewer panel to run. Defaults to `high`. */
    effort?: ImageReviewEffort;
  };

  /**
   * Image review request for the SDK client.
   * Pass either `url` or `file` (files are uploaded before the API call).
   */
  export type ImageReviewClientRequest = ImageClientUrlOrFile & {
    /** Reviewer panel to run. Defaults to `high`. */
    effort?: ImageReviewEffort;
  };

  /** Create-task response from the image review endpoint. */
  export type ImageReviewCreatedResponse = {
    task_id: string;
    estimated_cost: string;
  };

  export type ImageReviewFinding = {
    /** What is wrong, in plain language. */
    finding: string;
    /** Defect category. */
    category: string;
    severity: ImageReviewSeverity;
    /** Where the defect appears in the image, in plain language. */
    where: string;
    confidence: ImageReviewConfidence;
  };

  export type ImageReviewStrength = {
    strength: string;
    confidence: ImageReviewConfidence;
  };

  export type ImageReviewTaskResult = {
    /** Median reviewer score from 1 to 4. Higher is better. */
    score: number;
    summary: string;
    findings: ImageReviewFinding[];
    strengths: ImageReviewStrength[];
  };

  // ============================================================
  // Image Remove Background
  // ============================================================

  /** Formats that keep the transparent background. */
  export type ImageRemoveBackgroundOutputFormat = "png" | "webp";

  export type ImageRemoveBackgroundRequestOutput = {
    /** Converts the result to this format. When omitted, the provider's format is kept. */
    format?: ImageRemoveBackgroundOutputFormat;
  };

  /** Request body for the image remove background endpoint (API wire format). */
  export type ImageRemoveBackgroundRequest = {
    /** Image URL to remove the background from. */
    url: string;
    output?: ImageRemoveBackgroundRequestOutput;
    webhook?: ImageGenerationRequestWebhook;
    /** Return a public access token for browser-side polling. Defaults to `false`. */
    generate_public_access_token?: boolean;
    metadata?: Record<string, unknown>;
    destination?: string;
  };

  /**
   * Image remove background request for the SDK client.
   * Pass either `url` or `file` (files are uploaded before the API call).
   */
  export type ImageRemoveBackgroundClientRequest = ImageClientUrlOrFile &
    Omit<ImageRemoveBackgroundRequest, "url">;

  /** Create-task response from the image remove background endpoint. */
  export type ImageRemoveBackgroundCreatedResponse = TaskCreatedResponse;

  export type ImageRemoveBackgroundResultImage = {
    id: string;
    /** Destination URL, or the Mynth URL without a destination. `null` when delivery failed. */
    url: string | null;
    mynth_url: string;
    /** `{width}x{height}` */
    size: string;
    format: ImageRemoveBackgroundOutputFormat;
    destination?: ImageResultDestination;
  };

  export type ImageRemoveBackgroundTaskResult = {
    image: ImageRemoveBackgroundResultImage;
  };

  // ============================================================
  // Image Upscale
  // ============================================================

  /**
   * Upscaler to run, and the price.
   * - `low`: fast and sharp
   * - `high`: rebuilds fine detail such as small text and faces
   */
  export type ImageUpscaleEffort = "low" | "high";

  export type ImageUpscaleFactor = 2 | 4;

  /**
   * How much to enlarge each side: a shorthand, or an explicit scale.
   * The upscaled image can be at most 4096x4096 pixels.
   */
  export type ImageUpscaleSize = "2x" | "4x" | { type: "scale"; factor: ImageUpscaleFactor };

  export type ImageUpscaleOutputFormat = "png" | "jpg" | "webp";

  export type ImageUpscaleRequestOutput = {
    /** Converts the result to this format. When omitted, the provider's format is kept. */
    format?: ImageUpscaleOutputFormat;
  };

  /** Request body for the image upscale endpoint (API wire format). */
  export type ImageUpscaleRequest = {
    /** Image URL to upscale. */
    url: string;
    size: ImageUpscaleSize;
    /** Sets the price, so there is no default. */
    effort: ImageUpscaleEffort;
    output?: ImageUpscaleRequestOutput;
    webhook?: ImageGenerationRequestWebhook;
    /** Return a public access token for browser-side polling. Defaults to `false`. */
    generate_public_access_token?: boolean;
    metadata?: Record<string, unknown>;
    destination?: string;
  };

  /**
   * Image upscale request for the SDK client.
   * Pass either `url` or `file` (files are uploaded before the API call).
   */
  export type ImageUpscaleClientRequest = ImageClientUrlOrFile & Omit<ImageUpscaleRequest, "url">;

  /** Create-task response from the image upscale endpoint. */
  export type ImageUpscaleCreatedResponse = TaskCreatedResponse;

  export type ImageUpscaleResultImage = {
    id: string;
    /** Destination URL, or the Mynth URL without a destination. `null` when delivery failed. */
    url: string | null;
    mynth_url: string;
    /** `{width}x{height}`. Can be a few pixels off the source times the factor. */
    size: string;
    format: ImageUpscaleOutputFormat;
    destination?: ImageResultDestination;
  };

  export type ImageUpscaleTaskResult = {
    image: ImageUpscaleResultImage;
  };

  // ============================================================
  // Video Generate
  // ============================================================

  /**
   * Video generation always runs on a pinned model; there is no `auto`.
   */
  export type VideoGenerationModelId =
    | "bytedance/seedance-2.0-mini"
    | "google/gemini-omni-flash-1.1"
    | "prunaai/p-video"
    | "xai/grok-imagine-video-1.5";

  export type VideoGenerationModel = VideoGenerationModelId;

  /** Resolution tier. Each model supports a subset; see `AVAILABLE_VIDEO_MODELS`. */
  export type VideoGenerationRequestResolution = "480p" | "720p" | "1080p" | "4k";

  /** Video webhook configuration (same shape as image generation). */
  export type VideoGenerationRequestWebhook = ImageGenerationRequestWebhook;

  /** Video input source (API wire format) */
  export type VideoGenerationRequestInputSource = {
    type: "url";
    url: string;
  };

  /**
   * Role of an input image.
   * `first_frame` and `last_frame` bracket the generated clip; `reference` is
   * guidance only. Defaults to `auto`, which assigns the first image as the
   * first frame.
   */
  export type VideoGenerationRequestInputAs = "auto" | "first_frame" | "last_frame" | "reference";

  /** Structured video input (API wire format) */
  export type VideoGenerationRequestInput = {
    type: "image";
    as?: VideoGenerationRequestInputAs;
    source: VideoGenerationRequestInputSource;
  };

  /** Structured video input for the SDK client (may include local files) */
  export type VideoGenerationClientInput = Omit<VideoGenerationRequestInput, "source"> & {
    source: VideoGenerationRequestInputSource | { type: "file"; file: ImageUploadInput };
  };

  /**
   * Video generation request parameters (API wire format).
   */
  export type VideoGenerationRequest = {
    model: VideoGenerationModel;
    prompt: string;
    negative_prompt?: string;
    /** Duration in whole seconds. Defaults to the model's default duration. */
    duration?: number;
    /** Resolution tier. Defaults to the model's default tier. */
    resolution?: VideoGenerationRequestResolution;
    /** Model-native generated audio. Only for models with the audio capability. */
    audio?: boolean;
    inputs?: (string | VideoGenerationRequestInput)[];
    webhook?: VideoGenerationRequestWebhook;
    /** Return a public access token for browser-side polling. Defaults to `false`. */
    generate_public_access_token?: boolean;
    metadata?: Record<string, unknown>;
  };

  /**
   * Video generation request parameters for the SDK client.
   * Accepts local files in `inputs`; they are uploaded before the API call.
   */
  export type VideoGenerationClientRequest = Omit<VideoGenerationRequest, "inputs"> & {
    inputs?: (string | ImageUploadInput | VideoGenerationClientInput)[];
  };

  /** Create-task response from the video generate endpoint */
  export type VideoGenerationCreatedResponse = TaskCreatedResponse;

  /** Response from the video generation cost estimate endpoint */
  export type VideoGenerationEstimate = {
    /** Estimated cost in USD. Nothing is generated or charged. */
    estimated_cost: string;
    currency: "usd";
    /** Video generation always pins a model, so the estimate is exact. */
    estimate_kind: "exact";
  };

  export type VideoResultVideoSuccess = {
    status: "success";
    id: string;
    /** Public URL of the video. `null` when it could not be delivered there. */
    url: string | null;
    mynth_url: string;
    cost: string;
    /** Duration of the generated video in seconds */
    duration: number;
    resolution: VideoGenerationRequestResolution;
    /** Whether the video was generated with audio */
    audio: boolean;
  };

  export type VideoResultVideoFailure = {
    status: "failed";
    error: {
      code: string;
      message?: string;
    };
  };

  export type VideoResultVideo = VideoResultVideoSuccess | VideoResultVideoFailure;

  export type VideoResult = {
    model: VideoGenerationModelId;
    videos: VideoResultVideo[];
  };

  // ============================================================
  // Task creation
  // ============================================================

  /** What the endpoints that create a task answer with. */
  export type TaskCreatedResponse = {
    task_id: string;
    /** Cost reserved for the task. Failed media is refunded. */
    estimated_cost: string;
    /** Present when the request set `generate_public_access_token: true`. */
    public_access_token?: string;
  };

  // ============================================================
  // Webhooks
  // ============================================================

  /** A task that finished with results. Items in the result can still have failed. */
  export type CompletedTaskData<TypeT extends TaskType = TaskType> =
    Extract<TaskData, { type: TypeT }> extends infer DataT extends TaskData
      ? DataT & {
          status: "completed";
          result: NonNullable<DataT["result"]>;
          cost: string;
          errors: null;
        }
      : never;

  /** A task that failed as a whole, without results. */
  export type FailedTaskData<TypeT extends TaskType = TaskType> =
    Extract<TaskData, { type: TypeT }> extends infer DataT extends TaskData
      ? DataT & {
          status: "failed";
          result: null;
          errors: TaskError[];
        }
      : never;

  /**
   * One webhook event, for one task type and status.
   *
   * `id` is the `webhook-id` header: the same for every delivery of the event,
   * so deduplicate on it. `timestamp` is when the event happened. `data` is
   * the task exactly as `GET /tasks/{id}` returns it.
   */
  export type WebhookEventOf<TypeT extends TaskType, StatusT extends "completed" | "failed"> = {
    id: string;
    type: `task.${TypeT}.${StatusT}`;
    timestamp: string;
    data: StatusT extends "completed" ? CompletedTaskData<TypeT> : FailedTaskData<TypeT>;
  };

  /**
   * Every webhook event, discriminated on `type`. An event added after this SDK
   * version is still returned by `verifyWebhook`, so keep a `default` branch.
   */
  export type WebhookEvent = {
    [TypeT in TaskType]: WebhookEventOf<TypeT, "completed"> | WebhookEventOf<TypeT, "failed">;
  }[TaskType];

  /** The `type` of every webhook event this SDK version knows. */
  export type WebhookEventType = WebhookEvent["type"];
}
