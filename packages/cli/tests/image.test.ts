import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { json, runCli, taskRoutes, withApi } from "./helpers.ts";

const completedGeneration = {
  type: "image.generate",
  status: "completed",
  cost: "0.0125",
  result: {
    model: "black-forest-labs/flux.2-pro",
    images: [
      {
        status: "success",
        id: "img_1",
        url: "https://cdn.test/a.webp",
        mynth_url: "https://mynth.test/a.webp",
        size: "1024x1024",
        format: "webp",
      },
    ],
  },
};

describe("image generate", () => {
  it("sends only the flags the caller set", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        const result = await runCli(["image", "generate", "-p", "a cat", "--async"], env);

        expect(result.status).toBe(0);
        expect(requests[0]?.body).toEqual({
          prompt: "a cat",
          access: { pat: { enabled: true } },
        });
      },
    );
  });

  it("sends output as a format-only object", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        await runCli(["image", "generate", "-p", "x", "--async", "--format", "png"], env);
        expect(requests[0]?.body).toMatchObject({ output: { format: "png" } });
      },
    );
  });

  it("no longer accepts --quality", async () => {
    const result = await runCli(["image", "generate", "-p", "x", "--quality", "90"]);

    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain("--quality");
  });

  it("sends magic_prompt only when --magic-prompt is passed", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        await runCli(["image", "generate", "-p", "x", "--async"], env);
        await runCli(["image", "generate", "-p", "x", "--async", "--magic-prompt"], env);

        expect(requests[0]?.body).not.toHaveProperty("magic_prompt");
        expect(requests[1]?.body).toMatchObject({ magic_prompt: true });
      },
    );
  });

  it("sends inputs as structured image sources with their role", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        await runCli(
          [
            "image",
            "generate",
            "-p",
            "x",
            "--async",
            "-i",
            "source:https://cdn.test/product.webp",
            "-i",
            "https://cdn.test/reference.webp",
          ],
          env,
        );

        expect(requests[0]?.body).toMatchObject({
          inputs: [
            {
              type: "image",
              as: "source",
              source: { type: "url", url: "https://cdn.test/product.webp" },
            },
            { type: "image", source: { type: "url", url: "https://cdn.test/reference.webp" } },
          ],
        });
      },
    );
  });

  it("rejects an unknown input role before making a request", async () => {
    const result = await runCli(["image", "generate", "-p", "x", "-i", "backdrop:./a.png"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain('invalid --input role "backdrop"');
  });

  it("sends request-level webhooks", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        await runCli(
          [
            "image",
            "generate",
            "-p",
            "x",
            "--async",
            "--webhook-url",
            "https://hooks.test/a",
            "--no-dashboard-webhooks",
          ],
          env,
        );

        expect(requests[0]?.body).toMatchObject({
          webhook: { dashboard: false, custom: [{ url: "https://hooks.test/a" }] },
        });
      },
    );
  });

  it("falls back to MYNTH_DESTINATION", async () => {
    await withApi(
      (request, response) => json(response, 201, { data: { taskId: "tsk_1" } }),
      async (env, requests) => {
        await runCli(["image", "generate", "-p", "x", "--async"], {
          ...env,
          MYNTH_DESTINATION: "bunny-prod",
        });
        expect(requests[0]?.body).toMatchObject({ destination: "bunny-prod" });
      },
    );
  });

  it("waits for the task and summarizes it as JSON", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_gen",
        createPath: "/image/generate",
        task: completedGeneration,
      }),
      async (env) => {
        const result = await runCli(["image", "generate", "-p", "x", "--json"], env);

        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual({
          taskId: "tsk_gen",
          status: "completed",
          images: [
            {
              status: "success",
              url: "https://cdn.test/a.webp",
              mynth_url: "https://mynth.test/a.webp",
              size: "1024x1024",
              format: "webp",
            },
          ],
          cost: "0.0125",
          model: "black-forest-labs/flux.2-pro",
        });
      },
    );
  });

  it("prints the estimate and generates nothing with --dry-run", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, {
          data: { estimatedCost: "0.03", currency: "usd", estimateKind: "upper_bound" },
        }),
      async (env, requests) => {
        const result = await runCli(["image", "generate", "-p", "x", "--dry-run"], env);

        expect(result.status).toBe(0);
        expect(result.stdout).toContain("Estimated cost: $0.03 (upper bound)");
        expect(requests.map((request) => request.url)).toEqual(["/image/generate/estimate"]);
      },
    );
  });
});

