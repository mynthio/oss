import type { MynthSDKTypes } from "@mynthio/sdk";
import { describe, expectTypeOf, it } from "vitest";

import type { MynthImageInputModel, MynthImageModel } from "../src/model-meta.ts";

// These are compile-time checks: `pnpm typecheck` fails when a listed ID drifts.
describe("model metadata", () => {
  it("lists only model IDs the SDK accepts", () => {
    expectTypeOf<MynthImageModel>().toExtend<MynthSDKTypes.ImageGenerationModel>();
  });

  it("lists only input models that are also image models", () => {
    expectTypeOf<MynthImageInputModel>().toExtend<MynthImageModel>();
  });
});
