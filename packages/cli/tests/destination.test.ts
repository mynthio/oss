import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const destination = {
  id: "dst_1",
  name: "bunny-prod",
  provider: { id: "bunny", storage_zone: "my-zone", region: "de" },
  config: { path_template: "images/{id}", url_template: "https://cdn.test/{path}" },
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const created = (
  request: { url: string; method: string },
  response: Parameters<typeof json>[0],
) => {
  if (request.method === "DELETE") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.url === "/destinations/dst_1/test") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (request.url === "/destinations" && request.method === "GET") {
    return json(response, 200, { data: [destination] });
  }
  return json(response, request.method === "POST" ? 201 : 200, { data: destination });
};

describe("destination create", () => {
  it("builds a bunny body from typed flags and a bare stdin secret", async () => {
    await withApi(created, async (env, requests) => {
      const result = await runCli(
        [
          "destination",
          "create",
          "bunny-prod",
          "--provider",
          "bunny",
          "--storage-zone",
          "my-zone",
          "--region",
          "de",
          "--path-template",
          "images/{id}",
          "--url-template",
          "https://cdn.test/{path}",
          "--secret",
          "tests/fixtures/bunny-secret.txt",
          "--json",
        ],
        env,
      );

      expect(result.status).toBe(0);
      expect(requests[0]?.body).toEqual({
        name: "bunny-prod",
        provider: { id: "bunny", storage_zone: "my-zone", region: "de" },
        config: { path_template: "images/{id}", url_template: "https://cdn.test/{path}" },
        secret: { password: "s3cret" },
      });
    });
  });

  it("builds an s3 body from a JSON secret file", async () => {
    await withApi(created, async (env, requests) => {
      await runCli(
        [
          "destination",
          "create",
          "s3-prod",
          "--provider",
          "s3",
          "--bucket",
          "my-bucket",
          "--region",
          "us-east-1",
          "--path-template",
          "images/{id}",
          "--secret",
          "tests/fixtures/s3-secret.json",
          "--json",
        ],
        env,
      );

      expect(requests[0]?.body).toEqual({
        name: "s3-prod",
        provider: { id: "s3", bucket: "my-bucket", region: "us-east-1" },
        config: { path_template: "images/{id}" },
        secret: { access_key_id: "AKIA", secret_access_key: "shh" },
      });
    });
  });

  it("reports the missing provider flag before making a request", async () => {
    const result = await runCli([
      "destination",
      "create",
      "r2-prod",
      "--provider",
      "r2",
      "--bucket",
      "b",
      "--path-template",
      "images/{id}",
      "--secret",
      "tests/fixtures/s3-secret.json",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--provider r2 requires --account-id");
  });

  it("rejects an invalid bunny region", async () => {
    const result = await runCli([
      "destination",
      "create",
      "b",
      "--provider",
      "bunny",
      "--storage-zone",
      "z",
      "--region",
      "mars",
      "--path-template",
      "p/{id}",
      "--secret",
      "tests/fixtures/bunny-secret.txt",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('invalid bunny --region "mars"');
  });

  it("rejects a name that is not a slug", async () => {
    const result = await runCli([
      "destination",
      "create",
      "Bunny Prod",
      "--provider",
      "bunny",
      "--storage-zone",
      "z",
      "--path-template",
      "p/{id}",
      "--secret",
      "tests/fixtures/bunny-secret.txt",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("invalid destination name");
  });

  it("refuses to mix --file with the typed flags", async () => {
    const result = await runCli([
      "destination",
      "create",
      "x",
      "--file",
      "tests/fixtures/s3-secret.json",
      "--provider",
      "bunny",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("not both");
  });

  it("still accepts a full --file body", async () => {
    await withApi(created, async (env, requests) => {
      const result = await runCli(
        [
          "destination",
          "create",
          "bunny-prod",
          "--file",
          "tests/fixtures/destination.json",
          "--json",
        ],
        env,
      );

      expect(result.status).toBe(0);
      expect(requests[0]?.body).toMatchObject({
        name: "bunny-prod",
        provider: { id: "bunny" },
      });
    });
  });
});

describe("destination lifecycle", () => {
  it("lists destinations as a table", async () => {
    await withApi(created, async (env) => {
      const result = await runCli(["destination", "list"], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("dst_1");
      expect(result.stdout).toContain("bunny");
    });
  });

  it("never sends name on update", async () => {
    await withApi(created, async (env, requests) => {
      await runCli(
        ["destination", "update", "dst_1", "--file", "tests/fixtures/destination.json", "--json"],
        env,
      );

      expect(requests[0]?.method).toBe("PUT");
      expect(requests[0]?.body).not.toHaveProperty("name");
    });
  });

  it("posts a probe path on test", async () => {
    await withApi(created, async (env, requests) => {
      const result = await runCli(["destination", "test", "dst_1", "--path", "probe/x.txt"], env);

      expect(result.status).toBe(0);
      expect(requests[0]?.body).toEqual({ path: "probe/x.txt" });
    });
  });

  it("refuses to delete without --yes", async () => {
    const result = await runCli(["destination", "delete", "dst_1"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("--yes");
  });

  it("works with API-key auth (no OAuth gate)", async () => {
    await withApi(created, async (env, requests) => {
      const result = await runCli(["destination", "list", "--json"], env);

      expect(result.status).toBe(0);
      expect(requests[0]?.authorization).toBe("Bearer mak_test");
    });
  });
});
