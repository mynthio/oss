import * as Args from "@effect/cli/Args";
import * as Command from "@effect/cli/Command";
import * as Options from "@effect/cli/Options";
import * as FileSystem from "@effect/platform/FileSystem";
import * as Path from "@effect/platform/Path";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { MynthApiError } from "../domain/Errors.ts";
import {
  ImageService,
  MAX_RATE_IMAGES,
  MAX_RATE_LEVELS,
  MAX_UPLOAD_FILES,
  MIN_RATE_LEVELS,
  type RateLevel,
} from "../services/ImageService.ts";
import { withSpinner } from "../utils/spinner.ts";

const jsonOption = Options.boolean("json").pipe(
  Options.withDescription("Output machine-readable JSON instead of a human-readable summary"),
);

// Shared level helpers -------------------------------------------------------

const LevelArraySchema = Schema.Array(
  Schema.Struct({ value: Schema.String, description: Schema.String }),
);

const parseLevelPair = (raw: string): Effect.Effect<RateLevel, MynthApiError> =>
  Effect.sync(() => raw.indexOf("=")).pipe(
    Effect.flatMap((idx) =>
      idx <= 0
        ? Effect.fail(
            new MynthApiError({
              message: `invalid --level "${raw}": expected "value=description"`,
              status: 0,
            }),
          )
        : Effect.succeed<RateLevel>({
            value: raw.slice(0, idx).trim(),
            description: raw.slice(idx + 1).trim(),
          }),
    ),
    Effect.flatMap((level) =>
      level.value.length === 0 || level.description.length === 0
        ? Effect.fail(
            new MynthApiError({
              message: `invalid --level "${raw}": value and description must be non-empty`,
              status: 0,
            }),
          )
        : Effect.succeed(level),
    ),
  );

