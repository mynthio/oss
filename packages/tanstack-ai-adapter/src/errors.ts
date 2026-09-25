import type { MynthSDKTypes } from "@mynthio/sdk";

/**
 * Thrown when a Mynth task completes without a single successful image.
 *
 * When only some images fail, the adapter returns the successful ones and
 * does not throw.
 */
export class MynthNoImagesError extends Error {
  override readonly name = "MynthNoImagesError";
  /** Stable code, read by TanStack AI's `RUN_ERROR` payload. */
  readonly code = "MYNTH_NO_IMAGES";
  /** The Mynth task that produced no images. */
  readonly taskId: string;
  /** Why each image failed, in request order. */
  readonly errors: ReadonlyArray<MynthSDKTypes.ImageResultImageFailure["error"]>;

  constructor(
    taskId: string,
    errors: ReadonlyArray<MynthSDKTypes.ImageResultImageFailure["error"]>,
  ) {
    const codes = [...new Set(errors.map((error) => error.code))];
    super(
      `Mynth task ${taskId} completed without any images` +
        (codes.length > 0 ? ` (${codes.join(", ")})` : ""),
    );
    this.taskId = taskId;
    this.errors = errors;
  }
}
