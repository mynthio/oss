import { readFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { isolatedConfigHome, json, runCli, withApi, type RecordedRequest } from "./helpers.ts";
import type { ServerResponse } from "node:http";

const DEVICE = {
  device_code: "dev_code_1",
  user_code: "WDJB-MJHT",
  verification_uri: "https://auth.test/device",
  verification_uri_complete: "https://auth.test/device?code=WDJB-MJHT",
  expires_in: 600,
  interval: 1,
};

const SESSION = {
  access_token: "wos_access_token",
  refresh_token: "wos_refresh_token",
  user: { id: "user_1", email: "tom@mynth.io" },
};

const createdKey = (scopes: ReadonlyArray<string>) => ({
  raw: "mak_live_secret",
  apiKey: {
    id: "key_1",
    name: "mynth-cli (test-host)",
    keyPreview: "mak_liv...ret",
    scopes,
  },
});

/** One server stands in for both WorkOS and the Mynth API, routed by path. */
const loginRoutes = (request: RecordedRequest, response: ServerResponse) => {
  if (request.url === "/user_management/authorize/device") {
    return json(response, 200, DEVICE);
  }
  if (request.url === "/user_management/authenticate") {
    return json(response, 200, SESSION);
  }
  if (request.url === "/api-key" && request.method === "POST") {
    const body = request.body as { scopes?: string[] };
    return json(response, 201, { data: createdKey(body.scopes ?? []) });
  }
  if (request.url === "/api-key/key_1" && request.method === "DELETE") {
    response.statusCode = 204;
    response.end();
    return;
  }
  json(response, 404, { code: "NOT_FOUND" });
};

const loginEnv = (env: NodeJS.ProcessEnv, configHome: string) => ({
  ...env,
  MYNTH_WORKOS_API_URL: env["MYNTH_API_URL"]!,
  MYNTH_WORKOS_CLIENT_ID: "client_test",
  MYNTH_API_KEY: undefined,
  XDG_CONFIG_HOME: configHome,
});

const readCredentials = async (configHome: string) =>
  JSON.parse(await readFile(join(configHome, "mynth", "credentials.json"), "utf8"));

describe("auth login", () => {
  it("mints an all-scopes API key and stores only that", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env, requests) => {
      const result = await runCli(["auth", "login"], loginEnv(env, configHome));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Check the page shows this code: WDJB-MJHT");
      expect(result.stdout).toContain("Logged in as tom@mynth.io");
      expect(result.stdout).toContain("https://mynth.io/dashboard/keys/key_1");

      const create = requests.find((request) => request.url === "/api-key");
      expect(create?.body).toMatchObject({ scopes: ["generate", "manage", "keys"] });
      // Minting must use the short-lived WorkOS token, not a stored key.
      expect(create?.authorization).toBe("Bearer wos_access_token");

      // Name and scopes are deliberately not persisted: the server owns them,
      // so a cached copy would go stale the moment the key is edited.
      const stored = await readCredentials(configHome);
      expect(stored).toEqual({
        kind: "api_key",
        api_key: "mak_live_secret",
        id: "key_1",
      });
      // No OAuth material ever reaches disk.
      expect(JSON.stringify(stored)).not.toContain("wos_refresh_token");
      expect(JSON.stringify(stored)).not.toContain("wos_access_token");
    });
  });

  it("never opens a browser when stdio is not a terminal", async () => {
    await withApi(loginRoutes, async (env) => {
      const result = await runCli(["auth", "login"], loginEnv(env, isolatedConfigHome()));

      // Tests run with piped stdio, so detection must decline and print instead.
      expect(result.stdout).toContain("Open: https://auth.test/device");
      expect(result.stdout).not.toContain("Opened:");
    });
  });

  it("prints the URL rather than opening it with --no-browser", async () => {
    await withApi(loginRoutes, async (env) => {
      const result = await runCli(
        ["auth", "login", "--no-browser"],
        loginEnv(env, isolatedConfigHome()),
      );

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("Open: https://auth.test/device");
      expect(result.stdout).not.toContain("Opened:");
    });
  });

  it("tells the user to type the code when the URL has none embedded", async () => {
    await withApi(
      (request, response) => {
        if (request.url === "/user_management/authorize/device") {
          const { verification_uri_complete: _omitted, ...bare } = DEVICE;
          return json(response, 200, bare);
        }
        loginRoutes(request, response);
      },
      async (env) => {
        const result = await runCli(["auth", "login"], loginEnv(env, isolatedConfigHome()));

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Enter this code: WDJB-MJHT");
        expect(result.stdout).not.toContain("Check the page shows");
      },
    );
  });

  it("writes the credentials file as 0600", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env) => {
      await runCli(["auth", "login"], loginEnv(env, configHome));

      const stats = await stat(join(configHome, "mynth", "credentials.json"));
      expect(stats.mode & 0o777).toBe(0o600);
    });
  });

  it("narrows scopes with --scopes", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env, requests) => {
      const result = await runCli(
        ["auth", "login", "--scopes", "generate,manage"],
        loginEnv(env, configHome),
      );

      expect(result.status).toBe(0);
      expect(requests.find((request) => request.url === "/api-key")?.body).toMatchObject({
        scopes: ["generate", "manage"],
      });
    });
  });

  it("rejects an unknown scope before contacting anything", async () => {
    await withApi(loginRoutes, async (env, requests) => {
      const result = await runCli(
        ["auth", "login", "--scopes", "generate,billing"],
        loginEnv(env, isolatedConfigHome()),
      );

      expect(result.status).toBe(3);
      expect(result.stderr).toContain("invalid --scopes: billing");
      expect(requests).toHaveLength(0);
    });
  });

  it("refuses to log in while MYNTH_API_KEY is set", async () => {
    await withApi(loginRoutes, async (env, requests) => {
      const result = await runCli(["auth", "login"], {
        ...loginEnv(env, isolatedConfigHome()),
        MYNTH_API_KEY: "mak_env",
      });

      expect(result.status).toBe(3);
      expect(result.stderr).toContain("takes precedence");
      expect(requests).toHaveLength(0);
    });
  });
});