describe("image analysis", () => {
  it("returns rate results with the task id and cost", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_rate",
        createPath: "/image/rate",
        task: {
          type: "image.rate",
          status: "completed",
          cost: "0.0002",
          result: { url: "https://cdn.test/a.webp", level: "sfw" },
        },
      }),
      async (env) => {
        const result = await runCli(["image", "rate", "https://cdn.test/a.webp", "--json"], env);

        expect(result.status).toBe(0);
        expect(JSON.parse(result.stdout)).toEqual({
          taskId: "tsk_rate",
          cost: "0.0002",
          url: "https://cdn.test/a.webp",
          level: "sfw",
        });
      },
    );
  });

  it("sends custom rate levels as a custom-mode request", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_rate",
        createPath: "/image/rate",
        task: {
          type: "image.rate",
          status: "completed",
          cost: "0.0002",
          result: { url: "https://cdn.test/a.webp", level: "kids" },
        },
      }),
      async (env, requests) => {
        await runCli(
          [
            "image",
            "rate",
            "https://cdn.test/a.webp",
            "--json",
            "-l",
            "kids=Safe for children",
            "-l",
            "adults=Adults only",
          ],
          env,
        );

        expect(requests[0]?.body).toEqual({
          url: "https://cdn.test/a.webp",
          mode: "custom",
          levels: [
            { value: "kids", description: "Safe for children" },
            { value: "adults", description: "Adults only" },
          ],
        });
      },
    );
  });

  it("rejects fewer than two custom levels", async () => {
    const result = await runCli([
      "image",
      "rate",
      "https://cdn.test/a.webp",
      "-l",
      "only=One level",
    ]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("between 2 and 7 items");
  });

  it("returns alt text", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_alt",
        createPath: "/image/alt",
        task: {
          type: "image.alt",
          status: "completed",
          cost: "0.0001",
          result: { url: "https://cdn.test/a.webp", alt: "A tabby cat on a windowsill" },
        },
      }),
      async (env) => {
        const result = await runCli(["image", "alt", "https://cdn.test/a.webp", "--json"], env);

        expect(JSON.parse(result.stdout)).toMatchObject({
          taskId: "tsk_alt",
          alt: "A tabby cat on a windowsill",
        });
      },
    );
  });

  it("returns a review with findings and strengths", async () => {
    await withApi(
      taskRoutes({
        taskId: "tsk_review",
        createPath: "/image/review",
        task: {
          type: "image.review",
          status: "completed",
          cost: "0.02",
          result: {
            url: "https://cdn.test/a.webp",
            score: 3,
            summary: "Usable with small fixes.",
            findings: [
              {
                finding: "Left hand has six fingers",
                category: "anatomy",
                severity: "major",
                where: "lower left",
                confidence: "high",
              },
            ],
            strengths: [{ strength: "Clean studio lighting", confidence: "high" }],
          },
        },
      }),
      async (env) => {
        const human = await runCli(["image", "review", "https://cdn.test/a.webp"], env);

        expect(human.status).toBe(0);
        expect(human.stdout).toContain("Score: 3/4 — Usable, with fixes");
        expect(human.stdout).toContain("[major] anatomy — Left hand has six fingers");
        expect(human.stdout).toContain("Clean studio lighting");
      },
    );
  });

  it("rejects an unknown review effort", async () => {
    const result = await runCli([
      "image",
      "review",
      "https://cdn.test/a.webp",
      "--effort",
      "extreme",
    ]);

    expect(result.status).toBe(2);
  });
});

describe("image upload", () => {
  it("posts the files as multipart and maps URLs back to paths", async () => {
    await withApi(
      (request, response) =>
        json(response, 200, { data: { urls: ["https://cdn.test/uploaded.png"] } }),
      async (env, requests) => {
        const result = await runCli(["image", "upload", "tests/fixtures/pixel.png", "--json"], env);

        expect(result.status).toBe(0);
        expect(requests[0]?.url).toBe("/image/upload");
        expect(JSON.parse(result.stdout)).toEqual({
          images: [{ path: "tests/fixtures/pixel.png", url: "https://cdn.test/uploaded.png" }],
        });
      },
    );
  });

  it("rejects an unsupported extension before uploading", async () => {
    const result = await runCli(["image", "upload", "tests/fixtures/s3-secret.json"]);

    expect(result.status).toBe(2);
    expect(result.stderr).toContain("unsupported image extension");
  });
});

describe("image generate --output-dir", () => {
  it("downloads every succeeded image and reports the saved paths", async () => {
    const directory = await mkdtemp(join(tmpdir(), "mynth-cli-"));
    // Image URLs must point back at this throwaway server, whose port is only
    // known once it is listening.
    let base = "";

    try {
      await withApi(
        (request, response) => {
          if (request.url === "/image/generate") {
            return json(response, 201, { data: { taskId: "tsk_dl" } });
          }
          if (request.url === "/tasks/tsk_dl/status") {
            return json(response, 200, { data: { status: "completed" } });
          }
          if (request.url === "/tasks/tsk_dl") {
            return json(response, 200, {
              data: {
                id: "tsk_dl",
                type: "image.generate",
                status: "completed",
                cost: "0.01",
                request: {},
                createdAt: "2026-01-01T00:00:00.000Z",
                updatedAt: "2026-01-01T00:00:01.000Z",
                result: {
                  model: "m",
                  images: [
                    { status: "success", id: "img_1", url: `${base}/files/first.webp` },
                    { status: "failed", error: { code: "PROVIDER_ERROR" } },
                  ],
                },
              },
            });
          }
          if (request.url === "/files/first.webp") {
            response.statusCode = 200;
            response.end("image-bytes");
            return;
          }
          json(response, 404, { code: "NOT_FOUND" });
        },
        async (env) => {
          base = env["MYNTH_API_URL"]!;
          const result = await runCli(
            ["image", "generate", "-p", "x", "-o", directory, "--json"],
            env,
          );

          const payload = JSON.parse(result.stdout) as { downloadedFiles: string[] };
          expect(result.status).toBe(0);
          expect(payload.downloadedFiles).toHaveLength(1);
          expect(await readdir(directory)).toEqual(["first.webp"]);
          expect(await readFile(payload.downloadedFiles[0]!, "utf8")).toBe("image-bytes");
        },
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
