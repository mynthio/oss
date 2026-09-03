import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { CliError } from "../errors.ts";
import { mapLimit } from "./async.ts";

const CONCURRENCY = 4;

const filenameFor = (url: string, fallbackPrefix: string, index: number): string => {
  try {
    const last = new URL(url).pathname.split("/").filter(Boolean).pop();
    if (last !== undefined && last.length > 0) return decodeURIComponent(last);
  } catch {
    // Not a parseable URL; fall through to the generated name.
  }
  return `${fallbackPrefix}-${index}`;
};

/** Downloads URLs into `directory`, creating it if needed. Returns file paths. */
export const downloadAll = async (args: {
  readonly urls: ReadonlyArray<string>;
  readonly directory: string;
  readonly fallbackPrefix: string;
}): Promise<ReadonlyArray<string>> => {
  const directory = resolve(args.directory);
  try {
    await mkdir(directory, { recursive: true });
  } catch (cause) {
    throw new CliError(`could not create ${directory}: ${(cause as Error).message}`, { cause });
  }

  return mapLimit(args.urls, CONCURRENCY, async (url, index) => {
    let response: Response;
    try {
      response = await fetch(url);
    } catch (cause) {
      throw new CliError(`download failed for ${url}: ${(cause as Error).message}`, { cause });
    }
    if (!response.ok) {
      throw new CliError(`download failed for ${url} (${response.status})`);
    }

    const path = join(directory, filenameFor(url, args.fallbackPrefix, index));
    try {
      await writeFile(path, new Uint8Array(await response.arrayBuffer()));
    } catch (cause) {
      throw new CliError(`could not write ${path}: ${(cause as Error).message}`, { cause });
    }
    return path;
  });
};
