import { MynthAPIError, MynthClient } from "./client";
import type { AvailableModel, ModelCapability } from "./constants";
import type { AvailableVideoModel, VideoInputRole, VideoResolutionTier } from "./constants";
import {
  ALT_IMAGE_PATH,
  API_KEY_ENV_VAR,
  AVAILABLE_MODELS,
  AVAILABLE_VIDEO_MODELS,
  DESTINATION_ENV_VAR,
  ESTIMATE_VIDEO_PATH,
  GENERATE_IMAGE_PATH,
  GENERATE_VIDEO_PATH,
  MODELS_PATH,
  RATE_IMAGE_PATH,
  REVIEW_IMAGE_PATH,
  VIDEO_POLLING,
} from "./constants";
import { ImageAltResult } from "./image-alt-result";
import { ImageGenerationResult } from "./image-generation-result";
import { ImageRateResult } from "./image-rate-result";
import { ImageReviewResult } from "./image-review-result";
import type { TaskAsyncAccess } from "./task-async";
import {
  TaskAsync,
  TaskAsyncFetchError,
  TaskAsyncTaskFailedError,
  TaskAsyncTaskFetchError,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
} from "./task-async";
import type { MynthSDKTypes } from "./types";
import { resolveInputs, uploadImages } from "./uploads";
import { VideoGenerationResult } from "./video-generation-result";

/**
 * Configuration options for the Mynth client.
 */
type MynthOptions = {
  /**
   * Your Mynth API key. If not provided, reads from MYNTH_API_KEY environment variable.
   */
  apiKey?: string;
  /**
   * Custom base URL for the API. Useful for proxies or testing.
   */
  baseUrl?: string;
  /**
   * Default destination name (slug) to deliver generated images to.
   * If not provided, reads from MYNTH_DESTINATION environment variable.
   * Can be overridden on a per-request basis via `request.destination`.
   */
  destination?: string;
};

type MynthModel = MynthSDKTypes.Model;
type MynthModelPricing = MynthSDKTypes.ModelPricing;

// Extract metadata type from ImageGenerationClientRequest
type ExtractMetadata<T extends MynthSDKTypes.ImageGenerationClientRequest> = T["metadata"];

type ExtractVideoMetadata<T extends MynthSDKTypes.VideoGenerationClientRequest> = T["metadata"];

type ExtractRatingConfig<T extends MynthSDKTypes.ImageGenerationClientRequest> = T["rating"];

type ExtractRatingLevels<T extends MynthSDKTypes.ImageGenerationClientRequest> =
  ExtractRatingConfig<T> extends { levels: readonly (infer L)[] }
    ? L
    : ExtractRatingConfig<T> extends { levels: (infer L)[] }
      ? L
      : never;

type ExtractRatingLevelValues<T extends MynthSDKTypes.ImageGenerationClientRequest> =
  ExtractRatingLevels<T> extends { value: infer V } ? (V extends string ? V : never) : never;

type IsRatingCustom<T extends MynthSDKTypes.ImageGenerationClientRequest> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for type inference
  ExtractRatingConfig<T> extends { mode: "custom"; levels: readonly any[] | any[] } ? true : false;

type ExtractRatingResponse<T extends MynthSDKTypes.ImageGenerationClientRequest> =
  IsRatingCustom<T> extends true
    ?
        | {
            status: "success";
            level: ExtractRatingLevelValues<T>;
          }
        | MynthSDKTypes.ImageResultRatingFailure
    : ExtractRatingConfig<T> extends true | { mode: "nsfw_sfw" }
      ?
          | {
              status: "success";
              level: MynthSDKTypes.ImageResultRatingDefaultLevel;
            }
          | MynthSDKTypes.ImageResultRatingFailure
      : MynthSDKTypes.ImageResultRating | undefined;

// Extract rate level values from the levels array (default mode when omitted)
type ExtractRateLevelValues<T extends MynthSDKTypes.ImageRateClientRequest> = T extends {
  mode: "custom";
  levels: readonly { value: infer V }[];
}
  ? V extends string
    ? V
    : string
  : MynthSDKTypes.ImageResultRatingDefaultLevel;

