import { type MynthImageInput, parseUploadedUrls, type WireImageInput } from "./api.ts";
import type { MynthClient } from "./client.ts";

const UPLOAD_PATH = "/image/upload";
const UPLOAD_FIELD = "images";
const UPLOAD_FILENAME = "image";

/**
 * Upload images to Mynth's temporary input storage in one request.
 *
 * @returns One URL per image, in the order given
 */
export async function uploadImages(
  client: MynthClient,
  images: ReadonlyArray<Blob>,
  { signal }: { signal?: AbortSignal | undefined } = {},
): Promise<string[]> {
  const form = new FormData();

  for (const image of images) {
    form.append(UPLOAD_FIELD, image, isFile(image) ? image.name : UPLOAD_FILENAME);
  }

  const data = await client.postForm(UPLOAD_PATH, form, { signal });
  return parseUploadedUrls(data, images.length);
}

/** `File` is missing from a few older runtimes, where every upload is a plain `Blob`. */
function isFile(blob: Blob): blob is File {
  return typeof File !== "undefined" && blob instanceof File;
}

function fileOf(input: MynthImageInput): Blob | undefined {
  if (input instanceof Blob) return input;
  if (typeof input !== "string" && input.source.type === "file") return input.source.file;
  return undefined;
}

/**
 * Turn inputs into their wire form. Local files go up in a single upload,
 * and each returned URL takes its file's place, so input order and roles
 * are kept.
 */
export async function resolveImageInputs(
  client: MynthClient,
  inputs: ReadonlyArray<MynthImageInput>,
  options: { signal?: AbortSignal | undefined } = {},
): Promise<WireImageInput[]> {
  const files = inputs.flatMap((input) => fileOf(input) ?? []);
  const urls = files.length > 0 ? await uploadImages(client, files, options) : [];
  let next = 0;
  // `parseUploadedUrls` checked there is one URL per file.
  const takeUrl = (): string => urls[next++]!;

  return inputs.map((input): WireImageInput => {
    if (typeof input === "string") return input;
    if (input instanceof Blob) return takeUrl();

    const source =
      input.source.type === "file" ? { type: "url" as const, url: takeUrl() } : input.source;
    return input.as === undefined
      ? { type: "image", source }
      : { type: "image", as: input.as, source };
  });
}
