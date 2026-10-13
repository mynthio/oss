import { describe, expect, it } from "vitest";

import { MynthClient } from "../src/client.ts";
import { resolveImageInputs } from "../src/uploads.ts";
import { BASE_URL, createMockApi, type MockApi, ok } from "./mock-api.ts";

const UPLOAD = "POST /image/upload";

function createClient(api: MockApi): MynthClient {
  return new MynthClient({ apiKey: "mak_test", baseURL: BASE_URL, headers: {}, fetch: api.fetch });
}

function png(): Blob {
  return new Blob(["png"], { type: "image/png" });
}

describe("resolveImageInputs", () => {
  it("puts each uploaded URL in its file's place, keeping roles", async () => {
    // Arrange
    const api = createMockApi({ [UPLOAD]: ok({ urls: ["https://u/1.png", "https://u/2.png"] }) });

    // Act
    const inputs = await resolveImageInputs(createClient(api), [
      png(),
      "https://example.com/ref.jpg",
      { type: "image", as: "source", source: { type: "file", file: png() } },
    ]);

    // Assert
    expect(inputs).toEqual([
      "https://u/1.png",
      "https://example.com/ref.jpg",
      { type: "image", as: "source", source: { type: "url", url: "https://u/2.png" } },
    ]);
  });

  it("uploads every file in a single request", async () => {
    // Arrange
    const api = createMockApi({ [UPLOAD]: ok({ urls: ["https://u/1.png", "https://u/2.png"] }) });

    // Act
    await resolveImageInputs(createClient(api), [png(), png()]);

    // Assert
    expect(api.requestsTo(UPLOAD)).toHaveLength(1);
  });

  it("sends URL inputs without uploading", async () => {
    // Arrange
    const api = createMockApi({});

    // Act
    await resolveImageInputs(createClient(api), [
      "https://example.com/a.jpg",
      { type: "image", source: { type: "url", url: "https://example.com/b.jpg" } },
    ]);

    // Assert
    expect(api.requests).toHaveLength(0);
  });

  it("keeps a File's name in the upload", async () => {
    // Arrange
    const api = createMockApi({ [UPLOAD]: ok({ urls: ["https://u/1.png"] }) });

    // Act
    await resolveImageInputs(createClient(api), [new File(["png"], "product.png")]);

    // Assert
    const form = await api.requests[0]?.formData();
    expect((form?.get("images") as File | null)?.name).toBe("product.png");
  });
});
