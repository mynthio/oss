import type { Task } from "../api/schemas.ts";
import { imageGenerateResult, type GeneratedImage } from "../api/schemas.ts";
import { glyph, glyphForStatus, indent, plural, print } from "./print.ts";

/**
 * Renderers shared by the `image` and `task` commands, so `image generate` and
 * `task wait` print an identical result for the same task.
 */

/** Labels for the 1–4 review score scale (higher is better). */
const REVIEW_SCORE_LABELS: Record<number, string> = {
  4: "Production-ready",
  3: "Usable, with fixes",
  2: "Not fit for purpose",
  1: "Discard",
};

export const isImageGenerateTask = (task: Pick<Task, "type">): boolean =>
  task.type === "image.generate";

/** Parses `task.result` as an image generation result, tolerating older shapes. */
export const readImageGenerateResult = (
  result: unknown,
): {
  readonly images: ReadonlyArray<GeneratedImage>;
  readonly model?: string | undefined;
  readonly magic_prompt?: { positive: string; negative?: string | undefined } | undefined;
} => {
  const parsed = imageGenerateResult.safeParse(result ?? {});
  if (!parsed.success) return { images: [] };
  return { ...parsed.data, images: parsed.data.images ?? [] };
};

export const imageUrl = (image: GeneratedImage): string | undefined =>
  image.status === "success" ? (image.url ?? image.mynth_url ?? undefined) : undefined;

type ResultError = { readonly code: string; readonly message?: string | undefined };

const formatError = (error: ResultError): string =>
  error.message !== undefined ? `${error.code}: ${error.message}` : error.code;

export const renderUploads = (
  uploads: ReadonlyArray<{ readonly path: string; readonly url: string }>,
): void => {
  if (uploads.length === 0) return;
  print(`${glyph.ok} Uploaded ${plural(uploads.length, "image")}`);
  for (const upload of uploads) print(`  ${upload.path} -> ${upload.url}`);
};

export const renderImageGenerateTask = (task: Task): void => {
  const result = readImageGenerateResult(task.result);
  const images = result.images;
  const succeeded = images.filter((image) => image.status === "success").length;

  print(
    `${glyph.ok} Generated ${succeeded}/${images.length} ${images.length === 1 ? "image" : "images"} (task ${task.id})`,
  );
  if (result.model !== undefined) print(`  Model: ${result.model}`);
  if (task.cost !== null) print(`  Cost:  ${task.cost}`);

  if (result.magic_prompt !== undefined) {
    print("");
    print("Enhanced prompt (mynth):");
    print(`  ${result.magic_prompt.positive}`);
    if (result.magic_prompt.negative) print(`  negative: ${result.magic_prompt.negative}`);
  }

  if (images.length === 0) return;
  print("");
  for (const image of images) {
    if (image.status === "failed") {
      print(`  ${glyph.fail} ${formatError(image.error)}`);
      continue;
    }
    const rating = image.rating?.status === "success" ? ` [${image.rating.level}]` : "";
    print(`  ${glyph.ok} ${imageUrl(image) ?? "(no url)"}${rating}`);
    if (image.destination?.status === "failed") {
      print(
        `      ${glyph.fail} destination ${image.destination.name}: ${formatError(image.destination.error)}`,
      );
    }
  }
};

/** Fallback rendering for any task type the CLI has no bespoke renderer for. */
export const renderTask = (task: Task): void => {
  print(`${glyphForStatus(task.status)} Task ${task.id}`);
  print(`  Type:    ${task.type}`);
  print(`  Status:  ${task.status}`);
  if (task.cost !== null) print(`  Cost:    ${task.cost}`);
  print(`  Created: ${task.createdAt}`);
  print(`  Updated: ${task.updatedAt}`);

  if (task.errors !== null && task.errors !== undefined && task.errors.length > 0) {
    print("");
    print("Errors:");
    for (const error of task.errors) print(`  ${glyph.fail} ${formatError(error)}`);
  }

  if (task.result !== null && task.result !== undefined) {
    print("");
    print("Result:");
    print(indent(JSON.stringify(task.result, null, 2)));
  }
};

/** `image generate` and `task wait` share this entry point. */
export const renderTaskResult = (task: Task): void => {
  if (isImageGenerateTask(task) && task.status === "completed") {
    renderImageGenerateTask(task);
    return;
  }
  renderTask(task);
};

/** Compact JSON view of a generation task; `--detailed` prints the raw task. */
export const summarizeTask = (task: Task) => {
  const result = readImageGenerateResult(task.result);
  return {
    taskId: task.id,
    status: task.status,
    images: result.images.map((image) =>
      image.status === "success"
        ? {
            status: "success",
            url: image.url ?? null,
            mynth_url: image.mynth_url ?? null,
            size: image.size,
            format: image.format,
            rating: image.rating,
            destination: image.destination,
          }
        : { status: "failed", error: image.error },
    ),
    ...(result.magic_prompt !== undefined ? { magic_prompt: result.magic_prompt } : {}),
    ...(task.cost !== null ? { cost: task.cost } : {}),
    ...(result.model !== undefined ? { model: result.model } : {}),
  };
};

export const renderReview = (review: {
  readonly taskId: string;
  readonly cost: string | null;
  readonly url: string;
  readonly score: number;
  readonly summary: string;
  readonly findings: ReadonlyArray<{
    readonly finding: string;
    readonly category: string;
    readonly severity: string;
    readonly where: string;
    readonly confidence: string;
  }>;
  readonly strengths: ReadonlyArray<{
    readonly strength: string;
    readonly confidence: string;
  }>;
}): void => {
  print(`${glyph.ok} Reviewed (task ${review.taskId})`);
  print(`  Score: ${review.score}/4 — ${REVIEW_SCORE_LABELS[review.score] ?? "unknown"}`);
  if (review.cost !== null) print(`  Cost:  ${review.cost}`);
  print(`  ${review.url}`);

  if (review.summary.length > 0) {
    print("");
    print("Summary");
    print(`  ${review.summary}`);
  }

  if (review.findings.length > 0) {
    print("");
    print(`Findings (${review.findings.length})`);
    for (const item of review.findings) {
      print(`  • [${item.severity}] ${item.category} — ${item.finding}`);
      print(`    where: ${item.where}  (${item.confidence} confidence)`);
    }
  }

  if (review.strengths.length > 0) {
    print("");
    print(`Strengths (${review.strengths.length})`);
    for (const item of review.strengths) {
      print(`  • ${item.strength}  (${item.confidence} confidence)`);
    }
  }
};
