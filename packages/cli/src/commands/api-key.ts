import { Command } from "commander";
import { createApiKeyAsSelf, deleteApiKey, listApiKeys } from "../api/api-keys.ts";
import { API_KEY_SCOPES } from "../api/schemas.ts";
import type { App } from "../app.ts";
import { UsageError } from "../errors.ts";
import { glyph, print, printJson } from "../output/print.ts";
import { printTable } from "../output/table.ts";
import { jsonOption, yesOption, type JsonFlag } from "./options.ts";

const DEFAULT_SCOPES = ["generate"] as const;

const parseScopes = (raw: string | undefined): ReadonlyArray<string> => {
  if (raw === undefined) return DEFAULT_SCOPES;

  const scopes = raw
    .split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  const unknown = scopes.filter(
    (scope) => !(API_KEY_SCOPES as ReadonlyArray<string>).includes(scope),
  );

  if (scopes.length === 0 || unknown.length > 0) {
    throw new UsageError(
      `invalid --scopes: ${unknown.join(", ") || "empty"}. Valid scopes: ${API_KEY_SCOPES.join(", ")}`,
    );
  }
  return scopes;
};

export const apiKeyCommand = (app: App): Command => {
  const apiKey = new Command("api-key").description("Manage Mynth API keys");

  apiKey
    .command("create")
    .description("Create an API key. The key itself is shown once, on success.")
    .argument("<name>", "Name for the key, e.g. the app or environment it belongs to")
    .option(
      "--scopes <list>",
      `Comma-separated scopes (default: ${DEFAULT_SCOPES.join(",")}). Widening beyond \`generate\` requires the dashboard: the API refuses scope escalation from a CLI session.`,
    )
    .addOption(jsonOption())
    .action(async (name: string, options: JsonFlag & { readonly scopes?: string }) => {
      const created = await createApiKeyAsSelf(app.api, {
        name,
        scopes: parseScopes(options.scopes),
      });

      if (options.json) {
        printJson({ key: created.raw, ...created.apiKey });
        return;
      }

      print(`${glyph.ok} Created API key "${created.apiKey.name ?? name}"`);
      print(`  ID:     ${created.apiKey.id}`);
      print(`  Scopes: ${created.apiKey.scopes.join(", ")}`);
      print("");
      print(`  ${created.raw}`);
      print("  Save this now — it is shown only once and cannot be retrieved again.");
    });

  apiKey
    .command("list")
    .description("List active API keys")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const keys = await listApiKeys(app.api);
      if (options.json) {
        printJson(keys);
        return;
      }

      printTable(
        keys,
        [
          { header: "ID", value: (key) => key.id },
          { header: "Name", value: (key) => key.name ?? "-" },
          { header: "Preview", value: (key) => key.keyPreview },
          { header: "Scopes", value: (key) => key.scopes.join(",") },
          {
            header: "Limit",
            value: (key) =>
              key.spendingLimit === null || key.spendingLimit === undefined
                ? "-"
                : `$${key.spendingLimit}/${key.spendingLimitPeriod ?? "period"}`,
          },
          { header: "Created", value: (key) => key.createdAt },
        ],
        "No API keys found.",
      );
    });

  apiKey
    .command("delete")
    .description("Revoke an API key")
    .argument("<id>", "API key ID")
    .addOption(yesOption())
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag & { readonly yes?: boolean }) => {
      if (options.yes !== true) throw new UsageError("refusing to delete without --yes");

      await deleteApiKey(app.api, id);
      if (options.json) {
        printJson({ deleted: id });
        return;
      }
      print(`${glyph.ok} Revoked API key ${id}`);
    });

  return apiKey;
};
