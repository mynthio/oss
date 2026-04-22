import * as Command from "@effect/cli/Command";
import {
  authCommand,
  configCommand,
  imageCommand,
  taskCommand,
  whoamiCommand,
} from "./commands/index.ts";

const mynth = Command.make("mynth").pipe(
  Command.withSubcommands([authCommand, configCommand, imageCommand, taskCommand, whoamiCommand]),
);

export const run = Command.run(mynth, {
  name: "Mynth CLI",
  version: "0.0.4",
});