const parseLevelsJson = (
  source: string,
  origin: string,
): Effect.Effect<ReadonlyArray<RateLevel>, MynthApiError> =>
  Effect.try({
    try: () => JSON.parse(source) as unknown,
    catch: (cause) =>
      new MynthApiError({
        message: `invalid JSON in ${origin}: ${(cause as Error).message}`,
        status: 0,
        cause,
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      Schema.decodeUnknown(LevelArraySchema)(parsed).pipe(
        Effect.mapError(
          (cause) =>
            new MynthApiError({
              message: `invalid levels in ${origin}: expected array of { value, description }`,
              status: 0,
              cause,
            }),
        ),
      ),
    ),
  );

const resolveLevels = Effect.fn("image.resolveLevels")(function* (input: {
  readonly levelPairs: ReadonlyArray<string>;
  readonly levelsFile: Option.Option<string>;
  readonly levelsJson: Option.Option<string>;
}) {
  const sources = [
    input.levelPairs.length > 0 ? "--level" : null,
    Option.isSome(input.levelsFile) ? "--levels-file" : null,
    Option.isSome(input.levelsJson) ? "--levels-json" : null,
  ].filter((s): s is string => s !== null);

  if (sources.length === 0) return undefined;
  if (sources.length > 1) {
    return yield* new MynthApiError({
      message: `conflicting level options: ${sources.join(", ")} — use only one`,
      status: 0,
    });
  }

  const levels: ReadonlyArray<RateLevel> = yield* input.levelPairs.length > 0
    ? Effect.forEach(input.levelPairs, parseLevelPair)
    : Option.match(input.levelsFile, {
        onSome: (path) =>
          Effect.gen(function* () {
            const fs = yield* FileSystem.FileSystem;
            const contents = yield* fs.readFileString(path).pipe(
              Effect.mapError(
                (cause) =>
                  new MynthApiError({
                    message: `could not read ${path}: ${cause.message}`,
                    status: 0,
                  }),
              ),
            );
            return yield* parseLevelsJson(contents, path);
          }),
        onNone: () =>
          parseLevelsJson(
            Option.getOrElse(input.levelsJson, () => "[]"),
            "--levels-json",
          ),
      });

  if (levels.length < MIN_RATE_LEVELS || levels.length > MAX_RATE_LEVELS) {
    return yield* new MynthApiError({
      message: `levels must have between ${MIN_RATE_LEVELS} and ${MAX_RATE_LEVELS} items (got ${levels.length})`,
      status: 0,
    });
  }

  const values = new Set<string>();
  for (const lv of levels) {
    if (values.has(lv.value)) {
      return yield* new MynthApiError({
        message: `duplicate level value: "${lv.value}"`,
        status: 0,
      });
    }
    values.add(lv.value);
  }

  return levels;
});

const isUrl = (s: string) => /^https?:\/\//i.test(s);

// image upload ---------------------------------------------------------------

const uploadFiles = Args.file({ exists: "yes" }).pipe(
  Args.withDescription("Path to a local image file (.jpg, .jpeg, .png, .webp)"),
  Args.between(1, MAX_UPLOAD_FILES),
);

const upload = Command.make("upload", { files: uploadFiles, json: jsonOption }, ({ files, json }) =>
  Effect.gen(function* () {
    const images = yield* ImageService;
    const uploaded = yield* images.upload(files);
    if (json) {
      yield* Console.log(JSON.stringify({ images: uploaded }, null, 2));
      return;
    }
    yield* Console.log(`✓ Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`);
    for (const { path, url } of uploaded) {
      yield* Console.log(`  ${path}`);
      yield* Console.log(`    → ${url}`);
    }
  }),
);

// image rate ------------------------------------------------------------------

const rateInputs = Args.text({ name: "image" }).pipe(
  Args.withDescription(
    "Image URL (http://, https://) or path to a local image file to upload first",
  ),
  Args.between(1, MAX_RATE_IMAGES),
);

const levelOption = Options.text("level").pipe(
  Options.withAlias("l"),
  Options.withDescription(
    'Custom rating level as "value=description" (repeatable, 2–7 items). ' +
      'Example: -l safe="No explicit content" -l nsfw="Contains nudity"',
  ),
  Options.repeated,
);

const levelsFileOption = Options.file("levels-file", { exists: "yes" }).pipe(
  Options.withDescription(
    'Path to a JSON file containing an array of { "value": string, "description": string } (2–7 items). ' +
      "Alternative to --level when descriptions contain special characters.",
  ),
  Options.optional,
);

const levelsJsonOption = Options.text("levels-json").pipe(
  Options.withDescription(
    'Inline JSON array of { "value": string, "description": string } (2–7 items). ' +
      "Alternative to --level / --levels-file.",
  ),
  Options.optional,
);

const rate = Command.make(
  "rate",
  {
    inputs: rateInputs,
    level: levelOption,
    levelsFile: levelsFileOption,
    levelsJson: levelsJsonOption,
    json: jsonOption,
  },
  ({ inputs, level, levelsFile, levelsJson, json }) =>
    Effect.gen(function* () {
      const images = yield* ImageService;

      const levels = yield* resolveLevels({
        levelPairs: level,
        levelsFile,
        levelsJson,
      });

      const urlInputs = inputs.filter(isUrl);
      const pathInputs = inputs.filter((s) => !isUrl(s));

      const uploaded = pathInputs.length > 0 ? yield* images.upload(pathInputs) : [];

      const uploadedByPath = new Map(uploaded.map((u) => [u.path, u.url] as const));
      const urls = inputs.map((input) =>
        isUrl(input) ? input : (uploadedByPath.get(input) ?? input),
      );

      const result = yield* images.rate({ urls, ...(levels ? { levels } : {}) });

      if (json) {
        yield* Console.log(JSON.stringify(result, null, 2));
        return;
      }

      const successes = result.results.filter(
        (r): r is { url: string; rating: string } => "url" in r,
      );
      const errors = result.results.filter((r): r is { error_code: string } => "error_code" in r);

      if (uploaded.length > 0) {
        yield* Console.log(
          `✓ Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}`,
        );
      }
      yield* Console.log(
        `✓ Rated ${successes.length}/${result.results.length} (task ${result.taskId})`,
      );
      for (const r of successes) {
        yield* Console.log(`  ${r.rating}  ${r.url}`);
      }
      for (const r of errors) {
        yield* Console.log(`  ERROR  ${r.error_code}`);
      }
      if (urlInputs.length === 0 && uploaded.length > 0) {
        yield* Console.log("");
        yield* Console.log("Uploaded source files:");
        for (const u of uploaded) {
          yield* Console.log(`  ${u.path} → ${u.url}`);
        }
      }
    }),
);

// image generate --------------------------------------------------------------

const MAX_GENERATE_INPUTS = 8;
const INPUT_ROLES = ["context", "init", "reference"] as const;
type InputRole = (typeof INPUT_ROLES)[number];

type ParsedInput = {
  readonly role: InputRole;
  readonly value: string;
  readonly isFile: boolean;
};

const parseInputSpec = (raw: string): Effect.Effect<ParsedInput, MynthApiError> =>
  Effect.sync(() => {
    const colonIdx = raw.indexOf(":");
    const looksLikeUrl = /^https?:/i.test(raw);
    if (colonIdx > 0 && !looksLikeUrl) {
      const maybeRole = raw.slice(0, colonIdx) as InputRole;
      if ((INPUT_ROLES as ReadonlyArray<string>).includes(maybeRole)) {
        return { role: maybeRole, rest: raw.slice(colonIdx + 1) };
      }
    }
    return { role: "reference" as InputRole, rest: raw };
  }).pipe(
    Effect.flatMap(({ role, rest }) =>
      rest.length === 0
        ? Effect.fail(
            new MynthApiError({
              message: `invalid --input "${raw}": missing path or URL`,
              status: 0,
            }),
          )
        : Effect.succeed<ParsedInput>({ role, value: rest, isFile: !isUrl(rest) }),
    ),
  );

const promptOption = Options.text("prompt").pipe(
  Options.withAlias("p"),
  Options.withDescription("Text prompt describing the image to generate"),
);

const negativeOption = Options.text("negative").pipe(
  Options.withAlias("n"),
  Options.withDescription("Negative prompt (elements to exclude)"),
  Options.optional,
);

const enhanceOption = Options.choice("enhance", ["prefer_magic", "prefer_native", "none"]).pipe(
  Options.withDescription(
    'Prompt enhancement mode: "prefer_magic" (Mynth), "prefer_native" (provider), or "none"',
  ),
  Options.optional,
);

const modelOption = Options.text("model").pipe(
  Options.withAlias("m"),
  Options.withDescription('Model ID (e.g. "black-forest-labs/flux.1-dev"). Default: "auto"'),
  Options.optional,
);

const sizeOption = Options.text("size").pipe(
  Options.withAlias("s"),
  Options.withDescription(
    'Size preset or aspect ratio: "square", "portrait", "landscape", "1:1", "16:9", "16:9_4k", "auto", etc.',
  ),
  Options.optional,
);

const countOption = Options.integer("count").pipe(
  Options.withAlias("c"),
  Options.withDescription("Number of images to generate (default: 1)"),
  Options.optional,
);

const formatOption = Options.choice("format", ["png", "jpg", "webp"]).pipe(
  Options.withAlias("f"),
  Options.withDescription("Output image format (default: webp)"),
  Options.optional,
);

const qualityOption = Options.integer("quality").pipe(
  Options.withAlias("q"),
  Options.withDescription("Output quality 0–100 (default: 80)"),
  Options.optional,
);

const inputOption = Options.text("input").pipe(
  Options.withAlias("i"),
  Options.withDescription(
    'Input image as "[role:]path-or-url" (repeatable, up to ' +
      `${MAX_GENERATE_INPUTS}). Role is one of: context, init, reference (default: reference). ` +
      "Examples: -i ./img.jpg, -i reference:https://example.com/a.png, -i init:./seed.png",
  ),
  Options.repeated,
);

const outputDirOption = Options.directory("output-dir", { exists: "either" }).pipe(
  Options.withAlias("o"),
  Options.withDescription(
    "Directory to save generated images to. Created if it doesn't exist. " +
      "Ignored in --async mode since the task hasn't completed yet.",
  ),
  Options.optional,
);

const destinationOption = Options.text("destination").pipe(
  Options.withDescription(
    "Name (slug) of a user-configured destination to deliver the result to. " +
      "Falls back to MYNTH_DESTINATION env var if not set.",
  ),
  Options.optional,
);

const metadataOption = Options.text("metadata").pipe(
  Options.withDescription("Inline JSON object of custom metadata to attach to the task (max 2KB)"),
  Options.optional,
);

const contentRatingOption = Options.boolean("content-rating").pipe(
  Options.withDescription(
    "Enable content rating classification using default sfw/nsfw levels. " +
      "For custom levels use --level / --levels-file / --levels-json.",
  ),
);

const asyncOption = Options.boolean("async").pipe(
  Options.withDescription("Return the task ID immediately instead of polling until completion"),
);

const detailedOption = Options.boolean("detailed").pipe(
  Options.withDescription("Include full task data (all fields) in the output"),
);

const parseMetadata = (raw: string): Effect.Effect<Record<string, unknown>, MynthApiError> =>
  Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: (cause) =>
      new MynthApiError({
        message: `invalid --metadata JSON: ${(cause as Error).message}`,
        status: 0,
        cause,
      }),
  }).pipe(
    Effect.flatMap((parsed) =>
      parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
        ? Effect.succeed(parsed as Record<string, unknown>)
        : Effect.fail(
            new MynthApiError({ message: "--metadata must be a JSON object", status: 0 }),
          ),
    ),
  );

