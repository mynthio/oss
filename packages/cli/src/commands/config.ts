import * as Args from "@effect/cli/Args";
import * as Command from "@effect/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import { MynthCliError } from "../domain/Errors.ts";
import { Auth } from "../services/Auth.ts";

const readStdin = Effect.tryPromise({
  try: async () => {
    let data = "";
    process.stdin.setEncoding("utf8");
    for await (const chunk of process.stdin) data += chunk;
    return data.trim();
  },
  catch: (cause) => new MynthCliError({ message: "could not read stdin", cause }),
});

const apiKeyArg = Args.text({ name: "value" }).pipe(
  Args.withDescription("API key value, or `-` to read from stdin"),
);

const setApiKey = Command.make("api-key", { value: apiKeyArg }, ({ value }) =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const key = value === "-" ? yield* readStdin : value;
    if (key.length === 0) {
      return yield* new MynthCliError({ message: "API key is empty" });
    }
    yield* auth
      .setApiKey(key)
      .pipe(
        Effect.mapError(
          (cause) =>
            new MynthCliError({ message: `could not save API key: ${cause.message}`, cause }),
        ),
      );
    yield* Console.log("✓ API key saved");
    if (auth.envApiKeySet) {
      yield* Console.log(
        "Note: MYNTH_API_KEY is also set in your environment and will take precedence.",
      );
    }
  }),
);

const set = Command.make("set").pipe(Command.withSubcommands([setApiKey]));

const unsetApiKey = Command.make("api-key", {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    yield* auth.logout;
    yield* Console.log("✓ Stored credentials cleared");
  }),
);

const unset = Command.make("unset").pipe(Command.withSubcommands([unsetApiKey]));

export const configCommand = Command.make("config").pipe(Command.withSubcommands([set, unset]));
