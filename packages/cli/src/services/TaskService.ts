import * as HttpClientRequest from "@effect/platform/HttpClientRequest";
import * as Effect from "effect/Effect";
import { MynthApiError } from "../domain/Errors.ts";
import { MynthApi } from "./MynthApi.ts";

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

export class TaskService extends Effect.Service<TaskService>()("TaskService", {
  effect: Effect.gen(function* () {
    const api = yield* MynthApi;

    const getTask = Effect.fn("TaskService.getTask")(function* (taskId: string) {
      const response = yield* api.execute(HttpClientRequest.get(`/tasks/${taskId}`));

      if (response.status < 200 || response.status >= 300) {
        const bodyText = yield* response.text.pipe(Effect.orElseSucceed(() => ""));
        return yield* new MynthApiError({
          message: `task fetch failed (${response.status}): ${bodyText || "no body"}`,
          status: response.status,
        });
      }

      const json = yield* response.json.pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid task response: ${cause.message}`,
              status: response.status,
            }),
        ),
      );
      return json as TaskData;
    });

    return { getTask } as const;
  }),
  dependencies: [MynthApi.Default],
}) {}
