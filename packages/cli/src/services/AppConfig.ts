import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

export const appConfig = Effect.all({
  mynthApiUrl: Config.string("MYNTH_API_URL").pipe(Config.withDefault("https://api.mynth.io")),
  apiKeyEnvOverride: Config.redacted("MYNTH_API_KEY").pipe(Config.option),
});

export type AppConfig = Effect.Effect.Success<typeof appConfig>;
