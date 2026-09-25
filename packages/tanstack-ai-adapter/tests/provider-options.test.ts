import { createImageOptions } from "@tanstack/ai";
import { describe, expect, it } from "vitest";

import { mynthImage } from "../src/adapter.ts";

// These are compile-time checks: `pnpm typecheck` fails when a model accepts an
// option it cannot use, or rejects one it can. Each `@ts-expect-error` must fail.
const config = { apiKey: "mak_test" };
const TEXT_ONLY_MODEL = "black-forest-labs/flux.1-dev";
const INPUT_MODEL = "black-forest-labs/flux.2-pro";
const NATIVE_NEGATIVE_MODEL = "purplesmartai/pony-diffusion-v6-xl";
const FOUR_K_MODEL = "google/gemini-3.1-flash-image";

describe("per-model provider options", () => {
  it("accepts a negative prompt on models that take one natively, and on auto", () => {
    createImageOptions({
      adapter: mynthImage(NATIVE_NEGATIVE_MODEL, config),
      prompt: "a cat",
      modelOptions: { negativePrompt: "blurry" },
    });
    createImageOptions({
      adapter: mynthImage("auto", config),
      prompt: "a cat",
      modelOptions: { negativePrompt: "blurry" },
    });

    expect(true).toBe(true);
  });

  it("requires magic prompt for a negative prompt on other models", () => {
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: "a cat",
      // @ts-expect-error -- the model has no native negative prompt
      modelOptions: { negativePrompt: "blurry" },
    });
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: "a cat",
      modelOptions: { negativePrompt: "blurry", magicPrompt: true },
    });

    const magicPrompt: boolean = Math.random() > 0.5;
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: "a cat",
      modelOptions: { magicPrompt },
    });

    expect(true).toBe(true);
  });

  it("allows 4k sizes only on models with 4k output", () => {
    createImageOptions({
      adapter: mynthImage(FOUR_K_MODEL, config),
      prompt: "a cat",
      size: "16:9_4k",
      modelOptions: { size: { type: "aspect_ratio", aspectRatio: "16:9", scale: "4k" } },
    });
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: "a cat",
      // @ts-expect-error -- the model has no 4k output
      size: "16:9_4k",
    });
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: "a cat",
      // @ts-expect-error -- the model has no 4k output
      modelOptions: { size: { type: "aspect_ratio", aspectRatio: "16:9", scale: "4k" } },
    });
    createImageOptions({
      adapter: mynthImage("auto", config),
      prompt: "a cat",
      // @ts-expect-error -- auto may pick a model without 4k output
      size: "16:9_4k",
    });

    expect(true).toBe(true);
  });

  it("allows image inputs only on models that accept them", () => {
    createImageOptions({
      adapter: mynthImage(INPUT_MODEL, config),
      prompt: [
        { type: "text", content: "a cat" },
        { type: "image", source: { type: "url", value: "https://example.com/cat.png" } },
      ],
      modelOptions: { inputs: ["https://example.com/style.png"] },
    });
    createImageOptions({
      adapter: mynthImage(TEXT_ONLY_MODEL, config),
      prompt: "a cat",
      // @ts-expect-error -- the model is text-to-image only
      modelOptions: { inputs: ["https://example.com/style.png"] },
    });
    createImageOptions({
      adapter: mynthImage(TEXT_ONLY_MODEL, config),
      prompt: [
        { type: "text", content: "a cat" },
        // @ts-expect-error -- the model is text-to-image only
        { type: "image", source: { type: "url", value: "https://example.com/cat.png" } },
      ],
    });

    expect(true).toBe(true);
  });
});
