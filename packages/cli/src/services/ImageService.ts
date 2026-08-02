import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import type { z } from "zod";
import { MynthApiError, taskFailureCode } from "../domain/Errors.ts";
import {
  AltCreateResponseSchema,
  AltTaskResultSchema,
  EstimateResponseSchema,
  GenerateResponseSchema,
  RateCreateResponseSchema,
  RateTaskResultSchema,
  ReviewCreateResponseSchema,
  TaskResponseSchema,
  TaskStatusSchema,
  UploadResponseSchema,
  type Estimate,
  type TaskData,
} from "../domain/Schemas.ts";
import { MynthApi, readJson, requireSuccess } from "./MynthApi.ts";

export const MAX_UPLOAD_FILES = 10;
export const MIN_RATE_LEVELS = 2;
export const MAX_RATE_LEVELS = 7;
export const REVIEW_EFFORTS = ["low", "high"] as const;

export type RateLevel = {
  readonly value: string;
  readonly description: string;
};

export type RateResponse = {
  readonly taskId: string;
  readonly cost: string;
  readonly url: string;
  readonly level: string;
};

export type AltResponse = {
  readonly taskId: string;
  readonly cost: string;
  readonly url: string;
  readonly alt: string;
};

export type ReviewEffort = (typeof REVIEW_EFFORTS)[number];

export type ReviewFinding = {
  readonly finding: string;
  readonly category: string;
  readonly severity: string;
  readonly where: string;
  readonly confidence: string;
};

export type ReviewStrength = {
  readonly strength: string;
  readonly confidence: string;
};

export type ReviewResponse = {
  readonly taskId: string;
  readonly cost: string;
  readonly url: string;
  readonly score: number;
  readonly summary: string;
  readonly findings: ReadonlyArray<ReviewFinding>;
  readonly strengths: ReadonlyArray<ReviewStrength>;
};

export type GenerateResponse = {
  readonly taskId: string;
  readonly pat?: string;
};

export type UploadedImage = {
  readonly path: string;
  readonly url: string;
};

export type { TaskData };

const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_FAST_PHASE_MS = 12_000;
const POLL_FAST_INTERVAL_MS = 2_500;
const POLL_SLOW_INTERVAL_MS = 5_000;

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const sleep = (ms: number) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

const deriveFilename = (url: string, taskId: string, index: number): string => {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last && last.length > 0) return decodeURIComponent(last);
  } catch {
    // Use the fallback below.
  }
  return `${taskId}-${index}`;
};

const readImageFile = async (filePath: string): Promise<File> => {
  const ext = extname(filePath).toLowerCase();
  const mime = EXT_TO_MIME[ext];
  if (!mime) {
    throw new MynthApiError({
      message: `unsupported image extension "${ext}" for ${filePath} (allowed: .jpg, .jpeg, .png, .webp)`,
      status: 0,
    });
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(filePath);
  } catch (cause) {
    throw new MynthApiError({
      message: `could not read ${filePath}: ${(cause as Error).message}`,
      status: 0,
      cause,
    });
  }

  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return new File([new Uint8Array(buffer as ArrayBuffer)], basename(filePath), { type: mime });
};

const parseResponse = async <T>(
  response: Response,
  schema: z.ZodType<T>,
  message: string,
): Promise<T> => {
  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) {
    throw new MynthApiError({ message, status: response.status, cause: parsed.error });
  }
  return parsed.data;
};

const mapLimit = async <A, B>(
  items: ReadonlyArray<A>,
  limit: number,
  fn: (item: A, index: number) => Promise<B>,
): Promise<ReadonlyArray<B>> => {
  const results = Array.from<B | undefined>({ length: items.length });
  let next = 0;

  const worker = async () => {
    while (true) {
      const index = next++;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await fn(item, index);
    }
  };

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results as ReadonlyArray<B>;
};

export class ImageService {
  constructor(private readonly api: MynthApi) {}

  async upload(filePaths: ReadonlyArray<string>): Promise<ReadonlyArray<UploadedImage>> {
    if (filePaths.length === 0) {
      throw new MynthApiError({ message: "no files to upload", status: 0 });
    }
    if (filePaths.length > MAX_UPLOAD_FILES) {
      throw new MynthApiError({
        message: `too many files: ${filePaths.length} (max ${MAX_UPLOAD_FILES})`,
        status: 0,
      });
    }

    const files = await Promise.all(filePaths.map(readImageFile));
    const form = new FormData();
    for (const file of files) form.append("images", file);

    const response = await this.api.execute("/image/upload", { method: "POST", body: form });
    await requireSuccess(response, "upload");

    const json = await parseResponse(response, UploadResponseSchema, "invalid upload response");
    return filePaths.map((path, i): UploadedImage => ({ path, url: json.data.urls[i]! }));
  }

