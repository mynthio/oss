import { z } from "zod";

export const WorkOSUserSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
});
export type WorkOSUser = z.infer<typeof WorkOSUserSchema>;

export const DeviceAuthorizationResponseSchema = z.object({
  device_code: z.string(),
  user_code: z.string(),
  verification_uri: z.string(),
  verification_uri_complete: z.string().optional(),
  expires_in: z.number(),
  interval: z.number().optional(),
});
export type DeviceAuthorizationResponse = z.infer<typeof DeviceAuthorizationResponseSchema>;

export const TokenResponseSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: WorkOSUserSchema.optional(),
  organization_id: z.string().optional(),
});
export type TokenResponse = z.infer<typeof TokenResponseSchema>;

export const WorkOSErrorResponseSchema = z.object({
  error: z.string().optional(),
  error_description: z.string().optional(),
  message: z.string().optional(),
  code: z.string().optional(),
});

export const OAuthCredentialsSchema = z.object({
  kind: z.literal("oauth"),
  access_token: z.string(),
  refresh_token: z.string(),
  expires_at: z.number(),
  user: WorkOSUserSchema.optional(),
});
export type OAuthCredentials = z.infer<typeof OAuthCredentialsSchema>;

export const ApiKeyCredentialsSchema = z.object({
  kind: z.literal("api_key"),
  api_key: z.string(),
});
export type ApiKeyCredentials = z.infer<typeof ApiKeyCredentialsSchema>;

export const CredentialsSchema = z.union([OAuthCredentialsSchema, ApiKeyCredentialsSchema]);
export type Credentials = z.infer<typeof CredentialsSchema>;

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ]),
);

export const UploadResponseSchema = z.object({
  data: z.object({
    urls: z.array(z.string()),
  }),
});

export const RateResultItemSchema = z.union([
  z.object({ status: z.literal("success"), url: z.string(), level: z.string() }),
  z.object({
    status: z.literal("failed"),
    url: z.string(),
    error: z.object({ code: z.string() }),
  }),
]);

export const RateResponseSchema = z.object({
  data: z.object({
    task: z.object({
      id: z.string(),
      status: z.literal("completed"),
      cost: z.string(),
    }),
    results: z.array(RateResultItemSchema),
  }),
});

export const GenerateResponseSchema = z.object({
  data: z.object({
    taskId: z.string(),
    access: z
      .object({
        publicAccessToken: z.string(),
      })
      .optional(),
  }),
});

export const TaskStatusSchema = z.object({
  data: z.object({
    status: z.union([z.literal("pending"), z.literal("completed"), z.literal("failed")]),
  }),
});

export const TaskDataSchema = z.object({
  id: z.string(),
  type: z.union([z.literal("image.generate"), z.literal("image.rate")]),
  status: z.union([z.literal("pending"), z.literal("completed"), z.literal("failed")]),
  userId: z.string(),
  apiKeyId: z.string().nullable(),
  cost: z.string().nullable(),
  request: JsonValueSchema,
  result: JsonValueSchema,
  errors: z
    .array(z.object({ code: z.string() }))
    .nullable()
    .optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskData = z.infer<typeof TaskDataSchema>;

export const TaskResponseSchema = z.object({
  data: TaskDataSchema,
});

export const TaskListItemSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  cost: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TaskListItem = z.infer<typeof TaskListItemSchema>;

export const TaskListResponseSchema = z.object({
  data: z.array(TaskListItemSchema),
});

export const ModelPricingSchema = z.object({
  perImage: z.object({
    base: z.string(),
    "4k": z.string().optional(),
  }),
  perInput: z.string().optional(),
});

export const ModelSchema = z.object({
  id: z.string(),
  displayName: z.string().nullable(),
  pricing: ModelPricingSchema.nullable(),
});
export type Model = z.infer<typeof ModelSchema>;

export const ModelsListResponseSchema = z.object({
  data: z.array(ModelSchema),
});
