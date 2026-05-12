import { MynthAPIError, MynthClient } from "./client";
import type { AvailableModel, ModelCapability } from "./constants";
import {
  API_KEY_ENV_VAR,
  AVAILABLE_MODELS,
  DESTINATION_ENV_VAR,
  GENERATE_IMAGE_PATH,
  RATE_IMAGE_PATH,
} from "./constants";
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

// Extract metadata type from ImageGenerationRequest
type ExtractMetadata<T extends MynthSDKTypes.ImageGenerationRequest> = T["metadata"];

type ExtractRatingConfig<T extends MynthSDKTypes.ImageGenerationRequest> = T["rating"];

type ExtractRatingLevels<T extends MynthSDKTypes.ImageGenerationRequest> =
  ExtractRatingConfig<T> extends { levels: readonly (infer L)[] }
    ? L
    : ExtractRatingConfig<T> extends { levels: (infer L)[] }
      ? L
      : never;

type ExtractRatingLevelValues<T extends MynthSDKTypes.ImageGenerationRequest> =
  ExtractRatingLevels<T> extends { value: infer V } ? (V extends string ? V : never) : never;

type IsRatingCustom<T extends MynthSDKTypes.ImageGenerationRequest> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for type inference
  ExtractRatingConfig<T> extends { mode: "custom"; levels: readonly any[] | any[] } ? true : false;

type ExtractRatingResponse<T extends MynthSDKTypes.ImageGenerationRequest> =
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

// Extract rate level values from the levels array
type ExtractRateLevelValues<T extends MynthSDKTypes.ImageRateRequest> = T extends {
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
 * Client for interacting with the Mynth image generation and rating APIs.
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
  public async generate<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
  ): Promise<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>> {
    const taskAsync = await this.createGenerationTask(request);

    return taskAsync.wait();
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
  public async generateAsync<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
  ): Promise<TaskAsync<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>>> {
    return this.createGenerationTask(request);
  }

  private async createGenerationTask<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
  ): Promise<TaskAsync<ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>>> {
    const json = await this.client.post<{
      taskId: string;
      access?: {
        publicAccessToken: string;
      };
    }>(GENERATE_IMAGE_PATH, {
      ...request,
      destination: request.destination ?? this.defaultDestination,
    });

    type Result = ImageGenerationResult<ExtractMetadata<T>, ExtractRatingResponse<T>>;

    const taskAsync = new TaskAsync<Result>(json.taskId, {
      client: this.client,
      pat: json.access?.publicAccessToken,
      resultFactory: (data) =>
        new ImageGenerationResult(data as MynthSDKTypes.ImageGenerationTaskData) as Result,
    });

    return taskAsync;
  }

  /**
   * Rate the content of one or more images.
   *
   * Uses AI classification to assign a rating level to each image.
   * By default uses `"sfw"` / `"nsfw"` levels; pass custom `levels` to define
   * your own scale.
   *
   * @param request - URLs to rate and optional custom levels
   * @returns An ImageRateResult with per-image ratings
   *
   * @example
   * ```typescript
   * // Default sfw/nsfw
   * const result = await image.rate({ urls: ["https://..."], mode: "nsfw_sfw" });
   * console.log(result.getRatings()); // [{ status: "success", url: "...", level: "sfw" }]
   *
   * // Custom levels
   * const result = await image.rate({
   *   urls: ["https://..."],
   *   mode: "custom",
   *   levels: [
   *     { value: "safe", description: "No explicit content" },
   *     { value: "mature", description: "Adult themes, no nudity" },
   *     { value: "explicit", description: "Contains nudity or graphic content" },
   *   ] as const,
   * });
   * result.getRatings(); // [{ status: "success", url: "...", level: "safe" | "mature" | "explicit" }]
   * ```
   */
  public async rate<const T extends MynthSDKTypes.ImageRateRequest>(
    request: T,
  ): Promise<ImageRateResult<ExtractRateLevelValues<T>>> {
    type LevelT = ExtractRateLevelValues<T>;

    const json = await this.client.post<MynthSDKTypes.ImageRateResponse<LevelT>>(
      RATE_IMAGE_PATH,
      request,
    );

    return new ImageRateResult<LevelT>(json);
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
  /** Image generation and rating client */
  readonly image: MynthImage;

  /**
   * Creates a new Mynth client instance.
   *
   * @param options - Configuration options
   * @param options.apiKey - Your API key (defaults to MYNTH_API_KEY env var)
   * @param options.baseUrl - Custom API base URL
   */
  constructor(options: MynthOptions = {}) {
    this.image = new MynthImage(options);
  }
}

export {
  AVAILABLE_MODELS,
  ImageGenerationResult,
  ImageRateResult,
  Mynth,
  MynthImage,
  TaskAsync,
  // Error classes
  MynthAPIError,
  TaskAsyncFetchError,
  TaskAsyncTaskFailedError,
  TaskAsyncTaskFetchError,
  TaskAsyncTimeoutError,
  TaskAsyncUnauthorizedError,
};
export type { AvailableModel, ModelCapability, MynthOptions, MynthSDKTypes, TaskAsyncAccess };
export default Mynth;
