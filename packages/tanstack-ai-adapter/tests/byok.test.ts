import { describe, expect, it } from "vitest";

import { mynthByok } from "../src/byok.ts";

describe("mynthByok", () => {
  it("names the Mynth provider and its env var", () => {
    // Arrange & Act
    const descriptor = mynthByok;

    // Assert
    expect(descriptor).toEqual({ id: "mynth", label: "Mynth", env: ["MYNTH_API_KEY"] });
  });
});
