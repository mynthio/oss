export class MynthCliError extends Error {
  readonly _tag = "MynthCliError";
  override readonly cause?: unknown;

  constructor(params: { readonly message: string; readonly cause?: unknown }) {
    super(params.message);
    this.name = this._tag;
    this.cause = params.cause;
  }
}

export class CliUsageError extends Error {
  readonly _tag = "CliUsageError";

  constructor(message: string) {
    super(message);
    this.name = this._tag;
  }
}

export class NotAuthenticatedError extends Error {
  readonly _tag = "NotAuthenticatedError";

  constructor(params: { readonly reason?: string } = {}) {
    super(params.reason ?? "not authenticated");
    this.name = this._tag;
  }
}

export class CredentialsStoreError extends Error {
  readonly _tag = "CredentialsStoreError";
  override readonly cause?: unknown;

  constructor(params: { readonly message: string; readonly cause?: unknown }) {
    super(params.message);
    this.name = this._tag;
    this.cause = params.cause;
  }
}

export class WorkOSError extends Error {
  readonly _tag = "WorkOSError";
  readonly code: string | undefined;
  readonly status: number | undefined;
  override readonly cause?: unknown;

  constructor(params: {
    readonly message: string;
    readonly code?: string;
    readonly status?: number;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = this._tag;
    this.code = params.code;
    this.status = params.status;
    this.cause = params.cause;
  }
}

export class AuthorizationPendingError extends Error {
  readonly _tag = "AuthorizationPendingError";
  readonly slowDown: boolean;

  constructor(params: { readonly slowDown: boolean }) {
    super("authorization pending");
    this.name = this._tag;
    this.slowDown = params.slowDown;
  }
}

export class AuthorizationExpiredError extends Error {
  readonly _tag = "AuthorizationExpiredError";

  constructor() {
    super("authorization expired");
    this.name = this._tag;
  }
}

export class AuthorizationDeniedError extends Error {
  readonly _tag = "AuthorizationDeniedError";

  constructor() {
    super("authorization denied");
    this.name = this._tag;
  }
}

// Stable exit-code contract so agents can branch without parsing error prose.
// Documented in `mynth --help` and the package README; keep all three in sync.
export const EXIT_CODES = {
  success: 0,
  error: 1,
  usage: 2,
  auth: 3,
  insufficientCredits: 4,
  moderation: 5,
  rateLimited: 6,
} as const;

const API_CODE_EXITS: Record<string, number> = {
  UNAUTHORIZED: EXIT_CODES.auth,
  VALIDATION_ERROR: EXIT_CODES.usage,
  INSUFFICIENT_BALANCE: EXIT_CODES.insufficientCredits,
  RESTRICTED_CONTENT: EXIT_CODES.moderation,
};

export const exitCodeForError = (error: unknown): number => {
  if (error instanceof CliUsageError) return EXIT_CODES.usage;
  if (error instanceof NotAuthenticatedError) return EXIT_CODES.auth;
  if (error instanceof MynthApiError) {
    const byCode = error.code !== undefined ? API_CODE_EXITS[error.code] : undefined;
    if (byCode !== undefined) return byCode;
    if (error.status === 401 || error.status === 403) return EXIT_CODES.auth;
    if (error.status === 429) return EXIT_CODES.rateLimited;
    return EXIT_CODES.error;
  }
  // Commander usage errors (unknown option, missing argument, ...).
  const code = (error as { code?: unknown }).code;
  if (typeof code === "string" && code.startsWith("commander.")) return EXIT_CODES.usage;
  return EXIT_CODES.error;
};

type FailedTaskLike = {
  readonly errors?: ReadonlyArray<{ readonly code: string }> | null | undefined;
  readonly result?: unknown;
};

// A failed task carries codes at the task level and per image; a moderation
// block anywhere means the request was moderated.
export const taskFailureCode = (task: FailedTaskLike): string | undefined => {
  const images = (task.result as { images?: ReadonlyArray<Record<string, unknown>> } | null)
    ?.images;
  const codes = [
    ...(task.errors ?? []).map((error) => error.code),
    ...(images ?? []).map((image) => (image["error"] as { code?: string } | undefined)?.code),
  ].filter((code): code is string => typeof code === "string");
  return codes.find((code) => code === "RESTRICTED_CONTENT") ?? codes[0];
};

export const exitCodeForFailedTask = (task: FailedTaskLike): number =>
  taskFailureCode(task) === "RESTRICTED_CONTENT" ? EXIT_CODES.moderation : EXIT_CODES.error;

export class MynthApiError extends Error {
  readonly _tag = "MynthApiError";
  readonly status: number;
  readonly code: string | undefined;
  override readonly cause?: unknown;

  constructor(params: {
    readonly message: string;
    readonly status: number;
    readonly code?: string;
    readonly cause?: unknown;
  }) {
    super(params.message);
    this.name = this._tag;
    this.status = params.status;
    this.code = params.code;
    this.cause = params.cause;
  }
}