const generate = Command.make(
  "generate",
  {
    prompt: promptOption,
    negative: negativeOption,
    enhance: enhanceOption,
    model: modelOption,
    size: sizeOption,
    count: countOption,
    format: formatOption,
    quality: qualityOption,
    input: inputOption,
    outputDir: outputDirOption,
    destination: destinationOption,
    metadata: metadataOption,
    contentRating: contentRatingOption,
    level: levelOption,
    levelsFile: levelsFileOption,
    levelsJson: levelsJsonOption,
    async: asyncOption,
    detailed: detailedOption,
    json: jsonOption,
  },
  (opts) =>
    Effect.gen(function* () {
      const images = yield* ImageService;

      if (opts.input.length > MAX_GENERATE_INPUTS) {
        return yield* new MynthApiError({
          message: `too many --input values: ${opts.input.length} (max ${MAX_GENERATE_INPUTS})`,
          status: 0,
        });
      }

      const parsedInputs = yield* Effect.forEach(opts.input, parseInputSpec);

      const metadata = yield* Option.match(opts.metadata, {
        onSome: (raw) => parseMetadata(raw).pipe(Effect.map(Option.some)),
        onNone: () => Effect.succeed(Option.none<Record<string, unknown>>()),
      });

      const customLevels = yield* resolveLevels({
        levelPairs: opts.level,
        levelsFile: opts.levelsFile,
        levelsJson: opts.levelsJson,
      });

      if (customLevels && !opts.contentRating) {
        // Custom levels imply content rating is enabled; this is allowed and does not
        // require --content-rating. Nothing to do here.
      }

      // Upload any file inputs to get CDN URLs
      const filePaths = parsedInputs.filter((i) => i.isFile).map((i) => i.value);
      const uniqueFilePaths = Array.from(new Set(filePaths));
      const uploaded = uniqueFilePaths.length > 0 ? yield* images.upload(uniqueFilePaths) : [];
      const uploadedByPath = new Map(uploaded.map((u) => [u.path, u.url] as const));

      const resolvedInputs = parsedInputs.map((i) => ({
        type: "image" as const,
        role: i.role,
        source: {
          type: "url" as const,
          url: i.isFile ? (uploadedByPath.get(i.value) ?? i.value) : i.value,
        },
      }));

      // Build structured prompt when any structured field is provided
      const enhanceValue = Option.getOrUndefined(opts.enhance);
      const negativeValue = Option.getOrUndefined(opts.negative);
      const usesStructuredPrompt = enhanceValue !== undefined || negativeValue !== undefined;

      const prompt: unknown = usesStructuredPrompt
        ? {
            positive: opts.prompt,
            ...(negativeValue !== undefined ? { negative: negativeValue } : {}),
            enhance: enhanceValue === undefined || enhanceValue === "none" ? false : enhanceValue,
          }
        : opts.prompt;

      const output: Record<string, unknown> = {};
      const fmt = Option.getOrUndefined(opts.format);
      const q = Option.getOrUndefined(opts.quality);
      if (fmt !== undefined) output["format"] = fmt;
      if (q !== undefined) output["quality"] = q;

      const contentRatingCfg =
        customLevels !== undefined
          ? { enabled: true, levels: customLevels }
          : opts.contentRating
            ? { enabled: true }
            : undefined;

      const request: Record<string, unknown> = { prompt };
      const model = Option.getOrUndefined(opts.model);
      const size = Option.getOrUndefined(opts.size);
      const count = Option.getOrUndefined(opts.count);
      const destination = Option.getOrUndefined(opts.destination);
      if (model !== undefined) request["model"] = model;
      if (size !== undefined) request["size"] = size;
      if (count !== undefined) request["count"] = count;
      if (Object.keys(output).length > 0) request["output"] = output;
      if (resolvedInputs.length > 0) request["inputs"] = resolvedInputs;
      if (destination !== undefined) request["destination"] = destination;
      if (contentRatingCfg !== undefined) request["content_rating"] = contentRatingCfg;
      if (Option.isSome(metadata)) request["metadata"] = metadata.value;

      // Async mode: create the task and return the ID immediately.
      if (opts.async) {
        const created = yield* images.generate({ request, requestPat: true });
        const payload = {
          taskId: created.taskId,
          access: Option.match(created.pat, {
            onSome: (publicAccessToken) => ({ publicAccessToken }),
            onNone: () => undefined,
          }),
        };
        if (opts.json) {
          yield* Console.log(JSON.stringify(payload, null, 2));
          return;
        }
        yield* Console.log(`✓ Task created: ${created.taskId}`);
        if (Option.isSome(created.pat)) {
          yield* Console.log(`  PAT: ${created.pat.value}`);
        }
        return;
      }

      // Sync mode: create, then poll with PAT by default.
      const created = yield* images.generate({ request, requestPat: true });

      // Show a spinner only for human-readable output; keep --json clean.
      const waitEffect = images.waitForTask(created.taskId, created.pat);
      const task = yield* opts.json ? waitEffect : withSpinner(waitEffect);

      const outputDirRaw = Option.getOrUndefined(opts.outputDir);
      const outputDir =
        outputDirRaw !== undefined ? (yield* Path.Path).resolve(outputDirRaw) : undefined;
      const downloadedFiles =
        outputDir !== undefined ? yield* downloadSucceededImages(task, outputDir) : [];

      if (opts.json) {
        const base = opts.detailed ? task : summarizeTask(task);
        const output = outputDir !== undefined ? { ...(base as object), downloadedFiles } : base;
        yield* Console.log(JSON.stringify(output, null, 2));
        return;
      }

      yield* renderTaskHuman(task, uploaded.length);
      if (outputDir !== undefined && downloadedFiles.length > 0) {
        yield* Console.log("");
        yield* Console.log(
          `✓ Saved ${downloadedFiles.length} image${downloadedFiles.length === 1 ? "" : "s"} to ${outputDir}`,
        );
        for (const f of downloadedFiles) {
          yield* Console.log(`  ${f}`);
        }
      }
    }),
);

