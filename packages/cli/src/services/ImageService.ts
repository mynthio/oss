import * as FileSystem from "@effect/platform/FileSystem";
import * as HttpBody from "@effect/platform/HttpBody";
import * as HttpClient from "@effect/platform/HttpClient";
import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as HttpClientResponse from "@effect/platform/HttpClientResponse";
import * as Path from "@effect/platform/Path";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { MynthApiError } from "../domain/Errors.ts";
import { appConfig } from "./AppConfig.ts";
import { MynthApi } from "./MynthApi.ts";

export const MAX_UPLOAD_FILES = 10;
export const MAX_RATE_IMAGES = 10;
export const MIN_RATE_LEVELS = 2;
export const MAX_RATE_LEVELS = 7;

export type RateLevel = {
  readonly value: string;
  readonly description: string;
};

export type RateResultItem =
  | { readonly url: string; readonly rating: string }
  | { readonly error_code: string };

export type RateResponse = {
  readonly taskId: string;
  readonly results: ReadonlyArray<RateResultItem>;
};

export type GenerateResponse = {
  readonly taskId: string;
  readonly pat: Option.Option<string>;
};

export type TaskData = {
  readonly id: string;
  readonly status: "pending" | "completed" | "failed";
  readonly type: string;
  readonly result: unknown;
  readonly request: unknown;
  readonly cost: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

const POLL_TIMEOUT_MS = 5 * 60 * 1000;
const POLL_FAST_PHASE_MS = 12_000;
const POLL_FAST_INTERVAL_MS = 2_500;
const POLL_SLOW_INTERVAL_MS = 5_000;

const deriveFilename = (url: string, taskId: string, index: number): string => {
  try {
    const parsed = new URL(url);
    const last = parsed.pathname.split("/").filter(Boolean).pop();
    if (last && last.length > 0) return decodeURIComponent(last);
  } catch {
    // fall through to fallback
  }
  return `${taskId}-${index}`;
};

const EXT_TO_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export type UploadedImage = {
  readonly path: string;
  readonly url: string;
};

const readImageFile = Effect.fn("ImageService.readImageFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const ext = path.extname(filePath).toLowerCase();
  const mime = EXT_TO_MIME[ext];
  if (!mime) {
    return yield* new MynthApiError({
      message: `unsupported image extension "${ext}" for ${filePath} (allowed: .jpg, .jpeg, .png, .webp)`,
      status: 0,
    });
  }

  const bytes = yield* fs
    .readFile(filePath)
    .pipe(
      Effect.mapError(
        (cause) =>
          new MynthApiError({ message: `could not read ${filePath}: ${cause.message}`, status: 0 }),
      ),
    );

  const name = path.basename(filePath);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return new File([buffer], name, { type: mime });
});

