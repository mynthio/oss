import { beforeEach, describe, expect, it, vi } from "vitest";

const { uploadMock, MockMynthImage } = vi.hoisted(() => {
  const upload = vi.fn();
  const MockMynthImageConstructor = vi.fn(function MockMynthImage() {
    return { upload };
  });

  return { uploadMock: upload, MockMynthImage: MockMynthImageConstructor };
});

vi.mock("@mynthio/sdk", () => ({ MynthImage: MockMynthImage }));

const { mynthFiles } = await import("../src/files.ts");

describe("mynthFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uploadMock.mockResolvedValue({ urls: ["https://cdn.mynth.io/uploads/input.png"] });
  });

  it("passes config to the SDK client", () => {
    // Arrange
    const config = { apiKey: "mak_test", baseUrl: "https://custom.api" };

    // Act
    mynthFiles(config);

    // Assert
    expect(MockMynthImage).toHaveBeenCalledWith(config);
  });

  it("uploads a Blob and returns its URL as the handle", async () => {
    // Arrange
    const adapter = mynthFiles({ apiKey: "mak_test" });
    const blob = new Blob(["png"], { type: "image/png" });

    // Act
    const handle = await adapter.upload(blob);

    // Assert
    expect(uploadMock).toHaveBeenCalledWith(blob);
    expect(handle).toEqual({
      id: "https://cdn.mynth.io/uploads/input.png",
      provider: "mynth",
      uri: "https://cdn.mynth.io/uploads/input.png",
      mimeType: "image/png",
    });
  });

  it("decodes base64 input before uploading", async () => {
    // Arrange
    const adapter = mynthFiles({ apiKey: "mak_test" });

    // Act
    const handle = await adapter.upload({
      data: "QUJD",
      mimeType: "image/webp",
      filename: "input.webp",
    });

    // Assert
    const uploaded = uploadMock.mock.calls[0]?.[0] as Blob;
    expect(uploaded.type).toBe("image/webp");
    expect(await uploaded.text()).toBe("ABC");
    expect(handle).toMatchObject({ mimeType: "image/webp", filename: "input.webp" });
  });

  it("throws when the upload returns no URL", async () => {
    // Arrange
    uploadMock.mockResolvedValue({ urls: [] });
    const adapter = mynthFiles({ apiKey: "mak_test" });

    // Act
    const result = adapter.upload(new Blob(["png"], { type: "image/png" }));

    // Assert
    await expect(result).rejects.toThrow("no URL");
  });
});
