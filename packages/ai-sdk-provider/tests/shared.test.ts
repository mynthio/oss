import { describe, expect, it } from "vitest";

import { closestAspectRatio, parseAspectRatio, parseSize } from "../src/shared.ts";

describe("closestAspectRatio", () => {
  it.each([
    [16, 9, "16:9", true],
    [1, 1, "1:1", true],
    [1920, 1080, "16:9", true],
    [7, 4, "16:9", false],
    [2.4, 1, "21:9", false],
    [1, 3, "1:2", false],
  ] as const)("%d:%d → %s", (width, height, ratio, exact) => {
    expect(closestAspectRatio(width, height)).toEqual({ ratio, exact });
  });
});

describe("parsers", () => {
  it("reads ratios and sizes, and rejects anything else", () => {
    expect(parseAspectRatio("16:9")).toEqual({ width: 16, height: 9 });
    expect(parseAspectRatio("0:9")).toBeUndefined();
    expect(parseAspectRatio("wide")).toBeUndefined();
    expect(parseSize("1280x720")).toEqual({ width: 1280, height: 720 });
    expect(parseSize("1280:720")).toBeUndefined();
  });
});