describe("auth logout", () => {
  it("revokes the key it created, then clears the file", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env, requests) => {
      await runCli(["auth", "login"], loginEnv(env, configHome));
      const result = await runCli(["auth", "logout"], loginEnv(env, configHome));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("API key revoked");
      expect(
        requests.some((request) => request.method === "DELETE" && request.url === "/api-key/key_1"),
      ).toBe(true);
      await expect(readCredentials(configHome)).rejects.toThrow();
    });
  });

  it("leaves a manually configured key active", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env, requests) => {
      await runCli(["config", "set", "api-key", "mak_manual"], loginEnv(env, configHome));
      const result = await runCli(["auth", "logout"], loginEnv(env, configHome));

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("left active");
      expect(requests.some((request) => request.method === "DELETE")).toBe(false);
    });
  });

  it("clears locally and warns when revocation fails", async () => {
    const configHome = isolatedConfigHome();

    await withApi(
      (request, response) => {
        if (request.method === "DELETE") return json(response, 500, { code: "BOOM" });
        loginRoutes(request, response);
      },
      async (env) => {
        await runCli(["auth", "login"], loginEnv(env, configHome));
        const result = await runCli(["auth", "logout"], loginEnv(env, configHome));

        expect(result.status).toBe(0);
        expect(result.stderr).toContain("could not revoke API key key_1");
        await expect(readCredentials(configHome)).rejects.toThrow();
      },
    );
  });
});

describe("auth status", () => {
  it("reports the stored key without calling the API", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env, requests) => {
      await runCli(["auth", "login"], loginEnv(env, configHome));
      const before = requests.length;

      const result = await runCli(["auth", "status", "--json"], loginEnv(env, configHome));

      expect(JSON.parse(result.stdout)).toMatchObject({
        source: "stored",
        apiKeyId: "key_1",
      });
      expect(requests).toHaveLength(before);
    });
  });

  it("reports nothing that the server could have changed since login", async () => {
    const configHome = isolatedConfigHome();

    await withApi(loginRoutes, async (env) => {
      await runCli(["auth", "login"], loginEnv(env, configHome));
      const result = await runCli(["auth", "status"], loginEnv(env, configHome));

      expect(result.stdout).toContain("key:    key_1");
      // Scopes can be narrowed in the dashboard, so status must not claim them.
      expect(result.stdout).not.toContain("manage");
      expect(result.stdout).toContain("mynth whoami");
    });
  });

  it("reports no credentials on a clean machine", async () => {
    const result = await runCli(["auth", "status"], {
      XDG_CONFIG_HOME: isolatedConfigHome(),
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Not authenticated");
  });
});
