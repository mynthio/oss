import { MynthApiError } from "../domain/Errors.ts";
import { MynthApi, readJson, readText } from "./MynthApi.ts";

export type TaskData = {
  readonly id: string;
  readonly type: string;
  readonly status: "pending" | "completed" | "failed";
  readonly userId: string;
  readonly apiKeyId: string | null;
  readonly cost: string | null;
  readonly request: unknown;
  readonly result: unknown;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export class TaskService {
  constructor(private readonly api: MynthApi) {}

  async getTask(taskId: string): Promise<TaskData> {
    const response = await this.api.execute(`/tasks/${taskId}`);

    if (response.status < 200 || response.status >= 300) {
      const bodyText = await readText(response);
      throw new MynthApiError({
        message: `task fetch failed (${response.status}): ${bodyText || "no body"}`,
        status: response.status,
      });
    }

    const json = (await readJson(response)) as { readonly data?: unknown };
    if (json.data === undefined) {
      throw new MynthApiError({
        message: "invalid task response: missing data",
        status: response.status,
      });
    }
    return json.data as TaskData;
  }
}
