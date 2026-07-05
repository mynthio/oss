import { describe, expect, it } from "vitest";
import { createServer } from "node:http";
import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const runCli = (...args: ReadonlyArray<string>) =>
  spawnSync("bun", ["run", "./src/bin.ts", ...args], {
    cwd: packageRoot,
    encoding: "utf8",
    env: { ...process.env, NO_COLOR: "1" },
  });

const runCliAsync = (
  args: ReadonlyArray<string>,
  env: NodeJS.ProcessEnv = {},
): Promise<{ readonly status: number | null; readonly stdout: string; readonly stderr: string }> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", ["run", "./src/bin.ts", ...args], {
      cwd: packageRoot,
      env: { ...process.env, ...env, NO_COLOR: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });

describe("mynth cli", () => {
  it("boots", () => {
    expect(true).toBe(true);
  });

  it("exposes the prompt as an optional option", () => {
    const help = runCli("image", "generate", "--help");

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("(-p, --prompt text)");
    expect(help.stdout).toContain("Models: mynth models list");
    expect(help.stdout).toContain("Output quality 1-100");
    expect(help.stdout).not.toContain("<prompt>");
  });

  it("sends optional image output settings as a complete output object", async () => {
    const requests: Array<{ readonly body: unknown }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push({ body: JSON.parse(body) });
        response.statusCode = 201;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ data: { taskId: `tsk_${requests.length}` } }));
      });
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;
    const env = {
      MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
      MYNTH_API_KEY: "mak_test",
    };

    try {
      const noOutput = await runCliAsync(["image", "generate", "-p", "test", "--async"], env);
      const formatOnly = await runCliAsync(
        ["image", "generate", "-p", "test", "--async", "--format", "png"],
        env,
      );
      const qualityOnly = await runCliAsync(
        ["image", "generate", "-p", "test", "--async", "--quality", "90"],
        env,
      );

      expect([noOutput.status, formatOnly.status, qualityOnly.status]).toEqual([0, 0, 0]);
      expect(requests.map((request) => request.body)).toEqual([
        {
          prompt: "test",
          access: { pat: { enabled: true } },
        },
        {
          prompt: "test",
          output: { format: "png", quality: 80 },
          access: { pat: { enabled: true } },
        },
        {
          prompt: "test",
          output: { format: "webp", quality: 90 },
          access: { pat: { enabled: true } },
        },
      ]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("sends image inputs using current API as fields", async () => {
    const requests: Array<{ readonly body: unknown }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        requests.push({ body: JSON.parse(body) });
        response.statusCode = 201;
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify({ data: { taskId: "tsk_inputs" } }));
      });
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;
    const env = {
      MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
      MYNTH_API_KEY: "mak_test",
    };

    try {
      const result = await runCliAsync(
        [
          "image",
          "generate",
          "-p",
          "test",
          "--async",
          "--input",
          "source:https://cdn.test/product.webp",
          "--input",
          "https://cdn.test/reference.webp",
        ],
        env,
      );

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(requests.map((request) => request.body)).toEqual([
        {
          prompt: "test",
          inputs: [
            {
              type: "image",
              as: "source",
              source: { type: "url", url: "https://cdn.test/product.webp" },
            },
            {
              type: "image",
              source: { type: "url", url: "https://cdn.test/reference.webp" },
            },
          ],
          access: { pat: { enabled: true } },
        },
      ]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("rejects image output quality outside the API range", () => {
    const result = runCli("image", "generate", "-p", "test", "--quality", "0");

    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain('invalid quality: "0" (expected 1-100)');
  });

  it("preserves image rate response fields from the API", async () => {
    const server = createServer((request, response) => {
      expect(request.url).toBe("/image/rate");
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: {
            task: { id: "tsk_rate", status: "completed", cost: "0.00020000" },
            results: [{ status: "success", url: "https://cdn.test/image.webp", level: "sfw" }],
          },
        }),
      );
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(["image", "rate", "https://cdn.test/image.webp", "--json"], {
        MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
        MYNTH_API_KEY: "mak_test",
      });

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual({
        task: { id: "tsk_rate", status: "completed", cost: "0.00020000" },
        results: [{ status: "success", url: "https://cdn.test/image.webp", level: "sfw" }],
      });
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("preserves task response fields from the API", async () => {
    const task = {
      id: "tsk_failed",
      type: "image.generate",
      status: "failed",
      userId: "user_123",
      apiKeyId: "key_123",
      cost: null,
      request: { prompt: "test", count: 1, output: { format: "webp", quality: 80 } },
      result: null,
      errors: null,
      createdAt: "2026-01-29T12:00:00.000Z",
      updatedAt: "2026-01-29T12:00:05.000Z",
    };
    const server = createServer((request, response) => {
      expect(request.url).toBe("/tasks/tsk_failed");
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: task }));
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(["task", "get", "tsk_failed", "--json"], {
        MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
        MYNTH_API_KEY: "mak_test",
      });

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual(task);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("documents the models list command", () => {
    const rootHelp = runCli("--help");
    const listHelp = runCli("models", "list", "--help");

    expect(rootHelp.status).toBe(0);
    expect(rootHelp.stdout).toContain("models");

    expect(listHelp.status).toBe(0);
    expect(listHelp.stdout).toContain("List available image generation models");
    expect(listHelp.stdout).toContain("(--json)");
  });

  it("documents the documentation commands", () => {
    // Arrange & Act
    const rootHelp = runCli("--help");
    const getHelp = runCli("docs", "get", "--help");
    const listHelp = runCli("docs", "list", "--help");

    // Assert
    expect({
      root: rootHelp.stdout.includes("docs"),
      get: getHelp.stdout.includes("Fetch a documentation page as Markdown"),
      list: listHelp.stdout.includes("Fetch the complete documentation index"),
      json: [getHelp.stdout.includes("(--json)"), listHelp.stdout.includes("(--json)")],
    }).toEqual({ root: true, get: true, list: true, json: [true, true] });
  });

  it("lists models from the public API without authorization", async () => {
    const requests: Array<{
      readonly url: string | undefined;
      readonly authorization: string | undefined;
    }> = [];
    const server = createServer((request, response) => {
      requests.push({
        url: request.url,
        authorization: request.headers.authorization,
      });
      response.setHeader("Content-Type", "application/json");
      response.end(
        JSON.stringify({
          data: [
            {
              id: "black-forest-labs/flux.2-pro",
              displayName: "FLUX.2 Pro",
              pricing: { perImage: { base: "0.03", "4k": "0.06" }, perInput: "0.01" },
            },
          ],
        }),
      );
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(["models", "list", "--json"], {
        MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
        MYNTH_API_KEY: "mak_should_not_be_sent",
      });

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual([
        {
          id: "black-forest-labs/flux.2-pro",
          displayName: "FLUX.2 Pro",
          pricing: { perImage: { base: "0.03", "4k": "0.06" }, perInput: "0.01" },
        },
      ]);
      expect(requests).toEqual([{ url: "/models", authorization: undefined }]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("waits for a task and prints the sync-generate summary", async () => {
    const task = {
      id: "tsk_wait",
      type: "image.generate",
      status: "completed",
      userId: "user_1",
      apiKeyId: null,
      cost: "0.01250000",
      request: { prompt: "test" },
      result: {
        model: "black-forest-labs/flux.2-pro",
        images: [
          {
            status: "success",
            url: "https://cdn.test/image.webp",
            mynth_url: "https://cdn.test/mynth.webp",
            size: "1024x1024",
          },
        ],
      },
      createdAt: "2026-07-04T10:00:00.000Z",
      updatedAt: "2026-07-04T10:00:05.000Z",
    };
    const urls: Array<string | undefined> = [];
    const server = createServer((request, response) => {
      urls.push(request.url);
      response.setHeader("Content-Type", "application/json");
      const payload =
        request.url === "/tasks/tsk_wait/status"
          ? { data: { status: "completed" } }
          : { data: task };
      response.end(JSON.stringify(payload));
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(["task", "wait", "tsk_wait", "--json"], {
        MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
        MYNTH_API_KEY: "mak_test",
      });

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual({
        taskId: "tsk_wait",
        status: "completed",
        images: [
          {
            status: "success",
            url: "https://cdn.test/image.webp",
            mynth_url: "https://cdn.test/mynth.webp",
            size: "1024x1024",
            rating: undefined,
          },
        ],
        cost: "0.01250000",
        model: "black-forest-labs/flux.2-pro",
      });
      expect(urls).toEqual(["/tasks/tsk_wait/status", "/tasks/tsk_wait"]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("exits non-zero when a waited task failed", async () => {
    const server = createServer((request, response) => {
      response.setHeader("Content-Type", "application/json");
      if (request.url === "/tasks/tsk_failed/status") {
        response.end(JSON.stringify({ data: { status: "failed" } }));
        return;
      }
      response.end(
        JSON.stringify({
          data: {
            id: "tsk_failed",
            type: "image.generate",
            status: "failed",
            userId: "user_1",
            apiKeyId: null,
            cost: null,
            request: { prompt: "test" },
            result: null,
            errors: [{ code: "GENERATION_FAILED" }],
            createdAt: "2026-07-04T10:00:00.000Z",
            updatedAt: "2026-07-04T10:00:05.000Z",
          },
        }),
      );
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(["task", "wait", "tsk_failed"], {
        MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
        MYNTH_API_KEY: "mak_test",
      });

      expect(result.status).toBe(1);
      expect(result.stdout).toContain("✗ Task tsk_failed");
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("rejects a non-positive task wait timeout", () => {
    const result = runCli("task", "wait", "tsk_x", "--timeout", "0");

    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain(
      'invalid --timeout: "0" (expected a positive integer)',
    );
  });

  describe("exit codes", () => {
    const withApiError = async (
      response: { readonly status: number; readonly body: unknown },
      args: ReadonlyArray<string>,
    ) => {
      const server = createServer((_request, res) => {
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(response.body));
      });
      await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
      const address = server.address() as AddressInfo;
      try {
        return await runCliAsync(args, {
          MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
          MYNTH_API_KEY: "mak_test",
        });
      } finally {
        await new Promise<void>((resolvePromise, reject) => {
          server.close((error) => (error ? reject(error) : resolvePromise()));
        });
      }
    };

    it("documents the exit codes in --help", () => {
      const help = runCli("--help");

      expect(help.status).toBe(0);
      expect(help.stdout).toContain("Exit codes:");
      expect(help.stdout).toContain("5  blocked by content moderation");
    });

    it("exits 2 on unknown options", () => {
      const result = runCli("task", "list", "--nope");

      expect(result.status).toBe(2);
    });

    it("exits 3 on authentication failures", async () => {
      const result = await withApiError(
        { status: 401, body: { code: "UNAUTHORIZED", message: "Invalid API key" } },
        ["task", "get", "tsk_x"],
      );

      expect(result.status).toBe(3);
      expect(result.stderr).toContain("UNAUTHORIZED");
    });

    it("exits 4 on insufficient credits", async () => {
      const result = await withApiError(
        { status: 422, body: { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance." } },
        ["image", "generate", "-p", "test", "--async"],
      );

      expect(result.status).toBe(4);
    });

    it("exits 6 when rate limited", async () => {
      const result = await withApiError(
        { status: 429, body: { code: "RATE_LIMITED", message: "Too many requests" } },
        ["task", "list"],
      );

      expect(result.status).toBe(6);
    });

    it("exits 5 when a waited task was blocked by content moderation", async () => {
      const server = createServer((request, response) => {
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/tasks/tsk_mod/status") {
          response.end(JSON.stringify({ data: { status: "failed" } }));
          return;
        }
        response.end(
          JSON.stringify({
            data: {
              id: "tsk_mod",
              type: "image.generate",
              status: "failed",
              userId: "user_1",
              apiKeyId: null,
              cost: null,
              request: { prompt: "test" },
              result: {
                images: [{ status: "failed", error: { code: "RESTRICTED_CONTENT" } }],
              },
              errors: null,
              createdAt: "2026-07-04T10:00:00.000Z",
              updatedAt: "2026-07-04T10:00:05.000Z",
            },
          }),
        );
      });

      await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
      const address = server.address() as AddressInfo;

      try {
        const result = await runCliAsync(["task", "wait", "tsk_mod"], {
          MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
          MYNTH_API_KEY: "mak_test",
        });

        expect(result.status).toBe(5);
      } finally {
        await new Promise<void>((resolvePromise, reject) => {
          server.close((error) => (error ? reject(error) : resolvePromise()));
        });
      }
    });
  });

  it("lists tasks with a limit", async () => {
    const tasks = [
      {
        id: "tsk_2",
        type: "image.generate",
        status: "completed",
        cost: "0.01250000",
        createdAt: "2026-07-04T10:05:00.000Z",
        updatedAt: "2026-07-04T10:05:10.000Z",
      },
      {
        id: "tsk_1",
        type: "image.rate",
        status: "failed",
        cost: null,
        createdAt: "2026-07-04T10:00:00.000Z",
        updatedAt: "2026-07-04T10:00:05.000Z",
      },
    ];
    const urls: Array<string | undefined> = [];
    const server = createServer((request, response) => {
      urls.push(request.url);
      response.setHeader("Content-Type", "application/json");
      response.end(JSON.stringify({ data: tasks }));
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;

    try {
      const result = await runCliAsync(
        ["task", "list", "--limit", "2", "--after", "tsk_9", "--json"],
        {
          MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
          MYNTH_API_KEY: "mak_test",
        },
      );

      expect(result).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(result.stdout)).toEqual({ tasks });
      expect(urls).toEqual(["/tasks?limit=2&after=tsk_9"]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });

  it("shows the balance and estimates generation cost with --dry-run", async () => {
    const seen: Array<{ readonly url: string | undefined; readonly body: unknown }> = [];
    const server = createServer((request, response) => {
      let body = "";
      request.setEncoding("utf8");
      request.on("data", (chunk) => {
        body += chunk;
      });
      request.on("end", () => {
        seen.push({ url: request.url, body: body.length > 0 ? JSON.parse(body) : undefined });
        response.setHeader("Content-Type", "application/json");
        if (request.url === "/balance") {
          response.end(
            JSON.stringify({
              data: { balance: "12.5", reserved: "0.2", available: "12.3", currency: "usd" },
            }),
          );
          return;
        }
        response.end(
          JSON.stringify({
            data: { estimatedCost: "0.008", currency: "usd", estimateKind: "exact" },
          }),
        );
      });
    });

    await new Promise<void>((resolvePromise) => server.listen(0, "127.0.0.1", resolvePromise));
    const address = server.address() as AddressInfo;
    const env = {
      MYNTH_API_URL: `http://127.0.0.1:${address.port}`,
      MYNTH_API_KEY: "mak_test",
    };

    try {
      const balance = await runCliAsync(["balance", "--json"], env);
      const dryRun = await runCliAsync(
        [
          "image",
          "generate",
          "-p",
          "test",
          "-m",
          "black-forest-labs/flux.1-dev",
          "-c",
          "2",
          "--dry-run",
        ],
        env,
      );

      expect(balance).toMatchObject({ status: 0, stderr: "" });
      expect(JSON.parse(balance.stdout)).toEqual({
        balance: "12.5",
        reserved: "0.2",
        available: "12.3",
        currency: "usd",
      });

      expect(dryRun).toMatchObject({ status: 0, stderr: "" });
      expect(dryRun.stdout).toContain("Estimated cost: $0.008");

      expect(seen).toEqual([
        { url: "/balance", body: undefined },
        {
          url: "/image/generate/estimate",
          body: { prompt: "test", model: "black-forest-labs/flux.1-dev", count: 2 },
        },
      ]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });
});
