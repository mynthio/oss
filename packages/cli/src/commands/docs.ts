import { Command } from "commander";
import type { CliContext } from "../context.ts";
import { print } from "../utils/output.ts";

type JsonOption = {
  readonly json?: boolean;
};

export const createDocsCommand = (ctx: CliContext): Command => {
  const docs = new Command("docs").description("Read Mynth documentation");

  docs
    .command("get")
    .description("Fetch a documentation page as Markdown")
    .argument("<path>", "Documentation path without the .md suffix")
    .option("--json", "Output machine-readable JSON")
    .action(async (path: string, options: JsonOption) => {
      const page = await ctx.docs.get(path);
      print(options.json ? JSON.stringify(page, null, 2) : page.content);
    });

  docs
    .command("list")
    .description("Fetch the complete documentation index")
    .option("--json", "Output machine-readable JSON")
    .action(async (options: JsonOption) => {
      const content = await ctx.docs.list();
      print(options.json ? JSON.stringify({ content }, null, 2) : content);
    });

  return docs;
};
