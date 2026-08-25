import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Command, Option } from "commander";
import chalk from "chalk";
import { z } from "zod";
import type { CliContext } from "../context.ts";
import { CliUsageError } from "../domain/Errors.ts";
import {
  ImageService,
  MAX_RATE_LEVELS,
  MAX_UPLOAD_FILES,
  MIN_RATE_LEVELS,
  REVIEW_EFFORTS,
  type RateLevel,
  type ReviewEffort,
  type ReviewResponse,
  type TaskData,
} from "../services/ImageService.ts";
import { print } from "../utils/output.ts";
import { withSpinner } from "../utils/spinner.ts";

const MAX_GENERATE_INPUTS = 20;
const INPUT_AS = ["auto", "person", "garment", "pose", "source", "reference"] as const;

/** Labels for the 1–4 review score scale (higher is better). */
const SCORE_LABELS: Record<number, string> = {
  4: "Production-ready",
  3: "Usable, with fixes",
  2: "Not fit for purpose",
  1: "Discard",
};

type InputAs = (typeof INPUT_AS)[number];
type ParsedInput = {
  readonly as?: InputAs;
  readonly value: string;
  readonly isFile: boolean;
};

type JsonOption = {
  readonly json?: boolean;
};

type RateOptions = JsonOption & {
  readonly level?: ReadonlyArray<string>;
  readonly levelsFile?: string;
  readonly levelsJson?: string;
};

type ReviewOptions = JsonOption & {
  readonly effort?: ReviewEffort;
};

type GenerateOptions = RateOptions & {
  readonly prompt?: string;
  readonly negative?: string;
  readonly enhance?: "prefer_magic" | "prefer_native" | "none";
  readonly model?: string;
  readonly size?: string;
  readonly count?: number;
  readonly format?: "png" | "jpg" | "webp";
  readonly input?: ReadonlyArray<string>;
  readonly outputDir?: string;
  readonly destination?: string;
  readonly metadata?: string;
  readonly contentRating?: boolean;
  readonly async?: boolean;
  readonly detailed?: boolean;
  readonly dryRun?: boolean;
};

// Stands in for local file inputs during --dry-run: the estimate only needs
// input count and roles, so nothing is uploaded.
const DRY_RUN_INPUT_URL = "https://dry-run.mynth.io/input";

const ok = chalk.green("✓");
const fail = chalk.red("✗");
const createJsonOption = () =>
  new Option("--json", "Output machine-readable JSON instead of a human-readable summary");

const LevelArraySchema = z.array(z.object({ value: z.string(), description: z.string() }));

const isUrl = (s: string) => /^https?:\/\//i.test(s);

const collect = (value: string, previous: ReadonlyArray<string> = []) => [...previous, value];

const parseInteger = (value: string): number => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || String(parsed) !== value) {
    throw new CliUsageError(`invalid integer: "${value}"`);
  }
  return parsed;
};

const parseLevelPair = (raw: string): RateLevel => {
  const idx = raw.indexOf("=");
  if (idx <= 0) {
    throw new CliUsageError(`invalid --level "${raw}": expected "value=description"`);
  }

  const level = {
    value: raw.slice(0, idx).trim(),
    description: raw.slice(idx + 1).trim(),
  };

  if (level.value.length === 0 || level.description.length === 0) {
    throw new CliUsageError(`invalid --level "${raw}": value and description must be non-empty`);
  }

  return level;
};

const parseLevelsJson = (source: string, origin: string): ReadonlyArray<RateLevel> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    throw new CliUsageError(`invalid JSON in ${origin}: ${(cause as Error).message}`);
  }

  const result = LevelArraySchema.safeParse(parsed);
  if (!result.success) {
    throw new CliUsageError(
      `invalid levels in ${origin}: expected array of { value, description }`,
    );
  }
  return result.data;
};

