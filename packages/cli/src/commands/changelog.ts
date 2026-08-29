import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { CliUsageError } from "../domain/Errors.ts";
import type { ChangelogIndexEntry } from "../services/ChangelogService.ts";
import { print } from "../utils/output.ts";

type ListOptions = {
  readonly json?: boolean;
  readonly product?: string;
  readonly since?: string;
  readonly limit?: string;
};

type JsonOption = {
  readonly json?: boolean;
};

const parseLimit = (limit: string): number => {
  const parsed = Number(limit);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new CliUsageError("--limit must be a positive integer");
  }
  return parsed;
};

const parseSince = (since: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    throw new CliUsageError("--since must be a date in YYYY-MM-DD format");
  }
  return since;
};

const renderHuman = (entries: ReadonlyArray<ChangelogIndexEntry>): void => {
  if (entries.length === 0) {
    print("No changelog entries match.");
    return;
  }

  for (const [index, entry] of entries.entries()) {
    if (index > 0) print();
    const meta = [
      entry.date,
      entry.type,
      ...(entry.breaking ? ["BREAKING"] : []),
      entry.products.join(", "),
      ...(entry.version ? [entry.version] : []),
    ].join(" · ");

    print(entry.title);
    print(`  ${meta}`);
    if (entry.summary) print(`  ${entry.summary}`);
    print(`  mynth changelog get ${entry.slug}`);
  }
};

export const createChangelogCommand = (ctx: CliContext): Command => {
  const changelog = new Command("changelog")
    .description("See what changed across the Mynth API, SDK, CLI, and packages")
    .option("--product <product>", "Only entries for one product (api, sdk, cli, ...)")
    .option("--since <date>", "Only entries on or after a date (YYYY-MM-DD)")
    .option("--limit <count>", "Maximum number of entries to show")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: ListOptions) => {
      const product = options.product;
      const since = options.since === undefined ? undefined : parseSince(options.since);
      const limit = options.limit === undefined ? undefined : parseLimit(options.limit);

      let entries = await ctx.changelog.list();
      if (product !== undefined) {
        entries = entries.filter((entry) => entry.products.includes(product));
      }
      // ISO dates compare correctly as strings.
      if (since !== undefined) entries = entries.filter((entry) => entry.date >= since);
      if (limit !== undefined) entries = entries.slice(0, limit);

      if (options.json) {
        print(JSON.stringify(entries, null, 2));
        return;
      }
      renderHuman(entries);
    });

  changelog
    .command("get")
    .description("Fetch one changelog entry as Markdown")
    .argument("<slug>", "Entry slug, e.g. 2026-08-06-image-review-and-alt-text")
    .option("--json", "Output machine-readable JSON")
    .action(async (slug: string, options: JsonOption) => {
      const entry = await ctx.changelog.get(slug);
      print(options.json ? JSON.stringify(entry, null, 2) : entry.content);
    });

  return changelog;
};
