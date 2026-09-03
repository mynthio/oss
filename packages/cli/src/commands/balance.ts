import { Command } from "commander";
import { getBalance, getMe } from "../api/account.ts";
import type { App } from "../app.ts";
import { print, printJson } from "../output/print.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

/**
 * Spending limits live on `/me` (they belong to the API key, not the account),
 * so an API-key session fetches both and prints them together.
 */
export const balanceCommand = (app: App): Command =>
  new Command("balance")
    .description("Show account balance, and the active API key's spending limit")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const balance = await getBalance(app.api);
      const me = await getMe(app.api).catch(() => undefined);
      const spending = me?.auth.apiKey?.spending;

      if (options.json) {
        printJson({ ...balance, ...(spending !== undefined ? { spending } : {}) });
        return;
      }

      print(`Balance:   $${balance.balance}`);
      print(`Reserved:  $${balance.reserved}`);
      print(`Available: $${balance.available}`);

      if (spending === undefined) return;
      print("");
      if (spending.mode === "unlimited") {
        print("API key spending: unlimited");
        return;
      }
      print(`API key limit: $${spending.limit} / ${spending.period}`);
      print(`  used:      $${spending.used}`);
      print(`  remaining: $${spending.remaining}`);
    });
