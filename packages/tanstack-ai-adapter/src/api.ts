import { MynthResponseError } from "./errors.ts";

/**
 * The slice of the Mynth REST API the adapter speaks, in wire format, and the
 * parsers that check responses where they cross into the adapter.
 *
 * Request types are public: provider options are built from them. Response
 * types stay internal.
 */

// ============================================================================
// Image generation request
// ============================================================================

/** Aspect ratios Mynth accepts. A model gets the closest one it supports. */
export type MynthImageAspectRatio =
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

/** Named size presets, plain aspect ratios, and aspect ratios at 4k scale. */
export type MynthImageSizePreset =
  | "square"
  | "portrait"
  | "landscape"
  | "portrait_tall"
  | "landscape_wide"
  | MynthImageAspectRatio
  | `${MynthImageAspectRatio}_4k`;

/** Structured aspect-ratio size. `scale` defaults to `"base"`. */
export interface MynthImageAspectRatioSize {
  type: "aspect_ratio";
  aspect_ratio: MynthImageAspectRatio;
  scale?: "base" | "4k";
}

/** Lets the model pick the size. */
export interface MynthImageAutoSize {
  type: "auto";
}

/** Every size the API accepts. */
export type MynthImageSize =
  | "auto"
  | MynthImageSizePreset
  | MynthImageAspectRatioSize
  | MynthImageAutoSize;

/** Output conversion. Without `format`, the provider's format is kept. */
export interface MynthImageOutput {
  format?: "png" | "jpg" | "webp";
}

/**
 * Webhooks for this task. `registered: false` skips the account's registered
 * webhooks; `custom` endpoints receive the events unsigned.
 */
export interface MynthImageWebhook {
  registered?: boolean;
  custom?: Array<{ url: string }>;
}

/** One level of a custom content rating scale. */
export interface MynthImageRatingLevel {
  value: string;
  description: string;
}

/** Content rating: `true` or `nsfw_sfw` for sfw/nsfw, or a custom scale. */
export type MynthImageRating =
  | true
  | { mode: "nsfw_sfw" }
  | { mode: "custom"; levels: ReadonlyArray<MynthImageRatingLevel> };

/**
 * How Mynth uses an input image. `source` is the image to edit, `reference`
 * guides the result, and `auto` (or no role) lets Mynth decide.
 */
export type MynthImageInputRole = "auto" | "source" | "reference";

/**
 * An image input. A string is an image URL. A `Blob` or `File` is uploaded
 * before the task is created. The structured form also sets the input's role.
 */
export type MynthImageInput =
  | string
  | Blob
  | {
      type: "image";
      as?: MynthImageInputRole;
      source: { type: "url"; url: string } | { type: "file"; file: Blob };
    };

/** An input as the API takes it: every source is a URL. */
export type WireImageInput =
  | string
  | { type: "image"; as?: MynthImageInputRole; source: { type: "url"; url: string } };

/** `POST /image/generate` body. */
export interface ImageGenerationRequest {
  prompt: string;
  model: string;
  negative_prompt?: string;
  magic_prompt?: boolean;
  size?: MynthImageSize;
  count?: number;
  output?: MynthImageOutput;
  webhook?: MynthImageWebhook;
  rating?: MynthImageRating;
  generate_public_access_token?: boolean;
  inputs?: WireImageInput[];
  metadata?: Record<string, unknown>;
  destination?: string;
}

// ============================================================================
// Responses
// ============================================================================

/** A task-level or image-level error. `message` is prose and must not be parsed. */
export interface MynthTaskErrorEntry {
  code: string;
  message?: string;
}

export type TaskStatus = "pending" | "completed" | "failed";

export interface GeneratedImageData {
  /** Destination URL, Mynth CDN URL without a destination, or `null` when delivery failed. */
  url: string | null;
  /** Mynth CDN URL. Always set. */
  mynthUrl: string;
}

export type ImageGenerationTask =
  | { id: string; status: "pending" }
  | { id: string; status: "failed"; errors: MynthTaskErrorEntry[] }
  | {
      id: string;
      status: "completed";
      /** USD charged for the task, as a decimal string. */
      cost: string;
      /** The model that ran; resolved to a concrete one when the request used `auto`. */
      model: string;
      images: GeneratedImageData[];
      /** Why images failed, in request order. A completed task can hold failed images. */
      failures: MynthTaskErrorEntry[];
      /** The prompt Mynth rewrote when the request enabled magic prompt. */
      revisedPrompt: string | undefined;
    };

// ============================================================================
// Parsers
// ============================================================================

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fail(what: string): never {
  throw new MynthResponseError(`Unexpected Mynth API response: ${what}`);
}

function record(value: unknown, what: string): UnknownRecord {
  return isRecord(value) ? value : fail(`${what} is not an object`);
}

function string(value: unknown, what: string): string {
  return typeof value === "string" ? value : fail(`${what} is not a string`);
}

function array(value: unknown, what: string): unknown[] {
  return Array.isArray(value) ? value : fail(`${what} is not an array`);
}

function parseErrorEntry(value: unknown): MynthTaskErrorEntry {
  const entry = record(value, "error entry");
  const code = string(entry["code"], "error code");
  return typeof entry["message"] === "string" ? { code, message: entry["message"] } : { code };
}

/** `POST /image/generate` → `{ task_id }` */
export function parseTaskCreated(data: unknown): { taskId: string } {
  return { taskId: string(record(data, "task")["task_id"], "task_id") };
}

/** `POST /image/upload` → `{ urls }`, one per uploaded image, in order. */
export function parseUploadedUrls(data: unknown, expected: number): string[] {
  const urls = array(record(data, "upload")["urls"], "urls").map((url) => string(url, "url"));
  return urls.length === expected
    ? urls
    : fail(`expected ${expected} upload URLs, got ${urls.length}`);
}

/** `GET /tasks/{id}/status` → `{ status }` */
export function parseTaskStatus(data: unknown): TaskStatus {
  const status = record(data, "task status")["status"];
  return status === "pending" || status === "completed" || status === "failed"
    ? status
    : fail(`unknown task status ${JSON.stringify(status)}`);
}

/** `GET /tasks/{id}` for an image generation task. */
export function parseImageGenerationTask(data: unknown): ImageGenerationTask {
  const task = record(data, "task");
  const id = string(task["id"], "task id");
  const status = parseTaskStatus(task);

  switch (status) {
    case "pending":
      return { id, status };
    case "failed":
      return {
        id,
        status,
        errors: Array.isArray(task["errors"]) ? task["errors"].map(parseErrorEntry) : [],
      };
    case "completed": {
      const result = record(task["result"], "task result");
      const images: GeneratedImageData[] = [];
      const failures: MynthTaskErrorEntry[] = [];

      for (const value of array(result["images"], "result images")) {
        const image = record(value, "result image");

        if (image["status"] === "success") {
          const url = image["url"];
          images.push({
            url: typeof url === "string" ? url : null,
            mynthUrl: string(image["mynth_url"], "image mynth_url"),
          });
        } else {
          failures.push(parseErrorEntry(image["error"]));
        }
      }

      const magicPrompt = result["magic_prompt"];

      return {
        id,
        status,
        cost: string(task["cost"], "task cost"),
        model: string(result["model"], "result model"),
        images,
        failures,
        revisedPrompt:
          isRecord(magicPrompt) && typeof magicPrompt["positive"] === "string"
            ? magicPrompt["positive"]
            : undefined,
      };
    }
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}
