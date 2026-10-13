import type { MynthTaskErrorEntry } from "./api.ts";

/**
 * Base class of every error the adapter throws for a Mynth failure.
 *
 * `code` is what TanStack AI reports as the `RUN_ERROR` code: the API's own
 * code (e.g. `insufficient_balance`) for {@link MynthAPIError}, a stable
 * `MYNTH_*` code for the rest.
 */
export class MynthError extends Error {
  override readonly name: string = "MynthError";
  readonly code: string | undefined;

  constructor(message: string, code: string | undefined, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
  }
}

/** One invalid or unknown request field of a `validation_error`. */
export interface MynthAPIErrorIssue {
  /** Where the problem is, e.g. `["size", "scale"]`. Empty for the body as a whole. */
  path: ReadonlyArray<string | number>;
  message: string;
}

/** The Mynth API answered with an error status. */
export class MynthAPIError extends MynthError {
  override readonly name: string = "MynthAPIError";
  /** HTTP status code. */
  readonly status: number;
  /** One entry per invalid field when `code` is `validation_error`. */
  readonly issues: ReadonlyArray<MynthAPIErrorIssue> | undefined;
  /**
   * The task the request created before it failed, when `code` is
   * `public_access_token_failed`. The task runs anyway.
   */
  readonly taskId: string | undefined;
  /** How long the API asked to wait before retrying (`Retry-After`), when it did. */
  readonly retryAfterMs: number | undefined;

  constructor(options: {
    message: string;
    status: number;
    code?: string | undefined;
    issues?: ReadonlyArray<MynthAPIErrorIssue> | undefined;
    taskId?: string | undefined;
    retryAfterMs?: number | undefined;
  }) {
    super(options.message, options.code);
    this.status = options.status;
    this.issues = options.issues;
    this.taskId = options.taskId;
    this.retryAfterMs = options.retryAfterMs;
  }
}

/** A successful API response did not have the shape the adapter relies on. */
export class MynthResponseError extends MynthError {
  override readonly name: string = "MynthResponseError";

  constructor(message: string) {
    super(message, "MYNTH_INVALID_RESPONSE");
  }
}

function describeErrors(errors: ReadonlyArray<MynthTaskErrorEntry>): string {
  const codes = [...new Set(errors.map((error) => error.code))];
  return codes.length > 0 ? ` (${codes.join(", ")})` : "";
}

/** The Mynth task failed as a whole, without results. It is not billed. */
export class MynthTaskFailedError extends MynthError {
  override readonly name: string = "MynthTaskFailedError";
  /** The task that failed. */
  readonly taskId: string;
  /** Why the task failed. */
  readonly errors: ReadonlyArray<MynthTaskErrorEntry>;

  constructor(taskId: string, errors: ReadonlyArray<MynthTaskErrorEntry>) {
    super(`Mynth task ${taskId} failed${describeErrors(errors)}`, "MYNTH_TASK_FAILED");
    this.taskId = taskId;
    this.errors = errors;
  }
}

/**
 * The task completed, but every image in it failed.
 *
 * When only some images fail, the adapter returns the successful ones and
 * does not throw.
 */
export class MynthNoImagesError extends MynthError {
  override readonly name: string = "MynthNoImagesError";
  /** The task that produced no images. */
  readonly taskId: string;
  /** Why each image failed, in request order. */
  readonly errors: ReadonlyArray<MynthTaskErrorEntry>;

  constructor(taskId: string, errors: ReadonlyArray<MynthTaskErrorEntry>) {
    super(
      `Mynth task ${taskId} completed without any images${describeErrors(errors)}`,
      "MYNTH_NO_IMAGES",
    );
    this.taskId = taskId;
    this.errors = errors;
  }
}

/**
 * The task did not settle within the adapter's wait budget. It may still
 * complete on Mynth; follow it by `taskId` or a webhook.
 */
export class MynthTaskTimeoutError extends MynthError {
  override readonly name: string = "MynthTaskTimeoutError";
  /** The task that is still running. */
  readonly taskId: string;

  constructor(taskId: string, timeoutMs: number) {
    super(`Mynth task ${taskId} did not settle within ${timeoutMs}ms`, "MYNTH_TASK_TIMEOUT");
    this.taskId = taskId;
  }
}
