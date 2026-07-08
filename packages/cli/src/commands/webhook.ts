import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { CliUsageError } from "../domain/Errors.ts";
import type { WebhookCreated, WebhookUpdated } from "../domain/Schemas.ts";
import type { WebhookEvents } from "../services/WebhookService.ts";
import { print } from "../utils/output.ts";
import { requireOAuth } from "./support.ts";

type JsonOption = { readonly json?: boolean };

const VALID_EVENTS = [
  "task.completed",
  "task.failed",
  "task.image.generate.completed",
  "task.image.generate.failed",
  "task.image.rate.completed",
  "task.image.rate.failed",
  "task.image.alt.completed",
  "task.image.alt.failed",
] as const;

const collect = (value: string, previous: ReadonlyArray<string> = []) => [...previous, value];

// "all" (as the sole shorthand) sends the literal "all"; otherwise every value
// must be a known event name. Unknown names fail client-side with a clear error.
const resolveEvents = (raw: ReadonlyArray<string> | undefined): WebhookEvents => {
  if (raw === undefined || raw.length === 0) {
    throw new CliUsageError("at least one --event is required");
  }
  if (raw.includes("all")) return "all";
  for (const event of raw) {
    if (!(VALID_EVENTS as ReadonlyArray<string>).includes(event)) {
      throw new CliUsageError(
        `unknown event "${event}". Valid events: all, ${VALID_EVENTS.join(", ")}`,
      );
    }
  }
  return raw;
};

const resolveEnabled = (options: { enabled?: boolean; disabled?: boolean }): boolean => {
  if (options.enabled === true && options.disabled === true) {
    throw new CliUsageError("--enabled and --disabled are mutually exclusive");
  }
  return options.disabled !== true;
};

const renderCreated = (webhook: WebhookCreated): void => {
  print(`✓ Webhook ${webhook.id} created`);
  print(`  URL:     ${webhook.url}`);
  print(`  Enabled: ${webhook.enabled}`);
  print(`  Events:  ${Array.isArray(webhook.events) ? webhook.events.join(", ") : webhook.events}`);
  print("");
  print(`  Signing secret: ${webhook.secret}`);
  print("  Save this now — it is shown only once and cannot be retrieved again.");
};

const renderUpdated = (webhook: WebhookUpdated): void => {
  print(`✓ Webhook ${webhook.id} updated`);
  print(`  URL:     ${webhook.url}`);
  if (webhook.enabled !== undefined) print(`  Enabled: ${webhook.enabled}`);
  print(`  Events:  ${Array.isArray(webhook.events) ? webhook.events.join(", ") : webhook.events}`);
};

export const createWebhookCommand = (ctx: CliContext): Command => {
  const webhook = new Command("webhook").description(
    "Manage registered webhooks (OAuth login required)",
  );

  webhook
    .command("create")
    .description("Register a webhook; the signing secret is shown once on success")
    .requiredOption("--url <url>", "Destination URL for webhook deliveries")
    .option("-e, --event <name>", "Event to subscribe to (repeatable, or `all`)", collect)
    .option("--disabled", "Create the webhook disabled (default: enabled)")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (options: JsonOption & { url: string; event?: string[]; disabled?: boolean }) => {
      await requireOAuth(ctx);
      const body = {
        enabled: options.disabled !== true,
        url: options.url,
        events: resolveEvents(options.event),
      };
      const data = await ctx.webhooks.create(body);
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }
      renderCreated(data);
    });

  webhook
    .command("update")
    .description("Replace a webhook's configuration (all fields required)")
    .argument("<id>", "Webhook ID")
    .requiredOption("--url <url>", "Destination URL for webhook deliveries")
    .option("-e, --event <name>", "Event to subscribe to (repeatable, or `all`)", collect)
    .option("--enabled", "Enable the webhook")
    .option("--disabled", "Disable the webhook")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(
      async (
        id: string,
        options: JsonOption & {
          url: string;
          event?: string[];
          enabled?: boolean;
          disabled?: boolean;
        },
      ) => {
        await requireOAuth(ctx);
        const body = {
          enabled: resolveEnabled(options),
          url: options.url,
          events: resolveEvents(options.event),
        };
        const data = await ctx.webhooks.update(id, body);
        if (options.json) {
          print(JSON.stringify(data, null, 2));
          return;
        }
        renderUpdated(data);
      },
    );

  webhook
    .command("delete")
    .description("Delete a webhook (requires --yes)")
    .argument("<id>", "Webhook ID")
    .option("--yes", "Confirm deletion (required; no interactive prompt)")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (id: string, options: JsonOption & { yes?: boolean }) => {
      if (options.yes !== true) {
        throw new CliUsageError("refusing to delete without --yes");
      }
      await requireOAuth(ctx);
      await ctx.webhooks.delete(id);
      if (options.json) {
        print(JSON.stringify({ deleted: id }, null, 2));
        return;
      }
      print(`✓ deleted webhook ${id}`);
    });

  return webhook;
};
