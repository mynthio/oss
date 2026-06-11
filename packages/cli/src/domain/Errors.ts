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