/**
 * Attempts to read the API key from environment variables.
 * Works in Node.js, Bun, Deno, and edge runtimes that support process.env.
 */
function getApiKeyFromEnv(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[API_KEY_ENV_VAR];
  }
  return undefined;
}

/**
 * Attempts to read the default destination from environment variables.
 * Works in Node.js, Bun, Deno, and edge runtimes that support process.env.
 */
function getDestinationFromEnv(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[DESTINATION_ENV_VAR];
  }
  return undefined;
}

/**
 * Client for interacting with the Mynth image generation and analysis APIs.
 *
 * @example
 * ```typescript
 * // Using environment variable (MYNTH_API_KEY)
 * const image = new MynthImage();
 *
 * // Or with explicit API key
 * const image = new MynthImage({ apiKey: "mak_..." });
 *
 * // Generate an image
 * const result = await image.generate({
 *   prompt: "A beautiful sunset over mountains",
 *   model: "black-forest-labs/flux.1-dev",
 * });
 *
 * console.log(result.urls); // ["https://..."]
 * ```
 */
class MynthImage {
  private readonly client: MynthClient;
  private readonly defaultDestination?: string;

  /**
   * Creates a new MynthImage client instance.
   *
   * @param options - Configuration options
   * @param options.apiKey - Your API key (defaults to MYNTH_API_KEY env var)
   * @param options.baseUrl - Custom API base URL
   * @param options.destination - Default destination name (defaults to MYNTH_DESTINATION env var)
   * @throws {Error} If no API key is provided and MYNTH_API_KEY is not set
   */
  constructor(options: MynthOptions = {}) {
    const apiKey = options.apiKey ?? getApiKeyFromEnv();

    if (!apiKey) {
      throw new Error(
        `Mynth API key is required. Either pass it as an option or set the ${API_KEY_ENV_VAR} environment variable.`,
      );
    }

    this.defaultDestination = options.destination ?? getDestinationFromEnv();

    this.client = new MynthClient({
      apiKey,
      baseUrl: options.baseUrl,
    });
  }

  /**
   * Generate images from a text prompt.
   *
   * @param request - Image generation request parameters
   * @returns A completed ImageGenerationResult with the generation results
   *
   * @example
   * ```typescript
   * const result = await image.generate({
   *   prompt: "A serene lake at dawn",
   *   model: "black-forest-labs/flux.1-dev",
   * });
   * console.log(result.urls);
   * ```
   */
  public async generate<const T extends MynthSDKTypes.ImageGenerationClientRequest>(
    request: T,
  ): Promise<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>> {
    const taskAsync = await this.createGenerationTask(request);

    return taskAsync.wait();
  }

  /**
   * Upload one or more images to Mynth temporary input storage.
   *
   * Accepts File/Blob or an array of File/Blob inputs.
   *
   * @param input - Image input or inputs to upload
   * @returns Uploaded image URLs that can be passed to generation `inputs`
   *
   * @example
   * ```typescript
   * const { urls } = await image.upload(file);
   * await image.generate({ prompt: "Use this reference", inputs: urls });
   * ```
   */
  public async upload(
    input: MynthSDKTypes.ImageUploadInput | readonly MynthSDKTypes.ImageUploadInput[],
  ): Promise<MynthSDKTypes.ImageUploadResponse> {
    return uploadImages(this.client, input);
  }

  /**
   * Start image generation without waiting for completion.
   *
   * @param request - Image generation request parameters
   * @returns A TaskAsync that can be polled for completion via `.wait()`
   *
   * @example
   * ```typescript
   * const taskAsync = await image.generateAsync({
   *   prompt: "A futuristic cityscape",
   * });
   *
   * return { id: taskAsync.id, access: taskAsync.access };
   * ```
   */
  public async generateAsync<const T extends MynthSDKTypes.ImageGenerationClientRequest>(
    request: T,
  ): Promise<TaskAsync<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>>> {
    return this.createGenerationTask(request);
  }