const resolveLevels = async (input: {
  readonly levelPairs: ReadonlyArray<string>;
  readonly levelsFile?: string | undefined;
  readonly levelsJson?: string | undefined;
}): Promise<ReadonlyArray<RateLevel> | undefined> => {
  const sources = [
    input.levelPairs.length > 0 ? "--level" : null,
    input.levelsFile !== undefined ? "--levels-file" : null,
    input.levelsJson !== undefined ? "--levels-json" : null,
  ].filter((source): source is string => source !== null);

  if (sources.length === 0) return undefined;
  if (sources.length > 1) {
    throw new CliUsageError(`conflicting level options: ${sources.join(", ")} - use only one`);
  }

  let levels: ReadonlyArray<RateLevel>;
  if (input.levelPairs.length > 0) {
    levels = input.levelPairs.map(parseLevelPair);
  } else if (input.levelsFile !== undefined) {
    let contents: string;
    try {
      contents = await readFile(input.levelsFile, "utf8");
    } catch (cause) {
      throw new CliUsageError(`could not read ${input.levelsFile}: ${(cause as Error).message}`);
    }
    levels = parseLevelsJson(contents, input.levelsFile);
  } else {
    levels = parseLevelsJson(input.levelsJson ?? "[]", "--levels-json");
  }

  if (levels.length < MIN_RATE_LEVELS || levels.length > MAX_RATE_LEVELS) {
    throw new CliUsageError(
      `levels must have between ${MIN_RATE_LEVELS} and ${MAX_RATE_LEVELS} items (got ${levels.length})`,
    );
  }

  const values = new Set<string>();
  for (const level of levels) {
    if (values.has(level.value)) {
      throw new CliUsageError(`duplicate level value: "${level.value}"`);
    }
    values.add(level.value);
  }

  return levels;
};

const parseInputSpec = (raw: string): ParsedInput => {
  const colonIdx = raw.indexOf(":");
  const looksLikeUrl = /^https?:/i.test(raw);
  let as: InputAs | undefined;
  let rest = raw;

  if (colonIdx > 0 && !looksLikeUrl) {
    const maybeAs = raw.slice(0, colonIdx);
    if (!(INPUT_AS as ReadonlyArray<string>).includes(maybeAs)) {
      throw new CliUsageError(
        `invalid --input as "${maybeAs}". Expected one of: ${INPUT_AS.join(", ")}`,
      );
    }

    as = maybeAs as InputAs;
    rest = raw.slice(colonIdx + 1);
  }

  if (rest.length === 0) {
    throw new CliUsageError(`invalid --input "${raw}": missing path or URL`);
  }

  return {
    ...(as !== undefined ? { as } : {}),
    value: rest,
    isFile: !isUrl(rest),
  };
};

const parseMetadata = (raw: string): Record<string, unknown> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CliUsageError(`invalid --metadata JSON: ${(cause as Error).message}`);
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new CliUsageError("--metadata must be a JSON object");
  }

  return parsed as Record<string, unknown>;
};

const addLevelOptions = (command: Command) =>
  command
    .option(
      "-l, --level <value>",
      'Custom rating level as "value=description" (repeatable, 2-7 items). Example: -l safe="No explicit content" -l nsfw="Contains nudity"',
      collect,
    )
    .option(
      "--levels-file <path>",
      'Path to a JSON file containing an array of { "value": string, "description": string } (2-7 items). Alternative to --level when descriptions contain special characters.',
    )
    .option(
      "--levels-json <json>",
      'Inline JSON array of { "value": string, "description": string } (2-7 items). Alternative to --level / --levels-file.',
    );

