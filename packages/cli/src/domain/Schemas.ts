import * as Schema from "effect/Schema";

export const WorkOSUser = Schema.Struct({
  id: Schema.String,
  email: Schema.String,
  first_name: Schema.NullOr(Schema.String).pipe(Schema.optional),
  last_name: Schema.NullOr(Schema.String).pipe(Schema.optional),
});
export type WorkOSUser = typeof WorkOSUser.Type;

export const DeviceAuthorizationResponse = Schema.Struct({
  device_code: Schema.String,
  user_code: Schema.String,
  verification_uri: Schema.String,
  verification_uri_complete: Schema.String.pipe(Schema.optional),
  expires_in: Schema.Number,
  interval: Schema.Number.pipe(Schema.optional),
});
export type DeviceAuthorizationResponse = typeof DeviceAuthorizationResponse.Type;

export const TokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  user: WorkOSUser.pipe(Schema.optional),
  organization_id: Schema.String.pipe(Schema.optional),
});
export type TokenResponse = typeof TokenResponse.Type;

export const WorkOSErrorResponse = Schema.Struct({
  error: Schema.String.pipe(Schema.optional),
  error_description: Schema.String.pipe(Schema.optional),
  message: Schema.String.pipe(Schema.optional),
  code: Schema.String.pipe(Schema.optional),
});

export const OAuthCredentials = Schema.Struct({
  kind: Schema.Literal("oauth"),
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_at: Schema.Number,
  user: WorkOSUser.pipe(Schema.optional),
});
export type OAuthCredentials = typeof OAuthCredentials.Type;

export const ApiKeyCredentials = Schema.Struct({
  kind: Schema.Literal("api_key"),
  api_key: Schema.String,
});
export type ApiKeyCredentials = typeof ApiKeyCredentials.Type;

export const Credentials = Schema.Union(OAuthCredentials, ApiKeyCredentials);
export type Credentials = typeof Credentials.Type;
