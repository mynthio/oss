import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { stripVTControlCharacters } from "node:util";
import type { AddressInfo } from "node:net";
import { json, runCli, withApi } from "./helpers.ts";
import { logo } from "../src/output/logo.ts";

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

  it("keeps the logo out of piped help", async () => {
    const result = await runCli(["--help"]);

    expect(result.stdout).not.toMatch(/[\u2580-\u2588]/u);
    expect(result.stdout.startsWith("Usage: mynth")).toBe(true);
  });

  it("draws the mint glyph with half blocks, 11 cells wide", () => {
    const lines = logo().split("\n");
    const width = (line: string) => [...stripVTControlCharacters(line)].length;

    expect(lines).toHaveLength(5);
    for (const line of lines) expect(width(line)).toBeLessThanOrEqual(11);
    expect(lines.join("")).toMatch(/[\u2580-\u2588]/u);
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
      (request, response) => json(response, status, { error: { code, message: "nope" } }),
      (env) => runCli(["balance"], env),
    );

  it("exits 3 on unauthorized", async () => {
    expect((await failing(401, "unauthorized")).status).toBe(3);
  });

  it("exits 3 on insufficient_scope", async () => {
    expect((await failing(403, "insufficient_scope")).status).toBe(3);
  });

  it("exits 4 on insufficient_balance", async () => {
    expect((await failing(402, "insufficient_balance")).status).toBe(4);
  });

  it("exits 4 on spending_limit_exceeded", async () => {
    expect((await failing(402, "spending_limit_exceeded")).status).toBe(4);
  });

  it("exits 4 on a 402 with an unknown code", async () => {
    expect((await failing(402, "something_new")).status).toBe(4);
  });

  it("exits 6 when plainly rate limited", async () => {
    expect((await failing(429, "rate_limited")).status).toBe(6);
  });

  it("exits 2 on validation_error", async () => {
    expect((await failing(400, "validation_error")).status).toBe(2);
  });

  it("exits 2 on invalid_json", async () => {
    expect((await failing(400, "invalid_json")).status).toBe(2);
  });

  it("exits 2 on unsupported_media_type", async () => {
    expect((await failing(415, "unsupported_media_type")).status).toBe(2);
  });

  it("exits 1 on a server error", async () => {
    expect((await failing(500, "internal_server_error")).status).toBe(1);
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
