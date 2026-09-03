import { Command } from "commander";
import type { App } from "../app.ts";
import { UsageError } from "../errors.ts";
import { glyph, print } from "../output/print.ts";
import { readStdin } from "../utils/files.ts";

export const configCommand = (app: App): Command => {
  const set = new Command("set").description("Set local CLI configuration");

  set
    .command("api-key")
    .description("Save a Mynth API key to the system keychain (or a 0600 file)")
    .argument("<value>", "API key value, or `-` to read it from stdin")
    .action(async (value: string) => {
      const key = (value === "-" ? await readStdin() : value).trim();
      if (key.length === 0) throw new UsageError("API key is empty");

      await app.session.saveApiKey(key);
      print(`${glyph.ok} API key saved to ${await app.session.store.backend()}`);
      if (app.session.envApiKeySet) {
        print("Note: MYNTH_API_KEY is also set in your environment and takes precedence.");
      }
    });

  const unset = new Command("unset").description("Unset local CLI configuration");

  unset
    .command("api-key")
    .description("Clear stored Mynth credentials")
    .action(async () => {
      await app.session.logout();
      print(`${glyph.ok} Stored credentials cleared`);
    });

  return new Command("config")
    .description("Manage local CLI configuration")
    .addCommand(set)
    .addCommand(unset);
};
