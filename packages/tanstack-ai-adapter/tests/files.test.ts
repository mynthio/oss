import { describe, expect, it } from "vitest";

import { mynthFiles } from "../src/files.ts";
import { BASE_URL, createMockApi, type MockApi, ok } from "./mock-api.ts";

const UPLOAD = "POST /image/upload";

function createAdapter(api: MockApi) {
  return mynthFiles({ apiKey: "mak_test", baseURL: BASE_URL, fetch: api.fetch });
}

describe("mynthFiles", () => {
  it("uploads a Blob and returns its URL as the handle", async () => {
    // Arrange
    const api = createMockApi({
      [UPLOAD]: ok({ urls: ["https://cdn.mynth.io/uploads/input.png"] }),
    });

    // Act
    const handle = await createAdapter(api).upload(new Blob(["png"], { type: "image/png" }));

    // Assert
    expect(handle).toEqual({
      id: "https://cdn.mynth.io/uploads/input.png",
      provider: "mynth",
      uri: "https://cdn.mynth.io/uploads/input.png",
      mimeType: "image/png",
    });
  });

  it("decodes base64 input before uploading", async () => {
    // Arrange
    const api = createMockApi({
      [UPLOAD]: ok({ urls: ["https://cdn.mynth.io/uploads/input.webp"] }),
    });

    // Act
    await createAdapter(api).upload({ data: "QUJD", mimeType: "image/webp" });

    // Assert
    const form = await api.requests[0]?.formData();
    expect(await (form?.get("images") as File | null)?.text()).toBe("ABC");
  });

  it("echoes the input's MIME type and filename on the handle", async () => {
    // Arrange
    const api = createMockApi({
      [UPLOAD]: ok({ urls: ["https://cdn.mynth.io/uploads/input.webp"] }),
    });

    // Act
    const handle = await createAdapter(api).upload({
      data: "QUJD",
      mimeType: "image/webp",
      filename: "input.webp",
    });

    // Assert
    expect(handle).toMatchObject({ mimeType: "image/webp", filename: "input.webp" });
  });
});
