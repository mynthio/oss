import { z } from "zod";

/**
 * Zod mirrors of the Mynth API response shapes. Only the fields the CLI reads
 * are declared; unknown fields are ignored, so additive API changes never break
 * a released CLI.
 */

const jsonValue: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValue), z.record(jsonValue)]),
);
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

/** Every API endpoint wraps its payload in `{ data: ... }`. */
export const envelope = <T extends z.ZodTypeAny>(data: T) => z.object({ data });

//
// Auth (WorkOS)
//

export const workosUser = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});
export type WorkosUser = z.infer<typeof workosUser>;

export const deviceAuthorization = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string().optional(),
  expires_in: z.number(),
  interval: z.number().optional(),
});
export type DeviceAuthorization = z.infer<typeof deviceAuthorization>;

export const tokenResponse = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: workosUser.optional(),
});
export type TokenResponse = z.infer<typeof tokenResponse>;

export const workosErrorResponse = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

//
// Stored credentials
//

/**
 * The only credential the CLI stores. `auth login` exchanges a short-lived
 * WorkOS session for a long-lived API key, so no OAuth token ever reaches disk
 * and there is nothing to refresh.
 */
export const credentials = z.object({
  kind: z.literal("api_key"),
  api_key: z.string(),
  /** Present when the CLI minted the key, so `auth logout` can revoke it. */
  id: z.string().optional(),
});
export type Credentials = z.infer<typeof credentials>;

//
// API keys
//

export const API_KEY_SCOPES = ["generate", "manage", "keys"] as const;

/** The raw key is returned exactly once, by the create endpoint. */
export const createdApiKey = z.object({
  raw: z.string(),
  apiKey: z.object({
    id: z.string(),
    name: z.string().optional(),
    keyPreview: z.string(),
    scopes: z.array(z.string()),
  }),
});
export type CreatedApiKey = z.infer<typeof createdApiKey>;

/** Money fields come back as decimal strings, but tolerate numbers. */
const decimal = z.union([z.string(), z.number()]).nullable().optional();

export const apiKey = z.object({
  id: z.string(),
  name: z.string().nullable(),
  keyPreview: z.string(),
  scopes: z.array(z.string()),
  spendingLimit: decimal,
  spendingLimitPeriod: z.string().nullable().optional(),
  createdAt: z.string(),
});
export type ApiKey = z.infer<typeof apiKey>;

//
// Account
//

export const apiKeySpending = z.union([
  z.object({ mode: z.literal("unlimited") }),
  z.object({
    mode: z.literal("limited"),
    limit: z.string(),
    period: z.string(),
    used: z.string(),
    remaining: z.string(),
  }),
]);

export const me = z.object({
  userId: z.string(),
  auth: z.object({
    method: z.string(),
    apiKey: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        keyPreview: z.string(),
        scopes: z.array(z.string()).optional(),
        spending: apiKeySpending.optional(),
      })
      .optional(),
  }),
});
export type Me = z.infer<typeof me>;

export const balance = z.object({
  balance: z.string(),
  reserved: z.string(),
  available: z.string(),
  currency: z.string(),
});
export type Balance = z.infer<typeof balance>;

//
// Models
//

export const model = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  pricing: z
    .object({
      perImage: z.object({ base: z.string(), "4k": z.string().optional() }),
      perInput: z.string().optional(),
    })
    .nullable(),
});
export type Model = z.infer<typeof model>;

//
// Tasks
//

export const taskStatus = z.enum(["pending", "completed", "failed"]);
export type TaskStatus = z.infer<typeof taskStatus>;

/**
 * Task types are not narrowed to a closed set: the API adds new ones (video,
 * and more later) and a released CLI must still render them.
 */
