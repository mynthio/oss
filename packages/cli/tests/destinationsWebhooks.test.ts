import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MynthApiError } from "../src/domain/Errors.ts";
import { DestinationService } from "../src/services/DestinationService.ts";
import { WebhookService } from "../src/services/WebhookService.ts";
import type { MynthApi } from "../src/services/MynthApi.ts";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runCli = (args: ReadonlyArray<string>, env: NodeJS.ProcessEnv = {}) =>
  spawnSync("bun", ["run", "./src/bin.ts", ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, ...env, NO_COLOR: "1" },
  });

// Minimal MynthApi stand-in: records calls, returns a canned Response.
class FakeApi {
  readonly calls: Array<{ path: string; init: RequestInit | undefined }> = [];
  constructor(private readonly responder: (path: string, init?: RequestInit) => Response) {}
  async execute(path: string, init?: RequestInit): Promise<Response> {
    this.calls.push({ path, init });
    return this.responder(path, init);
  }
}

const asApi = (fake: FakeApi): MynthApi => fake as unknown as MynthApi;

describe("destination service", () => {
  it("sends the create body verbatim and returns a secret-free destination", async () => {
    const created = {
      id: "dst_1",
      name: "my-bucket",
      provider: { id: "s3", bucket: "my-bucket", region: "us-east-1" },
      config: { path_template: "/images/{id}" },
      createdAt: "2026-07-08T10:00:00.000Z",
      updatedAt: "2026-07-08T10:00:00.000Z",
    };
    const fake = new FakeApi(
      () => new Response(JSON.stringify({ data: created }), { status: 201 }),
    );
    const body = {
      name: "my-bucket",
      provider: { id: "s3", bucket: "my-bucket", region: "us-east-1" },
      config: { path_template: "/images/{id}" },
      secret: { access_key_id: "AK", secret_access_key: "SK" },
    };

    const result = await new DestinationService(asApi(fake)).create(body);

    expect(fake.calls).toHaveLength(1);
    expect(fake.calls[0]!.path).toBe("/destinations");
    expect(fake.calls[0]!.init?.method).toBe("POST");
    expect(JSON.parse(fake.calls[0]!.init?.body as string)).toEqual(body);
    expect(result).toEqual(created);
    expect(result).not.toHaveProperty("secret");
  });

  it("resolves on a 204 test and throws on a failed credential test", async () => {
    const ok = new DestinationService(
      asApi(new FakeApi(() => new Response(null, { status: 204 }))),
    );
    await expect(ok.test("dst_1", "mynth-cli-test/x.txt")).resolves.toBeUndefined();

    const bad = new DestinationService(
      asApi(
        new FakeApi(
          () => new Response(JSON.stringify({ message: "access denied" }), { status: 400 }),
        ),
      ),
    );
    await expect(bad.test("dst_1", "mynth-cli-test/x.txt")).rejects.toBeInstanceOf(MynthApiError);
  });
});

describe("webhook service", () => {
  it("returns the one-time signing secret from create", async () => {
    const fake = new FakeApi(
      () =>
        new Response(
          JSON.stringify({
            data: {
              id: "wh_1",
              userId: "user_1",
              enabled: true,
              url: "https://app.test/hook",
              secret: "whsec_abc123",
              events: ["task.image.generate.completed"],
              createdAt: "2026-07-08T10:00:00.000Z",
              updatedAt: "2026-07-08T10:00:00.000Z",
            },
          }),
          { status: 201 },
        ),
    );

    const result = await new WebhookService(asApi(fake)).create({
      enabled: true,
      url: "https://app.test/hook",
      events: ["task.image.generate.completed"],
    });

    expect(fake.calls[0]!.path).toBe("/webhook");
    expect(result.secret).toBe("whsec_abc123");
  });
});

describe("oauth-only command gate", () => {
  it("exits 3 without a network call when authenticated by API key", () => {
    let hit = false;
    const server = createServer((_request, response) => {
      hit = true;
      response.statusCode = 200;
      response.end("{}");
    });

    return new Promise<void>((done, fail) => {
      server.listen(0, "127.0.0.1", () => {
        const address = server.address() as AddressInfo;
        const result = runCli(["destination", "list"], {
          MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
          MYNTH_API_KEY: "mak_test",
        });
        server.close((error) => {
          if (error) return fail(error);
          try {
            expect(result.status).toBe(3);
            expect(hit).toBe(false);
            expect(`${result.stdout}${result.stderr}`).toContain("OAuth login");
            done();
          } catch (assertion) {
            fail(assertion);
          }
        });
      });
    });
  });

  it("exits 2 when destination delete is missing --yes", () => {
    const result = runCli(["destination", "delete", "dst_1"], { MYNTH_API_KEY: "mak_test" });
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain("--yes");
  });

  it("registers destination and webhook commands", () => {
    const help = runCli(["--help"]);
    expect(help.status).toBe(0);
    expect(help.stdout).toContain("destination");
    expect(help.stdout).toContain("webhook");
  });
});
