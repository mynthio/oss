import { Command } from "commander";
import { getMe } from "../api/account.ts";
import type { App } from "../app.ts";
import { exchangeDeviceCode, requestDeviceAuthorization } from "../auth/workos.ts";
import { AuthError, CliError, DeviceFlowError } from "../errors.ts";
import { glyph, print, printJson } from "../output/print.ts";
import { sleep } from "../utils/async.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

const SLOW_DOWN_STEP_MS = 5_000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;

/**
 * Polls WorkOS until the user approves the device code in their browser.
 * `authorization_pending` and `slow_down` are the only codes we keep waiting on.
 */
const awaitApproval = async (deviceCode: string, intervalMs: number, expiresAtMs: number) => {
  let interval = intervalMs;

  while (true) {
    if (Date.now() >= expiresAtMs) throw new CliError("device code expired before approval");

    try {
      return await exchangeDeviceCode(deviceCode);
    } catch (error) {
      if (!(error instanceof DeviceFlowError)) throw error;

      if (error.code === "access_denied") throw new AuthError("login was denied");
      if (error.code === "expired_token") {
        throw new AuthError("device code expired; run `mynth auth login` again");
      }
      if (error.code !== "authorization_pending" && error.code !== "slow_down") throw error;

      // `slow_down` means we are polling too fast; back off permanently.
      if (error.code === "slow_down") interval += SLOW_DOWN_STEP_MS;
      await sleep(interval);
    }
  }
};

const login = (app: App) =>
  new Command("login")
    .description("Authenticate with Mynth using OAuth device login")
    .action(async () => {
      if (app.session.envApiKeySet) {
        throw new AuthError(
          "MYNTH_API_KEY is set and takes precedence over login. Unset it to use OAuth, or keep using the env API key.",
        );
      }

      const device = await requestDeviceAuthorization();

      print("");
      print(`  First copy your one-time code: ${device.user_code}`);
      print(`  Then open: ${device.verification_uri_complete ?? device.verification_uri}`);
      print("");
      print("Waiting for confirmation...");

      const issued = await awaitApproval(
        device.device_code,
        (device.interval ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000,
        Date.now() + device.expires_in * 1000,
      );

      await app.session.saveOAuth({
        access_token: issued.token.access_token,
        refresh_token: issued.token.refresh_token,
        expires_at: issued.expiresAt,
        ...(issued.token.user !== undefined ? { user: issued.token.user } : {}),
      });

      const who = issued.token.user?.email ?? issued.token.user?.id ?? "unknown user";
      print(`${glyph.ok} Logged in as ${who}`);
    });

const logout = (app: App) =>
  new Command("logout").description("Clear locally stored Mynth credentials").action(async () => {
    await app.session.logout();
    print(`${glyph.ok} Local credentials cleared`);
    if (app.session.envApiKeySet) {
      print("Note: MYNTH_API_KEY is still set in your environment and will still be used.");
    }
  });

const status = (app: App) =>
  new Command("status")
    .description("Show how this machine is authenticated, without calling the API")
    .action(async () => {
      const current = await app.session.status();

      switch (current.kind) {
        case "env":
          print("Authenticated via env: MYNTH_API_KEY");
          return;
        case "none":
          print("Not authenticated. Run `mynth auth login`, or set an API key.");
          return;
        case "api_key":
          print(`Authenticated via stored API key (${await app.session.store.backend()})`);
          return;
        case "oauth":
          print(
            `Authenticated via OAuth as ${current.user?.email ?? current.user?.id ?? "unknown user"} (${await app.session.store.backend()})`,
          );
          print(`  access token expires: ${new Date(current.expiresAt).toISOString()}`);
      }
    });

/**
 * Verifies credentials against the API, so a revoked key or expired session
 * fails here instead of part-way through a real command.
 */
export const whoamiCommand = (app: App): Command =>
  new Command("whoami")
    .description("Print the active Mynth identity, verified against the API")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const current = await app.session.status();
      if (current.kind === "none") {
        throw new AuthError("not authenticated: run `mynth auth login` or set MYNTH_API_KEY");
      }

      const me = await getMe(app.api);

      if (options.json) {
        printJson({ source: current.kind, ...me });
        return;
      }

      const label =
        current.kind === "env"
          ? "env:MYNTH_API_KEY"
          : current.kind === "api_key"
            ? "api-key"
            : (current.user?.email ?? current.user?.id ?? "oauth");

      print(label);
      print(`  user:   ${me.userId}`);
      print(`  method: ${me.auth.method}`);

      const key = me.auth.apiKey;
      if (key === undefined) return;
      print(`  key:    ${key.name ?? "unnamed"} (${key.keyPreview})`);
      if (key.scopes !== undefined && key.scopes.length > 0) {
        print(`  scopes: ${key.scopes.join(", ")}`);
      }
      if (key.spending?.mode === "limited") {
        print(
          `  spend:  $${key.spending.used} of $${key.spending.limit} per ${key.spending.period} ($${key.spending.remaining} left)`,
        );
      }
    });

export const authCommand = (app: App): Command =>
  new Command("auth")
    .description("Manage Mynth authentication")
    .addCommand(login(app))
    .addCommand(logout(app))
    .addCommand(status(app))
    .addCommand(whoamiCommand(app));
