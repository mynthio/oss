import { Command } from "commander";
import type { App } from "../app.ts";
import { print, printJson } from "../output/print.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

export const docsCommand = (app: App): Command => {
  const docs = new Command("docs").description("Read Mynth documentation (no authentication)");

  docs
    .command("get")
    .description("Fetch a documentation page as Markdown")
    .argument(
      "<path>",
      "Documentation path, without the .md suffix (e.g. guides/async-and-polling)",
    )
    .addOption(jsonOption())
    .action(async (path: string, options: JsonFlag) => {
      const page = await app.docs.get(path);
      if (options.json) {
        printJson(page);
        return;
      }
      print(page.content);
    });

  docs
    .command("list")
    .description("Fetch the complete documentation index")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const content = await app.docs.list();
      if (options.json) {
        printJson({ content });
        return;
      }
      print(content);
    });

  return docs;
};
