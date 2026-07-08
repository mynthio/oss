import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { CliUsageError } from "../domain/Errors.ts";
import type { DestinationPublic } from "../domain/Schemas.ts";
import { print } from "../utils/output.ts";
import { readJsonFile, requireOAuth } from "./support.ts";

type JsonOption = { readonly json?: boolean };
type FileOptions = JsonOption & { readonly file: string };
type TestOptions = JsonOption & { readonly path?: string };
type DeleteOptions = JsonOption & { readonly yes?: boolean };

const SLUG_RE = /^[a-z0-9-]+$/;

const providerId = (destination: DestinationPublic): string => {
  const provider = destination.provider as { id?: unknown } | null;
  return typeof provider?.id === "string" ? provider.id : "-";
};

const renderList = (destinations: ReadonlyArray<DestinationPublic>): void => {
  if (destinations.length === 0) {
    print("No destinations found.");
    return;
  }
  const rows = destinations.map((d) => ({
    id: d.id,
    name: d.name,
    provider: providerId(d),
    created: d.createdAt,
  }));
  const width = (key: keyof (typeof rows)[number], header: string) =>
    Math.max(header.length, ...rows.map((row) => row[key].length));
  const widths = {
    id: width("id", "ID"),
    name: width("name", "Name"),
    provider: width("provider", "Provider"),
  };
  print(
    [
      "ID".padEnd(widths.id),
      "Name".padEnd(widths.name),
      "Provider".padEnd(widths.provider),
      "Created",
    ].join("  "),
  );
  for (const row of rows) {
    print(
      [
        row.id.padEnd(widths.id),
        row.name.padEnd(widths.name),
        row.provider.padEnd(widths.provider),
        row.created,
      ].join("  "),
    );
  }
};

const renderOne = (destination: DestinationPublic): void => {
  print(`Destination ${destination.id}`);
  print(`  Name:     ${destination.name}`);
  print(`  Provider: ${providerId(destination)}`);
  print(`  Created:  ${destination.createdAt}`);
  print(`  Updated:  ${destination.updatedAt}`);
};

export const createDestinationCommand = (ctx: CliContext): Command => {
  const destination = new Command("destination").description(
    "Manage storage destinations (OAuth login required)",
  );

  destination
    .command("list")
    .description("List storage destinations")
    .option("--json", "Output machine-readable JSON instead of a human-readable table")
    .action(async (options: JsonOption) => {
      await requireOAuth(ctx);
      const data = await ctx.destinations.list();
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderList(data);
    });

  destination
    .command("get")
    .description("Fetch a destination by ID")
    .argument("<id>", "Destination ID")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: JsonOption) => {
      await requireOAuth(ctx);
      const data = await ctx.destinations.get(id);
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderOne(data);
    });

  destination
    .command("create")
    .description("Create a destination from a JSON file ({ name, provider, config, secret })")
    .requiredOption("--file <path>", "Path to a JSON file, or `-` to read from stdin")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (options: FileOptions) => {
      await requireOAuth(ctx);
      const body = await readJsonFile(options.file);
      const name = (body as { name?: unknown } | null)?.name;
      if (typeof name !== "string" || name.length < 1 || name.length > 64 || !SLUG_RE.test(name)) {
        throw new CliUsageError(
          `invalid destination name: expected 1-64 chars matching ${SLUG_RE.source}`,
        );
      }
      const data = await ctx.destinations.create(body);
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderOne(data);
      print("");
      print(`Next: verify credentials with 'mynth destination test ${data.id}'`);
    });

  destination
    .command("update")
    .description("Update a destination from a JSON file ({ provider, config, secret? })")
    .argument("<id>", "Destination ID")
    .requiredOption("--file <path>", "Path to a JSON file, or `-` to read from stdin")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: FileOptions) => {
      await requireOAuth(ctx);
      const parsed = await readJsonFile(options.file);
      // slug is immutable; never forward a `name` field.
      const { name: _ignored, ...body } = (parsed ?? {}) as Record<string, unknown>;
      const data = await ctx.destinations.update(id, body);
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderOne(data);
    });

  destination
    .command("test")
    .description("Test a destination's credentials by uploading a probe file")
    .argument("<id>", "Destination ID")
    .option("--path <path>", "Object path to write (defaults to a unique probe path)")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: TestOptions) => {
      await requireOAuth(ctx);
      const path = options.path ?? `mynth-cli-test/${Date.now()}.txt`;
      await ctx.destinations.test(id, path);
      if (options.json) {
        print(JSON.stringify({ id, path, ok: true }, null, 2));
        return;
      }
      print(`✓ credentials valid (wrote ${path})`);
    });

  destination
    .command("delete")
    .description("Delete a destination (requires --yes)")
    .argument("<id>", "Destination ID")
    .option("--yes", "Confirm deletion (required; no interactive prompt)")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: DeleteOptions) => {
      if (options.yes !== true) {
        throw new CliUsageError("refusing to delete without --yes");
      }
      await requireOAuth(ctx);
      await ctx.destinations.delete(id);
      if (options.json) {
        print(JSON.stringify({ deleted: id }, null, 2));
        return;
      }
      print(`✓ deleted destination ${id}`);
    });

  return destination;
};
