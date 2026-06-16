import { MynthApiError } from "../domain/Errors.ts";
import { ModelsListResponseSchema, type Model } from "../domain/Schemas.ts";
import { MynthApi, readJson, readText } from "./MynthApi.ts";

export class ModelsService {
  constructor(private readonly api: MynthApi) {}

  async list(): Promise<ReadonlyArray<Model>> {
    const response = await this.api.executePublic("/models");

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await readText(response);
      throw new MynthApiError({
        message: `models fetch failed (${response.status}): ${bodyText || "no body"}`,
        status: response.status,
      });
    }

    const parsed = ModelsListResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid models response",
        status: response.status,
        cause: parsed.error,
      });
    }

    return parsed.data.data;
  }
}
