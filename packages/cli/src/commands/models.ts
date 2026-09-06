import { Command, Option } from "commander";
import fuzzysort from "fuzzysort";
import { listModels } from "../api/models.ts";
import type { App } from "../app.ts";
import type { Model, ModelPricing } from "../api/schemas.ts";
import { UsageError } from "../errors.ts";
import { printJson } from "../output/print.ts";
import { printTable } from "../output/table.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

/** The catalog names modes `txt->img`; the flag spells them the way a shell can. */
const MODE_BY_CAPABILITY = {
  txt2img: "txt->img",
  img2img: "img->img",
  txt2vid: "txt->vid",
  img2vid: "img->vid",
} as const;

type Capability = keyof typeof MODE_BY_CAPABILITY;

type ListFlags = JsonFlag & {
  readonly search?: string;
  readonly org?: string;
  readonly type?: string;
  readonly maxPrice?: number;
  readonly minPrice?: number;
  readonly "4k"?: boolean;
  readonly capability?: Capability;
};

/** Model IDs are `org/name`, so the org is the id prefix — the API has no separate field. */
const orgOf = (model: Model): string => model.id.split("/")[0]!;

const isImagePricing = (
  pricing: ModelPricing,
): pricing is Extract<ModelPricing, { perImage: unknown }> => "perImage" in pricing;

/** Image models are priced per image, video models per second of output. */
const rateUnit = (model: Model): string => (model.type === "video" ? "/s" : "");

const rates = (model: Model): string[] => {
  const pricing = model.pricing;
  if (pricing === null) return [];

  return isImagePricing(pricing) ? [pricing.perImage.base] : Object.values(pricing.perSecond);
};

/**
 * The cheapest rate a model charges, so one price column and one pair of price
 * filters span both media types. The raw string is kept for display, because it
 * carries the precision the catalog published.
 */
const cheapestRate = (model: Model): { raw: string; value: number } | undefined => {
  let best: { raw: string; value: number } | undefined;

  for (const raw of rates(model)) {
    const value = Number.parseFloat(raw);
    if (Number.isFinite(value) && (best === undefined || value < best.value)) best = { raw, value };
  }

  return best;
};

const basePrice = (model: Model): number | undefined => cheapestRate(model)?.value;

const priceLabel = (model: Model): string => {
  const rate = cheapestRate(model);
  return rate === undefined ? "-" : `${rate.raw}${rateUnit(model)}`;
};

const price4k = (model: Model): string | undefined => {
  const pricing = model.pricing;
  if (pricing === null) return undefined;
  return isImagePricing(pricing) ? pricing.perImage["4k"] : pricing.perSecond["4k"];
};

const price4kLabel = (model: Model): string => {
  const raw = price4k(model);
  return raw === undefined ? "-" : `${raw}${rateUnit(model)}`;
};

const inputFee = (model: Model): string | undefined => {
  const pricing = model.pricing;
  if (pricing === null || !isImagePricing(pricing)) return undefined;
  return pricing.perInput;
};

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
  if (flags.type !== undefined) {
    const type = flags.type;
    result = result.filter((model) => model.type === type);
  }
  if (flags["4k"]) {
    result = result.filter((model) => price4k(model) !== undefined);
  }
  if (flags.capability !== undefined) {
    const mode = MODE_BY_CAPABILITY[flags.capability];
    result = result.filter((model) => mode in model.modes);
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
    .description("List available generation models and their pricing")
    .option(
      "-s, --search <query>",
      "Fuzzy match against model ID (which includes the org) and name",
    )
    .option("--org <org>", "Only models from this org, fuzzy matched (e.g. bfl, google)")
    .option("--type <type>", "Only models of this media type (image, video)")
    .option(
      "--max-price <usd>",
      "Only models at or below this price (per image, or per second for video)",
      parsePrice("--max-price"),
    )
    .option(
      "--min-price <usd>",
      "Only models at or above this price (per image, or per second for video)",
      parsePrice("--min-price"),
    )
    .option("--4k", "Only models with 4K pricing")
    .addOption(
      new Option("--capability <capability>", "Only models serving this generation mode").choices(
        Object.keys(MODE_BY_CAPABILITY),
      ),
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
          { header: "Type", value: (model) => model.type },
          { header: "Modes", value: (model) => Object.keys(model.modes).join(",") || "-" },
          { header: "Price", value: (model) => priceLabel(model) },
          { header: "4K", value: (model) => price4kLabel(model) },
          { header: "Input fee", value: (model) => inputFee(model) ?? "-" },
        ],
        "No models matched the filters.",
      );
    });

  return models;
};
