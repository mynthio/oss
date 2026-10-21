import type { ImageGenerationOptions } from "@tanstack/ai";
import { resolveDebugOption } from "@tanstack/ai/adapter-internals";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createMynthImage, MynthImageAdapter, mynthImage } from "../src/adapter.ts";
import type { MynthImageConfig } from "../src/config.ts";
import { MynthNoImagesError, MynthTaskFailedError } from "../src/errors.ts";
import type {
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "../src/provider-options.ts";
import {
  apiError,
  BASE_URL,
  completedTask,
  createMockApi,
  type MockApi,
  generationRoutes,
  ok,
} from "./mock-api.ts";

const DEFAULT_MODEL = "krea/krea-2-large" as const;

/** TanStack AI always hands adapters a logger; this one has every category off. */
const silentLogger = resolveDebugOption(false);

type Options = ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>;

function createOptions(overrides: Partial<Options> = {}): Options {
  return { model: DEFAULT_MODEL, prompt: "A beautiful sunset", logger: silentLogger, ...overrides };
}

/** An adapter bound to any model, so tests can pass the options of every model. */
function createAdapter(
  api: MockApi,
  { model = DEFAULT_MODEL, ...config }: MynthImageConfig & { model?: string } = {},
) {
  return new MynthImageAdapter(
    { apiKey: "mak_test", baseURL: BASE_URL, fetch: api.fetch, ...config },
    model as "google/gemini-3.1-flash-image",
  );
}

/** Settle a call while fake timers drive the polling. */
async function run<T>(promise: Promise<T>): Promise<T> {
  // The caller awaits the outcome; this only keeps a rejection from going unhandled meanwhile.
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

async function sentBody(api: MockApi): Promise<unknown> {
  return api.requestsTo("POST /image/generate")[0]?.json();
}

describe("MynthImageAdapter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  describe("request mapping", () => {
    it("sends the prompt with the adapter-bound model", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api, { model: "auto" });

      // Act
      await run(adapter.generateImages(createOptions({ prompt: "test" })));

      // Assert
      expect(await sentBody(api)).toEqual({ prompt: "test", model: "auto" });
    });

    it("maps numberOfImages to count", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(adapter.generateImages(createOptions({ numberOfImages: 2 })));

      // Assert
      expect(await sentBody(api)).toMatchObject({ count: 2 });
    });

    it("forwards the top-level shorthand size", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(adapter.generateImages(createOptions({ size: "16:9_4k" })));

      // Assert
      expect(await sentBody(api)).toMatchObject({ size: "16:9_4k" });
    });

    it("prefers the provider size over the top-level size", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);
      const size = { type: "aspect_ratio", aspect_ratio: "4:5", scale: "4k" } as const;

      // Act
      await run(
        adapter.generateImages(createOptions({ size: "portrait", modelOptions: { size } })),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({ size });
    });

    it("maps negative and magic prompt options to their API fields", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({ modelOptions: { negativePrompt: "watermark", magicPrompt: false } }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        negative_prompt: "watermark",
        magic_prompt: false,
      });
    });

    it("forwards the remaining provider options under their API names", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            modelOptions: {
              generatePublicAccessToken: false,
              output: { format: "png" },
              webhook: { registered: false },
              rating: true,
              metadata: { userId: "u123" },
              destination: "my-bucket",
            },
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toEqual({
        prompt: "A beautiful sunset",
        model: DEFAULT_MODEL,
        generate_public_access_token: false,
        output: { format: "png" },
        webhook: { registered: false },
        rating: true,
        metadata: { userId: "u123" },
        destination: "my-bucket",
      });
    });

    it("sends the configured destination by default", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api, { destination: "configured" });

      // Act
      await run(adapter.generateImages(createOptions()));

      // Assert
      expect(await sentBody(api)).toMatchObject({ destination: "configured" });
    });

    it("falls back to the MYNTH_DESTINATION environment variable", async () => {
      // Arrange
      vi.stubEnv("MYNTH_DESTINATION", "from-env");
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(adapter.generateImages(createOptions()));

      // Assert
      expect(await sentBody(api)).toMatchObject({ destination: "from-env" });
    });

    it("lets modelOptions.destination override the configured destination", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api, { destination: "configured" });

      // Act
      await run(
        adapter.generateImages(createOptions({ modelOptions: { destination: "per-request" } })),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({ destination: "per-request" });
    });
  });

  describe("media prompts", () => {
    it("splits a content-part prompt into text and image inputs", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              { type: "text", content: "Put the person in this outfit" },
              {
                type: "image",
                source: { type: "url", value: "https://example.com/person.jpg" },
                metadata: { role: "reference" },
              },
              { type: "image", source: { type: "url", value: "https://example.com/outfit.jpg" } },
            ],
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        prompt: "Put the person in this outfit",
        inputs: [
          {
            type: "image",
            as: "reference",
            source: { type: "url", url: "https://example.com/person.jpg" },
          },
          { type: "image", source: { type: "url", url: "https://example.com/outfit.jpg" } },
        ],
      });
    });

    it("maps the character role to a Mynth reference", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              {
                type: "image",
                source: { type: "url", value: "https://example.com/character.jpg" },
                metadata: { role: "character" },
              },
            ],
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        inputs: [{ type: "image", as: "reference" }],
      });
    });

    it("uploads inline data and sends the uploaded URL", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "POST /image/upload": ok({ urls: ["https://cdn.mynth.io/uploads/input.png"] }),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              { type: "text", content: "edit this" },
              { type: "image", source: { type: "data", value: "QUJD", mimeType: "image/png" } },
            ],
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        inputs: [
          { type: "image", source: { type: "url", url: "https://cdn.mynth.io/uploads/input.png" } },
        ],
      });
    });

    it("sends a Mynth file handle as its URL", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              {
                type: "image",
                source: {
                  type: "file",
                  value: "https://cdn.mynth.io/input.png",
                  provider: "mynth",
                },
              },
            ],
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        inputs: [{ type: "image", source: { type: "url", url: "https://cdn.mynth.io/input.png" } }],
      });
    });

    it("rejects a file handle issued by another provider", async () => {
      // Arrange
      const adapter = createAdapter(createMockApi(generationRoutes()));

      // Act
      const result = run(
        adapter.generateImages(
          createOptions({
            prompt: [
              { type: "image", source: { type: "file", value: "file-abc", provider: "openai" } },
            ],
          }),
        ),
      );

      // Assert
      await expect(result).rejects.toThrow("issued by openai");
    });

    it.each(["mask", "control"] as const)("rejects the unsupported %s role", async (role) => {
      // Arrange
      const adapter = createAdapter(createMockApi(generationRoutes()));

      // Act
      const result = run(
        adapter.generateImages(
          createOptions({
            prompt: [
              {
                type: "image",
                source: { type: "url", value: "https://example.com/input.png" },
                metadata: { role },
              },
            ],
          }),
        ),
      );

      // Assert
      await expect(result).rejects.toThrow(`"${role}" image inputs`);
    });

    it("rejects video prompt parts before creating a task", async () => {
      // Arrange
      const api = createMockApi(generationRoutes());
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              { type: "video", source: { type: "url", value: "https://example.com/v.mp4" } },
            ],
          }),
        ),
      ).catch(() => {});

      // Assert
      expect(api.requests).toHaveLength(0);
    });

    it("appends modelOptions.inputs after the prompt's inputs", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "POST /image/upload": ok({ urls: ["https://cdn.mynth.io/uploads/style.png"] }),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      await run(
        adapter.generateImages(
          createOptions({
            prompt: [
              { type: "text", content: "blend" },
              {
                type: "image",
                source: { type: "url", value: "https://example.com/from-prompt.jpg" },
              },
            ],
            modelOptions: {
              inputs: ["https://example.com/ref.jpg", new Blob(["png"], { type: "image/png" })],
            },
          }),
        ),
      );

      // Assert
      expect(await sentBody(api)).toMatchObject({
        inputs: [
          { type: "image", source: { type: "url", url: "https://example.com/from-prompt.jpg" } },
          "https://example.com/ref.jpg",
          "https://cdn.mynth.io/uploads/style.png",
        ],
      });
    });
  });

  describe("result mapping", () => {
    it("returns normalized images with the revised prompt and usage", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "GET /tasks/tsk_1": ok(
            completedTask({
              cost: "0.024",
              result: {
                model: "black-forest-labs/flux.2-pro",
                magic_prompt: { positive: "An enhanced prompt" },
                images: [
                  { status: "success", url: "https://cdn.mynth.io/1.webp", mynth_url: "m1" },
                  { status: "success", url: "https://cdn.mynth.io/2.webp", mynth_url: "m2" },
                ],
              },
            }),
          ),
        }),
      );
      const adapter = createAdapter(api, { model: "auto" });

      // Act
      const result = await run(adapter.generateImages(createOptions()));

      // Assert
      expect(result).toEqual({
        id: "tsk_1",
        model: "black-forest-labs/flux.2-pro",
        images: [
          { url: "https://cdn.mynth.io/1.webp", revisedPrompt: "An enhanced prompt" },
          { url: "https://cdn.mynth.io/2.webp", revisedPrompt: "An enhanced prompt" },
        ],
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          billed: { quantity: 2, unit: "images" },
          cost: 0.024,
        },
      });
    });

    it("falls back to the Mynth CDN URL when an image has no destination URL", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "GET /tasks/tsk_1": ok(
            completedTask({
              result: {
                images: [
                  { status: "success", url: null, mynth_url: "https://cdn.mynth.io/copy.webp" },
                ],
              },
            }),
          ),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      const result = await run(adapter.generateImages(createOptions()));

      // Assert
      expect(result.images).toEqual([{ url: "https://cdn.mynth.io/copy.webp" }]);
    });

    it("returns only the successful images when some fail", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "GET /tasks/tsk_1": ok(
            completedTask({
              result: {
                images: [
                  { status: "success", url: "https://cdn.mynth.io/ok.webp", mynth_url: "m" },
                  { status: "failed", error: { code: "content_policy" } },
                ],
              },
            }),
          ),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      const result = await run(adapter.generateImages(createOptions()));

      // Assert
      expect(result.images).toEqual([{ url: "https://cdn.mynth.io/ok.webp" }]);
    });

    it("throws MynthNoImagesError when every image fails", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "GET /tasks/tsk_1": ok(
            completedTask({
              result: {
                images: [
                  { status: "failed", error: { code: "content_policy" } },
                  { status: "failed", error: { code: "provider_error" } },
                ],
              },
            }),
          ),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      const result = run(adapter.generateImages(createOptions()));

      // Assert
      await expect(result).rejects.toThrow(
        new MynthNoImagesError("tsk_1", [{ code: "content_policy" }, { code: "provider_error" }]),
      );
    });

    it("throws MynthTaskFailedError with the task's errors when the task fails", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({
          "GET /tasks/tsk_1/status": ok({ status: "failed" }),
          "GET /tasks/tsk_1": ok({
            id: "tsk_1",
            status: "failed",
            errors: [{ code: "provider_unavailable" }],
          }),
        }),
      );
      const adapter = createAdapter(api);

      // Act
      const result = run(adapter.generateImages(createOptions()));

      // Assert
      await expect(result).rejects.toThrow(
        new MynthTaskFailedError("tsk_1", [{ code: "provider_unavailable" }]),
      );
    });

    it("rejects with the API's error code when the task cannot be created", async () => {
      // Arrange
      const api = createMockApi({
        "POST /image/generate": apiError(402, {
          code: "insufficient_balance",
          message: "Balance too low",
        }),
      });
      const adapter = createAdapter(api);

      // Act
      const result = run(adapter.generateImages(createOptions()));

      // Assert
      await expect(result).rejects.toMatchObject({ code: "insufficient_balance", status: 402 });
    });
  });

  describe("cancellation", () => {
    it("rejects with the abort reason", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({ "GET /tasks/tsk_1/status": ok({ status: "pending" }) }),
      );
      const adapter = createAdapter(api);
      const controller = new AbortController();
      const result = adapter.generateImages(createOptions({ abortSignal: controller.signal }));
      result.catch(() => {});
      await vi.advanceTimersByTimeAsync(1_500);

      // Act
      controller.abort(new Error("client went away"));

      // Assert
      await expect(result).rejects.toThrow("client went away");
    });

    it("stops polling the task once aborted", async () => {
      // Arrange
      const api = createMockApi(
        generationRoutes({ "GET /tasks/tsk_1/status": ok({ status: "pending" }) }),
      );
      const adapter = createAdapter(api);
      const controller = new AbortController();
      adapter.generateImages(createOptions({ abortSignal: controller.signal })).catch(() => {});
      await vi.advanceTimersByTimeAsync(1_500);

      // Act
      controller.abort();
      await vi.advanceTimersByTimeAsync(60_000);

      // Assert
      expect(api.requestsTo("GET /tasks/tsk_1/status")).toHaveLength(1);
    });
  });

  describe("logging", () => {
    it("logs the request with the provider and model", async () => {
      // Arrange
      const logger = { request: vi.fn(), provider: vi.fn(), errors: vi.fn() };
      const adapter = createAdapter(createMockApi(generationRoutes()));

      // Act
      await run(adapter.generateImages(createOptions({ logger: logger as never })));

      // Assert
      expect(logger.request).toHaveBeenCalledWith(
        expect.stringContaining(`model=${DEFAULT_MODEL}`),
        {
          provider: "mynth",
          model: DEFAULT_MODEL,
        },
      );
    });

    it("logs a narrowed error payload before rethrowing", async () => {
      // Arrange
      const logger = { request: vi.fn(), provider: vi.fn(), errors: vi.fn() };
      const api = createMockApi({
        "POST /image/generate": apiError(402, { code: "insufficient_balance", message: "Low" }),
      });
      const adapter = createAdapter(api);

      // Act
      await run(adapter.generateImages(createOptions({ logger: logger as never }))).catch(() => {});

      // Assert
      expect(logger.errors).toHaveBeenCalledWith(expect.any(String), {
        error: { message: "Low", code: "insufficient_balance" },
        source: "mynth.generateImages",
      });
    });

    it("does not log a cancelled request as an error", async () => {
      // Arrange
      const logger = { request: vi.fn(), provider: vi.fn(), errors: vi.fn() };
      const api = createMockApi(
        generationRoutes({ "GET /tasks/tsk_1/status": ok({ status: "pending" }) }),
      );
      const adapter = createAdapter(api);
      const controller = new AbortController();
      const result = adapter.generateImages(
        createOptions({ logger: logger as never, abortSignal: controller.signal }),
      );
      result.catch(() => {});
      await vi.advanceTimersByTimeAsync(1_500);

      // Act
      controller.abort();
      await result.catch(() => {});

      // Assert
      expect(logger.errors).not.toHaveBeenCalled();
    });
  });
});

describe("createMynthImage", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates adapters that use the shared config", async () => {
    // Arrange
    const api = createMockApi(generationRoutes());
    const mynth = createMynthImage({ apiKey: "mak_shared", baseURL: BASE_URL, fetch: api.fetch });

    // Act
    await run(
      mynth("auto").generateImages({ model: "auto", prompt: "a cat", logger: silentLogger }),
    );

    // Assert
    expect(api.requests[0]?.headers.get("authorization")).toBe("Bearer mak_shared");
  });

  it("lets per-call config override the shared config", async () => {
    // Arrange
    const api = createMockApi(generationRoutes());
    const mynth = createMynthImage({ apiKey: "mak_shared", baseURL: BASE_URL, fetch: api.fetch });

    // Act
    await run(
      mynth("auto", { apiKey: "mak_override" }).generateImages({
        model: "auto",
        prompt: "a cat",
        logger: silentLogger,
      }),
    );

    // Assert
    expect(api.requests[0]?.headers.get("authorization")).toBe("Bearer mak_override");
  });
});

describe("mynthImage", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws when no API key is passed or set in the environment", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", "");

    // Act
    const create = () => mynthImage("auto");

    // Assert
    expect(create).toThrow("MYNTH_API_KEY");
  });
});