// ----------------------------------------------------------------------------

type TaskResult = {
  images?: ReadonlyArray<Record<string, unknown>>;
  cost?: { total?: string };
  model?: string;
  prompt_enhance?: { positive?: string; negative?: string; source?: string };
  destination?: { name?: string };
  size_auto?: { value?: string; source?: string };
};

const downloadSucceededImages = Effect.fn("image.downloadSucceededImages")(function* (
  task: { readonly id: string; readonly result: unknown },
  destinationDir: string,
) {
  const images = yield* ImageService;
  const result = (task.result ?? {}) as TaskResult;
  const urls = (result.images ?? [])
    .map((img) => img as Record<string, unknown>)
    .filter((img) => img["status"] === "succeeded")
    .map((img) => (img["url"] as string | null) ?? (img["mynth_url"] as string | null))
    .filter((u): u is string => typeof u === "string" && u.length > 0);

  if (urls.length === 0) return [] as ReadonlyArray<string>;

  return yield* images.downloadImages({
    urls,
    destinationDir,
    taskId: task.id,
  });
});

const summarizeTask = (task: {
  readonly id: string;
  readonly status: string;
  readonly result: unknown;
}) => {
  const result = (task.result ?? {}) as TaskResult;
  const images = (result.images ?? []).map((img) => {
    const obj = img as Record<string, unknown>;
    if (obj["status"] === "succeeded") {
      return {
        status: "succeeded",
        url: obj["url"] ?? null,
        mynth_url: obj["mynth_url"] ?? null,
        size: obj["size"],
        content_rating: obj["content_rating"],
      };
    }
    return { status: "failed", error: obj["error"], mynth_url: obj["mynth_url"] ?? null };
  });
  return {
    taskId: task.id,
    status: task.status,
    images,
    ...(result.prompt_enhance ? { prompt_enhance: result.prompt_enhance } : {}),
    ...(result.cost?.total !== undefined ? { cost: result.cost.total } : {}),
    ...(result.model !== undefined ? { model: result.model } : {}),
  };
};

