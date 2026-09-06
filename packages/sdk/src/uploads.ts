import type { MynthClient } from "./client";
import { UPLOAD_IMAGE_PATH } from "./constants";
import type { MynthSDKTypes } from "./types";

const UPLOAD_FIELD_NAME = "images";
const UPLOAD_FILENAME = "image";

/** Structured input accepted from callers, before local files are uploaded. */
type ClientInput<AsT extends string> =
  | string
  | MynthSDKTypes.ImageUploadInput
  | {
      type: "image";
      as?: AsT;
      source:
        | MynthSDKTypes.ImageGenerationRequestInputSource
        | { type: "file"; file: MynthSDKTypes.ImageUploadInput };
    };

/** The same input in API wire format: every source is a URL. */
type WireInput<AsT extends string> =
  | string
  | {
      type: "image";
      as?: AsT;
      source: MynthSDKTypes.ImageGenerationRequestInputSource;
    };

export function isUploadInput(value: unknown): value is MynthSDKTypes.ImageUploadInput {
  return typeof Blob !== "undefined" && value instanceof Blob;
}

/**
 * Upload images to Mynth temporary input storage.
 * Image and video generation share this endpoint: video inputs are images.
 */
export async function uploadImages(
  client: MynthClient,
  input: MynthSDKTypes.ImageUploadInput | readonly MynthSDKTypes.ImageUploadInput[],
): Promise<MynthSDKTypes.ImageUploadResponse> {
  const form = new FormData();
  const inputs = Array.isArray(input) ? input : [input];

  for (const upload of inputs) {
    form.append(
      UPLOAD_FIELD_NAME,
      upload,
      typeof File !== "undefined" && upload instanceof File ? upload.name : UPLOAD_FILENAME,
    );
  }

  const json = await client.post<MynthSDKTypes.ApiResponse<MynthSDKTypes.ImageUploadResponse>>(
    UPLOAD_IMAGE_PATH,
    form,
  );

  return json.data;
}

/**
 * Turn caller inputs into wire inputs, uploading any local files first.
 * All files go up in a single request, and the returned URLs are slotted back
 * into their original positions so input order (and role) is preserved.
 */
export async function resolveInputs<AsT extends string>(
  client: MynthClient,
  inputs: readonly ClientInput<AsT>[] | undefined,
): Promise<WireInput<AsT>[] | undefined> {
  if (!inputs?.length) {
    return undefined;
  }

  const files = inputs.flatMap((input) => {
    if (isUploadInput(input)) return [input];
    if (typeof input !== "string" && input.source.type === "file") return [input.source.file];
    return [];
  });
  const urls = files.length ? (await uploadImages(client, files)).urls : [];
  let i = 0;

  return inputs.map((input) => {
    if (typeof input === "string") return input;
    if (isUploadInput(input)) return urls[i++]!;
    if (input.source.type === "file") {
      return {
        type: "image" as const,
        as: input.as,
        source: { type: "url" as const, url: urls[i++]! },
      };
    }
    return { type: "image" as const, as: input.as, source: input.source };
  });
}