  async rate(args: {
    readonly url: string;
    readonly levels?: ReadonlyArray<RateLevel>;
  }): Promise<RateResponse> {
    if (
      args.levels !== undefined &&
      (args.levels.length < MIN_RATE_LEVELS || args.levels.length > MAX_RATE_LEVELS)
    ) {
      throw new MynthApiError({
        message: `levels must have between ${MIN_RATE_LEVELS} and ${MAX_RATE_LEVELS} items (got ${args.levels.length})`,
        status: 0,
      });
    }

    const body =
      args.levels !== undefined
        ? { url: args.url, mode: "custom" as const, levels: args.levels }
        : { url: args.url };

    const response = await this.api.execute("/image/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await requireSuccess(response, "rate");

    const created = await parseResponse(
      response,
      RateCreateResponseSchema,
      "invalid rate create response",
    );
    const task = await this.waitForTask(created.data.taskId);

    if (task.type !== "image.rate" || task.status !== "completed" || task.result === null) {
      throw new MynthApiError({
        message: `rate task ${created.data.taskId} did not complete successfully`,
        status: 0,
      });
    }

    if (task.cost === null) {
      throw new MynthApiError({
        message: `rate task ${created.data.taskId} is missing cost`,
        status: 0,
      });
    }

    const result = RateTaskResultSchema.safeParse(task.result);
    if (!result.success) {
      throw new MynthApiError({
        message: `rate task ${created.data.taskId} returned an invalid result`,
        status: 0,
        cause: result.error,
      });
    }

    return {
      taskId: task.id,
      cost: task.cost,
      url: result.data.url,
      level: result.data.level,
    };
  }

  async alt(args: { readonly url: string }): Promise<AltResponse> {
    const response = await this.api.execute("/image/alt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: args.url }),
    });
    await requireSuccess(response, "alt text");

    const created = await parseResponse(
      response,
      AltCreateResponseSchema,
      "invalid alt text create response",
    );
    const task = await this.waitForTask(created.data.taskId);

    if (task.type !== "image.alt" || task.status !== "completed" || task.result === null) {
      throw new MynthApiError({
        message: `alt text task ${created.data.taskId} did not complete successfully`,
        status: 0,
      });
    }

    if (task.cost === null) {
      throw new MynthApiError({
        message: `alt text task ${created.data.taskId} is missing cost`,
        status: 0,
      });
    }

    const result = AltTaskResultSchema.safeParse(task.result);
    if (!result.success) {
      throw new MynthApiError({
        message: `alt text task ${created.data.taskId} returned an invalid result`,
        status: 0,
        cause: result.error,
      });
    }

    return {
      taskId: task.id,
      cost: task.cost,
      url: result.data.url,
      alt: result.data.alt,
    };
  }

