import { describe, expect, test } from "vitest";

import { toOutputImage } from "./output-image.ts";

const wireImage = {
  id: "img_1",
  url: null,
  mynth_url: "https://mynth.test/1.jpg",
  size: "1536x1024",
  format: "jpg",
  destination: {
    status: "failed",
    name: "bunny-prod",
    error: { code: "DESTINATION_UPLOAD_FAILED" },
  },
} as const;

describe("toOutputImage", () => {
  test("maps the wire image to camelCase fields with parsed dimensions", () => {
    // Arrange & Act
    const image = toOutputImage(wireImage);

    // Assert
    expect(image).toStrictEqual({
      id: "img_1",
      url: null,
      mynthUrl: "https://mynth.test/1.jpg",
      width: 1536,
      height: 1024,
      size: "1536x1024",
      format: "jpg",
      mimeType: "image/jpeg",
      destination: {
        status: "failed",
        name: "bunny-prod",
        error: { code: "DESTINATION_UPLOAD_FAILED" },
      },
    });
  });

  test("throws on a size that is not {width}x{height}", () => {
    // Arrange & Act & Assert
    expect(() => toOutputImage({ ...wireImage, size: "auto" })).toThrow(
      'Unexpected image size "auto", expected {width}x{height}',
    );
  });
});
