import { Command, Option } from "commander";
import {
  createDestination,
  deleteDestination,
  getDestination,
  listDestinations,
  testDestination,
  updateDestination,
} from "../api/destinations.ts";
import type { Destination } from "../api/schemas.ts";
import type { App } from "../app.ts";
import { UsageError } from "../errors.ts";
import { glyph, print, printJson } from "../output/print.ts";
import { printTable } from "../output/table.ts";
import { readJsonInput, readTextInput } from "../utils/files.ts";
import { jsonOption, yesOption, type JsonFlag } from "./options.ts";

const NAME_PATTERN = /^[a-z0-9-]+$/;
const MAX_NAME_LENGTH = 64;

const PROVIDER_IDS = ["bunny", "r2", "s3"] as const;
const BUNNY_REGIONS = ["de", "uk", "ny", "la", "sg", "se", "br", "jh", "syd"] as const;
const R2_JURISDICTIONS = ["default", "eu", "fedramp"] as const;

type ProviderId = (typeof PROVIDER_IDS)[number];

type ProviderOptions = JsonFlag & {
  readonly provider?: ProviderId;
  readonly storageZone?: string;
  readonly region?: string;
  readonly accountId?: string;
  readonly bucket?: string;
  readonly jurisdiction?: string;
  readonly endpoint?: string;
  readonly forcePathStyle?: boolean;
  readonly pathTemplate?: string;
  readonly urlTemplate?: string;
  readonly secret?: string;
  readonly file?: string;
};

const required = <T>(value: T | undefined, flag: string): T => {
  if (value === undefined) throw new UsageError(`${flag} is required`);
  return value;
};

const requireFor = <T>(provider: ProviderId, value: T | undefined, flag: string): T => {
  if (value === undefined) throw new UsageError(`--provider ${provider} requires ${flag}`);
  return value;
};

const optional = <T>(key: string, value: T | undefined) =>
  value !== undefined ? { [key]: value } : {};

const buildProvider = (options: ProviderOptions, provider: ProviderId): Record<string, unknown> => {
  switch (provider) {
    case "bunny": {
      const region = options.region;
      if (region !== undefined && !(BUNNY_REGIONS as ReadonlyArray<string>).includes(region)) {
        throw new UsageError(
          `invalid bunny --region "${region}". One of: ${BUNNY_REGIONS.join(", ")}`,
        );
      }
      return {
        id: "bunny",
        storage_zone: requireFor(provider, options.storageZone, "--storage-zone"),
        ...optional("region", region),
      };
    }
    case "r2":
      return {
        id: "r2",
        account_id: requireFor(provider, options.accountId, "--account-id"),
        bucket: requireFor(provider, options.bucket, "--bucket"),
        ...optional("jurisdiction", options.jurisdiction),
      };
    case "s3":
      return {
        id: "s3",
        bucket: requireFor(provider, options.bucket, "--bucket"),
        region: requireFor(provider, options.region, "--region"),
        ...optional("endpoint", options.endpoint),
        ...optional("force_path_style", options.forcePathStyle),
      };
  }
};

/**
 * Secrets are read from a file or stdin, never from argv, so they do not leak
 * into shell history or `ps` output. Bunny's single-field secret also accepts
 * the bare password.
 */
const readSecret = async (path: string, provider: ProviderId): Promise<Record<string, unknown>> => {
  const raw = (await readTextInput(path)).trim();

  if (raw.startsWith("{")) {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch (cause) {
      throw new UsageError(`invalid JSON secret from ${path}: ${(cause as Error).message}`);
    }
  }

  if (provider !== "bunny") {
    throw new UsageError(
      `--provider ${provider} needs a JSON secret: { "access_key_id": "...", "secret_access_key": "..." }`,
    );
  }
  if (raw.length === 0) throw new UsageError(`secret from ${path} is empty`);
  return { password: raw };
};

const buildConfig = (options: ProviderOptions): Record<string, unknown> => ({
  path_template: required(options.pathTemplate, "--path-template"),
  ...optional("url_template", options.urlTemplate),
});

/**
 * A destination body comes either wholesale from `--file` (scripting) or from
 * typed flags (interactive). Mixing the two would make precedence ambiguous.
 */
const buildBody = async (
  options: ProviderOptions,
  extra: Record<string, unknown>,
  secretRequired: boolean,
): Promise<unknown> => {
  if (options.file !== undefined) {
    if (options.provider !== undefined) {
      throw new UsageError("use either --file or the typed --provider flags, not both");
    }
    const body = await readJsonInput(options.file);
    if (body === null || typeof body !== "object" || Array.isArray(body)) {
      throw new UsageError(`${options.file} must contain a JSON object`);
    }
    return { ...(body as Record<string, unknown>), ...extra };
  }

  const provider = options.provider;
  if (provider === undefined) throw new UsageError("--provider or --file is required");

  const secret =
    options.secret !== undefined ? await readSecret(options.secret, provider) : undefined;
  if (secret === undefined && secretRequired) {
    throw new UsageError("--secret <path|-> is required (use `-` to read the secret from stdin)");
  }

  return {
    ...extra,
    provider: buildProvider(options, provider),
    config: buildConfig(options),
    ...(secret !== undefined ? { secret } : {}),
  };
};

