import { Command } from "commander";
import {
  createWebhook,
  deleteWebhook,
  updateWebhook,
  type WebhookBody,
  type WebhookEvents,
} from "../api/webhooks.ts";
import type { App } from "../app.ts";
import { UsageError } from "../errors.ts";
import { glyph, print, printJson } from "../output/print.ts";
import { collect } from "../utils/parse.ts";
import { jsonOption, yesOption, type JsonFlag } from "./options.ts";

/** Mirrors `webhook_event` in the API's database schema, minus the `all` shorthand. */
const SUBSCRIBABLE_EVENTS = [
  "task.completed",
  "task.failed",
  "task.image.generate.completed",
  "task.image.generate.failed",
  "task.image.rate.completed",
  "task.image.rate.failed",
  "task.image.alt.completed",
  "task.image.alt.failed",
  "task.image.review.completed",
  "task.image.review.failed",
  "task.video.generate.completed",
  "task.video.generate.failed",
] as const;

type WebhookOptions = JsonFlag & {
  readonly url: string;
  readonly event?: ReadonlyArray<string>;
  readonly apiKeyId?: ReadonlyArray<string>;
  readonly enabled?: boolean;
  readonly disabled?: boolean;
  readonly oauthEvents?: boolean;
};

/**
 * `all` is a server-side shorthand and must be the whole subscription; every
 * other value is checked here so a typo fails before the request.
 */
const resolveEvents = (raw: ReadonlyArray<string> | undefined): WebhookEvents => {
  if (raw === undefined || raw.length === 0)
    throw new UsageError("at least one --event is required");
  if (raw.includes("all")) return "all";

  for (const event of raw) {
    if (!(SUBSCRIBABLE_EVENTS as ReadonlyArray<string>).includes(event)) {
      throw new UsageError(
        `unknown event "${event}". Valid events: all, ${SUBSCRIBABLE_EVENTS.join(", ")}`,
      );
    }
  }
  return raw;
};

const resolveEnabled = (options: WebhookOptions): boolean => {
  if (options.enabled === true && options.disabled === true) {
    throw new UsageError("--enabled and --disabled are mutually exclusive");
  }
  return options.disabled !== true;
};

const toBody = (options: WebhookOptions): WebhookBody => ({
  enabled: resolveEnabled(options),
  url: options.url,
  events: resolveEvents(options.event),
  ...(options.apiKeyId !== undefined ? { apiKeyIds: options.apiKeyId } : {}),
  // Left off by default, matching the API: webhooks are almost always consumed
  // by a server whose tasks are created with an API key, not by this session.
  ...(options.oauthEvents === true ? { oauthEnabled: true } : {}),
});

const eventsLabel = (events: WebhookEvents): string =>
  Array.isArray(events) ? events.join(", ") : String(events);

const addSharedOptions = (command: Command) =>
  command
    .requiredOption("--url <url>", "Destination URL for webhook deliveries")
    .option(
      "-e, --event <name>",
      `Event to subscribe to (repeatable). Use \`all\` for every event. One of: ${SUBSCRIBABLE_EVENTS.join(", ")}`,
      collect,
    )
    .option(
      "--api-key-id <id>",
      "Only deliver tasks created by this API key (repeatable). Omit to deliver for every key.",
      collect,
    )
    .option(
      "--oauth-events",
      "Also deliver tasks created by OAuth sessions (this CLI, the playground). Off by default.",
    )
    .addOption(jsonOption());

export const webhookCommand = (app: App): Command => {
  const webhook = new Command("webhook").description("Manage registered webhooks");

  const create = webhook
    .command("create")
    .description("Register a webhook. The signing secret is shown once, on success.")
    .option("--disabled", "Create the webhook disabled (default: enabled)");
  addSharedOptions(create).action(async (options: WebhookOptions) => {
    const data = await createWebhook(app.api, toBody(options));

    if (options.json) {
      printJson(data);
      return;
    }

    print(`${glyph.ok} Webhook ${data.id} created`);
    print(`  URL:     ${data.url}`);
    print(`  Enabled: ${data.enabled}`);
    print(`  Events:  ${eventsLabel(data.events)}`);
    if (data.oauthEnabled !== undefined) print(`  OAuth:   ${data.oauthEnabled}`);
    print("");
    print(`  Signing secret: ${data.secret}`);
    print("  Save this now — it is shown only once and cannot be retrieved again.");
  });

  const update = webhook
    .command("update")
    .description("Replace a webhook's configuration. Every field is sent, so pass them all.")
    .argument("<id>", "Webhook ID")
    .option("--enabled", "Enable the webhook")
    .option("--disabled", "Disable the webhook");
  addSharedOptions(update).action(async (id: string, options: WebhookOptions) => {
    const data = await updateWebhook(app.api, id, toBody(options));

    if (options.json) {
      printJson(data);
      return;
    }

    print(`${glyph.ok} Webhook ${data.id} updated`);
    print(`  URL:     ${data.url}`);
    if (data.enabled !== undefined) print(`  Enabled: ${data.enabled}`);
    print(`  Events:  ${eventsLabel(data.events)}`);
    if (data.oauthEnabled !== undefined) print(`  OAuth:   ${data.oauthEnabled}`);
  });

  webhook
    .command("delete")
    .description("Delete a webhook")
    .argument("<id>", "Webhook ID")
    .addOption(yesOption())
    .addOption(jsonOption())
    .action(async (id: string, options: JsonFlag & { readonly yes?: boolean }) => {
      if (options.yes !== true) throw new UsageError("refusing to delete without --yes");

      await deleteWebhook(app.api, id);
      if (options.json) {
        printJson({ deleted: id });
        return;
      }
      print(`${glyph.ok} Deleted webhook ${id}`);
    });

  return webhook;
};