  private async createGenerationTask<const T extends MynthSDKTypes.ImageGenerationClientRequest>(
    request: T,
  ): Promise<TaskAsync<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>>> {
    const inputs = await resolveInputs<MynthSDKTypes.ImageGenerationRequestInputAs>(
      this.client,
      request.inputs,
    );

    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<{
        taskId: string;
        access?: {
          publicAccessToken: string;
        };
      }>
    >(GENERATE_IMAGE_PATH, {
      ...request,
      inputs,
      destination: request.destination ?? this.defaultDestination,
    });

    const data = json.data;
    type Result = ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>;

    const taskAsync = new TaskAsync<Result>(data.taskId, {
      client: this.client,
      pat: data.access?.publicAccessToken,
      resultFactory: (data) =>
        new ImageGenerationResult(data as MynthSDKTypes.ImageGenerationTaskData) as Result,
    });

    return taskAsync;
  }

  /**
   * Rate the content of a single image.
   *
   * Uses AI classification to assign a rating level. Mode defaults to
   * `"nsfw_sfw"` (`"sfw"` / `"nsfw"`); pass custom `levels` to define your own scale.
   *
   * @param request - Image URL or local file, and optional rating mode
   * @returns An ImageRateResult with the assigned level
   *
   * @example
   * ```typescript
   * // Default sfw/nsfw (mode optional)
   * const result = await image.rate({ url: "https://..." });
   * console.log(result.level); // "sfw" | "nsfw"
   *
   * // Custom levels
   * const result = await image.rate({
   *   url: "https://...",
   *   mode: "custom",
   *   levels: [
   *     { value: "safe", description: "No explicit content" },
   *     { value: "mature", description: "Adult themes, no nudity" },
   *     { value: "explicit", description: "Contains nudity or graphic content" },
   *   ] as const,
   * });
   * console.log(result.level); // "safe" | "mature" | "explicit"
   * ```
   */
  public async rate<const T extends MynthSDKTypes.ImageRateClientRequest>(
    request: T,
  ): Promise<ImageRateResult<ExtractRateLevelValues<T>>> {
    const taskAsync = await this.createRateTask(request);

    return taskAsync.wait();
  }

  /**
   * Start image content rating without waiting for completion.
   *
   * @param request - Image URL or local file, and optional rating mode
   * @returns A TaskAsync that can be polled for completion via `.wait()`
   *
   * @example
   * ```typescript
   * const taskAsync = await image.rateAsync({ url: "https://..." });
   *
   * const result = await taskAsync.wait();
   * console.log(result.level);
   * ```
   */
  public async rateAsync<const T extends MynthSDKTypes.ImageRateClientRequest>(
    request: T,
  ): Promise<TaskAsync<ImageRateResult<ExtractRateLevelValues<T>>>> {
    return this.createRateTask(request);
  }

  private async resolveUrlOrFile(request: MynthSDKTypes.ImageClientUrlOrFile): Promise<string> {
    if (request.file !== undefined) {
      const { urls } = await this.upload(request.file);
      const url = urls[0];
      if (!url) {
        throw new Error("Image upload returned no URL");
      }
      return url;
    }

    return request.url;
  }

  private async createRateTask<const T extends MynthSDKTypes.ImageRateClientRequest>(
    request: T,
  ): Promise<TaskAsync<ImageRateResult<ExtractRateLevelValues<T>>>> {
    type LevelT = ExtractRateLevelValues<T>;

    const url = await this.resolveUrlOrFile(request);
    const { file: _, url: __, ...rest } = request;

    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.ImageRateCreatedResponse>
    >(RATE_IMAGE_PATH, { ...rest, url });

    const data = json.data;
    type Result = ImageRateResult<LevelT>;

    const taskAsync = new TaskAsync<Result>(data.taskId, {
      client: this.client,
      resultFactory: (taskData) =>
        ImageRateResult.fromTaskData<LevelT>(taskData as MynthSDKTypes.ImageRateTaskData) as Result,
    });

    return taskAsync;
  }

