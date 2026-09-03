import { Command } from "commander";
import { listModels } from "../api/models.ts";
import type { App } from "../app.ts";
import { printJson } from "../output/print.ts";
import { printTable } from "../output/table.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

export const modelsCommand = (app: App): Command => {
  const models = new Command("models").description("Browse the public Mynth model catalog");

  models
    .command("list")
    .description("List available image generation models and their per-image pricing")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const data = await listModels(app.api);
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
        "No models available.",
      );
    });

  return models;
};
