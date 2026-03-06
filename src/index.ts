import { MynthAPIError, MynthClient } from "./client";
import type { AvailableModel, ModelCapability } from "./constants";
import { API_KEY_ENV_VAR, AVAILABLE_MODELS, GENERATE_IMAGE_PATH } from "./constants";
import type { Task } from "./task";
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
 * Options for the generate method.
 */
type GenerateOptions = {
  /** Whether to wait for completion ("sync") or return immediately ("async") */
  mode?: "sync" | "async";
};

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
};

// Extract metadata type from ImageGenerationRequest
type ExtractMetadata<T extends MynthSDKTypes.ImageGenerationRequest> = T["metadata"];

// Extract content rating configuration from ImageGenerationRequest
type ExtractContentRatingConfig<T extends MynthSDKTypes.ImageGenerationRequest> =
  T["content_rating"];

// Extract content rating levels for custom mode - handle both mutable and readonly arrays
type ExtractContentRatingLevels<T extends MynthSDKTypes.ImageGenerationRequest> =
  ExtractContentRatingConfig<T> extends { levels: readonly (infer L)[] }
    ? L
    : ExtractContentRatingConfig<T> extends { levels: (infer L)[] }
      ? L
      : never;

// Extract content rating level values as union type
type ExtractContentRatingLevelValues<T extends MynthSDKTypes.ImageGenerationRequest> =
  ExtractContentRatingLevels<T> extends { value: infer V } ? (V extends string ? V : never) : never;

// Determine if content rating is custom (has levels defined)
type IsContentRatingCustom<T extends MynthSDKTypes.ImageGenerationRequest> =
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Required for type inference
  ExtractContentRatingConfig<T> extends { levels: readonly any[] | any[] } ? true : false;

// Create the appropriate content rating response type based on request config
type ExtractContentRatingResponse<T extends MynthSDKTypes.ImageGenerationRequest> =
  IsContentRatingCustom<T> extends true
    ? {
        mode: "custom";
        level: ExtractContentRatingLevelValues<T>;
      }
    : ExtractContentRatingConfig<T> extends { enabled?: true }
      ? {
          mode: "default";
          level: MynthSDKTypes.ImageResultContentRatingDefaultLevel;
        }
      : MynthSDKTypes.ImageResultContentRating | undefined;

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
 * Main client for interacting with the Mynth image generation API.
 *
 * @example
 * ```typescript
 * // Using environment variable (MYNTH_API_KEY)
 * const mynth = new Mynth();
 *
 * // Or with explicit API key
 * const mynth = new Mynth({ apiKey: "mak_..." });
 *
 * // Generate an image
 * const task = await mynth.generate({
 *   prompt: "A beautiful sunset over mountains",
 *   model: "black-forest-labs/flux.1-dev",
 * });
 *
 * console.log(task.urls); // ["https://..."]
 * ```
 */
class Mynth {
  private readonly client: MynthClient;

  /**
   * Creates a new Mynth client instance.
   *
   * @param options - Configuration options
   * @param options.apiKey - Your API key (defaults to MYNTH_API_KEY env var)
   * @param options.baseUrl - Custom API base URL
   * @throws {Error} If no API key is provided and MYNTH_API_KEY is not set
   */
  constructor(options: MynthOptions = {}) {
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
   * Generate images from a text prompt.
   *
   * @param request - Image generation request parameters
   * @returns A completed Task with the generation results
   *
   * @example
   * ```typescript
   * const task = await mynth.generate({
   *   prompt: "A serene lake at dawn",
   *   model: "black-forest-labs/flux.1-dev",
   * });
   * console.log(task.urls);
   * ```
   */
  public async generate<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
  ): Promise<Task<ExtractMetadata<T>, ExtractContentRatingResponse<T>>>;

  /**
   * Generate images asynchronously without waiting for completion.
   *
   * @param request - Image generation request parameters
   * @param opts - Options with mode set to "async"
   * @returns A TaskAsync that can be polled for completion
   *
   * @example
   * ```typescript
   * const taskAsync = await mynth.generate(
   *   { prompt: "A futuristic cityscape" },
   *   { mode: "async" }
   * );
   *
   * // Return task ID for client-side polling
   * return { id: taskAsync.id, access: taskAsync.access };
   *
   * // Or wait for completion later
   * const task = await taskAsync.toTask();
   * ```
   */
  public async generate<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
    opts: { mode: "async" },
  ): Promise<TaskAsync<ExtractMetadata<T>, ExtractContentRatingResponse<T>>>;

  /**
   * Generate images synchronously, waiting for completion.
   *
   * @param request - Image generation request parameters
   * @param opts - Options with mode set to "sync"
   * @returns A completed Task with the generation results
   */
  public async generate<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
    opts: { mode: "sync" },
  ): Promise<Task<ExtractMetadata<T>, ExtractContentRatingResponse<T>>>;

  // Implementation
  public async generate<const T extends MynthSDKTypes.ImageGenerationRequest>(
    request: T,
    opts: GenerateOptions = {},
  ): Promise<
    | Task<ExtractMetadata<T>, ExtractContentRatingResponse<T>>
    | TaskAsync<ExtractMetadata<T>, ExtractContentRatingResponse<T>>
  > {
    const mode = opts.mode ?? "sync";

    const json = await this.client.post<{
      taskId: string;
      access?: {
        publicAccessToken: string;
      };
    }>(GENERATE_IMAGE_PATH, request);

    const taskAsync = new TaskAsync<ExtractMetadata<T>, ExtractContentRatingResponse<T>>(
      json.taskId,
      {
        client: this.client,
        pat: json.access?.publicAccessToken,
      },
    );

    if (mode === "async") {
      return taskAsync;
    }

    return taskAsync.toTask();
  }
}

export {
  AVAILABLE_MODELS,
  Mynth,
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
  GenerateOptions,
  ModelCapability,
  MynthOptions,
  MynthSDKTypes,
  TaskAsyncAccess,
};
export default Mynth;
