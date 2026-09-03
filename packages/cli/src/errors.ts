/**
 * Stable exit-code contract so scripts and agents can branch without parsing
 * error prose. Documented in `mynth --help` and the README; keep all three in
 * sync.
 */
export const EXIT_CODES = {
  success: 0,
  error: 1,
  usage: 2,
  auth: 3,
  insufficientCredits: 4,
  moderation: 5,
  rateLimited: 6,
} as const;

export class CliError extends Error {
  constructor(message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Bad arguments, flags, or local input. Exits 2. */
export class UsageError extends CliError {}

/** Missing, invalid, or insufficient credentials. Exits 3. */
export class AuthError extends CliError {}

/** A non-2xx API response, or a transport failure (`status: 0`). */
export class ApiError extends CliError {
  readonly status: number;
  readonly code: string | undefined;

  constructor(
    message: string,
    options: { readonly status: number; readonly code?: string; readonly cause?: unknown },
  ) {
    super(message, options);
    this.status = options.status;
    this.code = options.code;
  }
}

/** An OAuth device-flow response that the login loop reacts to by `code`. */
export class DeviceFlowError extends CliError {
  readonly code: string;

  constructor(code: string, message: string, options?: { readonly cause?: unknown }) {
    super(message, options);
    this.code = code;
  }
}

// Server error codes that deserve their own exit code. Anything unlisted falls
// back to the HTTP status.
const EXIT_BY_API_CODE: Record<string, number> = {
  UNAUTHORIZED: EXIT_CODES.auth,
  INSUFFICIENT_SCOPE: EXIT_CODES.auth,
  VALIDATION_ERROR: EXIT_CODES.usage,
  INSUFFICIENT_BALANCE: EXIT_CODES.insufficientCredits,
  // 429, but a budget problem rather than a throughput one.
  SPENDING_LIMIT_EXCEEDED: EXIT_CODES.insufficientCredits,
  RESTRICTED_CONTENT: EXIT_CODES.moderation,
};

export const exitCodeForError = (error: unknown): number => {
  if (error instanceof UsageError) return EXIT_CODES.usage;
  if (error instanceof AuthError) return EXIT_CODES.auth;

  if (error instanceof ApiError) {
    const byCode = error.code !== undefined ? EXIT_BY_API_CODE[error.code] : undefined;
    if (byCode !== undefined) return byCode;
    if (error.status === 401 || error.status === 403) return EXIT_CODES.auth;
    if (error.status === 429) return EXIT_CODES.rateLimited;
    return EXIT_CODES.error;
  }

  // Commander usage errors (unknown option, missing argument, ...).
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code.startsWith("commander.")) return EXIT_CODES.usage;

  return EXIT_CODES.error;
};

type FailedTask = {
  readonly errors?: ReadonlyArray<{ readonly code: string }> | null | undefined;
  readonly result?: unknown;
};

/**
 * A failed task carries codes at the task level and per generated item; a
 * moderation block anywhere means the request was moderated.
 */
export const taskFailureCode = (task: FailedTask): string | undefined => {
  const result = task.result as { images?: ReadonlyArray<unknown> } | null | undefined;
  const codes = [
    ...(task.errors ?? []).map((error) => error.code),
    ...(result?.images ?? []).map(
      (image) =>
        ((image as Record<string, unknown>)["error"] as { code?: string } | undefined)?.code,
    ),
  ].filter((code): code is string => typeof code === "string");

  return codes.find((code) => code === "RESTRICTED_CONTENT") ?? codes[0];
};

export const exitCodeForFailedTask = (task: FailedTask): number =>
  taskFailureCode(task) === "RESTRICTED_CONTENT" ? EXIT_CODES.moderation : EXIT_CODES.error;
