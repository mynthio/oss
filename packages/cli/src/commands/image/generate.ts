import { resolve } from "node:path";
import { Command, Option } from "commander";
import {
  createImageTask,
  estimateGeneration,
  uploadImages,
  type UploadedImage,
} from "../../api/images.ts";
import { waitForTask } from "../../api/tasks.ts";
import type { Task } from "../../api/schemas.ts";
import type { App } from "../../app.ts";
import { UsageError } from "../../errors.ts";
import { glyph, plural, print, printJson } from "../../output/print.ts";
import {
  imageUrl,
  readImageGenerateResult,
  renderTaskResult,
  renderUploads,
  summarizeTask,
} from "../../output/render.ts";
import { withSpinner } from "../../output/spinner.ts";
import { downloadAll } from "../../utils/download.ts";
import { collect, isHttpUrl, parseInteger, parseJsonObject } from "../../utils/parse.ts";
import { jsonOption, type JsonFlag } from "../options.ts";
import { resolveLevels, type LevelOptions } from "./shared.ts";

const MAX_INPUTS = 20;
const OUTPUT_FORMATS = ["png", "jpg", "webp"] as const;
const INPUT_ROLES = ["auto", "person", "garment", "pose", "source", "reference"] as const;

/**
 * Stands in for local files during `--dry-run`: the estimate only depends on
 * input count and roles, so nothing is uploaded.
 */
const DRY_RUN_INPUT_URL = "https://dry-run.mynth.io/input";

type InputRole = (typeof INPUT_ROLES)[number];

type ParsedInput = {
  readonly role?: InputRole;
  readonly value: string;
  readonly isLocalFile: boolean;
};

type GenerateOptions = JsonFlag &
  LevelOptions & {
    readonly prompt?: string;
    readonly negative?: string;
    readonly magicPrompt?: boolean;
    readonly model?: string;
    readonly size?: string;
    readonly count?: number;
    readonly format?: string;
    readonly input?: ReadonlyArray<string>;
    readonly outputDir?: string;
    readonly destination?: string;
    readonly metadata?: string;
    readonly contentRating?: boolean;
    readonly webhookUrl?: ReadonlyArray<string>;
    readonly dashboardWebhooks?: boolean;
    readonly async?: boolean;
    readonly detailed?: boolean;
    readonly dryRun?: boolean;
  };

/** Parses `[role:]path-or-url`. A bare `https://...` keeps its colon. */
const parseInput = (raw: string): ParsedInput => {
  const separator = raw.indexOf(":");
  let role: InputRole | undefined;
  let value = raw;

  if (separator > 0 && !/^https?:/i.test(raw)) {
    const candidate = raw.slice(0, separator);
    if (!(INPUT_ROLES as ReadonlyArray<string>).includes(candidate)) {
      throw new UsageError(
        `invalid --input role "${candidate}". Expected one of: ${INPUT_ROLES.join(", ")}`,
      );
    }
    role = candidate as InputRole;
    value = raw.slice(separator + 1);
  }

  if (value.length === 0) throw new UsageError(`invalid --input "${raw}": missing path or URL`);
  return { ...(role !== undefined ? { role } : {}), value, isLocalFile: !isHttpUrl(value) };
};

const buildWebhook = (options: GenerateOptions): Record<string, unknown> | undefined => {
  const custom = options.webhookUrl ?? [];
  // `--no-dashboard-webhooks` flips Commander's default of `true`.
  const disableDashboard = options.dashboardWebhooks === false;

  if (custom.length === 0 && !disableDashboard) return undefined;
  return {
    ...(disableDashboard ? { dashboard: false } : {}),
    ...(custom.length > 0 ? { custom: custom.map((url) => ({ url })) } : {}),
  };
};

const buildRequest = async (
  app: App,
  options: GenerateOptions,
  inputs: ReadonlyArray<ParsedInput>,
  uploadedByPath: ReadonlyMap<string, string>,
): Promise<Record<string, unknown>> => {
  const levels = await resolveLevels(options);
  const rating =
    levels !== undefined
      ? { mode: "custom", levels }
      : options.contentRating === true
        ? true
        : undefined;

  const destination = options.destination ?? app.config.envDestination;
  const webhook = buildWebhook(options);

  const resolvedInputs = inputs.map((input) => ({
    type: "image" as const,
    ...(input.role !== undefined ? { as: input.role } : {}),
    source: {
      type: "url" as const,
      url: input.isLocalFile ? (uploadedByPath.get(input.value) ?? DRY_RUN_INPUT_URL) : input.value,
    },
  }));

  return {
    // Always sent, and legitimately empty for models (e.g. virtual try-on) that
    // work best with inputs alone.
    prompt: options.prompt ?? "",
    ...(options.model !== undefined ? { model: options.model } : {}),
    ...(options.negative !== undefined ? { negative_prompt: options.negative } : {}),
    ...(options.magicPrompt === true ? { magic_prompt: true } : {}),
    ...(options.size !== undefined ? { size: options.size } : {}),
    ...(options.count !== undefined ? { count: options.count } : {}),
    ...(options.format !== undefined ? { output: { format: options.format } } : {}),
    ...(resolvedInputs.length > 0 ? { inputs: resolvedInputs } : {}),
    ...(destination !== undefined ? { destination } : {}),
    ...(rating !== undefined ? { rating } : {}),
    ...(webhook !== undefined ? { webhook } : {}),
    ...(options.metadata !== undefined
      ? { metadata: parseJsonObject(options.metadata, "--metadata") }
      : {}),
  };
};

