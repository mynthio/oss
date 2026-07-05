import { MynthApiError } from "../domain/Errors.ts";
import {
  BalanceResponseSchema,
  MeResponseSchema,
  type Balance,
  type Me,
} from "../domain/Schemas.ts";
import { MynthApi, readJson, requireSuccess } from "./MynthApi.ts";

export class AccountService {
  constructor(private readonly api: MynthApi) {}

  async me(): Promise<Me> {
    const response = await this.api.execute("/me");
    await requireSuccess(response, "me");

    const parsed = MeResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid me response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }

  async balance(): Promise<Balance> {
    const response = await this.api.execute("/balance");
    await requireSuccess(response, "balance");

    const parsed = BalanceResponseSchema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new MynthApiError({
        message: "invalid balance response",
        status: response.status,
        cause: parsed.error,
      });
    }
    return parsed.data.data;
  }
}
