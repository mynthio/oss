import { describe, expect, it } from "vitest";
import { json, runCli, withApi } from "./helpers.ts";

const catalog = [
  {
    id: "black-forest-labs/flux.1-dev",
    displayName: "FLUX.1 Dev",
    pricing: { perImage: { base: "0.004" } },
  },
  {
    id: "black-forest-labs/flux.2-pro",
    displayName: "FLUX.2 Pro",
    pricing: { perImage: { base: "0.03" }, perInput: "0.03" },
  },
  {
    id: "bytedance/seedream-pro",
    displayName: "Seedream Pro",
    pricing: { perImage: { base: "0.1" }, perInput: "0.00321" },
  },
  {
    id: "google/gemini-3-pro-image-preview",
    displayName: "Gemini 3 Pro Image Preview",
    pricing: { perImage: { base: "0.14", "4k": "0.2" } },
  },
  { id: "recraft/recraft-v4", displayName: "Recraft V4", pricing: { perImage: { base: "0.04" } } },
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
    expect(await ids(["--org", "google"])).toEqual(["google/gemini-3-pro-image-preview"]);
  });

  it("filters by 4K pricing", async () => {
    expect(await ids(["--4k"])).toEqual(["google/gemini-3-pro-image-preview"]);
  });

  it("filters by max and min base price inclusively", async () => {
    expect(await ids(["--max-price", "0.04"])).toEqual([
      "black-forest-labs/flux.1-dev",
      "black-forest-labs/flux.2-pro",
      "recraft/recraft-v4",
    ]);
    expect(await ids(["--min-price", "0.1"])).toEqual([
      "bytedance/seedream-pro",
      "google/gemini-3-pro-image-preview",
    ]);
  });

  it("splits the catalog on image-input capability", async () => {
    expect(await ids(["--capability", "img2img"])).toEqual([
      "black-forest-labs/flux.2-pro",
      "bytedance/seedream-pro",
    ]);
    expect(await ids(["--capability", "txt2img"])).toEqual([
      "black-forest-labs/flux.1-dev",
      "google/gemini-3-pro-image-preview",
      "recraft/recraft-v4",
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

  it("rejects an unknown capability", async () => {
    await withApi(route, async (env) => {
      const result = await runCli(["models", "list", "--capability", "video"], env);
      expect(result.status).toBe(2);
    });
  });
});
