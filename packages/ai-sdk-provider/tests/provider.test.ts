import { NoSuchModelError } from "@ai-sdk/provider";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createMynth, mynth } from "../src/index.ts";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createMynth", () => {
  it("returns image models from the call shorthand, image() and imageModel()", () => {
    // Arrange
    const provider = createMynth({ apiKey: "mak_test" });

    // Act
    const models = [
      provider("black-forest-labs/flux-1-schnell"),
      provider.image("black-forest-labs/flux-1-schnell"),
      provider.imageModel("black-forest-labs/flux-1-schnell"),
    ];

    // Assert
    for (const model of models) {
      expect(model).toMatchObject({
        specificationVersion: "v4",
        provider: "mynth.image",
        modelId: "black-forest-labs/flux-1-schnell",
        maxImagesPerCall: 20,
        supportsFileInputs: true,
        supportsMaskInputs: false,
      });
    }
  });

  it("returns video models from video() and videoModel()", () => {
    // Arrange
    const provider = createMynth({ apiKey: "mak_test" });

    // Act
    const models = [
      provider.video("xai/grok-imagine-video-1.5-lite"),
      provider.videoModel("xai/grok-imagine-video-1.5-lite"),
    ];

    // Assert
    for (const model of models) {
      expect(model).toMatchObject({
        specificationVersion: "v4",
        provider: "mynth.video",
        modelId: "xai/grok-imagine-video-1.5-lite",
        maxVideosPerCall: 1,
      });
    }
  });

  it("is a v4 provider", () => {
    expect(createMynth().specificationVersion).toBe("v4");
  });

  it("throws NoSuchModelError for language and embedding models", () => {
    // Arrange
    const provider = createMynth({ apiKey: "mak_test" });

    // Act & Assert
    expect(() => provider.languageModel("gpt")).toThrow(NoSuchModelError);
    expect(() => provider.embeddingModel("embed")).toThrow(NoSuchModelError);
  });

  it("cannot be called with new", () => {
    // Arrange
    const provider = createMynth({ apiKey: "mak_test" }) as unknown as new (id: string) => unknown;

    // Act & Assert
    expect(() => new provider("black-forest-labs/flux-1-schnell")).toThrow(/new keyword/);
  });

  it("does not need an API key until a model generates", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", undefined as unknown as string);

    // Act & Assert
    expect(() => mynth.image("black-forest-labs/flux-1-schnell")).not.toThrow();
  });

  it("fails the call, not the import, when no API key is set", async () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", undefined as unknown as string);
    const model = createMynth().image("black-forest-labs/flux-1-schnell");

    // Act
    const call = model.doGenerate({
      prompt: "A cat",
      n: 1,
      size: undefined,
      aspectRatio: undefined,
      seed: undefined,
      files: undefined,
      mask: undefined,
      providerOptions: {},
    });

    // Assert
    await expect(call).rejects.toThrow(/MYNTH_API_KEY/);
  });
});
