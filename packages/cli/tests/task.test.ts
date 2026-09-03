import { describe, expect, it } from "vitest";
import { json, runCli, taskRoutes, withApi } from "./helpers.ts";

describe("task", () => {
  it("prints a task and preserves its fields in JSON", async () => {
    const task = {
      id: "tsk_get",
      type: "image.generate",
      status: "completed",
      userId: "user_1",
      apiKeyId: "key_1",
      cost: "0.0125",
      request: { prompt: "x" },
      result: { model: "m", images: [] },
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:01.000Z",
    };

    await withApi(
      (request, response) => json(response, 200, { data: task }),
      async (env) => {
        const result = await runCli(["task", "get", "tsk_get", "--json"], env);

        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual(task);
      },
    );
  });

  it("renders an unknown task type instead of failing to parse it", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, {
          data: {
            id: "tsk_video",
            type: "video.generate",
            status: "completed",
            cost: "0.5",
            result: { model: "bytedance/seedance-2.0-mini", videos: [] },
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:01.000Z",
          },
        }),
      async (env) => {
        const result = await runCli(["task", "get", "tsk_video"], env);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Type:    video.generate");
      },
    );
  });

  it("fetches only the result payload", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, {
          data: {
            id: "tsk_1",
            type: "image.alt",
            status: "completed",
            result: { url: "https://cdn.test/a.webp", alt: "A cat" },
          },
        }),
      async (env, requests) => {
        const result = await runCli(["task", "result", "tsk_1"], env);

        expect(requests[0]?.url).toBe("/tasks/tsk_1/result");
        expect(JSON.parse(result.stdout)).toEqual({ url: "https://cdn.test/a.webp", alt: "A cat" });
      },
    );
  });

  it("waits for a task and prints the generation summary", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_wait",
        createPath: "/never",
        task: {
          type: "image.generate",
          status: "completed",
          cost: "0.02",
          result: {
            model: "m",
            images: [{ status: "success", id: "img_1", url: "https://cdn.test/a.webp" }],
          },
        },
      }),
      async (env) => {
        const result = await runCli(["task", "wait", "tsk_wait", "--json"], env);

        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toMatchObject({
          taskId: "tsk_wait",
          status: "completed",
          images: [{ status: "success", url: "https://cdn.test/a.webp" }],
        });
      },
    );
  });

  it("exits 1 when the awaited task failed", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_failed",
        createPath: "/never",
        task: { type: "image.generate", status: "failed", errors: [{ code: "ENQUEUE_FAILED" }] },
      }),
      async (env) => {
        const result = await runCli(["task", "wait", "tsk_failed"], env);

        expect(result.status).toBe(1);
        expect(result.stdout).toContain("ENQUEUE_FAILED");
      },
    );
  });

  it("exits 5 when the awaited task was blocked by moderation", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_blocked",
        createPath: "/never",
        task: {
          type: "image.generate",
          status: "failed",
          errors: [{ code: "RESTRICTED_CONTENT" }],
        },
      }),
      async (env) => {
        const result = await runCli(["task", "wait", "tsk_blocked"], env);
        expect(result.status).toBe(5);
      },
    );
  });

  it("rejects a non-positive wait timeout", async () => {
    const result = await runCli(["task", "wait", "tsk_1", "--timeout", "0"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("expected a positive integer");
  });

  it("lists tasks with a limit and cursor", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, {
          data: [
            {
              id: "tsk_1",
              type: "image.generate",
              status: "completed",
              cost: "0.01",
              createdAt: "2026-01-01T00:00:00.000Z",
              updatedAt: "2026-01-01T00:00:01.000Z",
            },
          ],
        }),
      async (env, requests) => {
        const result = await runCli(["task", "list", "--limit", "5", "--after", "tsk_0"], env);

        expect(result.status).toBe(0);
        expect(requests[0]?.url).toBe("/tasks?limit=5&after=tsk_0");
        expect(result.stdout).toContain("tsk_1");
      },
    );
  });
});