export const task = z.object({
  id: z.string(),
  type: z.string(),
  status: taskStatus,
  userId: z.string().optional(),
  apiKeyId: z.string().nullable().optional(),
  cost: z.string().nullable(),
  request: jsonValue.optional(),
  result: jsonValue.nullable(),
  errors: z.array(z.object({ code: z.string(), message: z.string().optional() })).nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Task = z.infer<typeof task>;

export const taskListItem = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  cost: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskListItem = z.infer<typeof taskListItem>;

/** `GET /tasks/:id/result` — a lighter, PAT-readable view of a task. */
export const taskResult = z.object({
  id: z.string(),
  type: z.string(),
  status: taskStatus,
  result: jsonValue.nullable(),
});
export type TaskResult = z.infer<typeof taskResult>;

//
// Image
//

export const uploadResult = z.object({ urls: z.array(z.string()) });

/** Shared 201 envelope of every async create-task endpoint. */
export const createdTask = z.object({
  taskId: z.string(),
  estimatedCost: z.string().optional(),
  access: z.object({ publicAccessToken: z.string() }).optional(),
});
export type CreatedTask = z.infer<typeof createdTask>;

export const estimate = z.object({
  estimatedCost: z.string(),
  currency: z.string(),
  estimateKind: z.enum(["exact", "upper_bound"]),
});
export type Estimate = z.infer<typeof estimate>;

export const imageRateResult = z.object({ url: z.string(), level: z.string() });
export type ImageRateResult = z.infer<typeof imageRateResult>;

export const imageAltResult = z.object({ url: z.string(), alt: z.string() });
export type ImageAltResult = z.infer<typeof imageAltResult>;

export const imageReviewResult = z.object({
  url: z.string(),
  score: z.number(),
  summary: z.string(),
  findings: z
    .array(
      z.object({
        finding: z.string(),
        category: z.string(),
        severity: z.string(),
        where: z.string(),
        confidence: z.string(),
      }),
    )
    .optional(),
  strengths: z.array(z.object({ strength: z.string(), confidence: z.string() })).optional(),
});
export type ImageReviewResult = z.infer<typeof imageReviewResult>;

const imageError = z.object({ code: z.string(), message: z.string().optional() });

export const generatedImage = z.union([
  z.object({
    status: z.literal("success"),
    id: z.string().optional(),
    url: z.string().nullable().optional(),
    mynth_url: z.string().optional(),
    size: z.string().optional(),
    format: z.string().optional(),
    rating: z
      .union([
        z.object({ status: z.literal("success"), level: z.string() }),
        z.object({ status: z.literal("failed"), error: imageError }),
      ])
      .optional(),
    destination: z
      .union([
        z.object({ status: z.literal("success"), name: z.string() }),
        z.object({ status: z.literal("failed"), name: z.string(), error: imageError }),
      ])
      .optional(),
  }),
  z.object({ status: z.literal("failed"), error: imageError }),
]);
export type GeneratedImage = z.infer<typeof generatedImage>;

export const imageGenerateResult = z.object({
  model: z.string().optional(),
  images: z.array(generatedImage).optional(),
  magic_prompt: z.object({ positive: z.string(), negative: z.string().optional() }).optional(),
});
export type ImageGenerateResult = z.infer<typeof imageGenerateResult>;

//
// Destinations
//

export const destination = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.object({ id: z.string() }).catchall(jsonValue),
  config: z.object({ path_template: z.string(), url_template: z.string().optional() }).partial(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Destination = z.infer<typeof destination>;

//
// Webhooks
//

const webhookEvents = z.union([z.literal("all"), z.array(z.string())]);

/** The HMAC signing secret is only ever returned by the create endpoint. */
export const createdWebhook = z.object({
  id: z.string(),
  enabled: z.boolean(),
  url: z.string(),
  secret: z.string(),
  events: webhookEvents,
  apiKeyIds: z.array(z.string()).nullish(),
  oauthEnabled: z.boolean().optional(),
  createdAt: z.string().optional(),
});
export type CreatedWebhook = z.infer<typeof createdWebhook>;

export const updatedWebhook = z.object({
  id: z.string(),
  enabled: z.boolean().optional(),
  url: z.string(),
  events: webhookEvents,
  apiKeyIds: z.array(z.string()).nullish(),
  oauthEnabled: z.boolean().optional(),
});
export type UpdatedWebhook = z.infer<typeof updatedWebhook>;
