import { describe, expect, test } from "vitest";

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
