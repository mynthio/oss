import type { MynthSDKTypes } from "@mynthio/sdk";
import type { ImageGenerationOptions } from "@tanstack/ai";
import { resolveDebugOption } from "@tanstack/ai/adapter-internals";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  MynthImageProviderOptions,
  MynthImageShorthandSize,
} from "../src/provider-options.ts";

const { generateMock, MockMynthImage } = vi.hoisted(() => {
  const generate = vi.fn();
  const MockMynthImageConstructor = vi.fn(function MockMynthImage() {
    return { generate };
  });

  return { generateMock: generate, MockMynthImage: MockMynthImageConstructor };
});

vi.mock("@mynthio/sdk", () => ({ MynthImage: MockMynthImage }));

const DEFAULT_MODEL = "krea/krea-2-large" as const;

const { MynthImageAdapter, createMynthImage, mynthImage } = await import("../src/adapter.ts");
const { MynthNoImagesError } = await import("../src/errors.ts");

function successImage(
  overrides: Partial<MynthSDKTypes.ImageResultImageSuccess> = {},
): MynthSDKTypes.ImageResultImageSuccess {
  return {
    status: "success",
    id: "img_1",
    url: "https://cdn.mynth.io/image1.webp",
    mynth_url: "https://cdn.mynth.io/image1.webp",
    size: "1024x1024",
    format: "webp",
    ...overrides,
  };
}

function failedImage(code: string): MynthSDKTypes.ImageResultImageFailure {
  return { status: "failed", error: { code } };
}

/** Mirrors the parts of the SDK's ImageGenerationResult the adapter reads. */
function createMockTask(
  overrides: {
    id?: string;
    model?: string;
    cost?: string | null;
    images?: MynthSDKTypes.ImageResultImage[];
    magicPrompt?: MynthSDKTypes.ImageResultMagicPrompt;
  } = {},
) {
  const images = overrides.images ?? [successImage()];
  const result = {
    model: overrides.model,
    images,
    ...(overrides.magicPrompt ? { magic_prompt: overrides.magicPrompt } : {}),
  };

  return {
    id: overrides.id ?? "task-123",
    data: { cost: overrides.cost === undefined ? "0.01" : overrides.cost },
    result,
    getImages: ({ includeFailed = false }: { includeFailed?: boolean } = {}) =>
      includeFailed ? images : images.filter((image) => image.status === "success"),
  };
}

/** TanStack AI always hands adapters a logger; this one has every category off. */
const silentLogger = resolveDebugOption(false);

function createOptions(
  overrides: Partial<
    ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>
  > = {},
): ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize> {
  return {
    model: DEFAULT_MODEL,
    prompt: "A beautiful sunset",
    logger: silentLogger,
    ...overrides,
  };
}

/** Adapters bound to any model, so tests can pass sizes of every model. */
function createAdapter(model: string = DEFAULT_MODEL) {
  return new MynthImageAdapter({ apiKey: "mak_test" }, model as "google/gemini-3.1-flash-image");
}

function sentRequest(): MynthSDKTypes.ImageGenerationClientRequest {
  return generateMock.mock.calls[0]?.[0];
}

