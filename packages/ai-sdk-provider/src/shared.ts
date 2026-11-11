import {
  APICallError,
  type ImageModelV4File,
  InvalidArgumentError,
  type SharedV4Warning,
  type Experimental_VideoModelV4File as VideoModelV4File,
} from "@ai-sdk/provider";
import { convertBase64ToUint8Array, DownloadError } from "@ai-sdk/provider-utils";
import { MynthAPIError, TaskAsyncTaskFailedError } from "@mynthio/sdk";
import type { MynthSDKTypes } from "@mynthio/sdk";

/** Mynth's default API host, used for error reporting when no `baseURL` is set. */
export const DEFAULT_BASE_URL = "https://api.mynth.io";

/** The aspect ratios Mynth accepts for images and videos. */
export const MYNTH_ASPECT_RATIOS: readonly MynthSDKTypes.ImageGenerationRequestAspectRatio[] = [
  "1:1",
  "2:3",
  "3:2",
  "3:4",
  "4:3",
  "4:5",
  "5:4",
  "9:16",
  "16:9",
  "21:9",
  "2:1",
  "1:2",
];

const RATIO_PATTERN = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/;
const SIZE_PATTERN = /^(\d+)x(\d+)$/;

export type ClosestAspectRatio = {
  ratio: MynthSDKTypes.ImageGenerationRequestAspectRatio;
  exact: boolean;
};

/**
 * The supported Mynth aspect ratio closest to `width:height`, compared on a log
 * scale so 2:1 and 1:2 are equally far from 1:1.
 */
export function closestAspectRatio(width: number, height: number): ClosestAspectRatio {
  const target = Math.log(width / height);
  let best = MYNTH_ASPECT_RATIOS[0] as MynthSDKTypes.ImageGenerationRequestAspectRatio;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const ratio of MYNTH_ASPECT_RATIOS) {
    const [w, h] = ratio.split(":").map(Number) as [number, number];
    const distance = Math.abs(Math.log(w / h) - target);
    if (distance < bestDistance) {
      best = ratio;
      bestDistance = distance;
    }
  }

  return { ratio: best, exact: bestDistance < 1e-9 };
}

/** Parses `"16:9"`. Returns `undefined` for anything else. */
export function parseAspectRatio(value: string): { width: number; height: number } | undefined {
  const match = RATIO_PATTERN.exec(value);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

/** Parses `"1280x720"`. Returns `undefined` for anything else. */
export function parseSize(value: string): { width: number; height: number } | undefined {
  const match = SIZE_PATTERN.exec(value);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

/**
 * An AI SDK file as a Mynth SDK input: URLs go through as they are, bytes
 * become a Blob that the Mynth SDK uploads before it creates the task.
 */
export function toMynthInputSource(file: ImageModelV4File | VideoModelV4File): string | Blob {
  if (file.type === "url") return file.url;

  const bytes = typeof file.data === "string" ? convertBase64ToUint8Array(file.data) : file.data;
  // Copy into a fresh ArrayBuffer so the Blob never aliases a shared buffer.
  return new Blob([new Uint8Array(bytes)], { type: file.mediaType });
}

/** Reads `providerOptions.mynth` as a plain object, or throws if it is something else. */
export function readMynthOptions(providerOptions: unknown): Record<string, unknown> {
  const options = (providerOptions as Record<string, unknown> | undefined)?.mynth;
  if (options === undefined) return {};
  if (options === null || typeof options !== "object" || Array.isArray(options)) {
    throw new InvalidArgumentError({
      argument: "providerOptions.mynth",
      message: "providerOptions.mynth must be an object of Mynth request fields.",
    });
  }
  return options as Record<string, unknown>;
}

/** Throws when the call has no prompt: every Mynth generation needs one. */
export function requirePrompt(prompt: string | undefined): string {
  if (prompt === undefined || prompt.trim() === "") {
    throw new InvalidArgumentError({
      argument: "prompt",
      message: "Mynth needs a text prompt for every generation.",
    });
  }
  return prompt;
}

/** Warns when the caller passed request headers: the Mynth SDK sets its own. */
export function headersWarning(
  headers: Record<string, string | undefined> | undefined,
): SharedV4Warning[] {
  const names = Object.entries(headers ?? {})
    .filter(([, value]) => value !== undefined)
    .map(([name]) => name);
  return names.length === 0
    ? []
    : [
        {
          type: "unsupported",
          feature: "headers",
          details: `Mynth requests carry the SDK's own headers; ignored: ${names.join(", ")}.`,
        },
      ];
}

/**
 * Turns Mynth SDK errors into AI SDK errors.
 *
 * Only a 429 is marked retryable. A create that failed with a 5xx was already
 * retried by the Mynth SDK with the same `Idempotency-Key`; a retry from the AI
 * SDK would send a fresh key and could create and charge a second task.
 */
export function toAISDKError(error: unknown, baseURL: string, path: string): unknown {
  if (error instanceof MynthAPIError) {
    return new APICallError({
      message: error.message,
      url: `${baseURL}${path}`,
      requestBodyValues: undefined,
      statusCode: error.status,
      cause: error,
      isRetryable: error.status === 429,
      data: {
        code: error.code ?? null,
        issues: error.issues ? error.issues.map((issue) => ({ ...issue })) : null,
        taskId: error.taskId ?? null,
      },
    });
  }

  if (error instanceof TaskAsyncTaskFailedError) {
    return new APICallError({
      message: error.message,
      url: `${baseURL}${path}`,
      requestBodyValues: undefined,
      cause: error,
      isRetryable: false,
    });
  }

  return error;
}

/** `"code: message"` for each failed output, for error messages and warnings. */
export function describeFailures(failures: readonly MynthSDKTypes.TaskError[]): string {
  return failures
    .map((failure) => (failure.message ? `${failure.code}: ${failure.message}` : failure.code))
    .join("; ");
}

/** A completed Mynth task with no usable output. Not retryable: the inputs decide it. */
export function noOutputError(message: string, baseURL: string, path: string): APICallError {
  return new APICallError({
    message,
    url: `${baseURL}${path}`,
    requestBodyValues: undefined,
    isRetryable: false,
  });
}

/**
 * Downloads a generated file from the Mynth CDN with the global `fetch`, the
 * same `fetch` the Mynth SDK uses, so one stub or proxy covers both.
 */
export async function downloadBytes(
  url: string,
  abortSignal: AbortSignal | undefined,
): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url, abortSignal ? { signal: abortSignal } : {});
  } catch (cause) {
    abortSignal?.throwIfAborted();
    throw new DownloadError({ url, cause });
  }
  if (!response.ok) {
    throw new DownloadError({ url, statusCode: response.status, statusText: response.statusText });
  }
  return new Uint8Array(await response.arrayBuffer());
}