const addProviderOptions = (command: Command) =>
  command
    .addOption(
      new Option("--provider <id>", "Storage provider. Required unless --file is used.").choices([
        ...PROVIDER_IDS,
      ]),
    )
    .option("--path-template <template>", 'Object path template, e.g. "images/{id}"')
    .option(
      "--url-template <template>",
      'Public URL template; must contain {path}, e.g. "https://cdn.example.com/{path}"',
    )
    .option("--storage-zone <name>", "bunny: storage zone name")
    .option(
      "--region <region>",
      `bunny: one of ${BUNNY_REGIONS.join(", ")}. s3: the bucket's region, e.g. us-east-1.`,
    )
    .option("--account-id <id>", "r2: Cloudflare account ID")
    .option("--bucket <name>", "r2/s3: bucket name")
    .addOption(
      new Option("--jurisdiction <name>", "r2: data jurisdiction").choices([...R2_JURISDICTIONS]),
    )
    .option("--endpoint <url>", "s3: custom endpoint for S3-compatible storage")
    .option("--force-path-style", "s3: use path-style addressing instead of virtual-hosted")
    .option(
      "--secret <path>",
      "Path to a JSON secret file, or `-` to read it from stdin. bunny also accepts a bare password.",
    )
    .option(
      "--file <path>",
      "Full destination JSON body, or `-` for stdin. Alternative to the flags above.",
    )
    .addOption(jsonOption());

const renderOne = (destination: Destination): void => {
  print(`Destination ${destination.id}`);
  print(`  Name:     ${destination.name}`);
  print(`  Provider: ${destination.provider.id}`);
  if (destination.config.path_template !== undefined) {
    print(`  Path:     ${destination.config.path_template}`);
  }
  if (destination.config.url_template !== undefined) {
    print(`  URL:      ${destination.config.url_template}`);
  }
  print(`  Created:  ${destination.createdAt}`);
  print(`  Updated:  ${destination.updatedAt}`);
};

export const destinationCommand = (app: App): Command => {
  const destination = new Command("destination").description(
    "Manage storage destinations that generated images are delivered to",
  );

  destination
    .command("list")
    .description("List storage destinations")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const data = await listDestinations(app.api);
      if (options.json) {
        printJson(data);
        return;
      }
      printTable(
        data,
        [
          { header: "ID", value: (item) => item.id },
          { header: "Name", value: (item) => item.name },
          { header: "Provider", value: (item) => item.provider.id },
          { header: "Created", value: (item) => item.createdAt },
        ],
        "No destinations found.",
      );
    });

  destination
    .command("get")
    .description("Fetch a destination by ID")
    .argument("<id>", "Destination ID")
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag) => {
      const data = await getDestination(app.api, id);
      if (options.json) {
        printJson(data);
        return;
      }
      renderOne(data);
    });

  const create = destination
    .command("create")
    .description("Create a storage destination")
    .argument(
      "<name>",
      `Destination slug: 1-${MAX_NAME_LENGTH} chars, ${NAME_PATTERN.source}. Immutable.`,
    );
  addProviderOptions(create).action(async (name: string, options: ProviderOptions) => {
    if (name.length > MAX_NAME_LENGTH || !NAME_PATTERN.test(name)) {
      throw new UsageError(
        `invalid destination name "${name}": expected 1-${MAX_NAME_LENGTH} chars matching ${NAME_PATTERN.source}`,
      );
    }

    const data = await createDestination(app.api, await buildBody(options, { name }, true));
    if (options.json) {
      printJson(data);
      return;
    }
    renderOne(data);
    print("");
    print(`Next: verify the credentials with \`mynth destination test ${data.id}\``);
  });

  const update = destination
    .command("update")
    .description("Replace a destination's provider and config. The slug is immutable.")
    .argument("<id>", "Destination ID");
  addProviderOptions(update).action(async (id: string, options: ProviderOptions) => {
    // `name` is immutable server-side; drop it so a reused --file does not 400.
    const body = (await buildBody(options, {}, false)) as Record<string, unknown>;
    delete body["name"];

    const data = await updateDestination(app.api, id, body);
    if (options.json) {
      printJson(data);
      return;
    }
    renderOne(data);
  });

  destination
    .command("test")
    .description("Verify a destination's credentials by uploading a probe file")
    .argument("<id>", "Destination ID")
    .option("--path <path>", "Object path to write (defaults to a unique probe path)")
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag & { readonly path?: string }) => {
      const path = options.path ?? `mynth-cli-test/${Date.now()}.txt`;
      await testDestination(app.api, id, path);
      if (options.json) {
        printJson({ id, path, ok: true });
        return;
      }
      print(`${glyph.ok} Credentials valid (wrote ${path})`);
    });

  destination
    .command("delete")
    .description("Delete a destination")
    .argument("<id>", "Destination ID")
    .addOption(yesOption())
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag & { readonly yes?: boolean }) => {
      if (options.yes !== true) throw new UsageError("refusing to delete without --yes");

      await deleteDestination(app.api, id);
      if (options.json) {
        printJson({ deleted: id });
        return;
      }
      print(`${glyph.ok} Deleted destination ${id}`);
    });

  return destination;
};
