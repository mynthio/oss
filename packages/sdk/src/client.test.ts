import { describe, expect, test, vi } from "vitest";

import { MynthClient } from "./client.ts";
import { API_URL } from "./constants.ts";

describe("MynthClient", () => {
  test("getUrl drops a trailing slash from the base URL", () => {
    // Arrange
    const client = new MynthClient({ baseUrl: "https://api.test/" });

    // Act
    const url = client.getUrl("/models");

    // Assert
    expect(url).toBe("https://api.test/models");
  });

  test("getUrl falls back to the Mynth API without a base URL", () => {
    // Arrange
    const client = new MynthClient({});

    // Act
    const url = client.getUrl("/models");

    // Assert
    expect(url).toBe(`${API_URL}/models`);
  });

  test("getAuthHeaders is empty without an API key or access token", () => {
    // Arrange
    const client = new MynthClient({});

    // Act
    const headers = client.getAuthHeaders();

    // Assert
    expect(headers).toEqual({});
  });
});

describe("MynthClient errors", () => {
  test("reads the code, message and issues from the error envelope", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "validation_error",
            message: "count: Unknown field.",
            issues: [{ path: ["count"], message: "Unknown field." }],
          },
        },
        { status: 400 },
      ),
    );

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        name: "MynthAPIError",
        status: 400,
        code: "validation_error",
        message: "count: Unknown field.",
        issues: [{ path: ["count"], message: "Unknown field." }],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("reads the task a failed create left behind", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "public_access_token_failed",
            message: "Task tsk_123 was created and will run.",
            task_id: "tsk_123",
          },
        },
        { status: 500 },
      ),
    );

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        name: "MynthAPIError",
        status: 500,
        code: "public_access_token_failed",
        taskId: "tsk_123",
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("falls back to the status when the body is not the error envelope", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        status: 502,
        code: undefined,
        message: "Request failed with status 502",
      });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
