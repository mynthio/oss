import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { CliError, UsageError } from "../errors.ts";

const IMAGE_MIME_BY_EXTENSION: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

export const SUPPORTED_IMAGE_EXTENSIONS = Object.keys(IMAGE_MIME_BY_EXTENSION);

export const readStdin = async (): Promise<string> => {
  try {
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    return data;
  } catch (cause) {
    throw new CliError("could not read stdin", { cause });
  }
};

/** Reads a file, or stdin when `path` is `-`. */
export const readTextInput = async (path: string): Promise<string> => {
  if (path === "-") return readStdin();
  try {
    return await readFile(path, "utf8");
  } catch (cause) {
    throw new UsageError(`could not read ${path}: ${(cause as Error).message}`);
  }
};

export const readJsonInput = async (path: string): Promise<unknown> => {
  const contents = await readTextInput(path);
  try {
    return JSON.parse(contents);
  } catch (cause) {
    throw new UsageError(`invalid JSON in ${path}: ${(cause as Error).message}`);
  }
};

export const readImageFile = async (path: string): Promise<File> => {
  const extension = extname(path).toLowerCase();
  const mime = IMAGE_MIME_BY_EXTENSION[extension];
  if (mime === undefined) {
    throw new UsageError(
      `unsupported image extension "${extension}" for ${path} (allowed: ${SUPPORTED_IMAGE_EXTENSIONS.join(", ")})`,
    );
  }

  let bytes: Buffer;
  try {
    bytes = await readFile(path);
  } catch (cause) {
    throw new UsageError(`could not read ${path}: ${(cause as Error).message}`);
  }

  return new File([new Uint8Array(bytes)], basename(path), { type: mime });
};
