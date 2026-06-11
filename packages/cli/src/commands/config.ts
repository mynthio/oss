import { Command } from "commander";
import chalk from "chalk";
import type { CliContext } from "../context.ts";
import { MynthCliError } from "../domain/Errors.ts";
import { print } from "../utils/output.ts";

const ok = chalk.green("✓");

const readStdin = async (): Promise<string> => {
  try {
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    return data.trim();
  } catch (cause) {
    throw new MynthCliError({ message: "could not read stdin", cause });
  }
};

export const createConfigCommand = (ctx: CliContext): Command => {
  const config = new Command("config");

  const set = new Command("set").description("Set local CLI configuration");
  set
    .command("api-key")
    .description("Save a Mynth API key")
    .argument("<value>", "API key value, or `-` to read from stdin")
    .action(async (value: string) => {
      const key = value === "-" ? await readStdin() : value;
      if (key.length === 0) {
        throw new MynthCliError({ message: "API key is empty" });
      }
      try {
        await ctx.auth.setApiKey(key);
      } catch (cause) {
        throw new MynthCliError({
          message: `could not save API key: ${(cause as Error).message}`,
          cause,
        });
      }
      print(`${ok} API key saved`);
      if (ctx.auth.envApiKeySet) {
        print("Note: MYNTH_API_KEY is also set in your environment and will take precedence.");
      }
    });

  const unset = new Command("unset").description("Unset local CLI configuration");
  unset
    .command("api-key")
    .description("Clear stored Mynth credentials")
    .action(async () => {
      await ctx.auth.logout();
      print(`${ok} Stored credentials cleared`);
    });

  config.addCommand(set);
  config.addCommand(unset);
  return config;
};