  /**
   * Generate alt text for a single image.
   *
   * Uses AI image analysis to produce short alt text for the image.
   *
   * @param request - Image URL or local file
   * @returns An ImageAltResult with the generated alt text
   *
   * @example
   * ```typescript
   * const result = await image.alt({ url: "https://..." });
   * console.log(result.alt);
   * ```
   */
  public async alt(request: MynthSDKTypes.ImageAltClientRequest): Promise<ImageAltResult> {
    const taskAsync = await this.createAltTask(request);

    return taskAsync.wait();
  }

  /**
   * Start image alt text generation without waiting for completion.
   *
   * @param request - Image URL or local file
   * @returns A TaskAsync that can be polled for completion via `.wait()`
   *
   * @example
   * ```typescript
   * const taskAsync = await image.altAsync({ url: "https://..." });
   *
   * const result = await taskAsync.wait();
   * console.log(result.alt);
   * ```
   */
  public async altAsync(
    request: MynthSDKTypes.ImageAltClientRequest,
  ): Promise<TaskAsync<ImageAltResult>> {
    return this.createAltTask(request);
  }

  private async createAltTask(
    request: MynthSDKTypes.ImageAltClientRequest,
  ): Promise<TaskAsync<ImageAltResult>> {
    const url = await this.resolveUrlOrFile(request);

    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.ImageAltCreatedResponse>
    >(ALT_IMAGE_PATH, { url });

    const data = json.data;

    const taskAsync = new TaskAsync<ImageAltResult>(data.taskId, {
      client: this.client,
      resultFactory: (taskData) =>
        ImageAltResult.fromTaskData(taskData as MynthSDKTypes.ImageAltTaskData),
    });

    return taskAsync;
  }

  /**
   * Review a single image with a multi-model quality panel.
   *
   * @param request - Image URL or local file, and optional review effort
   * @returns An ImageReviewResult with the score, summary, findings, and strengths
   *
   * @example
   * ```typescript
   * const result = await image.review({ url: "https://..." });
   * console.log(result.score); // 1–4, higher is better
   * console.log(result.findings);
   * ```
   */
  public async review(request: MynthSDKTypes.ImageReviewClientRequest): Promise<ImageReviewResult> {
    const taskAsync = await this.createReviewTask(request);

    return taskAsync.wait();
  }

  /**
   * Start an image quality review without waiting for completion.
   *
   * @param request - Image URL or local file, and optional review effort
   * @returns A TaskAsync that can be polled for completion via `.wait()`
   */
  public async reviewAsync(
    request: MynthSDKTypes.ImageReviewClientRequest,
  ): Promise<TaskAsync<ImageReviewResult>> {
    return this.createReviewTask(request);
  }

  private async createReviewTask(
    request: MynthSDKTypes.ImageReviewClientRequest,
  ): Promise<TaskAsync<ImageReviewResult>> {
    const url = await this.resolveUrlOrFile(request);
    const { file: _, url: __, ...rest } = request;

    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.ImageReviewCreatedResponse>
    >(REVIEW_IMAGE_PATH, { ...rest, url });

    const data = json.data;

    return new TaskAsync<ImageReviewResult>(data.taskId, {
      client: this.client,
      resultFactory: (taskData) =>
        ImageReviewResult.fromTaskData(taskData as MynthSDKTypes.ImageReviewTaskData),
    });
  }
}

/**
 * Client for interacting with the Mynth video generation API.
 *
 * Mirrors {@link MynthImage}: `generate()` waits, `generateAsync()` hands you a
 * pollable task, and local files passed in `inputs` are uploaded for you.
 * Video tasks run for minutes, so waits use a longer, slower polling profile.
 *
 * @example
 * ```typescript
 * const video = new MynthVideo({ apiKey: "mak_..." });
 *
 * const result = await video.generate({
 *   model: "google/gemini-omni-flash-1.1",
 *   prompt: "A cat surfing a wave at sunset",
 *   duration: 8,
 *   resolution: "1080p",
 * });
 *
 * console.log(result.urls); // ["https://..."]
 * ```
 */
class MynthVideo {
  private readonly client: MynthClient;

