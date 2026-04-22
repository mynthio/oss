import * as NodeContext from "@effect/platform-node/NodeContext";
import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import { run } from "./Cli.ts";
import { MainLayer } from "./layers.ts";

const debug = process.env["MYNTH_DEBUG"] === "1" || process.env["MYNTH_DEBUG"] === "true";

const LoggerLayer = debug
  ? Logger.pretty.pipe(Layer.provide(Logger.minimumLogLevel(LogLevel.Debug)))
  : Layer.empty;

const program = debug
  ? run(process.argv).pipe(
      Effect.tapErrorCause((cause) =>
        Effect.sync(() => {
          // Surface nested causes (e.g. the underlying transport error inside MynthApiError.cause)
          // that Effect's default reporter doesn't unwrap.
          console.error("=== MYNTH_DEBUG cause ===");
          console.error(JSON.stringify(cause, null, 2));
        }),
      ),
    )
  : run(process.argv);

program.pipe(
  Effect.provide(MainLayer),
  Effect.provide(NodeContext.layer),
  Effect.provide(LoggerLayer),
  NodeRuntime.runMain({ disableErrorReporting: !debug }),
);
