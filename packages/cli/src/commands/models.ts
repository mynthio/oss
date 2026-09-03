import { Command, Option } from "commander";
import fuzzysort from "fuzzysort";
import { listModels } from "../api/models.ts";
import type { App } from "../app.ts";
import type { Model } from "../api/schemas.ts";
import { UsageError } from "../errors.ts";
import { printJson } from "../output/print.ts";
import { printTable } from "../output/table.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

type ListFlags = JsonFlag & {
  readonly search?: string;
  readonly org?: string;
  readonly maxPrice?: number;
  readonly minPrice?: number;
  readonly "4k"?: boolean;
  readonly capability?: "img2img" | "txt2img";
};

/** Model IDs are `org/name`, so the org is the id prefix — the API has no separate field. */
const orgOf = (model: Model): string => model.id.split("/")[0]!;

const basePrice = (model: Model): number | undefined => {
  const raw = model.pricing?.perImage.base;
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
};

/**
 * The catalog exposes no capability field. `perInput` pricing is the documented
 * signal that a model bills for image inputs, so it stands in for image-to-image
 * support; its absence means the model takes a prompt only.
 */
const takesImageInputs = (model: Model): boolean => model.pricing?.perInput !== undefined;

const parsePrice =
  (label: string) =>
  (value: string): number => {
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new UsageError(`invalid ${label}: "${value}" (expected a non-negative number)`);
    }
    return parsed;
  };

/**
 * Fuzzy rather than substring so `bfl flux`, `qwen3`, or `gemini flash` all land
 * on the right model. Matching runs over the id and the display name; the id
 * carries the org, so one query covers both name and vendor.
 *
 * fuzzysort only scores targets the query is a subsequence of, so nonsense
 * matches nothing regardless of threshold. 0.3 exists solely to keep typos
 * (`sedream` scores 0.36) while intentional queries score 0.7-0.95.
 */
const SEARCH_THRESHOLD = 0.3;

const search = (models: ReadonlyArray<Model>, query: string): ReadonlyArray<Model> =>
  fuzzysort
    .go(query, models, { keys: ["id", "displayName"], threshold: SEARCH_THRESHOLD })
    .map((result) => result.obj);

/** `--org bfl` should find black-forest-labs, so the org is fuzzy-matched too. */
const matchOrgs = (models: ReadonlyArray<Model>, query: string): ReadonlySet<string> => {
  const orgs = [...new Set(models.map(orgOf))];
  if (orgs.includes(query)) return new Set([query]);
  return new Set(fuzzysort.go(query, orgs, { threshold: SEARCH_THRESHOLD }).map((r) => r.target));
};

const applyFilters = (models: ReadonlyArray<Model>, flags: ListFlags): ReadonlyArray<Model> => {
  let result = models;

  if (flags.org !== undefined) {
    const orgs = matchOrgs(result, flags.org);
    result = result.filter((model) => orgs.has(orgOf(model)));
  }
  if (flags["4k"]) {
    result = result.filter((model) => model.pricing?.perImage["4k"] !== undefined);
  }
  if (flags.capability !== undefined) {
    const wantsInputs = flags.capability === "img2img";
    result = result.filter((model) => takesImageInputs(model) === wantsInputs);
  }
  if (flags.maxPrice !== undefined) {
    const max = flags.maxPrice;
    result = result.filter((model) => (basePrice(model) ?? Infinity) <= max);
  }
  if (flags.minPrice !== undefined) {
    const min = flags.minPrice;
    result = result.filter((model) => (basePrice(model) ?? -Infinity) >= min);
  }
  // Ranked last so relevance order survives, and so scoring only sees survivors.
  if (flags.search !== undefined) result = search(result, flags.search);

  return result;
};

export const modelsCommand = (app: App): Command => {
  const models = new Command("models").description("Browse the public Mynth model catalog");

  models
    .command("list")
    .description("List available image generation models and their per-image pricing")
    .option(
      "-s, --search <query>",
      "Fuzzy match against model ID (which includes the org) and name",
    )
    .option("--org <org>", "Only models from this org, fuzzy matched (e.g. bfl, google)")
    .option(
      "--max-price <usd>",
      "Only models at or below this base per-image price",
      parsePrice("--max-price"),
    )
    .option(
      "--min-price <usd>",
      "Only models at or above this base per-image price",
      parsePrice("--min-price"),
    )
    .option("--4k", "Only models with 4K pricing")
    .addOption(
      new Option(
        "--capability <capability>",
        "img2img: bills for image inputs. txt2img: prompt-only, no image inputs",
      ).choices(["img2img", "txt2img"]),
    )
    .addOption(jsonOption())
    .action(async (options: ListFlags) => {
      const data = applyFilters(await listModels(app.api), options);
      if (options.json) {
        printJson(data);
        return;
      }

      printTable(
        data,
        [
          { header: "ID", value: (model) => model.id },
          { header: "Name", value: (model) => model.displayName ?? "-" },
          { header: "Base", value: (model) => model.pricing?.perImage.base ?? "-" },
          { header: "4K", value: (model) => model.pricing?.perImage["4k"] ?? "-" },
          { header: "Input fee", value: (model) => model.pricing?.perInput ?? "-" },
        ],
        "No models matched the filters.",
      );
    });

  return models;
};