  /**
   * Creates a new MynthVideo client instance.
   *
   * @param options - Configuration options
   * @param options.apiKey - Your API key (defaults to MYNTH_API_KEY env var)
   * @param options.baseUrl - Custom API base URL
   * @throws {Error} If no API key is provided and MYNTH_API_KEY is not set
   */
  constructor(options: Omit<MynthOptions, "destination"> = {}) {
    const apiKey = options.apiKey ?? getApiKeyFromEnv();

    if (!apiKey) {
      throw new Error(
        `Mynth API key is required. Either pass it as an option or set the ${API_KEY_ENV_VAR} environment variable.`,
      );
    }

    this.client = new MynthClient({
      apiKey,
      baseUrl: options.baseUrl,
    });
  }

  /**
   * Generate a video from a text prompt, optionally guided by input images.
   *
   * Waits for the task to complete. Video generation is slow: this poll can
   * legitimately run for many minutes. Use `generateAsync()` (or a webhook)
   * when you cannot hold a request open that long.
   *
   * @param request - Video generation request parameters
   * @returns A completed VideoGenerationResult
   *
   * @example
   * ```typescript
   * const result = await video.generate({
   *   model: "bytedance/seedance-2.0-mini",
   *   prompt: "A drone shot over a misty forest at dawn",
   * });
   * console.log(result.urls);
   * ```
   */
  public async generate<const T extends MynthSDKTypes.VideoGenerationClientRequest>(
    request: T,
  ): Promise<VideoGenerationResult<ExtractVideoMetadata<T>>> {
    const taskAsync = await this.createGenerationTask(request);

    return taskAsync.wait();
  }

  /**
   * Start video generation without waiting for completion.
   *
   * The preferred entry point for server code: hand `taskAsync.id` and
   * `taskAsync.access.publicAccessToken` to the browser, or register a webhook,
   * instead of holding a connection open for the length of a render.
   *
   * @param request - Video generation request parameters
   * @returns A TaskAsync that can be polled for completion via `.wait()`
   *
   * @example
   * ```typescript
   * const taskAsync = await video.generateAsync({
   *   model: "prunaai/p-video",
   *   prompt: "A neon city street in the rain",
   * });
   *
   * return { id: taskAsync.id, access: taskAsync.access };
   * ```
   */
  public async generateAsync<const T extends MynthSDKTypes.VideoGenerationClientRequest>(
    request: T,
  ): Promise<TaskAsync<VideoGenerationResult<ExtractVideoMetadata<T>>>> {
    return this.createGenerationTask(request);
  }

  /**
   * Upload one or more images to Mynth temporary input storage.
   *
   * Video inputs are images, so this is the same storage `image.upload()` uses.
   * Passing files straight to `generate()` uploads them for you; call this
   * directly only when you want to reuse the URLs across several requests.
   *
   * @param input - Image input or inputs to upload
   * @returns Uploaded image URLs that can be passed to generation `inputs`
   */
  public async upload(
    input: MynthSDKTypes.ImageUploadInput | readonly MynthSDKTypes.ImageUploadInput[],
  ): Promise<MynthSDKTypes.ImageUploadResponse> {
    return uploadImages(this.client, input);
  }

  /**
   * Price a video generation request without generating anything.
   *
   * The request is validated exactly as `generate()` would validate it, so an
   * unsupported duration, resolution or input combination throws here too —
   * making this a cheap pre-flight check as well as a cost lookup. Because
   * video pins a concrete model, the returned estimate is exact.
   *
   * @param request - The same request you would pass to `generate()`
   * @returns The estimated cost in USD
   *
   * @example
   * ```typescript
   * const { estimatedCost } = await video.estimate({
   *   model: "google/gemini-omni-flash-1.1",
   *   prompt: "A timelapse of clouds over a canyon",
   *   duration: 10,
   *   resolution: "4k",
   * });
   * ```
   */
  public async estimate(
    request: MynthSDKTypes.VideoGenerationClientRequest,
  ): Promise<MynthSDKTypes.VideoGenerationEstimate> {
    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.VideoGenerationEstimate>
    >(ESTIMATE_VIDEO_PATH, await this.toRequestBody(request));

    return json.data;
  }