export const renderTaskHuman = (
  task: {
    readonly id: string;
    readonly cost: string | null;
    readonly result: unknown;
  },
  uploadedCount: number,
): void => {
  const result = (task.result ?? {}) as TaskResult;
  const images = result.images ?? [];

  if (uploadedCount > 0) {
    print(`${ok} Uploaded ${uploadedCount} input image${uploadedCount === 1 ? "" : "s"}`);
  }

  const succeeded = images.filter(
    (image) => (image as Record<string, unknown>)["status"] === "success",
  );
  print(
    `${ok} Generated ${succeeded.length}/${images.length} image${images.length === 1 ? "" : "s"} (task ${task.id})`,
  );

  if (result.model !== undefined) print(`  Model: ${result.model}`);
  if (task.cost !== null) print(`  Cost: ${task.cost}`);

  if (result.magic_prompt?.positive !== undefined) {
    print("");
    print("Enhanced prompt (mynth):");
    print(`  ${result.magic_prompt.positive}`);
    if (result.magic_prompt.negative !== undefined && result.magic_prompt.negative.length > 0) {
      print(`  negative: ${result.magic_prompt.negative}`);
    }
  }

  if (images.length > 0) {
    print("");
    for (const raw of images) {
      const image = raw as Record<string, unknown>;
      if (image["status"] === "success") {
        const rating = image["rating"] as { level?: string } | undefined;
        const ratingSuffix = rating?.level !== undefined ? ` [${rating.level}]` : "";
        const url = (image["url"] as string | null) ?? (image["mynth_url"] as string);
        print(`  ${ok} ${url}${ratingSuffix}`);
      } else {
        print(`  ${fail} ${formatImageError(image["error"])}`);
      }
    }
  }
};

const formatImageError = (error: unknown): string => {
  if (typeof error === "string") return error;
  if (error !== null && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const code = typeof obj["code"] === "string" ? obj["code"] : "unknown error";
    const message = typeof obj["message"] === "string" ? obj["message"] : undefined;
    return message !== undefined ? `${code}: ${message}` : code;
  }
  return "unknown error";
};

export const renderReviewHuman = (result: ReviewResponse): void => {
  const scoreLabel = SCORE_LABELS[result.score] ?? `${result.score}/4`;
  print(`${ok} Reviewed (task ${result.taskId})`);
  print(`  Score: ${result.score}/4 — ${scoreLabel}`);
  print(`  Cost:  ${result.cost}`);
  print(`  ${result.url}`);

  if (result.summary.length > 0) {
    print("");
    print("Summary");
    print(`  ${result.summary}`);
  }

  if (result.findings.length > 0) {
    print("");
    print(`Findings (${result.findings.length})`);
    for (const item of result.findings) {
      print(`  • [${item.severity}] ${item.category} — ${item.finding}`);
      print(`    where: ${item.where}  (${item.confidence} confidence)`);
    }
  }

  if (result.strengths.length > 0) {
    print("");
    print(`Strengths (${result.strengths.length})`);
    for (const item of result.strengths) {
      print(`  • ${item.strength}  (${item.confidence} confidence)`);
    }
  }
};

export const summarizeTask = (task: {
  readonly id: string;
  readonly status: string;
  readonly cost: string | null;
  readonly result: unknown;
}) => {
  const result = (task.result ?? {}) as TaskResult;
  const images = (result.images ?? []).map((image) => {
    const obj = image as Record<string, unknown>;
    if (obj["status"] === "success") {
      return {
        status: "success",
        url: obj["url"] ?? null,
        mynth_url: obj["mynth_url"] ?? null,
        size: obj["size"],
        rating: obj["rating"],
      };
    }
    return {
      status: "failed",
      error: obj["error"],
      mynth_url: obj["mynth_url"] ?? null,
    };
  });

  return {
    taskId: task.id,
    status: task.status,
    images,
    ...(result.magic_prompt ? { magic_prompt: result.magic_prompt } : {}),
    ...(task.cost !== null ? { cost: task.cost } : {}),
    ...(result.model !== undefined ? { model: result.model } : {}),
  };
};

