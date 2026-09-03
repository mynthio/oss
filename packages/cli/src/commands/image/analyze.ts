import { Command, Option } from "commander";
import { imageAltResult, imageRateResult, imageReviewResult } from "../../api/schemas.ts";
import type { App } from "../../app.ts";
import { glyph, print, printJson } from "../../output/print.ts";
import { renderReview, renderUploads } from "../../output/render.ts";
import { collect } from "../../utils/parse.ts";
import { jsonOption, type JsonFlag } from "../options.ts";
import {
  MAX_RATE_LEVELS,
  MIN_RATE_LEVELS,
  resolveImage,
  resolveLevels,
  runAnalysis,
  type LevelOptions,
} from "./shared.ts";

const REVIEW_EFFORTS = ["low", "high"] as const;

const IMAGE_ARGUMENT_HELP = "Image URL (http/https), or a local image file to upload first";

const addLevelOptions = (command: Command) =>
  command
    .option(
      "-l, --level <value>",
      `Custom rating level as "value=description" (repeatable, ${MIN_RATE_LEVELS}-${MAX_RATE_LEVELS} items). Example: -l safe="No explicit content" -l nsfw="Contains nudity"`,
      collect,
    )
    .option(
      "--levels-file <path>",
      'JSON file holding an array of { "value", "description" }, or `-` for stdin. Use when descriptions contain shell metacharacters.',
    )
    .option("--levels-json <json>", "Inline JSON array of { value, description }.");

const rateCommand = (app: App): Command => {
  const rate = new Command("rate")
    .description("Classify an image against the default sfw/nsfw levels, or custom ones")
    .argument("<image>", IMAGE_ARGUMENT_HELP)
    .addOption(jsonOption());

  addLevelOptions(rate).action(async (input: string, options: JsonFlag & LevelOptions) => {
    const levels = await resolveLevels(options);
    const { url, uploads } = await resolveImage(app, input);

    const { taskId, cost, result } = await runAnalysis(app, {
      endpoint: "rate",
      body: levels !== undefined ? { url, mode: "custom", levels } : { url },
      schema: imageRateResult,
      quiet: options.json === true,
    });

    if (options.json) {
      printJson({ taskId, cost, ...result });
      return;
    }

    renderUploads(uploads);
    print(`${glyph.ok} Rated (task ${taskId})`);
    print(`  ${result.level}  ${result.url}`);
  });

  return rate;
};

const altCommand = (app: App): Command =>
  new Command("alt")
    .description("Generate accessibility alt text for an image")
    .argument("<image>", IMAGE_ARGUMENT_HELP)
    .addOption(jsonOption())
    .action(async (input: string, options: JsonFlag) => {
      const { url, uploads } = await resolveImage(app, input);

      const { taskId, cost, result } = await runAnalysis(app, {
        endpoint: "alt",
        body: { url },
        schema: imageAltResult,
        quiet: options.json === true,
      });

      if (options.json) {
        printJson({ taskId, cost, ...result });
        return;
      }

      renderUploads(uploads);
      print(`${glyph.ok} Generated alt text (task ${taskId})`);
      print(`  ${result.alt}`);
      print(`  ${result.url}`);
    });

const reviewCommand = (app: App): Command =>
  new Command("review")
    .description("Review image quality with a multi-model panel (score, findings, strengths)")
    .argument("<image>", IMAGE_ARGUMENT_HELP)
    .addOption(
      new Option(
        "--effort <level>",
        '"high" (default) runs five strong vision models; "low" runs three smaller ones for faster, cheaper triage',
      ).choices([...REVIEW_EFFORTS]),
    )
    .addOption(jsonOption())
    .action(async (input: string, options: JsonFlag & { readonly effort?: string }) => {
      const { url, uploads } = await resolveImage(app, input);

      const { taskId, cost, result } = await runAnalysis(app, {
        endpoint: "review",
        body: { url, ...(options.effort !== undefined ? { effort: options.effort } : {}) },
        schema: imageReviewResult,
        quiet: options.json === true,
      });

      if (options.json) {
        printJson({ taskId, cost, ...result });
        return;
      }

      renderUploads(uploads);
      renderReview({
        taskId,
        cost,
        ...result,
        findings: result.findings ?? [],
        strengths: result.strengths ?? [],
      });
    });

export const analysisCommands = (app: App): ReadonlyArray<Command> => [
  rateCommand(app),
  altCommand(app),
  reviewCommand(app),
];
