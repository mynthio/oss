import { Command, Help, Option } from "commander";
import { createApp } from "./app.ts";
import { CLI_VERSION } from "./config.ts";
import { authCommand, whoamiCommand } from "./commands/auth.ts";
import { balanceCommand } from "./commands/balance.ts";
import { configCommand } from "./commands/config.ts";
import { destinationCommand } from "./commands/destination.ts";
import { docsCommand } from "./commands/docs.ts";
import { imageCommand } from "./commands/image/index.ts";
import { modelsCommand } from "./commands/models.ts";
import { taskCommand } from "./commands/task.ts";
import { webhookCommand } from "./commands/webhook.ts";

const HELP_WIDTH = 100;

const EXIT_CODE_HELP = `
Exit codes:
  0  success
  1  error (network, server, or unexpected failure)
  2  usage error (invalid arguments, flags, or request)
  3  authentication error (missing, invalid, or under-scoped credentials)
  4  insufficient credits (account balance or API key spending limit)
  5  blocked by content moderation
  6  rate limited

Environment:
  MYNTH_API_KEY        API key; takes precedence over stored credentials
  MYNTH_DESTINATION    default --destination for image generation
  MYNTH_DEBUG=1        print error causes and stack details to stderr
  MYNTH_NO_KEYCHAIN=1  store credentials in a file instead of the system keychain`;

/**
 * Renders options as `(--flag value)` and subcommands with their arguments,
 * which reads better than Commander's default in a dense command tree.
 */
class MynthHelp extends Help {
  override optionTerm(option: Option): string {
    return `(${option.flags.replaceAll("<", "").replaceAll(">", "")})`;
  }

  override subcommandTerm(command: Command): string {
    const args = command.registeredArguments
      .map((argument) =>
        argument.required
          ? `${argument.name()}${argument.variadic ? "..." : ""}`
          : `[${argument.name()}]`,
      )
      .join(" ");
    return args.length > 0 ? `${command.name()} ${args}` : command.name();
  }
}

/** Commander does not inherit help config or exitOverride into `addCommand`ed subtrees. */
const applyToTree = (command: Command): void => {
  command.configureHelp({ helpWidth: HELP_WIDTH });
  command.createHelp = () => new MynthHelp();
  command.exitOverride();
  for (const child of command.commands) applyToTree(child);
};

export const createProgram = (): Command => {
  const app = createApp();

  const program = new Command("mynth")
    .description("Official Mynth CLI")
    .version(CLI_VERSION)
    .addHelpText("after", EXIT_CODE_HELP);

  for (const command of [
    authCommand(app),
    balanceCommand(app),
    configCommand(app),
    destinationCommand(app),
    docsCommand(app),
    imageCommand(app),
    modelsCommand(app),
    taskCommand(app),
    webhookCommand(app),
    // Top-level alias for `mynth auth whoami`; it is the identity check agents reach for.
    whoamiCommand(app),
  ]) {
    program.addCommand(command);
  }

  applyToTree(program);
  return program;
};