const downloadImages = (task: Task, directory: string): Promise<ReadonlyArray<string>> => {
  const urls = readImageGenerateResult(task.result)
    .images.map(imageUrl)
    .filter((url): url is string => url !== undefined);

  return urls.length === 0
    ? Promise.resolve([])
    : downloadAll({ urls, directory, fallbackPrefix: task.id });
};

export const generateCommand = (app: App): Command => {
  const generate = new Command("generate")
    .description("Generate images with Mynth")
    .addHelpText("after", "\nBrowse models with: mynth models list")
    .option("-p, --prompt <text>", "Text prompt describing the image to generate")
    .option("-n, --negative <text>", "Negative prompt: elements to exclude")
    .option("--magic-prompt", "Let Mynth expand the prompt before generating")
    .option("-m, --model <id>", 'Model ID (e.g. "black-forest-labs/flux.2-pro"). Default: auto')
    .option(
      "-s, --size <size>",
      'Size preset or aspect ratio: "square", "portrait", "landscape", "1:1", "16:9", "16:9_4k", "auto", ...',
    )
    .option(
      "-c, --count <number>",
      "Number of images to generate (default: 1)",
      parseInteger("--count"),
    )
    .addOption(
      new Option("-f, --format <format>", "Output image format").choices([...OUTPUT_FORMATS]),
    )
    .option(
      "-i, --input <value>",
      `Input image as "[role:]path-or-url" (repeatable, up to ${MAX_INPUTS}). Roles: ${INPUT_ROLES.join(", ")}. Examples: -i ./img.jpg, -i source:https://example.com/a.png`,
      collect,
    )
    .option(
      "-o, --output-dir <dir>",
      "Directory to save generated images into. Created if missing. Ignored with --async.",
    )
    .option(
      "--destination <name>",
      "Slug of a configured storage destination to deliver results to. Defaults to MYNTH_DESTINATION.",
    )
    .option("--metadata <json>", "Inline JSON object attached to the task (max 2KB)")
    .option(
      "--content-rating",
      "Classify each image with the default sfw/nsfw levels. For custom levels use --level.",
    )
    .option(
      "-l, --level <value>",
      'Custom rating level as "value=description" (repeatable, 2-7)',
      collect,
    )
    .option("--levels-file <path>", "JSON file of custom rating levels, or `-` for stdin")
    .option("--levels-json <json>", "Inline JSON array of custom rating levels")
    .option(
      "--webhook-url <url>",
      "Deliver this task's events to this URL (repeatable, max 5)",
      collect,
    )
    .option("--no-dashboard-webhooks", "Skip dashboard-configured webhooks for this task")
    .option("--dry-run", "Validate the request and print the estimated cost without generating")
    .option("--async", "Print the task ID immediately instead of waiting for the result")
    .option("--detailed", "Include the full task record in --json output")
    .addOption(jsonOption());

  generate.action(async (options: GenerateOptions) => {
    const rawInputs = options.input ?? [];
    if (rawInputs.length > MAX_INPUTS) {
      throw new UsageError(`too many --input values: ${rawInputs.length} (max ${MAX_INPUTS})`);
    }
    const inputs = rawInputs.map(parseInput);

    const localPaths = [
      ...new Set(inputs.filter((input) => input.isLocalFile).map((input) => input.value)),
    ];
    const uploads: ReadonlyArray<UploadedImage> =
      localPaths.length > 0 && options.dryRun !== true
        ? await uploadImages(app.api, localPaths)
        : [];

    const request = await buildRequest(
      app,
      options,
      inputs,
      new Map(uploads.map((upload) => [upload.path, upload.url])),
    );

    if (options.dryRun === true) {
      const estimate = await estimateGeneration(app.api, request);
      if (options.json) {
        printJson(estimate);
        return;
      }
      const qualifier = estimate.estimateKind === "upper_bound" ? " (upper bound)" : "";
      print(`${glyph.ok} Estimated cost: $${estimate.estimatedCost}${qualifier}`);
      return;
    }

    if (options.async === true) {
      // A public access token lets browser or CI code poll this task without
      // the API key, so it is only worth requesting when we are not waiting.
      const created = await createImageTask(app.api, "generate", {
        ...request,
        access: { pat: { enabled: true } },
      });
      const token = created.access?.publicAccessToken;

      if (options.json) {
        printJson({
          taskId: created.taskId,
          ...(created.estimatedCost !== undefined ? { estimatedCost: created.estimatedCost } : {}),
          ...(token !== undefined ? { access: { publicAccessToken: token } } : {}),
        });
        return;
      }

      print(`${glyph.ok} Task created: ${created.taskId}`);
      if (token !== undefined) print(`  Public access token: ${token}`);
      print(`  Await it with: mynth task wait ${created.taskId}`);
      return;
    }

    const created = await createImageTask(app.api, "generate", request);
    const pending = waitForTask(app.api, created.taskId);
    const task = options.json ? await pending : await withSpinner(pending);

    const outputDir = options.outputDir !== undefined ? resolve(options.outputDir) : undefined;
    const downloaded = outputDir !== undefined ? await downloadImages(task, outputDir) : [];

    if (options.json) {
      const base = options.detailed === true ? task : summarizeTask(task);
      printJson(outputDir !== undefined ? { ...base, downloadedFiles: downloaded } : base);
      return;
    }

    renderUploads(uploads);
    renderTaskResult(task);

    if (downloaded.length > 0) {
      print("");
      print(`${glyph.ok} Saved ${plural(downloaded.length, "image")} to ${outputDir}`);
      for (const file of downloaded) print(`  ${file}`);
    }
  });

  return generate;
};
