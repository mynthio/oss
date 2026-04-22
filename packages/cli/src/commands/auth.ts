import * as Command from "@effect/cli/Command";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import { MynthCliError } from "../domain/Errors.ts";
import { Auth } from "../services/Auth.ts";
import { CredentialsStore } from "../services/CredentialsStore.ts";
import { WorkOS } from "../services/WorkOS.ts";

const formatExpiry = (ms: number) => new Date(ms).toISOString();

const wrapCli = (message: string) =>
  Effect.mapError(
    (cause: { readonly message: string }) =>
      new MynthCliError({ message: `${message}: ${cause.message}`, cause }),
  );

const pollForToken = Effect.fn("auth.pollForToken")(function* (
  workos: WorkOS,
  deviceCode: string,
  initialIntervalMs: number,
  expiresAtMs: number,
) {
  let intervalMs = initialIntervalMs;
  while (true) {
    if (Date.now() >= expiresAtMs) {
      return yield* new MynthCliError({ message: "device code expired before approval" });
    }
    const attempt = yield* Effect.either(workos.exchangeDeviceCode(deviceCode));
    if (attempt._tag === "Right") return attempt.right;
    const err = attempt.left;
    const next = Match.value(err).pipe(
      Match.tag("AuthorizationPendingError", (e) => ({
        kind: "retry" as const,
        slowDown: e.slowDown,
      })),
      Match.tag("AuthorizationDeniedError", () => ({
        kind: "fail" as const,
        message: "login denied by user",
      })),
      Match.tag("AuthorizationExpiredError", () => ({
        kind: "fail" as const,
        message: "device code expired",
      })),
      Match.tag("WorkOSError", (e) => ({ kind: "fail" as const, message: e.message, cause: e })),
      Match.exhaustive,
    );
    if (next.kind === "fail") {
      return yield* new MynthCliError({
        message: next.message,
        ...("cause" in next ? { cause: next.cause } : {}),
      });
    }
    if (next.slowDown) intervalMs += 5000;
    yield* Effect.sleep(`${intervalMs} millis`);
  }
});

const login = Command.make("login", {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const workos = yield* WorkOS;
    if (auth.envApiKeySet) {
      yield* Console.log(
        "MYNTH_API_KEY is set in your environment; that takes precedence over login.\n" +
          "Unset it to use OAuth, or just continue using the env API key.",
      );
      return yield* new MynthCliError({ message: "env api key takes precedence" });
    }

    const device = yield* workos.requestDeviceAuthorization().pipe(wrapCli("device authorize"));

    yield* Console.log("");
    yield* Console.log(`  First copy your one-time code: ${device.user_code}`);
    yield* Console.log(
      `  Then open: ${device.verification_uri_complete ?? device.verification_uri}`,
    );
    yield* Console.log("");
    yield* Console.log("Waiting for confirmation...");

    const exchanged = yield* pollForToken(
      workos,
      device.device_code,
      (device.interval ?? 5) * 1000,
      Date.now() + device.expires_in * 1000,
    );

    yield* auth
      .saveOAuth({
        accessToken: exchanged.token.access_token,
        refreshToken: exchanged.token.refresh_token,
        expiresAt: exchanged.expiresAt,
        ...(exchanged.token.user ? { user: exchanged.token.user } : {}),
      })
      .pipe(wrapCli("could not save credentials"));

    const who = exchanged.token.user?.email ?? exchanged.token.user?.id ?? "unknown user";
    yield* Console.log(`✓ Logged in as ${who}`);
  }),
);

const logout = Command.make("logout", {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    yield* auth.logout;
    yield* Console.log("✓ Local credentials cleared");
    if (auth.envApiKeySet) {
      yield* Console.log("Note: MYNTH_API_KEY is still set in your environment and will be used.");
    }
  }),
);

const status = Command.make("status", {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const store = yield* CredentialsStore;
    const s = yield* auth.status;
    const usingKeychain = yield* store.usingKeychain;
    const backend = usingKeychain ? "system keychain" : `file (${store.filePath})`;

    const message = Match.value(s).pipe(
      Match.when({ kind: "env" }, () => ["Authenticated via env: MYNTH_API_KEY"]),
      Match.when({ kind: "none" }, () => [
        "Not authenticated. Run `mynth auth login` or set an API key.",
      ]),
      Match.when({ kind: "api_key" }, () => [`Authenticated via stored API key (${backend})`]),
      Match.when({ kind: "oauth" }, (o) => {
        const who = o.user?.email ?? o.user?.id ?? "unknown user";
        return [
          `Authenticated via OAuth as ${who} (${backend})`,
          `  access token expires: ${formatExpiry(o.expiresAt)}`,
        ];
      }),
      Match.exhaustive,
    );
    yield* Effect.forEach(message, Console.log);
  }),
);

const whoami = Command.make("whoami", {}, () =>
  Effect.gen(function* () {
    const auth = yield* Auth;
    const s = yield* auth.status;
    return yield* Match.value(s).pipe(
      Match.when({ kind: "none" }, () =>
        Console.log("not authenticated").pipe(
          Effect.zipRight(new MynthCliError({ message: "not authenticated" })),
        ),
      ),
      Match.when({ kind: "env" }, () => Console.log("env:MYNTH_API_KEY")),
      Match.when({ kind: "api_key" }, () => Console.log("api-key")),
      Match.when({ kind: "oauth" }, (o) => Console.log(o.user?.email ?? o.user?.id ?? "oauth")),
      Match.exhaustive,
    );
  }),
);

export const authCommand = Command.make("auth").pipe(
  Command.withSubcommands([login, logout, status, whoami]),
);

export const whoamiCommand = whoami;
