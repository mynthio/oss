import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const balance = {
  balance: "12.50",
  reserved: "0.50",
  available: "12.00",
  currency: "usd",
};

const meWithLimit = {
  userId: "user_1",
  auth: {
    method: "api-key",
    apiKey: {
      id: "key_1",
      name: "ci",
      keyPreview: "mak_abc...xyz",
      scopes: ["generate", "manage"],
      spending: {
        mode: "limited",
        limit: "50.00",
        period: "month",
        used: "10.00",
        remaining: "40.00",
      },
    },
  },
};

const route = (request: { url: string }, response: Parameters<typeof json>[0]) => {
  if (request.url === "/balance") return json(response, 200, { data: balance });
  if (request.url === "/me") return json(response, 200, { data: meWithLimit });
  return json(response, 404, { code: "NOT_FOUND" });
};

describe("balance", () => {
  it("shows the balance and the API key spending limit from /me", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["balance"], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Available: $12.00");
      expect(result.stdout).toContain("API key limit: $50.00 / month");
      expect(result.stdout).toContain("remaining: $40.00");
    });
  });

  it("emits balance and spending together in JSON", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["balance", "--json"], env);

      expect(JSON.parse(result.stdout)).toMatchObject({
        available: "12.00",
        spending: { mode: "limited", remaining: "40.00" },
      });
    });
  });
});

describe("whoami", () => {
  it("verifies credentials against the API and reports scopes", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["whoami"], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("api-key");
      expect(result.stdout).toContain("user:   user_1");
      expect(result.stdout).toContain("scopes: generate, manage");
      expect(result.stdout).toContain("spend:  $10.00 of $50.00 per month");
    });
  });

  it("exits 3 with no credentials at all", async () => {
    const result = await runCli(["whoami"], { XDG_CONFIG_HOME: "/nonexistent-mynth-test" });
    expect(result.status).toBe(3);
  });
});

describe("models", () => {
  it("lists the public catalog without an Authorization header", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, {
          data: [
            {
              id: "black-forest-labs/flux.2-pro",
              displayName: "FLUX.2 Pro",
              pricing: { perImage: { base: "0.04", "4k": "0.08" }, perInput: "0.002" },
            },
          ],
        }),
      async (env, requests) => {
        const result = await runCli(["models", "list"], env);

        expect(result.status).toBe(0);
        expect(requests[0]?.authorization).toBeUndefined();
        expect(result.stdout).toContain("black-forest-labs/flux.2-pro");
        expect(result.stdout).toContain("FLUX.2 Pro");
      },
    );
  });
});
