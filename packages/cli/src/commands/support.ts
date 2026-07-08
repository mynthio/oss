import { readFile } from "node:fs/promises";
import type { CliContext } from "../context.ts";
import { CliUsageError, NotAuthenticatedError } from "../domain/Errors.ts";

// destination/webhook routes are OAuth-only on the API (API keys are rejected).
// Gate before any network call so agents get a clear, actionable message.
export const requireOAuth = async (ctx: CliContext): Promise<void> => {
  const status = await ctx.auth.status();
  if (status.kind !== "oauth") {
    throw new NotAuthenticatedError({
      reason:
        "destination/webhook commands require OAuth login (run 'mynth auth login'); " +
        "API key auth is not supported for this resource yet",
    });
  }
};

const readStdin = async (): Promise<string> => {
  let data = "";
  process.stdin.setEncoding("utf8");
  for await (const chunk of process.stdin) data += chunk;
  return data;
};

// Reads a JSON file (or stdin when `path` is "-") and parses it, raising a
// usage error on unreadable input or malformed JSON.
export const readJsonFile = async (path: string): Promise<unknown> => {
  let contents: string;
  try {
    contents = path === "-" ? await readStdin() : await readFile(path, "utf8");
  } catch (cause) {
    throw new CliUsageError(`could not read ${path}: ${(cause as Error).message}`);
  }
  try {
    return JSON.parse(contents);
  } catch (cause) {
    throw new CliUsageError(`invalid JSON in ${path}: ${(cause as Error).message}`);
  }
};
