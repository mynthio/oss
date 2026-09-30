import { resolve } from "node:path";
import { Command, Option } from "commander";
import { imageUpscaleResult } from "../../api/schemas.ts";
import type { App } from "../../app.ts";
import { printJson } from "../../output/print.ts";
import { renderDownloads, renderUploads, renderUpscale } from "../../output/render.ts";
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

const SIZES = ["2x", "4x"] as const;
const EFFORTS = ["low", "high"] as const;
const OUTPUT_FORMATS = ["png", "jpg", "webp"] as const;

type UpscaleOptions = JsonFlag &
  DeliveryOptions & {
    readonly size: string;
    readonly effort: string;
    readonly format?: string;
    readonly outputDir?: string;
    readonly metadata?: string;
    readonly async?: boolean;
  };

export const upscaleCommand = (app: App): Command => {
  const command = new Command("upscale")
    .description("Enlarge an image 2x or 4x, up to 4096x4096. Mynth picks the model.")
    .argument("<image>", "Image URL (http/https), or a local image file to upload first")
    .addOption(
      new Option("-s, --size <size>", "How much to enlarge each side")
        .choices([...SIZES])
        .makeOptionMandatory(),
    )
    .addOption(
      new Option(
        "--effort <level>",
        '"low" is fast and sharp; "high" rebuilds fine detail such as small text and faces. Sets the price, so there is no default',
      )
        .choices([...EFFORTS])
        .makeOptionMandatory(),
    )
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

  command.action(async (input: string, options: UpscaleOptions) => {
    const { url, uploads } = await resolveImage(app, input);

    const body = {
      url,
      size: options.size,
      effort: options.effort,
      ...(options.format !== undefined ? { output: { format: options.format } } : {}),
      ...buildDelivery(app, options),
      ...(options.metadata !== undefined
        ? { metadata: parseJsonObject(options.metadata, "--metadata") }
        : {}),
    };

    if (options.async === true) {
      await createTaskAsync(app, {
        endpoint: "upscale",
        body,
        json: options.json === true,
      });
      return;
    }

    const { taskId, cost, result } = await runImageTask(app, {
      endpoint: "upscale",
      body,
      schema: imageUpscaleResult,
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
    renderUpscale({ taskId, cost, ...result });
    if (outputDir !== undefined) renderDownloads(downloaded, outputDir);
  });

  return command;
};
