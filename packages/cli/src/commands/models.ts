import { Command } from "commander";
import type { CliContext } from "../context.ts";
import type { Model } from "../domain/Schemas.ts";
import { print } from "../utils/output.ts";

type JsonOption = {
  readonly json?: boolean;
};

const formatPrice = (value: string | undefined): string => value ?? "-";

const renderHuman = (models: ReadonlyArray<Model>): void => {
  if (models.length === 0) {
    print("No models available.");
    return;
  }

  const rows = models.map((model) => ({
    id: model.id,
    name: model.displayName ?? "-",
    base: formatPrice(model.pricing?.perImage.base),
    fourK: formatPrice(model.pricing?.perImage["4k"]),
    inputFee: formatPrice(model.pricing?.perInput),
  }));

  const widths = {
    id: Math.max("ID".length, ...rows.map((row) => row.id.length)),
    name: Math.max("Name".length, ...rows.map((row) => row.name.length)),
    base: Math.max("Base".length, ...rows.map((row) => row.base.length)),
    fourK: Math.max("4K".length, ...rows.map((row) => row.fourK.length)),
    inputFee: Math.max("Input fee".length, ...rows.map((row) => row.inputFee.length)),
  };

  print(
    [
      "ID".padEnd(widths.id),
      "Name".padEnd(widths.name),
      "Base".padEnd(widths.base),
      "4K".padEnd(widths.fourK),
      "Input fee".padEnd(widths.inputFee),
    ].join("  "),
  );

  for (const row of rows) {
    print(
      [
        row.id.padEnd(widths.id),
        row.name.padEnd(widths.name),
        row.base.padEnd(widths.base),
        row.fourK.padEnd(widths.fourK),
        row.inputFee.padEnd(widths.inputFee),
      ].join("  "),
    );
  }
};

export const createModelsCommand = (ctx: CliContext): Command => {
  const models = new Command("models").description("Browse the public Mynth model catalog");

  models
    .command("list")
    .description("List available image generation models")
    .option("--json", "Output machine-readable JSON instead of a human-readable table")
    .action(async (options: JsonOption) => {
      const data = await ctx.models.list();
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderHuman(data);
    });

  return models;
};