  async review(args: {
    readonly url: string;
    readonly effort?: ReviewEffort;
  }): Promise<ReviewResponse> {
    const body =
      args.effort !== undefined ? { url: args.url, effort: args.effort } : { url: args.url };

    const response = await this.api.execute("/image/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await requireSuccess(response, "review");

    const created = await parseResponse(
      response,
      ReviewCreateResponseSchema,
      "invalid review create response",
    );
    const task = await this.waitForTask(created.data.taskId);

    if (task.type !== "image.review" || task.status !== "completed" || task.result === null) {
      throw new MynthApiError({
        message: `review task ${created.data.taskId} did not complete successfully`,
        status: 0,
      });
    }

    if (task.cost === null) {
      throw new MynthApiError({
        message: `review task ${created.data.taskId} is missing cost`,
        status: 0,
      });
    }

    const result = task.result as unknown as {
      url: string;
      score: number;
      summary: string;
      findings: ReadonlyArray<ReviewFinding>;
      strengths: ReadonlyArray<ReviewStrength>;
    };

    return {
      taskId: task.id,
      cost: task.cost,
      url: result.url,
      score: result.score,
      summary: result.summary,
      findings: result.findings ?? [],
      strengths: result.strengths ?? [],
    };
  }

  async generate(args: {
    readonly request: Record<string, unknown>;
    readonly requestPat: boolean;
  }): Promise<GenerateResponse> {
    const body = args.requestPat
      ? {
          ...args.request,
          access: { ...(args.request["access"] as object | undefined), pat: { enabled: true } },
        }
      : args.request;

    const response = await this.api.execute("/image/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    await requireSuccess(response, "generate");

    const json = await parseResponse(response, GenerateResponseSchema, "invalid generate response");

    const pat = json.data.access?.publicAccessToken;
    return { taskId: json.data.taskId, ...(pat !== undefined ? { pat } : {}) };
  }

  async estimate(request: Record<string, unknown>): Promise<Estimate> {
    const response = await this.api.execute("/image/generate/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
    await requireSuccess(response, "estimate");

    const json = await parseResponse(response, EstimateResponseSchema, "invalid estimate response");
    return json.data;
  }

  async waitForTask(taskId: string, pat?: string): Promise<TaskData> {
    const startTime = Date.now();
    while (true) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= POLL_TIMEOUT_MS) {
        throw new MynthApiError({
          message: `task ${taskId} polling timed out after ${POLL_TIMEOUT_MS}ms`,
          status: 0,
        });
      }

      const status = await this.getTaskStatus(taskId, pat);
      if (status === "completed") return this.getTaskDetails(taskId);
      if (status === "failed") {
        // Fetch the task so moderation blocks surface with their error code.
        const task = await this.getTaskDetails(taskId).catch(() => undefined);
        const code = task !== undefined ? taskFailureCode(task) : undefined;
        throw new MynthApiError({
          message: `task ${taskId} failed${code !== undefined ? ` (${code})` : ""}`,
          status: 0,
          ...(code !== undefined ? { code } : {}),
        });
      }

      const base = elapsed < POLL_FAST_PHASE_MS ? POLL_FAST_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
      await sleep(base + Math.floor(Math.random() * 500));
    }
  }

  async getTaskDetails(taskId: string): Promise<TaskData> {
    const response = await this.api.execute(`/tasks/${taskId}`);
    await requireSuccess(response, "task details");
    const json = await parseResponse(response, TaskResponseSchema, "invalid task details response");
    return json.data;
  }

  async downloadImages(args: {
    readonly urls: ReadonlyArray<string>;
    readonly destinationDir: string;
    readonly taskId: string;
  }): Promise<ReadonlyArray<string>> {
    const absoluteDir = resolve(args.destinationDir);
    try {
      await mkdir(absoluteDir, { recursive: true });
    } catch (cause) {
      throw new MynthApiError({
        message: `could not create output directory ${absoluteDir}: ${(cause as Error).message}`,
        status: 0,
        cause,
      });
    }

    return mapLimit(args.urls, 4, async (url, index) => {
      let response: Response;
      try {
        response = await fetch(url);
      } catch (cause) {
        throw new MynthApiError({
          message: `download failed for ${url}: ${(cause as Error).message}`,
          status: 0,
          cause,
        });
      }

      if (response.status < 200 || response.status >= 300) {
        throw new MynthApiError({
          message: `download failed for ${url} (${response.status})`,
          status: response.status,
        });
      }

      let bytes: ArrayBuffer;
      try {
        bytes = await response.arrayBuffer();
      } catch (cause) {
        throw new MynthApiError({
          message: `could not read body for ${url}: ${(cause as Error).message}`,
          status: response.status,
          cause,
        });
      }

      const filename = deriveFilename(url, args.taskId, index);
      const filePath = join(absoluteDir, filename);
      try {
        await writeFile(filePath, new Uint8Array(bytes));
      } catch (cause) {
        throw new MynthApiError({
          message: `could not write ${filePath}: ${(cause as Error).message}`,
          status: 0,
          cause,
        });
      }

      return filePath;
    });
  }

  private async getTaskStatus(
    taskId: string,
    pat: string | undefined,
  ): Promise<"pending" | "completed" | "failed"> {
    const path = `/tasks/${taskId}/status`;
    let response: Response;

    if (pat !== undefined) {
      try {
        response = await fetch(`${this.api.baseUrl}${path}`, {
          headers: { Authorization: `Bearer ${pat}` },
        });
      } catch (cause) {
        throw new MynthApiError({
          message: `task status request failed: ${(cause as Error).message}`,
          status: 0,
          cause,
        });
      }
    } else {
      response = await this.api.execute(path);
    }

    await requireSuccess(response, "task status");
    const json = await parseResponse(response, TaskStatusSchema, "invalid task status response");
    return json.data.status;
  }
}
