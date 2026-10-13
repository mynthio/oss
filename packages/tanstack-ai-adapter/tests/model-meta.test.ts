import { describe, expect, expectTypeOf, it } from "vitest";

import {
  hasMynthImageCapability,
  isMynthImageModel,
  MYNTH_IMAGE_MODEL_META,
  MYNTH_IMAGE_MODELS,
  type MynthImageInputModel,
  type MynthImageModelMeta,
} from "../src/model-meta.ts";

describe("model metadata", () => {
  // Compile-time checks: `pnpm typecheck` fails when they break.
  it("describes every model with a label and capabilities", () => {
    expectTypeOf(MYNTH_IMAGE_MODEL_META).toExtend<Record<string, MynthImageModelMeta>>();
  });

  it("derives the capability unions from the table", () => {
    expectTypeOf<"black-forest-labs/flux.2-pro">().toExtend<MynthImageInputModel>();
    expectTypeOf<"black-forest-labs/flux.1-dev">().not.toExtend<MynthImageInputModel>();
  });

  it("lists auto first, so pickers default to it", () => {
    // Arrange & Act
    const [first] = MYNTH_IMAGE_MODELS;

    // Assert
    expect(first).toBe("auto");
  });
});

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