const downloadSucceededImages = async (
  images: ImageService,
  task: { readonly id: string; readonly result: unknown },
  destinationDir: string,
): Promise<ReadonlyArray<string>> => {
  const result = (task.result ?? {}) as TaskResult;
  const urls = (result.images ?? [])
    .map((image) => image as Record<string, unknown>)
    .filter((image) => image["status"] === "success")
    .map((image) => (image["url"] as string | null) ?? (image["mynth_url"] as string | null))
    .filter((url): url is string => typeof url === "string" && url.length > 0);

  if (urls.length === 0) return [];
  return images.downloadImages({ urls, destinationDir, taskId: task.id });
};

type TaskResult = {
  images?: ReadonlyArray<Record<string, unknown>>;
  model?: string;
  magic_prompt?: { positive?: string; negative?: string };
};

export const createImageCommand = (ctx: CliContext): Command => {
  const image = new Command("image");

  image
    .command("upload")
    .description("Upload local images to Mynth")
    .argument("<files...>", "Path to a local image file (.jpg, .jpeg, .png, .webp)")
    .addOption(createJsonOption())
    .action(async (files: ReadonlyArray<string>, options: JsonOption) => {
      if (files.length > MAX_UPLOAD_FILES) {
        throw new CliUsageError(`too many files: ${files.length} (max ${MAX_UPLOAD_FILES})`);
      }

      const uploaded = await ctx.images.upload(files);
      if (options.json) {
        print(JSON.stringify({ images: uploaded }, null, 2));
        return;
      }

      print(`${ok} Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`);
      for (const { path, url } of uploaded) {
        print(`  ${path}`);
        print(`    -> ${url}`);
      }
    });

  const rate = image
    .command("rate")
    .description("Rate an image by URL or local file")
    .argument(
      "<image>",
      "Image URL (http://, https://) or path to a local image file to upload first",
    )
    .addOption(createJsonOption());
  addLevelOptions(rate);
  rate.action(async (input: string, options: RateOptions) => {
    const levels = await resolveLevels({
      levelPairs: options.level ?? [],
      levelsFile: options.levelsFile,
      levelsJson: options.levelsJson,
    });

    const uploaded = isUrl(input) ? [] : await ctx.images.upload([input]);
    const url = isUrl(input) ? input : uploaded[0]!.url;

    const result = await ctx.images.rate({
      url,
      ...(levels ? { levels } : {}),
    });
    if (options.json) {
      print(JSON.stringify(result, null, 2));
      return;
    }

    if (uploaded.length > 0) {
      print(`${ok} Uploaded 1 image`);
      print(`  ${uploaded[0]!.path} -> ${uploaded[0]!.url}`);
    }
    print(`${ok} Rated (task ${result.taskId})`);
    print(`  ${result.level}  ${result.url}`);
  });

  image
    .command("alt")
    .description("Generate alt text for an image by URL or local file")
    .argument(
      "<image>",
      "Image URL (http://, https://) or path to a local image file to upload first",
    )
    .addOption(createJsonOption())
    .action(async (input: string, options: JsonOption) => {
      const uploaded = isUrl(input) ? [] : await ctx.images.upload([input]);
      const url = isUrl(input) ? input : uploaded[0]!.url;

      const result = await ctx.images.alt({ url });
      if (options.json) {
        print(JSON.stringify(result, null, 2));
        return;
      }

      if (uploaded.length > 0) {
        print(`${ok} Uploaded 1 image`);
        print(`  ${uploaded[0]!.path} -> ${uploaded[0]!.url}`);
      }
      print(`${ok} Generated alt text (task ${result.taskId})`);
      print(`  ${result.alt}`);
      print(`  ${result.url}`);
    });

  image
    .command("review")
    .description("Review image quality with a multi-model panel (score, findings, strengths)")
    .argument(
      "<image>",
      "Image URL (http://, https://) or path to a local image file to upload first",
    )
    .addOption(
      new Option(
        "--effort <level>",
        'Reviewer panel size: "high" (default, five strong vision models) or "low" (three smaller models, faster/cheaper triage)',
      ).choices([...REVIEW_EFFORTS]),
    )
    .addOption(createJsonOption())
    .action(async (input: string, options: ReviewOptions) => {
      const uploaded = isUrl(input) ? [] : await ctx.images.upload([input]);
      const url = isUrl(input) ? input : uploaded[0]!.url;

      const result = await ctx.images.review({
        url,
        ...(options.effort !== undefined ? { effort: options.effort } : {}),
      });

      if (options.json) {
        print(JSON.stringify(result, null, 2));
        return;
      }

      if (uploaded.length > 0) {
        print(`${ok} Uploaded 1 image`);
        print(`  ${uploaded[0]!.path} -> ${uploaded[0]!.url}`);
      }
      renderReviewHuman(result);
    });

  const generate = image
    .command("generate")
    .description("Generate images with Mynth")
    .addHelpText("after", "\nModels: mynth models list");
  generate
    .option("-p, --prompt <text>", "Text prompt describing the image to generate")
    .option("-n, --negative <text>", "Negative prompt (elements to exclude)")
    .addOption(
      new Option(
        "--enhance <mode>",
        'Prompt enhancement mode: "prefer_magic" (Mynth) or "none". "prefer_native" is no longer supported by the API.',
      ).choices(["prefer_magic", "prefer_native", "none"]),
    )
    .option("-m, --model <id>", 'Model ID (e.g. "black-forest-labs/flux.1-dev"). Default: "auto"')
    .option(
      "-s, --size <size>",
      'Size preset or aspect ratio: "square", "portrait", "landscape", "1:1", "16:9", "16:9_4k", "auto", etc.',
    )
    .option("-c, --count <number>", "Number of images to generate (default: 1)", parseInteger)
    .addOption(
      new Option("-f, --format <format>", "Output image format (default: model native)").choices([
        "png",
        "jpg",
        "webp",
      ]),
    )
    .option(
      "-i, --input <value>",
      `Input image as "[as:]path-or-url" (repeatable, up to ${MAX_GENERATE_INPUTS}). as is optional and must be one of: ${INPUT_AS.join(", ")}. Examples: -i ./img.jpg, -i source:https://example.com/a.png, -i reference:./style.png`,
      collect,
    )
    .option(
      "-o, --output-dir <dir>",
      "Directory to save generated images to. Created if it doesn't exist. Ignored in --async mode since the task hasn't completed yet.",
    )
    .option(
      "--destination <name>",
      "Name (slug) of a user-configured destination to deliver the result to. Falls back to MYNTH_DESTINATION env var if not set.",
    )
    .option(
      "--metadata <json>",
      "Inline JSON object of custom metadata to attach to the task (max 2KB)",
    )
    .option(
      "--content-rating",
      "Enable content rating classification using default sfw/nsfw levels. For custom levels use --level / --levels-file / --levels-json.",
    )
    .option(
      "--dry-run",
      "Validate the request and print the estimated cost without generating anything",
    )
    .option("--async", "Return the task ID immediately instead of polling until completion")
    .option("--detailed", "Include full task data (all fields) in the output")
    .addOption(createJsonOption());
  addLevelOptions(generate);

  generate.action(async (options: GenerateOptions) => {
    // The prompt is always sent but may be empty: some models (e.g. virtual
    // try-on) work best with no prompt at all.
    const prompt = options.prompt ?? "";

    if (options.enhance === "prefer_native") {
      throw new CliUsageError(
        '--enhance prefer_native is no longer supported by the API; use "prefer_magic" or "none"',
      );
    }

    const inputs = options.input ?? [];
    if (inputs.length > MAX_GENERATE_INPUTS) {
      throw new CliUsageError(
        `too many --input values: ${inputs.length} (max ${MAX_GENERATE_INPUTS})`,
      );
    }

    const parsedInputs = inputs.map(parseInputSpec);
    const metadata = options.metadata !== undefined ? parseMetadata(options.metadata) : undefined;
    const customLevels = await resolveLevels({
      levelPairs: options.level ?? [],
      levelsFile: options.levelsFile,
      levelsJson: options.levelsJson,
    });

    const filePaths = parsedInputs.filter((input) => input.isFile).map((input) => input.value);
    const uniqueFilePaths = Array.from(new Set(filePaths));
    const uploaded =
      uniqueFilePaths.length > 0 && !options.dryRun ? await ctx.images.upload(uniqueFilePaths) : [];
    const uploadedByPath = new Map(uploaded.map((upload) => [upload.path, upload.url] as const));

    const resolvedInputs = parsedInputs.map((input) => ({
      type: "image" as const,
      ...(input.as ? { as: input.as } : {}),
      source: {
        type: "url" as const,
        // The placeholder is only reachable in --dry-run, where files are not uploaded.
        url: input.isFile ? (uploadedByPath.get(input.value) ?? DRY_RUN_INPUT_URL) : input.value,
      },
    }));

    const output = options.format !== undefined ? { format: options.format } : undefined;

    const contentRatingCfg =
      customLevels !== undefined
        ? { mode: "custom", levels: customLevels }
        : options.contentRating
          ? true
          : undefined;

    const request: Record<string, unknown> = { prompt };
    if (options.model !== undefined) request["model"] = options.model;
    if (options.negative !== undefined) request["negative_prompt"] = options.negative;
    if (options.enhance === "prefer_magic") request["magic_prompt"] = true;
    if (options.size !== undefined) request["size"] = options.size;
    if (options.count !== undefined) request["count"] = options.count;
    if (output !== undefined) request["output"] = output;
    if (resolvedInputs.length > 0) request["inputs"] = resolvedInputs;
    if (options.destination !== undefined) request["destination"] = options.destination;
    if (contentRatingCfg !== undefined) request["rating"] = contentRatingCfg;
    if (metadata !== undefined) request["metadata"] = metadata;

    if (options.dryRun) {
      const estimate = await ctx.images.estimate(request);
      if (options.json) {
        print(JSON.stringify(estimate, null, 2));
        return;
      }
      const suffix = estimate.estimateKind === "upper_bound" ? " (upper bound)" : "";
      print(`${ok} Estimated cost: $${estimate.estimatedCost}${suffix}`);
      return;
    }

    if (options.async) {
      const created = await ctx.images.generate({ request, requestPat: true });
      const payload = {
        taskId: created.taskId,
        ...(created.pat !== undefined ? { access: { publicAccessToken: created.pat } } : {}),
      };
      if (options.json) {
        print(JSON.stringify(payload, null, 2));
        return;
      }
      print(`${ok} Task created: ${created.taskId}`);
      if (created.pat !== undefined) print(`  PAT: ${created.pat}`);
      return;
    }

    const created = await ctx.images.generate({ request, requestPat: true });
    const wait = ctx.images.waitForTask(created.taskId, created.pat);
    const task: TaskData = options.json ? await wait : await withSpinner(wait);

    const outputDir = options.outputDir !== undefined ? resolve(options.outputDir) : undefined;
    const downloadedFiles =
      outputDir !== undefined ? await downloadSucceededImages(ctx.images, task, outputDir) : [];

    if (options.json) {
      const base = options.detailed ? task : summarizeTask(task);
      const payload = outputDir !== undefined ? { ...(base as object), downloadedFiles } : base;
      print(JSON.stringify(payload, null, 2));
      return;
    }

    renderTaskHuman(task, uploaded.length);
    if (outputDir !== undefined && downloadedFiles.length > 0) {
      print("");
      print(
        `${ok} Saved ${downloadedFiles.length} image${downloadedFiles.length === 1 ? "" : "s"} to ${outputDir}`,
      );
      for (const file of downloadedFiles) {
        print(`  ${file}`);
      }
    }
  });

  return image;
};
