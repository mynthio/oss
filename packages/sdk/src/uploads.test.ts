import { describe, expect, test } from "vitest";

import type { MynthClient } from "./client.ts";
import { resolveInputs } from "./uploads.ts";

describe("resolveInputs", () => {
  test("passes URL inputs through without uploading", async () => {
    // Arrange - a client without `post` fails the test if an upload is attempted
    const client = {} as MynthClient;
    const inputs = [
      "https://cdn.test/a.webp",
      { type: "image" as const, source: { type: "url" as const, url: "https://cdn.test/b.webp" } },
    ];

    // Act
    const resolved = await resolveInputs(client, inputs);

    // Assert
    expect(resolved).toEqual(inputs);
  });
});
