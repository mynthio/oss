import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveClientConfig } from "../src/config.ts";

describe("resolveClientConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reads the API key from MYNTH_API_KEY when none is passed", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", "mak_env");

    // Act
    const { apiKey } = resolveClientConfig({});

    // Assert
    expect(apiKey).toBe("mak_env");
  });

  it("throws when no API key is passed or set", () => {
    // Arrange
    vi.stubEnv("MYNTH_API_KEY", "");

    // Act
    const resolve = () => resolveClientConfig({});

    // Assert
    expect(resolve).toThrow("MYNTH_API_KEY");
  });

  it("strips trailing slashes from the base URL", () => {
    // Arrange
    const config = { apiKey: "mak_test", baseURL: "https://proxy.example.com/mynth/" };

    // Act
    const { baseURL } = resolveClientConfig(config);

    // Assert
    expect(baseURL).toBe("https://proxy.example.com/mynth");
  });

  it("still accepts the deprecated baseUrl", () => {
    // Arrange
    const config = { apiKey: "mak_test", baseUrl: "https://legacy.example.com" };

    // Act
    const { baseURL } = resolveClientConfig(config);

    // Assert
    expect(baseURL).toBe("https://legacy.example.com");
  });

  it("prefers baseURL over the deprecated baseUrl", () => {
    // Arrange
    const config = {
      apiKey: "mak_test",
      baseURL: "https://new.example.com",
      baseUrl: "https://legacy.example.com",
    };

    // Act
    const { baseURL } = resolveClientConfig(config);

    // Assert
    expect(baseURL).toBe("https://new.example.com");
  });
});
