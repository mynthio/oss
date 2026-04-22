import * as Data from "effect/Data";

export class MynthCliError extends Data.TaggedError("MynthCliError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class NotAuthenticatedError extends Data.TaggedError("NotAuthenticatedError")<{
  readonly reason?: string;
}> {}

export class CredentialsStoreError extends Data.TaggedError("CredentialsStoreError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class WorkOSError extends Data.TaggedError("WorkOSError")<{
  readonly message: string;
  readonly code?: string;
  readonly status?: number;
  readonly cause?: unknown;
}> {}

export class AuthorizationPendingError extends Data.TaggedError("AuthorizationPendingError")<{
  readonly slowDown: boolean;
}> {}

export class AuthorizationExpiredError extends Data.TaggedError("AuthorizationExpiredError")<{}> {}

export class AuthorizationDeniedError extends Data.TaggedError("AuthorizationDeniedError")<{}> {}

export class MynthApiError extends Data.TaggedError("MynthApiError")<{
  readonly message: string;
  readonly status: number;
  readonly code?: string;
  readonly cause?: unknown;
}> {}
