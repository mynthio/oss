import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const KEY = {
  id: "key_1",
  name: "my-app",
  keyPreview: "mak_liv...ret",
  scopes: ["generate"],
  spendingLimit: "25.00",
  spendingLimitPeriod: "month",
  createdAt: "2026-01-01T00:00:00.000Z",
};

const route = (
  request: { method: string; body: unknown },
  response: Parameters<typeof json>[0],
) => {
  if (request.method === "DELETE") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.method === "POST") {
    const body = request.body as { name?: string; scopes?: string[] };
    return json(response, 201, {
      data: {
        raw: "mak_live_secret",
        apiKey: { ...KEY, name: body.name ?? null, scopes: body.scopes ?? [] },
      },
    });
  }
  json(response, 200, { data: [KEY] });
};

describe("api-key create", () => {
  it("defaults to the generate scope and prints the key once", async () => {
    await withApi(route, async (env, requests) => {
      const result = await runCli(["api-key", "create", "my-app"], env);

      expect(result.status).toBe(0);
      expect(requests[0]?.body).toEqual({ name: "my-app", scopes: ["generate"] });
      expect(result.stdout).toContain("mak_live_secret");
      expect(result.stdout).toContain("shown only once");
    });
  });

  it("passes explicit scopes through", async () => {
    await withApi(route, async (env, requests) => {
      await runCli(["api-key", "create", "ops", "--scopes", "generate,manage", "--json"], env);

      expect(requests[0]?.body).toMatchObject({ scopes: ["generate", "manage"] });
    });
  });

  it("rejects an unknown scope before making a request", async () => {
    await withApi(route, async (env, requests) => {
      const result = await runCli(["api-key", "create", "x", "--scopes", "billing"], env);

      expect(result.status).toBe(2);
      expect(result.stderr).toContain("invalid --scopes: billing");
      expect(requests).toHaveLength(0);
    });
  });

  it("surfaces the server's scope-escalation guidance", async () => {
    await withApi(
      (request, response) =>
        json(response, 403, {
          code: "SCOPE_ESCALATION",
          message:
            "A key created with API-key authentication always gets the `generate` scope. Sign in to the dashboard or use OAuth to create a key with `manage` or `keys`.",
        }),
      async (env) => {
        const result = await runCli(["api-key", "create", "x", "--scopes", "keys"], env);

        expect(result.status).toBe(3);
        expect(result.stderr).toContain("always gets the `generate` scope");
      },
    );
  });

  it("reports the account key limit", async () => {
    await withApi(
      (request, response) =>
        json(response, 400, { code: "API_KEY_LIMIT_REACHED", message: "API key limit reached" }),
      async (env) => {
        const result = await runCli(["api-key", "create", "x"], env);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain("API key limit reached");
      },
    );
  });
});

describe("api-key list and delete", () => {
  it("lists keys with their scopes and limit", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["api-key", "list"], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("key_1");
      expect(result.stdout).toContain("generate");
      expect(result.stdout).toContain("$25.00/month");
    });
  });

  it("refuses to delete without --yes", async () => {
    const result = await runCli(["api-key", "delete", "key_1"]);
    expect(result.status).toBe(2);
  });

  it("revokes with --yes", async () => {
    await withApi(route, async (env, requests) => {
      const result = await runCli(["api-key", "delete", "key_1", "--yes", "--json"], env);

      expect(result.status).toBe(0);
      expect(requests[0]?.method).toBe("DELETE");
      expect(requests[0]?.url).toBe("/api-key/key_1");
    });
  });
});
