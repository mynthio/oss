import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { json, runCli, withApi } from "./helpers.ts";

describe("help", () => {
  it("keeps the logo out of piped help", async () => {
    // Act
    const result = await runCli(["--help"]);

    // Assert
    expect({
      hasBlockGlyphs: /[\u2580-\u2588]/u.test(result.stdout),
      startsWithUsage: result.stdout.startsWith("Usage: mynth"),
    }).toEqual({ hasBlockGlyphs: false, startsWithUsage: true });
  });

  it("lists every top-level command", async () => {
    // Act
    const result = await runCli(["--help"]);

    // Assert
    expect(
      [
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
      ].filter((command) => !result.stdout.includes(command)),
    ).toEqual([]);
  });

  it("exits 2 on an unknown option", async () => {
    // Act
    const result = await runCli(["image", "generate", "--nonsense"]);

    // Assert
    expect(result.status).toBe(2);
  });
});

describe("exit codes", () => {
  const failing = (status: number, code: string) =>
    withApi(
      (request, response) => json(response, status, { error: { code, message: "nope" } }),
      (env) => runCli(["balance"], env),
    );

  it.each([
    [401, "unauthorized", 3],
    [403, "insufficient_scope", 3],
    [402, "insufficient_balance", 4],
    [402, "spending_limit_exceeded", 4],
    [402, "something_new", 4],
    [429, "rate_limited", 6],
    [400, "validation_error", 2],
    [400, "invalid_json", 2],
    [415, "unsupported_media_type", 2],
    [500, "internal_server_error", 1],
  ])("exits %i on %s", async (status, code, expected) => {
    // Act
    const result = await failing(status, code);

    // Assert
    expect(result.status).toBe(expected);
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

  it("reads pages under the docs path and the index from the site root", async () => {
    const requested: string[] = [];

    await withDocs(
      (url) => {
        requested.push(url);
        return { status: 200, body: "ok\n" };
      },
      async (env) => {
        const docsEnv = { MYNTH_DOCS_URL: `${env.MYNTH_DOCS_URL}/docs` };
        await runCli(["docs", "get", "concepts/tasks"], docsEnv);
        await runCli(["docs", "list"], docsEnv);
      },
    );

    expect(requested).toEqual(["/docs/concepts/tasks.md", "/llms.txt"]);
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