describe("MynthImageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateMock.mockResolvedValue(createMockTask());
  });

  it("declares that it consumes provider file sources", () => {
    // Arrange & Act
    const adapter = createAdapter();

    // Assert
    expect(adapter.supportsFileSources).toBe(true);
  });

  describe("request mapping", () => {
    it("sends the prompt with the adapter-bound model", async () => {
      // Arrange
      const adapter = createAdapter("auto");

      // Act
      await adapter.generateImages(createOptions({ model: "auto", prompt: "test" }));

      // Assert
      expect(sentRequest()).toEqual({ prompt: "test", model: "auto" });
    });

    it("maps numberOfImages to count", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(createOptions({ numberOfImages: 2 }));

      // Assert
      expect(sentRequest()).toMatchObject({ count: 2 });
    });

    it("forwards the top-level shorthand size", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(createOptions({ size: "16:9_4k" }));

      // Assert
      expect(sentRequest()).toMatchObject({ size: "16:9_4k" });
    });

    it("prefers provider size over top-level size", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
        createOptions({
          size: "portrait",
          modelOptions: { size: { type: "aspect_ratio", aspectRatio: "4:5", scale: "4k" } },
        }),
      );

      // Assert
      expect(sentRequest()).toMatchObject({
        size: { type: "aspect_ratio", aspectRatio: "4:5", scale: "4k" },
      });
    });

    it("maps negative and magic prompt options to their API fields", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
        createOptions({ modelOptions: { negativePrompt: "watermark", magicPrompt: false } }),
      );

      // Assert
      expect(sentRequest()).toMatchObject({ negative_prompt: "watermark", magic_prompt: false });
    });

    it("forwards the remaining provider options unchanged", async () => {
      // Arrange
      const adapter = createAdapter();
      const modelOptions: MynthImageProviderOptions = {
        access: { pat: { enabled: false } },
        output: { format: "png" },
        webhook: { dashboard: false },
        rating: true,
        metadata: { userId: "u123" },
        destination: "my-bucket",
      };

      // Act
      await adapter.generateImages(createOptions({ modelOptions }));

      // Assert
      expect(sentRequest()).toEqual({
        prompt: "A beautiful sunset",
        model: DEFAULT_MODEL,
        ...modelOptions,
      });
    });

    it("forwards the abort signal to the SDK", async () => {
      // Arrange
      const adapter = createAdapter();
      const controller = new AbortController();

      // Act
      await adapter.generateImages(createOptions({ abortSignal: controller.signal }));

      // Assert
      expect(generateMock).toHaveBeenCalledWith(expect.any(Object), {
        signal: controller.signal,
      });
    });
  });

  describe("media prompts", () => {
    it("splits a content-part prompt into text and image inputs", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
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
      );

      // Assert
      expect(sentRequest()).toMatchObject({
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
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
        createOptions({
          prompt: [
            {
              type: "image",
              source: { type: "url", value: "https://example.com/character.jpg" },
              metadata: { role: "character" },
            },
          ],
        }),
      );

      // Assert
      expect(sentRequest().inputs).toEqual([
        {
          type: "image",
          as: "reference",
          source: { type: "url", url: "https://example.com/character.jpg" },
        },
      ]);
    });

    it("sends inline data as a file for the SDK to upload", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
        createOptions({
          prompt: [
            { type: "text", content: "edit this" },
            { type: "image", source: { type: "data", value: "QUJD", mimeType: "image/png" } },
          ],
        }),
      );

      // Assert
      const input = sentRequest().inputs?.[0] as MynthSDKTypes.ImageGenerationClientInput;
      const source = input.source as { type: "file"; file: Blob };
      expect(source.type).toBe("file");
      expect(source.file.type).toBe("image/png");
      expect(await source.file.text()).toBe("ABC");
    });

    it("sends a Mynth file handle as its URL", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      await adapter.generateImages(
        createOptions({
          prompt: [
            {
              type: "image",
              source: { type: "file", value: "https://cdn.mynth.io/input.png", provider: "mynth" },
            },
          ],
        }),
      );

      // Assert
      expect(sentRequest().inputs).toEqual([
        { type: "image", source: { type: "url", url: "https://cdn.mynth.io/input.png" } },
      ]);
    });

    it("rejects a file handle issued by another provider", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(
        createOptions({
          prompt: [
            { type: "image", source: { type: "file", value: "file-abc", provider: "openai" } },
          ],
        }),
      );

      // Assert
      await expect(result).rejects.toThrow("issued by openai");
      expect(generateMock).not.toHaveBeenCalled();
    });

    it.each(["mask", "control"] as const)("rejects the unsupported %s role", async (role) => {
      // Arrange
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(
        createOptions({
          prompt: [
            {
              type: "image",
              source: { type: "url", value: "https://example.com/input.png" },
              metadata: { role },
            },
          ],
        }),
      );

      // Assert
      await expect(result).rejects.toThrow(`"${role}" image inputs`);
      expect(generateMock).not.toHaveBeenCalled();
    });

    it("rejects video prompt parts", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(
        createOptions({
          prompt: [{ type: "video", source: { type: "url", value: "https://example.com/v.mp4" } }],
        }),
      );

      // Assert
      await expect(result).rejects.toThrow("only text and image prompt parts");
      expect(generateMock).not.toHaveBeenCalled();
    });

    it("appends provider modelOptions.inputs after prompt-derived inputs", async () => {
      // Arrange
      const adapter = createAdapter();
      const upload = new Blob(["png"], { type: "image/png" });

      // Act
      await adapter.generateImages(
        createOptions({
          prompt: [
            { type: "text", content: "blend" },
            {
              type: "image",
              source: { type: "url", value: "https://example.com/from-prompt.jpg" },
            },
          ],
          modelOptions: { inputs: ["https://example.com/style.jpg", upload] },
        }),
      );

      // Assert
      expect(sentRequest().inputs).toEqual([
        { type: "image", source: { type: "url", url: "https://example.com/from-prompt.jpg" } },
        "https://example.com/style.jpg",
        upload,
      ]);
    });
  });

  describe("result mapping", () => {
    it("returns normalized images with the revised prompt and usage", async () => {
      // Arrange
      generateMock.mockResolvedValue(
        createMockTask({
          model: DEFAULT_MODEL,
          cost: "0.024",
          images: [
            successImage({ url: "https://cdn.mynth.io/1.webp" }),
            successImage({ url: "https://cdn.mynth.io/2.webp" }),
          ],
          magicPrompt: { positive: "An enhanced prompt" },
        }),
      );
      const adapter = createAdapter();

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result).toEqual({
        id: "task-123",
        model: DEFAULT_MODEL,
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
      generateMock.mockResolvedValue(
        createMockTask({
          images: [successImage({ url: null, mynth_url: "https://cdn.mynth.io/copy.webp" })],
        }),
      );
      const adapter = createAdapter();

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.images).toEqual([{ url: "https://cdn.mynth.io/copy.webp" }]);
    });

    it("falls back to the requested model when the result omits it", async () => {
      // Arrange
      const adapter = createAdapter();

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.model).toBe(DEFAULT_MODEL);
    });

    it("omits the cost when the task reports none", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask({ cost: null }));
      const adapter = createAdapter();

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.usage).not.toHaveProperty("cost");
    });

    it("returns only the successful images when some fail", async () => {
      // Arrange
      generateMock.mockResolvedValue(
        createMockTask({
          images: [successImage({ url: "https://cdn.mynth.io/ok.webp" }), failedImage("NSFW")],
        }),
      );
      const adapter = createAdapter();

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.images).toEqual([{ url: "https://cdn.mynth.io/ok.webp" }]);
      expect(result.usage?.billed).toEqual({ quantity: 1, unit: "images" });
    });

    it("throws MynthNoImagesError when every image fails", async () => {
      // Arrange
      generateMock.mockResolvedValue(
        createMockTask({ images: [failedImage("NSFW"), failedImage("PROVIDER_ERROR")] }),
      );
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(createOptions());

      // Assert
      await expect(result).rejects.toThrow(MynthNoImagesError);
      await expect(result).rejects.toMatchObject({
        taskId: "task-123",
        code: "MYNTH_NO_IMAGES",
        errors: [{ code: "NSFW" }, { code: "PROVIDER_ERROR" }],
        message: "Mynth task task-123 completed without any images (NSFW, PROVIDER_ERROR)",
      });
    });

    it("propagates SDK failures", async () => {
      // Arrange
      generateMock.mockRejectedValue(new Error("generate failed"));
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(createOptions());

      // Assert
      await expect(result).rejects.toThrow("generate failed");
    });
  });

  describe("logging", () => {
    it("logs the request, then the error before rethrowing", async () => {
      // Arrange
      const logger = { request: vi.fn(), errors: vi.fn() };
      generateMock.mockRejectedValue(new Error("boom"));
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(createOptions({ logger: logger as never }));

      // Assert
      await expect(result).rejects.toThrow("boom");
      expect(logger.request).toHaveBeenCalledWith(
        expect.stringContaining(`model=${DEFAULT_MODEL}`),
        { provider: "mynth", model: DEFAULT_MODEL },
      );
      expect(logger.errors).toHaveBeenCalledWith(expect.any(String), {
        error: { message: "boom", code: undefined },
        source: "mynth.generateImages",
      });
    });

    it("logs prompt validation errors", async () => {
      // Arrange
      const logger = { request: vi.fn(), errors: vi.fn() };
      const adapter = createAdapter();

      // Act
      const result = adapter.generateImages(
        createOptions({
          logger: logger as never,
          prompt: [{ type: "audio", source: { type: "url", value: "https://example.com/a.mp3" } }],
        }),
      );

      // Assert
      await expect(result).rejects.toThrow();
      expect(logger.errors).toHaveBeenCalledOnce();
    });
  });
});

describe("createMynthImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses shared config for created adapters", () => {
    // Arrange
    const mynth = createMynthImage({ apiKey: "mak_test", baseUrl: "https://custom.api" });

    // Act
    mynth("auto");

    // Assert
    expect(MockMynthImage).toHaveBeenCalledWith({
      apiKey: "mak_test",
      baseUrl: "https://custom.api",
    });
  });

  it("lets per-call config override shared config", () => {
    // Arrange
    const mynth = createMynthImage({ apiKey: "mak_test", baseUrl: "https://default.api" });

    // Act
    mynth("auto", { apiKey: "mak_override", baseUrl: "https://override.api" });

    // Assert
    expect(MockMynthImage).toHaveBeenCalledWith({
      apiKey: "mak_override",
      baseUrl: "https://override.api",
    });
  });
});

describe("mynthImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes config through the shorthand factory", () => {
    // Arrange
    const config = { apiKey: "mak_test", baseUrl: "https://custom.api", destination: "bucket" };

    // Act
    mynthImage("auto", config);

    // Assert
    expect(MockMynthImage).toHaveBeenCalledWith(config);
  });
});
