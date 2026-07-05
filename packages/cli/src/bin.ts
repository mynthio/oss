import type { Command } from "commander";
import { createProgram } from "./Cli.ts";
import { exitCodeForError } from "./domain/Errors.ts";
import { printErr } from "./utils/output.ts";

const debug = process.env["MYNTH_DEBUG"] === "1" || process.env["MYNTH_DEBUG"] === "true";

const formatError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

// `addCommand` does not inherit exitOverride, so apply it to every subcommand
// or usage errors there bypass the exit-code mapping below.
const overrideExits = (command: Command): void => {
  command.exitOverride();
  for (const child of command.commands) overrideExits(child);
};

const main = async () => {
  const program = createProgram();
  overrideExits(program);

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    const code = (error as { code?: string }).code;
    if (code === "commander.helpDisplayed" || code === "commander.version") return;

    // Commander already writes its own errors (and help) to stderr.
    if (typeof code !== "string" || !code.startsWith("commander.")) {
      printErr(formatError(error));

      if (debug && error instanceof Error) {
        printErr("=== MYNTH_DEBUG cause ===");
        printErr(JSON.stringify(error.cause ?? error, null, 2));
      }
    }

    process.exitCode = exitCodeForError(error);
  }
};

await main();