export class ImageService extends Effect.Service<ImageService>()("ImageService", {
  effect: Effect.gen(function* () {
    const api = yield* MynthApi;
    const httpClient = yield* HttpClient.HttpClient;
    const cfg = yield* appConfig;

    const upload = Effect.fn("ImageService.upload")(function* (filePaths: ReadonlyArray<string>) {
      if (filePaths.length === 0) {
        return yield* new MynthApiError({ message: "no files to upload", status: 0 });
      }
      if (filePaths.length > MAX_UPLOAD_FILES) {
        return yield* new MynthApiError({
          message: `too many files: ${filePaths.length} (max ${MAX_UPLOAD_FILES})`,
          status: 0,
        });
      }

      yield* Effect.logDebug("ImageService.upload starting", {
        count: filePaths.length,
        filePaths,
      });

      const files = yield* Effect.forEach(filePaths, readImageFile);
      yield* Effect.logDebug(
        "ImageService.upload read files",
        files.map((f) => ({ name: f.name, size: f.size, type: f.type })),
      );

      const form = new FormData();
      for (const file of files) form.append("images", file);

      const response = yield* api.execute(
        HttpClientRequest.post("/image/upload").pipe(HttpClientRequest.bodyFormData(form)),
      );
      yield* Effect.logDebug("ImageService.upload response", { status: response.status });

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `upload failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* HttpClientResponse.schemaBodyJson(UploadResponseSchema)(response).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid upload response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );

      return filePaths.map((p, i): UploadedImage => ({ path: p, url: json.urls[i]! }));
    });

    const rate = Effect.fn("ImageService.rate")(function* (args: {
      readonly urls: ReadonlyArray<string>;
      readonly levels?: ReadonlyArray<RateLevel> | undefined;
    }) {
      if (args.urls.length === 0) {
        return yield* new MynthApiError({ message: "no image URLs to rate", status: 0 });
      }
      if (args.urls.length > MAX_RATE_IMAGES) {
        return yield* new MynthApiError({
          message: `too many images: ${args.urls.length} (max ${MAX_RATE_IMAGES})`,
          status: 0,
        });
      }
      if (args.levels !== undefined) {
        if (args.levels.length < MIN_RATE_LEVELS || args.levels.length > MAX_RATE_LEVELS) {
          return yield* new MynthApiError({
            message: `levels must have between ${MIN_RATE_LEVELS} and ${MAX_RATE_LEVELS} items (got ${args.levels.length})`,
            status: 0,
          });
        }
      }

      yield* Effect.logDebug("ImageService.rate starting", {
        count: args.urls.length,
        hasLevels: args.levels !== undefined,
      });

      const body: Record<string, unknown> = { urls: args.urls };
      if (args.levels !== undefined) body["levels"] = args.levels;

      const httpBody = yield* HttpBody.json(body).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `could not encode rate body: ${cause.reason}`,
              status: 0,
              cause,
            }),
        ),
      );

      const response = yield* api.execute(
        HttpClientRequest.post("/image/rate").pipe(HttpClientRequest.setBody(httpBody)),
      );
      yield* Effect.logDebug("ImageService.rate response", { status: response.status });

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `rate failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* HttpClientResponse.schemaBodyJson(RateResponseSchema)(response).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid rate response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );

      return json as RateResponse;
    });

    const generate = Effect.fn("ImageService.generate")(function* (args: {
      readonly request: Record<string, unknown>;
      readonly requestPat: boolean;
    }) {
      const body = args.requestPat
        ? {
            ...args.request,
            access: { ...(args.request.access as object | undefined), pat: { enabled: true } },
          }
        : args.request;

      const httpBody = yield* HttpBody.json(body).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `could not encode generate body: ${cause.reason}`,
              status: 0,
              cause,
            }),
        ),
      );

      const response = yield* api.execute(
        HttpClientRequest.post("/image/generate").pipe(HttpClientRequest.setBody(httpBody)),
      );

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `generate failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* HttpClientResponse.schemaBodyJson(GenerateResponseSchema)(response).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid generate response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );

      return {
        taskId: json.taskId,
        pat: Option.fromNullable(json.access?.publicAccessToken),
      } satisfies GenerateResponse;
    });

    const getTaskStatus = Effect.fn("ImageService.getTaskStatus")(function* (
      taskId: string,
      pat: Option.Option<string>,
    ) {
      const path = `/tasks/${taskId}/status`;

      const response = yield* Option.match(pat, {
        onSome: (token) =>
          httpClient
            .execute(
              HttpClientRequest.get(`${cfg.mynthApiUrl}${path}`).pipe(
                HttpClientRequest.setHeader("Authorization", `Bearer ${token}`),
              ),
            )
            .pipe(
              Effect.mapError(
                (cause) =>
                  new MynthApiError({
                    message: `task status request failed: ${cause.message}`,
                    status: 0,
                    cause,
                  }),
              ),
            ),
        onNone: () => api.execute(HttpClientRequest.get(path)),
      });

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `task status failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* HttpClientResponse.schemaBodyJson(TaskStatusSchema)(response).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid task status response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );
      return json.status;
    });

    const getTaskDetails = Effect.fn("ImageService.getTaskDetails")(function* (taskId: string) {
      const response = yield* api.execute(HttpClientRequest.get(`/tasks/${taskId}`));

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `task details failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* response.json.pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid task details response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );
      return json as TaskData;
    });

    const waitForTask = Effect.fn("ImageService.waitForTask")(function* (
      taskId: string,
      pat: Option.Option<string>,
    ) {
      const startTime = Date.now();
      while (true) {
        const elapsed = Date.now() - startTime;
        if (elapsed >= POLL_TIMEOUT_MS) {
          return yield* new MynthApiError({
            message: `task ${taskId} polling timed out after ${POLL_TIMEOUT_MS}ms`,
            status: 0,
          });
        }

        const status = yield* getTaskStatus(taskId, pat);
        if (status === "completed") return yield* getTaskDetails(taskId);
        if (status === "failed") {
          return yield* new MynthApiError({
            message: `task ${taskId} failed during generation`,
            status: 0,
          });
        }

        const base = elapsed < POLL_FAST_PHASE_MS ? POLL_FAST_INTERVAL_MS : POLL_SLOW_INTERVAL_MS;
        yield* Effect.sleep(Duration.millis(base + Math.floor(Math.random() * 500)));
      }
    });

    const downloadImages = Effect.fn("ImageService.downloadImages")(function* (args: {
      readonly urls: ReadonlyArray<string>;
      readonly destinationDir: string;
      readonly taskId: string;
    }) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const absoluteDir = path.resolve(args.destinationDir);

      yield* fs.makeDirectory(absoluteDir, { recursive: true }).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `could not create output directory ${absoluteDir}: ${cause.message}`,
              status: 0,
            }),
        ),
      );

      return yield* Effect.forEach(
        args.urls,
        (url, index) =>
          Effect.gen(function* () {
            const response = yield* httpClient.execute(HttpClientRequest.get(url)).pipe(
              Effect.mapError(
                (cause) =>
                  new MynthApiError({
                    message: `download failed for ${url}: ${cause.message}`,
                    status: 0,
                    cause,
                  }),
              ),
            );

            if (response.status < 200 || response.status >= 300) {
              return yield* new MynthApiError({
                message: `download failed for ${url} (${response.status})`,
                status: response.status,
              });
            }

            const bytes = yield* response.arrayBuffer.pipe(
              Effect.mapError(
                (cause) =>
                  new MynthApiError({
                    message: `could not read body for ${url}: ${cause.message}`,
                    status: response.status,
                    cause,
                  }),
              ),
            );

            const filename = deriveFilename(url, args.taskId, index);
            const filePath = path.join(absoluteDir, filename);

            yield* fs.writeFile(filePath, new Uint8Array(bytes)).pipe(
              Effect.mapError(
                (cause) =>
                  new MynthApiError({
                    message: `could not write ${filePath}: ${cause.message}`,
                    status: 0,
                  }),
              ),
            );

            return filePath;
          }),
        { concurrency: 4 },
      );
    });

    return { upload, rate, generate, waitForTask, getTaskDetails, downloadImages } as const;
  }),
  dependencies: [MynthApi.Default],
}) {}

const UploadResponseSchema = Schema.Struct({
  urls: Schema.Array(Schema.String),
});

const RateResultItemSchema = Schema.Union(
  Schema.Struct({ url: Schema.String, rating: Schema.String }),
  Schema.Struct({ error_code: Schema.String }),
);

const RateResponseSchema = Schema.Struct({
  taskId: Schema.String,
  results: Schema.Array(RateResultItemSchema),
});

const GenerateResponseSchema = Schema.Struct({
  taskId: Schema.String,
  access: Schema.optional(
    Schema.Struct({
      publicAccessToken: Schema.optional(Schema.String),
    }),
  ),
});

const TaskStatusSchema = Schema.Struct({
  status: Schema.Literal("pending", "completed", "failed"),
});
