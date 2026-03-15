import { describe, expect, it } from "vitest"
import { MYNTH_IMAGE_MODELS } from "../src/model-meta"
import type { MynthImageModel } from "../src/model-meta"

describe("MYNTH_IMAGE_MODELS", () => {
  it("should contain all expected models", () => {
    expect(MYNTH_IMAGE_MODELS).toContain("auto")
    expect(MYNTH_IMAGE_MODELS).toContain("alibaba/qwen-image-2.0")
    expect(MYNTH_IMAGE_MODELS).toContain("alibaba/qwen-image-2.0-pro")
    expect(MYNTH_IMAGE_MODELS).toContain("black-forest-labs/flux.2-dev")
    expect(MYNTH_IMAGE_MODELS).toContain("black-forest-labs/flux.1-dev")
    expect(MYNTH_IMAGE_MODELS).toContain("black-forest-labs/flux-1-schnell")
    expect(MYNTH_IMAGE_MODELS).toContain("black-forest-labs/flux.2-klein-4b")
    expect(MYNTH_IMAGE_MODELS).toContain("bytedance/seedream-5.0-lite")
    expect(MYNTH_IMAGE_MODELS).toContain("tongyi-mai/z-image-turbo")
    expect(MYNTH_IMAGE_MODELS).toContain("john6666/bismuth-illustrious-mix")
    expect(MYNTH_IMAGE_MODELS).toContain("google/gemini-3.1-flash-image")
    expect(MYNTH_IMAGE_MODELS).toContain("google/gemini-3-pro-image-preview")
    expect(MYNTH_IMAGE_MODELS).toContain("wan/wan2.6-image")
    expect(MYNTH_IMAGE_MODELS).toContain("xai/grok-imagine-image")
  })

  it("should have 14 models", () => {
    expect(MYNTH_IMAGE_MODELS).toHaveLength(14)
  })

  it("should be a readonly array", () => {
    const model: MynthImageModel = "auto"
    expect(model).toBe("auto")
  })
})