  private async toRequestBody(
    request: MynthSDKTypes.VideoGenerationClientRequest,
  ): Promise<MynthSDKTypes.VideoGenerationRequest> {
    const inputs = await resolveInputs<MynthSDKTypes.VideoGenerationRequestInputAs>(
      this.client,
      request.inputs,
    );

    return { ...request, inputs };
  }

  private async createGenerationTask<const T extends MynthSDKTypes.VideoGenerationClientRequest>(
    request: T,
  ): Promise<TaskAsync<VideoGenerationResult<ExtractVideoMetadata<T>>>> {
    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.VideoGenerationCreatedResponse>
    >(GENERATE_VIDEO_PATH, await this.toRequestBody(request));

    const data = json.data;
    type Result = VideoGenerationResult<ExtractVideoMetadata<T>>;

    return new TaskAsync<Result>(data.taskId, {
      client: this.client,
      pat: data.access?.publicAccessToken,
      polling: VIDEO_POLLING,
      resultFactory: (taskData) =>
        new VideoGenerationResult(taskData as MynthSDKTypes.VideoGenerationTaskData) as Result,
    });
  }
}

/**
 * Client for interacting with the public Mynth model catalog.
 */
class MynthModels {
  private readonly client: MynthClient;

  /**
   * Creates a new MynthModels client instance.
   *
   * @param options - Configuration options
   * @param options.baseUrl - Custom API base URL
   */
  constructor(options: Pick<MynthOptions, "baseUrl"> = {}) {
    this.client = new MynthClient({
      baseUrl: options.baseUrl,
    });
  }

  /**
   * List available image generation models.
   *
   * This endpoint is public and does not require a Mynth API key.
   *
   * @returns Available image and video models with display names, served modes, and pricing
   *
   * @example
   * ```typescript
   * const models = await mynth.models.list();
   * console.log(models[0]?.id);
   * ```
   */
  public async list(): Promise<MynthSDKTypes.Model[]> {
    const json = await this.client.getOrThrow<MynthSDKTypes.ModelsListResponse>(MODELS_PATH, {
      auth: false,
    });

    return json.data;
  }
}

/**
 * Bundled Mynth client providing access to all media type clients.
 *
 * @example
 * ```typescript
 * const mynth = new Mynth({ apiKey: "mak_..." });
 *
 * // Generate an image
 * const result = await mynth.image.generate({
 *   prompt: "A beautiful sunset over mountains",
 * });
 * ```
 */
class Mynth {
  /** Public model catalog client */
  readonly models: MynthModels;

  private readonly options: MynthOptions;
  private imageClient?: MynthImage;
  private videoClient?: MynthVideo;

  /**
   * Creates a new Mynth client instance.
   *
   * @param options - Configuration options
   * @param options.apiKey - Your API key (defaults to MYNTH_API_KEY env var)
   * @param options.baseUrl - Custom API base URL
   */
  constructor(options: MynthOptions = {}) {
    this.options = options;
    this.models = new MynthModels({ baseUrl: options.baseUrl });
  }

  /** Image generation and analysis client */
  get image(): MynthImage {
    this.imageClient ??= new MynthImage(this.options);

    return this.imageClient;
  }

  /** Video generation client */
  get video(): MynthVideo {
    this.videoClient ??= new MynthVideo(this.options);

    return this.videoClient;
  }
}

export {
  AVAILABLE_MODELS,
  AVAILABLE_VIDEO_MODELS,
  ImageAltResult,
  ImageGenerationResult,
  ImageRateResult,
  ImageReviewResult,
  Mynth,
  MynthImage,
  MynthModels,
  MynthVideo,
  TaskAsync,
  VideoGenerationResult,
  // Error classes
  MynthAPIError,
  TaskAsyncFetchError,
  TaskAsyncTaskFailedError,
  TaskAsyncTaskFetchError,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
};
export type {
  AvailableModel,
  AvailableVideoModel,
  ModelCapability,
  MynthModel,
  MynthModelPricing,
  MynthOptions,
  MynthSDKTypes,
  TaskAsyncAccess,
  VideoInputRole,
  VideoResolutionTier,
};
export default Mynth;
