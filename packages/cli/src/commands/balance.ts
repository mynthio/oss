import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { print } from "../utils/output.ts";

type JsonOption = {
  readonly json?: boolean;
};

export const createBalanceCommand = (ctx: CliContext): Command =>
  new Command("balance")
    .description("Show account balance and API key spending limit usage")
    .option("--json", "Output machine-readable JSON instead of a human-readable summary")
    .action(async (options: JsonOption) => {
      const data = await ctx.account.balance();
      if (options.json) {
        print(JSON.stringify(data, null, 2));
        return;
      }

      print(`Balance:   $${data.balance}`);
      print(`Reserved:  $${data.reserved}`);
      print(`Available: $${data.available}`);
      if (data.apiKey) {
        print("");
        print(`API key limit: $${data.apiKey.spendingLimit} / ${data.apiKey.spendingLimitPeriod}`);
        print(`  used:      $${data.apiKey.usedInPeriod}`);
        print(`  remaining: $${data.apiKey.remainingInPeriod}`);
      }
    });
