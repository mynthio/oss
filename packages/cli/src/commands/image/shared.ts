import type { Command } from "commander";
import { z } from "zod";
import {
  createImageTask,
  uploadImages,
  type ImageTaskEndpoint,
  type UploadedImage,
} from "../../api/images.ts";
import { waitForTask } from "../../api/tasks.ts";
import type { Task } from "../../api/schemas.ts";
import type { App } from "../../app.ts";
import { ApiError, UsageError, taskFailureCode } from "../../errors.ts";
import { glyph, print, printJson } from "../../output/print.ts";
import { withSpinner } from "../../output/spinner.ts";
import { readTextInput } from "../../utils/files.ts";
import { collect, isHttpUrl } from "../../utils/parse.ts";

export const MIN_RATE_LEVELS = 2;
export const MAX_RATE_LEVELS = 7;

export type RateLevel = {
  readonly value: string;
  readonly description: string;
};

export type LevelOptions = {
  readonly level?: ReadonlyArray<string>;
  readonly levelsFile?: string;
  readonly levelsJson?: string;
};

/**
 * Commands take an image as either a URL or a local path. A local path is
 * uploaded first; the uploads are returned so they can be reported.
 */
export const resolveImage = async (
  app: App,
  input: string,
): Promise<{ readonly url: string; readonly uploads: ReadonlyArray<UploadedImage> }> => {
  if (isHttpUrl(input)) return { url: input, uploads: [] };

  const uploads = await uploadImages(app.api, [input]);
  return { url: uploads[0]!.url, uploads };
};

export type DeliveryOptions = {
  readonly destination?: string;
  readonly webhookUrl?: ReadonlyArray<string>;
  readonly dashboardWebhooks?: boolean;
};

/** Destination and webhook flags shared by commands that create a deliverable image. */
export const addDeliveryOptions = (command: Command): Command =>
  command
    .option(
      "--destination <name>",
      "Slug of a configured storage destination to deliver results to. Defaults to MYNTH_DESTINATION.",
    )
    .option(
      "--webhook-url <url>",
      "Deliver this task's events to this URL (repeatable, max 5)",
      collect,
    )
    .option("--no-dashboard-webhooks", "Skip dashboard-configured webhooks for this task");

/** Builds the `destination` and `webhook` request fields from the delivery flags. */
export const buildDelivery = (
  app: App,
  options: DeliveryOptions,
): { readonly destination?: string; readonly webhook?: Record<string, unknown> } => {
  const destination = options.destination ?? app.config.envDestination;
  const custom = options.webhookUrl ?? [];
  // `--no-dashboard-webhooks` flips Commander's default of `true`.
  const disableDashboard = options.dashboardWebhooks === false;

  const webhook =
    custom.length === 0 && !disableDashboard
      ? undefined
      : {
          ...(disableDashboard ? { dashboard: false } : {}),
          ...(custom.length > 0 ? { custom: custom.map((url) => ({ url })) } : {}),
        };

  return {
    ...(destination !== undefined ? { destination } : {}),
    ...(webhook !== undefined ? { webhook } : {}),
  };
};

/**
 * Creates a task without waiting and prints its ID. A public access token lets
 * browser or CI code poll the task without the API key, so it is requested here.
 */
export const createTaskAsync = async (
  app: App,
  args: {
    readonly endpoint: ImageTaskEndpoint;
    readonly body: Record<string, unknown>;
    readonly json: boolean;
  },
): Promise<void> => {
  const created = await createImageTask(app.api, args.endpoint, {
    ...args.body,
    access: { pat: { enabled: true } },
  });
  const token = created.access?.publicAccessToken;

  if (args.json) {
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
};

const levelArray = z.array(z.object({ value: z.string(), description: z.string() }));

const parseLevelPair = (raw: string): RateLevel => {
  const separator = raw.indexOf("=");
  if (separator <= 0) {
    throw new UsageError(`invalid --level "${raw}": expected "value=description"`);
  }

  const level = {
    value: raw.slice(0, separator).trim(),
    description: raw.slice(separator + 1).trim(),
  };
  if (level.value.length === 0 || level.description.length === 0) {
    throw new UsageError(`invalid --level "${raw}": value and description must both be non-empty`);
  }
  return level;
};

const parseLevelsJson = (source: string, origin: string): ReadonlyArray<RateLevel> => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (cause) {
    throw new UsageError(`invalid JSON in ${origin}: ${(cause as Error).message}`);
  }

  const result = levelArray.safeParse(parsed);
  if (!result.success) {
    throw new UsageError(
      `invalid levels in ${origin}: expected an array of { value, description }`,
    );
  }
  return result.data;
};

/**
 * Custom rating levels can come from repeated `--level value=description`, a
 * JSON file, or inline JSON — exactly one source at a time.
 */
export const resolveLevels = async (
  options: LevelOptions,
): Promise<ReadonlyArray<RateLevel> | undefined> => {
  const pairs = options.level ?? [];
  const sources = [
    pairs.length > 0 ? "--level" : undefined,
    options.levelsFile !== undefined ? "--levels-file" : undefined,
    options.levelsJson !== undefined ? "--levels-json" : undefined,
  ].filter((source): source is string => source !== undefined);

  if (sources.length === 0) return undefined;
  if (sources.length > 1) {
    throw new UsageError(`conflicting level options: ${sources.join(", ")} — use only one`);
  }

  const levels =
    pairs.length > 0
      ? pairs.map(parseLevelPair)
      : options.levelsFile !== undefined
        ? parseLevelsJson(await readTextInput(options.levelsFile), options.levelsFile)
        : parseLevelsJson(options.levelsJson ?? "[]", "--levels-json");

  if (levels.length < MIN_RATE_LEVELS || levels.length > MAX_RATE_LEVELS) {
    throw new UsageError(
      `levels must have between ${MIN_RATE_LEVELS} and ${MAX_RATE_LEVELS} items (got ${levels.length})`,
    );
  }

  const seen = new Set<string>();
  for (const level of levels) {
    if (seen.has(level.value)) throw new UsageError(`duplicate level value: "${level.value}"`);
    seen.add(level.value);
  }
  return levels;
};

const failedTaskError = (task: Task, label: string): ApiError => {
  const code = taskFailureCode(task);
  return new ApiError(`${label} task ${task.id} failed${code !== undefined ? ` (${code})` : ""}`, {
    status: 0,
    ...(code !== undefined ? { code } : {}),
  });
};

/**
 * Creates a single-image task, waits for it, and validates its result. The
 * commands only differ by endpoint and result shape.
 */
export const runImageTask = async <T>(
  app: App,
  args: {
    readonly endpoint: Exclude<ImageTaskEndpoint, "generate">;
    readonly body: Record<string, unknown>;
    readonly schema: z.ZodType<T>;
    readonly quiet: boolean;
  },
): Promise<{ readonly taskId: string; readonly cost: string | null; readonly result: T }> => {
  const created = await createImageTask(app.api, args.endpoint, args.body);

  const pending = waitForTask(app.api, created.taskId);
  const task = args.quiet ? await pending : await withSpinner(pending);

  if (task.status !== "completed") throw failedTaskError(task, args.endpoint);

  const parsed = args.schema.safeParse(task.result);
  if (!parsed.success) {
    throw new ApiError(`${args.endpoint} task ${task.id} returned an unexpected result`, {
      status: 0,
      cause: parsed.error,
    });
  }

  return { taskId: task.id, cost: task.cost, result: parsed.data };
};
