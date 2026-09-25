import type { MynthSDKTypes } from "@mynthio/sdk";
import { AVAILABLE_MODELS } from "@mynthio/sdk";
import type { ModelCapability } from "@mynthio/sdk";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  MYNTH_IMAGE_4K_MODELS,
  MYNTH_IMAGE_INPUT_MODELS,
  MYNTH_IMAGE_MODELS,
  MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS,
} from "../src/model-meta.ts";
import type { MynthImageModel } from "../src/model-meta.ts";

function sdkModelsWith(capability: ModelCapability): string[] {
  return AVAILABLE_MODELS.filter((model) => model.capabilities.includes(capability)).map(
    (model) => model.id,
  );
}

describe("model metadata", () => {
  // Compile-time check: `pnpm typecheck` fails when a listed ID drifts.
  it("lists only model IDs the SDK accepts", () => {
    expectTypeOf<MynthImageModel>().toExtend<MynthSDKTypes.ImageGenerationModel>();
  });

  it("lists every model in the SDK catalog", () => {
    // Arrange
    const sdkModels = AVAILABLE_MODELS.map((model) => model.id);

    // Act & Assert
    expect([...MYNTH_IMAGE_MODELS]).toEqual(sdkModels);
  });

  it.each([
    ["inputs", MYNTH_IMAGE_INPUT_MODELS],
    ["negative_prompt", MYNTH_IMAGE_NEGATIVE_PROMPT_MODELS],
    ["4k", MYNTH_IMAGE_4K_MODELS],
  ] as const)("matches the SDK's %s capability", (capability, models) => {
    // Arrange
    const sdkModels = sdkModelsWith(capability);

    // Act & Assert
    expect([...models]).toEqual(sdkModels);
  });
});
