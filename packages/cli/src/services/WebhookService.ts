import { MynthApiError } from "../domain/Errors.ts";
import {
  WebhookCreateResponseSchema,
  WebhookUpdateResponseSchema,
  type WebhookCreated,
  type WebhookUpdated,
} from "../domain/Schemas.ts";
import { MynthApi, readJson, requireSuccess } from "./MynthApi.ts";

export type WebhookEvents = "all" | ReadonlyArray<string>;

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export class WebhookService {
  constructor(private readonly api: MynthApi) {}

  async create(body: {
    enabled: boolean;
    url: string;
    events: WebhookEvents;
  }): Promise<WebhookCreated> {
    const response = await this.api.execute("/webhook", jsonInit("POST", body));
    await requireSuccess(response, "webhook create");
    const parsed = WebhookCreateResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid webhook create response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async update(
    id: string,
    body: { enabled: boolean; url: string; events: WebhookEvents },
  ): Promise<WebhookUpdated> {
    const response = await this.api.execute(`/webhook/${id}`, jsonInit("PUT", body));
    await requireSuccess(response, "webhook update");
    const parsed = WebhookUpdateResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid webhook update response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async delete(id: string): Promise<void> {
    const response = await this.api.execute(`/webhook/${id}`, { method: "DELETE" });
    await requireSuccess(response, "webhook delete");
  }
}
