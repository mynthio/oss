import type { ImageGenerationOptions } from "@tanstack/ai";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { MynthImageProviderOptions, MynthImageShorthandSize } from "../src/provider-options";

const { generateMock, MockMynth } = vi.hoisted(() => {
  const generate = vi.fn();
  const MockMynthConstructor = vi.fn(function MockMynth() {
    return {
      generate,
    };
  });

  return {
    generateMock: generate,
    MockMynth: MockMynthConstructor,
  };
});

vi.mock("@mynthio/sdk", () => {
  return {
    default: MockMynth,
    Mynth: MockMynth,
  };
});

const DEFAULT_MODEL = "black-forest-labs/flux.2-dev" as const;

const { MynthImageAdapter, createMynthImage, mynthImage } = await import("../src/adapter");

function createMockTask(
  overrides: {
    id?: string;
    model?: string | undefined;
    images?: Array<{ status: string; url: string }>;
    promptEnhance?: { source: string; positive?: string } | undefined;
  } = {},
) {
  const images = overrides.images ?? [
    { status: "succeeded", url: "https://cdn.mynth.io/image1.webp" },
  ];

  return {
    id: overrides.id ?? "task-123",
    status: "completed",
    result: {
      model: overrides.model,
      images,
      cost: { images: "0.01", total: "0.012", fee: "0.002" },
      prompt_enhance: overrides.promptEnhance,
    },
    getImages: () => images.filter((img) => img.status === "succeeded"),
    urls: images.filter((img) => img.status === "succeeded").map((img) => img.url),
  };
}

function createOptions(
  overrides: Partial<
    ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize>
  > = {},
): ImageGenerationOptions<MynthImageProviderOptions, MynthImageShorthandSize> {
  return {
    model: DEFAULT_MODEL,
    prompt: "A beautiful sunset",
    ...overrides,
  };
}

describe("MynthImageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("generateImages", () => {
    it("uses the adapter-bound model in the SDK request", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask({ model: "auto" }));
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, "auto");
      const options: ImageGenerationOptions<MynthImageProviderOptions, "auto"> = {
        model: "auto",
        prompt: "test",
      };

      // Act
      await adapter.generateImages(options);

      // Assert
      expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ model: "auto" }));
    });

    it("maps numberOfImages to count", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask());
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      await adapter.generateImages(
        createOptions({
          numberOfImages: 2,
        }),
      );

      // Assert
      expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }));
    });

    it("prefers a structured prompt over the plain prompt", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask());
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);
      const promptStructured = {
        positive: "a cat",
        negative: "blurry",
        enhance: "prefer_magic" as const,
      };

      // Act
      await adapter.generateImages(
        createOptions({
          prompt: "ignored",
          modelOptions: { promptStructured },
        }),
      );

      // Assert
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: promptStructured }),
      );
    });

    it("prefers provider size over top-level size", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask());
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      await adapter.generateImages(
        createOptions({
          size: "portrait",
          modelOptions: {
            size: {
              type: "aspect_ratio",
              aspectRatio: "4:5",
            },
          },
        }),
      );

      // Assert
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          size: {
            type: "aspect_ratio",
            aspectRatio: "4:5",
          },
        }),
      );
    });

    it("forwards an optional 4k scale when provided", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask());
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      await adapter.generateImages(
        createOptions({
          modelOptions: {
            size: {
              type: "aspect_ratio",
              aspectRatio: "16:9",
              scale: "4k",
            },
          },
        }),
      );

      // Assert
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          size: {
            type: "aspect_ratio",
            aspectRatio: "16:9",
            scale: "4k",
          },
        }),
      );
    });

    it("translates provider-only options to the SDK request shape", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask());
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      await adapter.generateImages(
        createOptions({
          modelOptions: {
            access: { pat: { enabled: false } },
            output: { format: "png", quality: 90 },
            inputs: ["https://example.com/ref.jpg"],
            webhook: { enabled: true },
            contentRating: { enabled: true },
            metadata: { userId: "u123" },
          },
        }),
      );

      // Assert
      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          access: { pat: { enabled: false } },
          output: { format: "png", quality: 90 },
          inputs: ["https://example.com/ref.jpg"],
          webhook: { enabled: true },
          content_rating: { enabled: true },
          metadata: { userId: "u123" },
        }),
      );
    });

    it("returns normalized images with the revised prompt when Mynth enhances it", async () => {
      // Arrange
      generateMock.mockResolvedValue(
        createMockTask({
          model: DEFAULT_MODEL,
          promptEnhance: { source: "mynth", positive: "An enhanced prompt" },
        }),
      );
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result).toEqual({
        id: "task-123",
        model: DEFAULT_MODEL,
        images: [
          {
            url: "https://cdn.mynth.io/image1.webp",
            revisedPrompt: "An enhanced prompt",
          },
        ],
      });
    });

    it("falls back to the requested model when the SDK omits it", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask({ model: undefined }));
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.model).toBe(DEFAULT_MODEL);
    });

    it("filters out unsuccessful images from the normalized response", async () => {
      // Arrange
      generateMock.mockResolvedValue(
        createMockTask({
          model: DEFAULT_MODEL,
          images: [
            { status: "succeeded", url: "https://cdn.mynth.io/img1.webp" },
            { status: "failed", url: "https://cdn.mynth.io/failed.webp" },
          ],
        }),
      );
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.images).toEqual([{ url: "https://cdn.mynth.io/img1.webp" }]);
    });

    it("returns an empty image list when the task has no successful images", async () => {
      // Arrange
      generateMock.mockResolvedValue(createMockTask({ model: DEFAULT_MODEL, images: [] }));
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      const result = await adapter.generateImages(createOptions());

      // Assert
      expect(result.images).toEqual([]);
    });

    it("propagates SDK failures", async () => {
      // Arrange
      generateMock.mockRejectedValue(new Error("generate failed"));
      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, DEFAULT_MODEL);

      // Act
      const result = adapter.generateImages(createOptions());

      // Assert
      await expect(result).rejects.toThrow("generate failed");
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
    expect(MockMynth).toHaveBeenCalledWith({ apiKey: "mak_test", baseUrl: "https://custom.api" });
  });

  it("lets per-call config override shared config", () => {
    // Arrange
    const mynth = createMynthImage({ apiKey: "mak_test", baseUrl: "https://default.api" });

    // Act
    mynth("auto", { apiKey: "mak_override", baseUrl: "https://override.api" });

    // Assert
    expect(MockMynth).toHaveBeenCalledWith({
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
    const config = {
      apiKey: "mak_test",
      baseUrl: "https://custom.api",
    };

    // Act
    mynthImage("auto", config);

    // Assert
    expect(MockMynth).toHaveBeenCalledWith(config);
  });
});
