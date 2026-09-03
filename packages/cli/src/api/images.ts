import { z } from "zod";
import { UsageError } from "../errors.ts";
import { readImageFile } from "../utils/files.ts";
import type { ApiClient } from "./client.ts";
import { createdTask, estimate, uploadResult, type CreatedTask, type Estimate } from "./schemas.ts";

export const MAX_UPLOAD_FILES = 10;

export type UploadedImage = {
  readonly path: string;
  readonly url: string;
};

/** Uploads local files to Mynth's temporary input storage and returns their URLs. */
export const uploadImages = async (
  client: ApiClient,
  paths: ReadonlyArray<string>,
): Promise<ReadonlyArray<UploadedImage>> => {
  if (paths.length === 0) throw new UsageError("no files to upload");
  if (paths.length > MAX_UPLOAD_FILES) {
    throw new UsageError(`too many files: ${paths.length} (max ${MAX_UPLOAD_FILES})`);
  }

  const form = new FormData();
  for (const file of await Promise.all(paths.map(readImageFile))) form.append("images", file);

  const { urls } = await client.fetch("upload", "/image/upload", uploadResult, { body: form });
  if (urls.length !== paths.length) {
    throw new UsageError(`upload returned ${urls.length} URLs for ${paths.length} files`);
  }
  return paths.map((path, index) => ({ path, url: urls[index]! }));
};

/** POSTs a request body to an async image endpoint and returns the created task. */
export const createImageTask = (
  client: ApiClient,
  endpoint: "generate" | "rate" | "alt" | "review",
  body: Record<string, unknown>,
): Promise<CreatedTask> =>
  client.fetch(`image ${endpoint}`, `/image/${endpoint}`, createdTask, { body });

/** Validates the request server-side and prices it without generating anything. */
export const estimateGeneration = (
  client: ApiClient,
  body: Record<string, unknown>,
): Promise<Estimate> => client.fetch("estimate", "/image/generate/estimate", estimate, { body });

export const parseTaskResult = <T>(
  schema: z.ZodType<T>,
  result: unknown,
  taskId: string,
  label: string,
): T => {
  const parsed = schema.safeParse(result);
  if (!parsed.success) {
    throw new UsageError(`${label} task ${taskId} returned an unexpected result`);
  }
  return parsed.data;
};