const renderTaskHuman = Effect.fn("image.renderTaskHuman")(function* (
  task: { readonly id: string; readonly status: string; readonly result: unknown },
  uploadedCount: number,
) {
  const result = (task.result ?? {}) as TaskResult;
  const images = result.images ?? [];

  if (uploadedCount > 0) {
    yield* Console.log(`✓ Uploaded ${uploadedCount} input image${uploadedCount === 1 ? "" : "s"}`);
  }

  const succeeded = images.filter((i) => (i as Record<string, unknown>)["status"] === "succeeded");
  yield* Console.log(
    `✓ Generated ${succeeded.length}/${images.length} image${images.length === 1 ? "" : "s"} (task ${task.id})`,
  );

  if (result.model !== undefined) yield* Console.log(`  Model: ${result.model}`);
  if (result.size_auto?.value !== undefined) {
    yield* Console.log(`  Size: ${result.size_auto.value} (auto, ${result.size_auto.source})`);
  }
  if (result.cost?.total !== undefined) yield* Console.log(`  Cost: ${result.cost.total}`);
  if (result.destination?.name !== undefined) {
    yield* Console.log(`  Destination: ${result.destination.name}`);
  }

  if (result.prompt_enhance?.positive !== undefined) {
    yield* Console.log("");
    yield* Console.log(`Enhanced prompt (${result.prompt_enhance.source ?? "unknown"}):`);
    yield* Console.log(`  ${result.prompt_enhance.positive}`);
    if (result.prompt_enhance.negative !== undefined && result.prompt_enhance.negative.length > 0) {
      yield* Console.log(`  negative: ${result.prompt_enhance.negative}`);
    }
  }

  if (images.length > 0) {
    yield* Console.log("");
    for (const raw of images) {
      const img = raw as Record<string, unknown>;
      if (img["status"] === "succeeded") {
        const rating = img["content_rating"] as { level?: string } | undefined;
        const ratingSuffix = rating?.level !== undefined ? ` [${rating.level}]` : "";
        const url = (img["url"] as string | null) ?? (img["mynth_url"] as string);
        yield* Console.log(`  ✓ ${url}${ratingSuffix}`);
      } else {
        yield* Console.log(`  ✗ ${(img["error"] as string) ?? "unknown error"}`);
      }
    }
  }
});

// ----------------------------------------------------------------------------

export const imageCommand = Command.make("image").pipe(
  Command.withSubcommands([generate, upload, rate]),
);
