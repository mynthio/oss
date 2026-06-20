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

  it("requires image generate prompt as an option", () => {
    const help = runCli("image", "generate", "--help");

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("(-p, --prompt text)");
    expect(help.stdout).toContain("Models: mynth models list");
    expect(help.stdout).toContain("Output quality 1-100");
    expect(help.stdout).not.toContain("<prompt>");

    const missingPrompt = runCli("image", "generate");

    expect(missingPrompt.status).toBe(1);
    expect(`${missingPrompt.stdout}${missingPrompt.stderr}`).toContain(
      "Expected to find option: '--prompt'",
    );
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

  it("sends image inputs using current API intent fields", async () => {
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
          "product:https://cdn.test/product.webp",
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
              intent: "product",
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

    expect(result.status).toBe(1);
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
              pricing: { perImage: { base: "0.03", "4k": "0.06" }, inputFee: "0.01" },
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
          pricing: { perImage: { base: "0.03", "4k": "0.06" }, inputFee: "0.01" },
        },
      ]);
      expect(requests).toEqual([{ url: "/models", authorization: undefined }]);
    } finally {
      await new Promise<void>((resolvePromise, reject) => {
        server.close((error) => (error ? reject(error) : resolvePromise()));
      });
    }
  });
});
