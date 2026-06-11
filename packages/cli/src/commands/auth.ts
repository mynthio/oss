import { Command } from "commander";
import chalk from "chalk";
import type { CliContext } from "../context.ts";
import {
  AuthorizationDeniedError,
  AuthorizationExpiredError,
  AuthorizationPendingError,
  MynthCliError,
  WorkOSError,
} from "../domain/Errors.ts";
import { print } from "../utils/output.ts";

const formatExpiry = (ms: number) => new Date(ms).toISOString();
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const ok = chalk.green("✓");

const wrapCli = (message: string, cause: unknown) =>
  new MynthCliError({
    message: cause instanceof Error ? `${message}: ${cause.message}` : message,
    cause,
  });

const pollForToken = async (
  ctx: CliContext,
  deviceCode: string,
  initialIntervalMs: number,
  expiresAtMs: number,
) => {
  let intervalMs = initialIntervalMs;
  while (true) {
    if (Date.now() >= expiresAtMs) {
      throw new MynthCliError({ message: "device code expired before approval" });
    }

    try {
      return await ctx.workos.exchangeDeviceCode(deviceCode);
    } catch (error) {
      if (error instanceof AuthorizationPendingError) {
        if (error.slowDown) intervalMs += 5000;
        await sleep(intervalMs);
        continue;
      }
      if (error instanceof AuthorizationDeniedError) {
        throw new MynthCliError({ message: "login denied by user" });
      }
      if (error instanceof AuthorizationExpiredError) {
        throw new MynthCliError({ message: "device code expired" });
      }
      if (error instanceof WorkOSError) {
        throw new MynthCliError({ message: error.message, cause: error });
      }
      throw error;
    }
  }
};

export const createAuthCommand = (ctx: CliContext): Command => {
  const auth = new Command("auth");

  auth
    .command("login")
    .description("Authenticate with Mynth using OAuth device login")
    .action(async () => {
      if (ctx.auth.envApiKeySet) {
        print(
          "MYNTH_API_KEY is set in your environment; that takes precedence over login.\n" +
            "Unset it to use OAuth, or just continue using the env API key.",
        );
        throw new MynthCliError({ message: "env api key takes precedence" });
      }

      let device: Awaited<ReturnType<CliContext["workos"]["requestDeviceAuthorization"]>>;
      try {
        device = await ctx.workos.requestDeviceAuthorization();
      } catch (cause) {
        throw wrapCli("device authorize", cause);
      }

      print("");
      print(`  First copy your one-time code: ${device.user_code}`);
      print(`  Then open: ${device.verification_uri_complete ?? device.verification_uri}`);
      print("");
      print("Waiting for confirmation...");

      const exchanged = await pollForToken(
        ctx,
        device.device_code,
        (device.interval ?? 5) * 1000,
        Date.now() + device.expires_in * 1000,
      );

      try {
        await ctx.auth.saveOAuth({
          accessToken: exchanged.token.access_token,
          refreshToken: exchanged.token.refresh_token,
          expiresAt: exchanged.expiresAt,
          ...(exchanged.token.user ? { user: exchanged.token.user } : {}),
        });
      } catch (cause) {
        throw wrapCli("could not save credentials", cause);
      }

      const who = exchanged.token.user?.email ?? exchanged.token.user?.id ?? "unknown user";
      print(`${ok} Logged in as ${who}`);
    });

  auth
    .command("logout")
    .description("Clear local Mynth credentials")
    .action(async () => {
      await ctx.auth.logout();
      print(`${ok} Local credentials cleared`);
      if (ctx.auth.envApiKeySet) {
        print("Note: MYNTH_API_KEY is still set in your environment and will be used.");
      }
    });

  auth
    .command("status")
    .description("Show current authentication status")
    .action(async () => {
      const status = await ctx.auth.status();
      const usingKeychain = await ctx.credentialsStore.usingKeychain();
      const backend = usingKeychain ? "system keychain" : `file (${ctx.credentialsStore.filePath})`;

      switch (status.kind) {
        case "env":
          print("Authenticated via env: MYNTH_API_KEY");
          return;
        case "none":
          print("Not authenticated. Run `mynth auth login` or set an API key.");
          return;
        case "api_key":
          print(`Authenticated via stored API key (${backend})`);
          return;
        case "oauth": {
          const who = status.user?.email ?? status.user?.id ?? "unknown user";
          print(`Authenticated via OAuth as ${who} (${backend})`);
          print(`  access token expires: ${formatExpiry(status.expiresAt)}`);
        }
      }
    });

  auth.addCommand(createWhoamiCommand(ctx));
  return auth;
};

export const createWhoamiCommand = (ctx: CliContext): Command =>
  new Command("whoami").description("Print the active Mynth identity").action(async () => {
    const status = await ctx.auth.status();
    switch (status.kind) {
      case "none":
        print("not authenticated");
        throw new MynthCliError({ message: "not authenticated" });
      case "env":
        print("env:MYNTH_API_KEY");
        return;
      case "api_key":
        print("api-key");
        return;
      case "oauth":
        print(status.user?.email ?? status.user?.id ?? "oauth");
    }
  });
