import type { ImageGenerationOptions } from "@tanstack/ai"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MynthImageProviderOptions } from "../src/provider-options"

vi.mock("@mynthio/sdk", () => {
  const generate = vi.fn()
  const MockMynth = vi.fn().mockImplementation(() => ({
    generate,
  }))

  return {
    __generate: generate,
    default: MockMynth,
    Mynth: MockMynth,
  }
})

const { MynthImageAdapter, createMynthImage, mynthImage } = await import("../src/adapter")
const sdkMock = (await import("@mynthio/sdk")) as {
  __generate: ReturnType<typeof vi.fn>
  default: ReturnType<typeof vi.fn>
}
const { __generate: generateMock, default: MockMynth } = sdkMock

function createMockTask(overrides: {
  id?: string
  model?: string
  images?: Array<{ status: string; url: string }>
  promptEnhance?: { source: string; positive?: string }
} = {}) {
  const images = overrides.images ?? [
    { status: "succeeded", url: "https://cdn.mynth.io/image1.webp" },
  ]

  return {
    id: overrides.id ?? "task-123",
    status: "completed",
    result: {
      model: overrides.model ?? "black-forest-labs/flux.2-dev",
      images,
      cost: { images: "0.01", total: "0.012", fee: "0.002" },
      prompt_enhance: overrides.promptEnhance ?? undefined,
    },
    getImages: () => images.filter((img) => img.status === "succeeded"),
    urls: images.filter((img) => img.status === "succeeded").map((img) => img.url),
  }
}

describe("MynthImageAdapter", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("should have kind 'image' and name 'mynth'", () => {
    const adapter = new MynthImageAdapter(
      { apiKey: "mak_test" },
      "black-forest-labs/flux.2-dev",
    )

    expect(adapter.kind).toBe("image")
    expect(adapter.name).toBe("mynth")
    expect(adapter.model).toBe("black-forest-labs/flux.2-dev")
  })

  describe("generateImages", () => {
    it("should generate images with basic prompt", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      const options: ImageGenerationOptions<MynthImageProviderOptions> = {
        model: "black-forest-labs/flux.2-dev",
        prompt: "A beautiful sunset",
      }

      const result = await adapter.generateImages(options)

      expect(result.id).toBe("task-123")
      expect(result.model).toBe("black-forest-labs/flux.2-dev")
      expect(result.images).toHaveLength(1)
      expect(result.images[0]!.url).toBe("https://cdn.mynth.io/image1.webp")
    })

    it("should pass numberOfImages as count", async () => {
      generateMock.mockResolvedValue(
        createMockTask({
          images: [
            { status: "succeeded", url: "https://cdn.mynth.io/img1.webp" },
            { status: "succeeded", url: "https://cdn.mynth.io/img2.webp" },
          ],
        }),
      )

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
        numberOfImages: 2,
      })

      expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ count: 2 }))
    })

    it("should pass size from TanStack options", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
        size: "1024x1024",
      })

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ size: "1024x1024" }),
      )
    })

    it("should prefer modelOptions.size over TanStack size", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
        size: "1024x1024",
        modelOptions: {
          size: "landscape",
        },
      })

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ size: "landscape" }),
      )
    })

    it("should pass structured prompt from modelOptions", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      const structured = {
        positive: "a cat",
        negative: "blurry",
        enhance: "prefer_magic" as const,
      }

      await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "ignored when structured is set",
        modelOptions: { promptStructured: structured },
      })

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ prompt: structured }),
      )
    })

    it("should pass all modelOptions to request", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
        modelOptions: {
          output: { format: "png", quality: 90 },
          inputs: ["https://example.com/ref.jpg"],
          webhook: { enabled: true },
          contentRating: { enabled: true },
          metadata: { userId: "u123" },
        },
      })

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          output: { format: "png", quality: 90 },
          inputs: ["https://example.com/ref.jpg"],
          webhook: { enabled: true },
          content_rating: { enabled: true },
          metadata: { userId: "u123" },
        }),
      )
    })

    it("should include revisedPrompt when prompt was enhanced", async () => {
      generateMock.mockResolvedValue(
        createMockTask({
          promptEnhance: { source: "mynth", positive: "An enhanced prompt" },
        }),
      )

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      const result = await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
      })

      expect(result.images[0]!.revisedPrompt).toBe("An enhanced prompt")
    })

    it("should handle empty image results", async () => {
      generateMock.mockResolvedValue(createMockTask({ images: [] }))

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      const result = await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
      })

      expect(result.images).toHaveLength(0)
    })

    it("should filter out failed images", async () => {
      generateMock.mockResolvedValue(
        createMockTask({
          images: [
            { status: "succeeded", url: "https://cdn.mynth.io/img1.webp" },
            { status: "failed", url: "" },
          ],
        }),
      )

      const adapter = new MynthImageAdapter(
        { apiKey: "mak_test" },
        "black-forest-labs/flux.2-dev",
      )

      const result = await adapter.generateImages({
        model: "black-forest-labs/flux.2-dev",
        prompt: "test",
      })

      expect(result.images).toHaveLength(1)
      expect(result.images[0]!.url).toBe("https://cdn.mynth.io/img1.webp")
    })

    it("should use model from adapter when not overridden", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, "auto")

      await adapter.generateImages({
        model: "auto",
        prompt: "test",
      })

      expect(generateMock).toHaveBeenCalledWith(expect.objectContaining({ model: "auto" }))
    })

    it("should use modelOptions.model when provided", async () => {
      generateMock.mockResolvedValue(createMockTask())

      const adapter = new MynthImageAdapter({ apiKey: "mak_test" }, "auto")

      await adapter.generateImages({
        model: "auto",
        prompt: "test",
        modelOptions: { model: "black-forest-labs/flux.2-dev" },
      })

      expect(generateMock).toHaveBeenCalledWith(
        expect.objectContaining({ model: "black-forest-labs/flux.2-dev" }),
      )
    })
  })
})

describe("createMynthImage", () => {
  it("should create adapter with explicit API key", () => {
    const adapter = createMynthImage("black-forest-labs/flux.2-dev", "mak_test123")

    expect(adapter).toBeInstanceOf(MynthImageAdapter)
    expect(adapter.model).toBe("black-forest-labs/flux.2-dev")
    expect(adapter.kind).toBe("image")
    expect(adapter.name).toBe("mynth")
  })

  it("should pass config options", () => {
    const adapter = createMynthImage("auto", "mak_test", { baseUrl: "https://custom.api" })

    expect(adapter).toBeInstanceOf(MynthImageAdapter)
    expect(MockMynth).toHaveBeenCalledWith({ apiKey: "mak_test", baseUrl: "https://custom.api" })
  })
})

describe("mynthImage", () => {
  it("should create adapter without explicit API key", () => {
    const adapter = mynthImage("black-forest-labs/flux.2-dev")

    expect(adapter).toBeInstanceOf(MynthImageAdapter)
    expect(adapter.model).toBe("black-forest-labs/flux.2-dev")
  })

  it("should pass config options", () => {
    const adapter = mynthImage("auto", { baseUrl: "https://custom.api" })

    expect(adapter).toBeInstanceOf(MynthImageAdapter)
    expect(MockMynth).toHaveBeenCalledWith({ baseUrl: "https://custom.api" })
  })
})
