import { InvalidArgumentError } from "commander";
import { createProgram } from "./Cli.ts";
import { CliUsageError } from "./domain/Errors.ts";
import { printErr } from "./utils/output.ts";

const debug = process.env["MYNTH_DEBUG"] === "1" || process.env["MYNTH_DEBUG"] === "true";

const formatError = (error: unknown): string => {
  if (error instanceof InvalidArgumentError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
};

const main = async () => {
  const program = createProgram();
  program.exitOverride();

  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if ((error as { code?: string }).code === "commander.helpDisplayed") return;
    if ((error as { code?: string }).code === "commander.version") return;

    const message = formatError(error);
    printErr(message);

    if (debug && error instanceof Error) {
      printErr("=== MYNTH_DEBUG cause ===");
      printErr(JSON.stringify(error.cause ?? error, null, 2));
    }

    process.exitCode = error instanceof CliUsageError ? 1 : 1;
  }
};

await main();
