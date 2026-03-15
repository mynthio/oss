import { describe, expect, it } from "vitest"
import { formatModelLabel, getGeneratedImageSource } from "./image-demo"

describe("getGeneratedImageSource", () => {
  it("prefers image URLs when available", () => {
    expect(
      getGeneratedImageSource({
        url: "https://cdn.example.com/demo.webp",
        b64Json: "abc123",
      })
    ).toBe("https://cdn.example.com/demo.webp")
  })

  it("falls back to base64 data when needed", () => {
    expect(
      getGeneratedImageSource({
        b64Json: "abc123",
      })
    ).toBe("data:image/png;base64,abc123")
  })

  it("returns null when the image has no usable data", () => {
    expect(getGeneratedImageSource({})).toBeNull()
  })
})

describe("formatModelLabel", () => {
  it("makes the auto model easier to understand", () => {
    expect(formatModelLabel("auto")).toBe("auto (let Mynth choose)")
  })

  it("keeps explicit model ids unchanged", () => {
    expect(formatModelLabel("black-forest-labs/flux.2-dev")).toBe(
      "black-forest-labs/flux.2-dev"
    )
  })
})
