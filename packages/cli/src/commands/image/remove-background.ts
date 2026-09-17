import { resolve } from "node:path";
import { Command, Option } from "commander";
import { imageRemoveBackgroundResult } from "../../api/schemas.ts";
import type { App } from "../../app.ts";
import { printJson } from "../../output/print.ts";
import { renderDownloads, renderRemoveBackground, renderUploads } from "../../output/render.ts";
import { downloadAll } from "../../utils/download.ts";
import { parseJsonObject } from "../../utils/parse.ts";
import { jsonOption, type JsonFlag } from "../options.ts";
import {
  addDeliveryOptions,
  buildDelivery,
  createTaskAsync,
  resolveImage,
  runImageTask,
  type DeliveryOptions,
} from "./shared.ts";

const OUTPUT_FORMATS = ["png", "webp"] as const;

type RemoveBackgroundOptions = JsonFlag &
  DeliveryOptions & {
    readonly format?: string;
    readonly outputDir?: string;
    readonly metadata?: string;
    readonly async?: boolean;
  };

export const removeBackgroundCommand = (app: App): Command => {
  const command = new Command("remove-background")
    .description("Remove the background from an image. Mynth picks the model.")
    .argument("<image>", "Image URL (http/https), or a local image file to upload first")
    .addOption(
      new Option(
        "-f, --format <format>",
        "Output format. Default: whatever the provider returns",
      ).choices([...OUTPUT_FORMATS]),
    )
    .option(
      "-o, --output-dir <dir>",
      "Directory to save the result into. Created if missing. Ignored with --async.",
    )
    .option("--metadata <json>", "Inline JSON object attached to the task (max 2KB)");

  addDeliveryOptions(command)
    .option("--async", "Print the task ID immediately instead of waiting for the result")
    .addOption(jsonOption());

  command.action(async (input: string, options: RemoveBackgroundOptions) => {
    const { url, uploads } = await resolveImage(app, input);

    const body = {
      url,
      ...(options.format !== undefined ? { output: { format: options.format } } : {}),
      ...buildDelivery(app, options),
      ...(options.metadata !== undefined
        ? { metadata: parseJsonObject(options.metadata, "--metadata") }
        : {}),
    };

    if (options.async === true) {
      await createTaskAsync(app, {
        endpoint: "remove-background",
        body,
        json: options.json === true,
      });
      return;
    }

    const { taskId, cost, result } = await runImageTask(app, {
      endpoint: "remove-background",
      body,
      schema: imageRemoveBackgroundResult,
      quiet: options.json === true,
    });

    const outputDir = options.outputDir !== undefined ? resolve(options.outputDir) : undefined;
    const downloaded =
      outputDir !== undefined
        ? await downloadAll({
            urls: [result.image.url ?? result.image.mynth_url],
            directory: outputDir,
            fallbackPrefix: taskId,
          })
        : [];

    if (options.json) {
      printJson({
        taskId,
        cost,
        ...result,
        ...(outputDir !== undefined ? { downloadedFiles: downloaded } : {}),
      });
      return;
    }

    renderUploads(uploads);
    renderRemoveBackground({ taskId, cost, ...result });
    if (outputDir !== undefined) renderDownloads(downloaded, outputDir);
  });

  return command;
};
