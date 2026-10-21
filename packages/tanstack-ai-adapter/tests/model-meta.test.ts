import { describe, expect, it } from "vitest";

import { hasMynthImageCapability, isMynthImageModel } from "../src/model-meta.ts";

describe("isMynthImageModel", () => {
  it.each([
    ["a known model", "krea/krea-2-large", true],
    ["an unknown model", "acme/image-1", false],
    ["an inherited object key", "toString", false],
    ["a non-string", 42, false],
  ])("recognizes %s", (_, value, expected) => {
    // Act
    const known = isMynthImageModel(value);

    // Assert
    expect(known).toBe(expected);
  });
});

describe("hasMynthImageCapability", () => {
  it.each([
    ["black-forest-labs/flux-3", "4k", true],
    ["black-forest-labs/flux.2-pro", "4k", false],
    ["purplesmartai/pony-diffusion-v6-xl", "negative_prompt", true],
  ] as const)("reports whether %s has %s", (model, capability, expected) => {
    // Act
    const has = hasMynthImageCapability(model, capability);

    // Assert
    expect(has).toBe(expected);
  });
});
