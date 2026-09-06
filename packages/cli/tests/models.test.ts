import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const catalog = [
  {
    id: "black-forest-labs/flux.1-dev",
    displayName: "FLUX.1 Dev",
    type: "image",
    modes: { "txt->img": {} },
    pricing: { perImage: { base: "0.004" } },
  },
  {
    id: "black-forest-labs/flux.2-pro",
    displayName: "FLUX.2 Pro",
    type: "image",
    modes: {
      "txt->img": {},
      "img->img": { inputs: { rules: [{ type: "image", max: 4 }], maxTotal: 4 } },
    },
    pricing: { perImage: { base: "0.03" }, perInput: "0.03" },
  },
  {
    id: "bytedance/seedream-pro",
    displayName: "Seedream Pro",
    type: "image",
    modes: {
      "txt->img": {},
      "img->img": { inputs: { rules: [{ type: "image", kind: "source", min: 1, max: 1 }] } },
    },
    pricing: { perImage: { base: "0.1" }, perInput: "0.00321" },
  },
  {
    id: "google/gemini-3-pro-image-preview",
    displayName: "Gemini 3 Pro Image Preview",
    type: "image",
    modes: { "txt->img": {} },
    pricing: { perImage: { base: "0.14", "4k": "0.2" } },
  },
  {
    id: "recraft/recraft-v4",
    displayName: "Recraft V4",
    type: "image",
    modes: { "txt->img": {} },
    pricing: { perImage: { base: "0.04" } },
  },
  {
    id: "bytedance/seedance-2.0-mini",
    displayName: "Seedance 2.0 Mini",
    type: "video",
    modes: {
      "txt->vid": {},
      "img->vid": {
        inputs: {
          rules: [
            { type: "image", kind: "first_frame", min: 1, max: 1 },
            { type: "image", kind: "last_frame", min: 0, max: 1 },
          ],
          maxTotal: 2,
        },
      },
    },
    pricing: { perSecond: { "480p": "0.036", "720p": "0.081" } },
  },
  {
    id: "google/gemini-omni-flash-1.1",
    displayName: "Gemini Omni Flash 1.1",
    type: "video",
    modes: { "txt->vid": {}, "img->vid": { inputs: { rules: [{ type: "image", max: 2 }] } } },
    pricing: {
      perSecond: { "720p": "0.10", "1080p": "0.15", "4k": "0.30" },
      audio: { perSecond: "0.002" },
    },
  },
];

const route = (request: { url: string }, response: Parameters<typeof json>[0]) =>
  request.url === "/models"
    ? json(response, 200, { data: catalog })
    : json(response, 404, { code: "NOT_FOUND" });

/** Runs `models list --json` with `args` and returns the matched model IDs, in order. */
const ids = async (args: ReadonlyArray<string>): Promise<string[]> =>
  withApi(route, async (env) => {
    const result = await runCli(["models", "list", "--json", ...args], env);
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
    return (JSON.parse(result.stdout) as { id: string }[]).map((model) => model.id);
  });

describe("models list filtering", () => {
  it("returns the whole catalog when no filter is given", async () => {
    expect(await ids([])).toHaveLength(catalog.length);
  });

  it("fuzzy matches a name across the id and the display name", async () => {
    expect(await ids(["--search", "gemini pro"])).toEqual(["google/gemini-3-pro-image-preview"]);
  });

  it("tolerates a typo rather than requiring a substring", async () => {
    expect(await ids(["-s", "sedream"])).toEqual(["bytedance/seedream-pro"]);
  });

  it("matches nothing for a query that is not a subsequence of any model", async () => {
    expect(await ids(["-s", "xyzzy"])).toEqual([]);
  });

  it("ranks the better fuzzy match first", async () => {
    expect((await ids(["-s", "flux"]))[0]).toMatch(/^black-forest-labs\/flux/);
  });

  it("filters by org, fuzzy matching the org name", async () => {
    expect(await ids(["--org", "bfl"])).toEqual([
      "black-forest-labs/flux.1-dev",
      "black-forest-labs/flux.2-pro",
    ]);
  });

  it("filters by exact org without dragging in fuzzy neighbours", async () => {
    expect(await ids(["--org", "google"])).toEqual([
      "google/gemini-3-pro-image-preview",
      "google/gemini-omni-flash-1.1",
    ]);
  });

  it("filters by 4K pricing across both per-image and per-second rates", async () => {
    expect(await ids(["--4k"])).toEqual([
      "google/gemini-3-pro-image-preview",
      "google/gemini-omni-flash-1.1",
    ]);
  });

  it("filters by media type", async () => {
    expect(await ids(["--type", "video"])).toEqual([
      "bytedance/seedance-2.0-mini",
      "google/gemini-omni-flash-1.1",
    ]);
    expect(await ids(["--type", "image"])).toHaveLength(5);
  });

  it("filters by max and min base price inclusively", async () => {
    expect(await ids(["--max-price", "0.04"])).toEqual([
      "black-forest-labs/flux.1-dev",
      "black-forest-labs/flux.2-pro",
      "recraft/recraft-v4",
      // Cheapest per-second tier, so a video model is comparable on price.
      "bytedance/seedance-2.0-mini",
    ]);
    expect(await ids(["--min-price", "0.1"])).toEqual([
      "bytedance/seedream-pro",
      "google/gemini-3-pro-image-preview",
      "google/gemini-omni-flash-1.1",
    ]);
  });

  it("filters on the modes a model actually serves", async () => {
    expect(await ids(["--capability", "img2img"])).toEqual([
      "black-forest-labs/flux.2-pro",
      "bytedance/seedream-pro",
    ]);
    // A model serving both modes matches both filters.
    expect(await ids(["--capability", "txt2img"])).toEqual([
      "black-forest-labs/flux.1-dev",
      "black-forest-labs/flux.2-pro",
      "bytedance/seedream-pro",
      "google/gemini-3-pro-image-preview",
      "recraft/recraft-v4",
    ]);
  });

  it("filters on video modes", async () => {
    expect(await ids(["--capability", "txt2vid"])).toEqual([
      "bytedance/seedance-2.0-mini",
      "google/gemini-omni-flash-1.1",
    ]);
    expect(await ids(["--capability", "img2vid"])).toEqual([
      "bytedance/seedance-2.0-mini",
      "google/gemini-omni-flash-1.1",
    ]);
  });

  it("combines filters", async () => {
    expect(await ids(["--capability", "img2img", "--max-price", "0.05"])).toEqual([
      "black-forest-labs/flux.2-pro",
    ]);
  });

  it("reports an empty result rather than the full table", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(
        ["models", "list", "--org", "google", "--4k", "--min-price", "9"],
        env,
      );
      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe("No models matched the filters.");
    });
  });

  it("rejects a non-numeric price with the usage exit code", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["models", "list", "--max-price", "cheap"], env);
      expect(result.status).toBe(2);
      expect(result.stderr).toContain("--max-price");
    });
  });

  it("renders per-second pricing and modes for a video model", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["models", "list", "--type", "video"], env);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain("video");
      expect(result.stdout).toContain("0.036/s");
      expect(result.stdout).toContain("txt->vid,img->vid");
    });
  });

  it("rejects an unknown capability", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["models", "list", "--capability", "txt2audio"], env);
      expect(result.status).toBe(2);
    });
  });
});
