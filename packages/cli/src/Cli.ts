import { Command, Help, Option } from "commander";
import { createCliContext } from "./context.ts";
import {
  createAuthCommand,
  createBalanceCommand,
  createConfigCommand,
  createDestinationCommand,
  createDocsCommand,
  createImageCommand,
  createModelsCommand,
  createTaskCommand,
  createWebhookCommand,
  createWhoamiCommand,
} from "./commands/index.ts";

class MynthHelp extends Help {
  override optionTerm(option: Option): string {
    return `(${option.flags.replaceAll("<", "").replaceAll(">", "")})`;
  }

  override subcommandTerm(command: Command): string {
    const args = command.registeredArguments
      .map((arg) =>
        arg.required ? `${arg.name()}${arg.variadic ? "..." : ""}` : `[${arg.name()}]`,
      )
      .join(" ");
    return args.length > 0 ? `${command.name()} ${args}` : command.name();
  }
}

export const createProgram = (): Command => {
  const ctx = createCliContext();
  const program = new Command("mynth");

  program.description("Official Mynth CLI").version("0.0.12");

  program.addHelpText(
    "after",
    `
Exit codes:
  0  success
  1  error (network, server, or unexpected failure)
  2  usage error (invalid arguments, flags, or request)
  3  authentication error (missing or invalid credentials)
  4  insufficient credits
  5  blocked by content moderation
  6  rate limited`,
  );

  program.addCommand(createAuthCommand(ctx));
  program.addCommand(createBalanceCommand(ctx));
  program.addCommand(createConfigCommand(ctx));
  program.addCommand(createDestinationCommand(ctx));
  program.addCommand(createDocsCommand(ctx));
  program.addCommand(createImageCommand(ctx));
  program.addCommand(createModelsCommand(ctx));
  program.addCommand(createTaskCommand(ctx));
  program.addCommand(createWebhookCommand(ctx));
  program.addCommand(createWhoamiCommand(ctx));

  applyHelp(program);
  return program;
};

const applyHelp = (command: Command): void => {
  command.configureHelp({ helpWidth: 100 });
  command.createHelp = () => new MynthHelp();
  for (const child of command.commands) applyHelp(child);
};
