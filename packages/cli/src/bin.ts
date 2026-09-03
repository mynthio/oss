import { loadConfig } from "./config.ts";
import { exitCodeForError } from "./errors.ts";
import { printErr } from "./output/print.ts";
import { createProgram } from "./program.ts";

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

try {
  await createProgram().parseAsync(process.argv);
} catch (error) {
  const code = (error as { code?: unknown } | null)?.code;

  if (code === "commander.helpDisplayed" || code === "commander.version") {
    // Commander already wrote the output; exit 0.
  } else {
    // Commander writes its own usage errors (and help) to stderr already.
    if (typeof code !== "string" || !code.startsWith("commander.")) {
      printErr(message(error));

      if (loadConfig().debug && error instanceof Error) {
        printErr("=== MYNTH_DEBUG ===");
        printErr(error.stack ?? error.message);
        if (error.cause !== undefined) printErr(`cause: ${message(error.cause)}`);
      }
    }
    process.exitCode = exitCodeForError(error);
  }
}
