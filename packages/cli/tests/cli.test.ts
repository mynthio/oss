import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { json, runCli, withApi } from "./helpers.ts";

describe("help", () => {
  it("documents the exit codes and environment variables", async () => {
    const result = await runCli(["--help"]);

    expect(result.status).toBe(0);
    for (const line of [
      "3  authentication error",
      "4  insufficient credits",
      "5  blocked by content moderation",
      "MYNTH_API_KEY",
      "MYNTH_DESTINATION",
    ]) {
      expect(result.stdout).toContain(line);
    }
  });

  it("lists every top-level command", async () => {
    const result = await runCli(["--help"]);

    for (const command of [
      "auth",
      "balance",
      "config",
      "destination",
      "docs",
      "image",
      "models",
      "task",
      "webhook",
      "whoami",
    ]) {
      expect(result.stdout).toContain(command);
    }
  });

  it("reports the package version", async () => {
    const result = await runCli(["--version"]);
    expect(result.status).toBe(0);
  });

  it("exits 2 on an unknown option", async () => {
    const result = await runCli(["image", "generate", "--nonsense"]);
    expect(result.status).toBe(2);
  });
});

describe("exit codes", () => {
  const failing = (status: number, code: string) =>
    withApi(
      (request, response) => json(response, status, { code, message: "nope" }),
      (env) => runCli(["balance"], env),
    );

  it("exits 3 on UNAUTHORIZED", async () => {
    expect((await failing(401, "UNAUTHORIZED")).status).toBe(3);
  });

  it("exits 3 on INSUFFICIENT_SCOPE", async () => {
    expect((await failing(403, "INSUFFICIENT_SCOPE")).status).toBe(3);
  });

  it("exits 4 on INSUFFICIENT_BALANCE", async () => {
    expect((await failing(422, "INSUFFICIENT_BALANCE")).status).toBe(4);
  });

  it("exits 4 on SPENDING_LIMIT_EXCEEDED even though it is a 429", async () => {
    expect((await failing(429, "SPENDING_LIMIT_EXCEEDED")).status).toBe(4);
  });

  it("exits 6 when plainly rate limited", async () => {
    expect((await failing(429, "RATE_LIMITED")).status).toBe(6);
  });

  it("exits 2 on VALIDATION_ERROR", async () => {
    expect((await failing(400, "VALIDATION_ERROR")).status).toBe(2);
  });

  it("exits 1 on a server error", async () => {
    expect((await failing(500, "INTERNAL_SERVER_ERROR")).status).toBe(1);
  });
});

describe("docs", () => {
  const withDocs = async <T>(
    handler: (url: string) => { status: number; body: string },
    fn: (env: NodeJS.ProcessEnv) => Promise<T>,
  ): Promise<T> => {
    const server = createServer((request, response) => {
      const { status, body } = handler(request.url ?? "/");
      response.statusCode = status;
      response.end(body);
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    const { port } = server.address() as AddressInfo;

    try {
      return await fn({ MYNTH_DOCS_URL: `http://127.0.0.1:${port}` });
    } finally {
      await new Promise<void>((done, fail) =>
        server.close((error) => (error ? fail(error) : done())),
      );
    }
  };

  it("prints a page as Markdown, without authentication", async () => {
    await withDocs(
      (url) =>
        url === "/guides/async-and-polling.md"
          ? { status: 200, body: "# Async and polling\n" }
          : { status: 404, body: "not found" },
      async (env) => {
        const result = await runCli(["docs", "get", "/guides/async-and-polling"], env);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("# Async and polling");
      },
    );
  });

  it("prints the index as JSON", async () => {
    await withDocs(
      () => ({ status: 200, body: "- /quickstart\n" }),
      async (env) => {
        const result = await runCli(["docs", "list", "--json"], env);
        expect(JSON.parse(result.stdout)).toEqual({ content: "- /quickstart\n" });
      },
    );
  });

  it("rejects traversal paths before making a request", async () => {
    const result = await runCli(["docs", "get", "../secrets"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("invalid segment");
  });

  it("rejects a URL in place of a path", async () => {
    const result = await runCli(["docs", "get", "https://example.com/x"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("not a URL");
  });

  it("rejects the .md suffix", async () => {
    const result = await runCli(["docs", "get", "quickstart.md"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain(".md suffix");
  });
});
