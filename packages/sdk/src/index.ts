import { MynthAPIError, MynthClient } from "./client";
import type { AvailableModel, ModelCapability } from "./constants";
import {
  ALT_IMAGE_PATH,
  API_KEY_ENV_VAR,
  AVAILABLE_MODELS,
  DESTINATION_ENV_VAR,
  GENERATE_IMAGE_PATH,
  MODELS_PATH,
  RATE_IMAGE_PATH,
  UPLOAD_IMAGE_PATH,
} from "./constants";
import { ImageAltResult } from "./image-alt-result";
import { ImageGenerationResult } from "./image-generation-result";
import { ImageRateResult } from "./image-rate-result";
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

const UPLOAD_FIELD_NAME = "images";
const UPLOAD_FILENAME = "image";

// Extract metadata type from ImageGenerationClientRequest
type ExtractMetadata<T extends MynthSDKTypes.ImageGenerationClientRequest> = T["metadata"];

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

function isUploadInput(value: unknown): value is MynthSDKTypes.ImageUploadInput {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

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
 * Client for interacting with the Mynth image generation, rating, and alt text APIs.
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
    const form = new FormData();
    const inputs = Array.isArray(input) ? input : [input];

    for (const upload of inputs) {
      form.append(
        UPLOAD_FIELD_NAME,
        upload,
        typeof File !== "undefined" && upload instanceof File ? upload.name : UPLOAD_FILENAME,
      );
    }

    const json = await this.client.post<
      MynthSDKTypes.ApiResponse<MynthSDKTypes.ImageUploadResponse>
    >(UPLOAD_IMAGE_PATH, form);

    return json.data;
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

  private async resolveGenerationInputs(
    inputs: MynthSDKTypes.ImageGenerationClientRequest["inputs"],
  ): Promise<MynthSDKTypes.ImageGenerationRequest["inputs"]> {
    if (!inputs?.length) {
      return undefined;
    }

    const files = inputs.flatMap((input) => {
      if (isUploadInput(input)) return [input];
      if (typeof input !== "string" && input.source.type === "file") return [input.source.file];
      return [];
    });
    const urls = files.length ? (await this.upload(files)).urls : [];
    let i = 0;

    return inputs.map((input) => {
      if (typeof input === "string") return input;
      if (isUploadInput(input)) return urls[i++]!;
      if (input.source.type === "file") {
        return {
          type: "image" as const,
          as: input.as,
          source: { type: "url" as const, url: urls[i++]! },
        };
      }
      return { type: "image" as const, as: input.as, source: input.source };
    });
  }

  private async createGenerationTask<const T extends MynthSDKTypes.ImageGenerationClientRequest>(
    request: T,
  ): Promise<TaskAsync<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>>> {
    const inputs = await this.resolveGenerationInputs(request.inputs);

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
   * @returns Available image generation models with display names and pricing metadata
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

  /** Image generation, rating, and alt text client */
  get image(): MynthImage {
    this.imageClient ??= new MynthImage(this.options);

    return this.imageClient;
  }
}

export {
  AVAILABLE_MODELS,
  ImageAltResult,
  ImageGenerationResult,
  ImageRateResult,
  Mynth,
  MynthImage,
  MynthModels,
  TaskAsync,
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
  ModelCapability,
  MynthModel,
  MynthModelPricing,
  MynthOptions,
  MynthSDKTypes,
  TaskAsyncAccess,
};
export default Mynth;
