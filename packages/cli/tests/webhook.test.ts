import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const webhook = {
  id: "whk_1",
  enabled: true,
  url: "https://hooks.test/mynth",
  secret: "whsec_abc",
  events: ["task.completed"],
  apiKeyIds: null,
  oauthEnabled: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

const route = (request: { method: string }, response: Parameters<typeof json>[0]) => {
  if (request.method === "DELETE") {
    response.statusCode = 204;
    response.end();
    return;
  }
  json(response, request.method === "POST" ? 201 : 200, { data: webhook });
};

describe("webhook create", () => {
  it("prints the one-time signing secret", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(
        ["webhook", "create", "--url", "https://hooks.test/mynth", "-e", "task.completed"],
        env,
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Signing secret: whsec_abc");
      expect(result.stdout).toContain("shown only once");
    });
  });

  it("mirrors the API default by omitting oauthEnabled", async () => {
    await withApi(route, async (env, requests) => {
      await runCli(
        [
          "webhook",
          "create",
          "--url",
          "https://hooks.test/mynth",
          "-e",
          "task.completed",
          "--json",
        ],
        env,
      );

      expect(requests[0]?.body).toEqual({
        enabled: true,
        url: "https://hooks.test/mynth",
        events: ["task.completed"],
      });
    });
  });

  it("opts into OAuth deliveries and API key scoping when asked", async () => {
    await withApi(route, async (env, requests) => {
      await runCli(
        [
          "webhook",
          "create",
          "--url",
          "https://hooks.test/mynth",
          "-e",
          "task.completed",
          "--oauth-events",
          "--api-key-id",
          "key_1",
          "--api-key-id",
          "key_2",
          "--json",
        ],
        env,
      );

      expect(requests[0]?.body).toMatchObject({
        oauthEnabled: true,
        apiKeyIds: ["key_1", "key_2"],
      });
    });
  });

  it("collapses `all` into the server shorthand", async () => {
    await withApi(route, async (env, requests) => {
      await runCli(
        ["webhook", "create", "--url", "https://hooks.test/mynth", "-e", "all", "--json"],
        env,
      );

      expect(requests[0]?.body).toMatchObject({ events: "all" });
    });
  });

  it("accepts video events", async () => {
    await withApi(route, async (env, requests) => {
      const result = await runCli(
        [
          "webhook",
          "create",
          "--url",
          "https://hooks.test/mynth",
          "-e",
          "task.video.generate.completed",
          "--json",
        ],
        env,
      );

      expect(result.status).toBe(0);
      expect(requests[0]?.body).toMatchObject({ events: ["task.video.generate.completed"] });
    });
  });

  it("rejects an unknown event before making a request", async () => {
    const result = await runCli([
      "webhook",
      "create",
      "--url",
      "https://hooks.test/mynth",
      "-e",
      "task.exploded",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('unknown event "task.exploded"');
  });

  it("requires at least one event", async () => {
    const result = await runCli(["webhook", "create", "--url", "https://hooks.test/mynth"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("at least one --event is required");
  });
});

describe("webhook lifecycle", () => {
  it("rejects --enabled together with --disabled", async () => {
    const result = await runCli([
      "webhook",
      "update",
      "whk_1",
      "--url",
      "https://hooks.test/mynth",
      "-e",
      "all",
      "--enabled",
      "--disabled",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("mutually exclusive");
  });

  it("refuses to delete without --yes", async () => {
    const result = await runCli(["webhook", "delete", "whk_1"]);
    expect(result.status).toBe(2);
  });

  it("deletes with --yes", async () => {
    await withApi(route, async (env, requests) => {
      const result = await runCli(["webhook", "delete", "whk_1", "--yes", "--json"], env);

      expect(result.status).toBe(0);
      expect(requests[0]?.method).toBe("DELETE");
      expect(JSON.parse(result.stdout)).toEqual({ deleted: "whk_1" });
    });
  });
});
