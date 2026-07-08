import { MynthApiError } from "../domain/Errors.ts";
import {
  DestinationListResponseSchema,
  DestinationResponseSchema,
  type DestinationPublic,
} from "../domain/Schemas.ts";
import { MynthApi, readJson, requireSuccess } from "./MynthApi.ts";

const jsonInit = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

export class DestinationService {
  constructor(private readonly api: MynthApi) {}

  async list(): Promise<ReadonlyArray<DestinationPublic>> {
    const response = await this.api.execute("/destinations");
    await requireSuccess(response, "destination list");
    const parsed = DestinationListResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid destination list response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async get(id: string): Promise<DestinationPublic> {
    const response = await this.api.execute(`/destinations/${id}`);
    await requireSuccess(response, "destination fetch");
    return this.parseOne(response);
  }

  async create(body: unknown): Promise<DestinationPublic> {
    const response = await this.api.execute("/destinations", jsonInit("POST", body));
    await requireSuccess(response, "destination create");
    return this.parseOne(response);
  }

  async update(id: string, body: unknown): Promise<DestinationPublic> {
    const response = await this.api.execute(`/destinations/${id}`, jsonInit("PUT", body));
    await requireSuccess(response, "destination update");
    return this.parseOne(response);
  }

  // 204 no body; a non-2xx (credential test failure) throws via requireSuccess.
  async test(id: string, path: string): Promise<void> {
    const response = await this.api.execute(`/destinations/${id}/test`, jsonInit("POST", { path }));
    await requireSuccess(response, "destination test");
  }

  async delete(id: string): Promise<void> {
    const response = await this.api.execute(`/destinations/${id}`, { method: "DELETE" });
    await requireSuccess(response, "destination delete");
  }

  private async parseOne(response: Response): Promise<DestinationPublic> {
    const parsed = DestinationResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid destination response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }
}

export type { DestinationPublic };
