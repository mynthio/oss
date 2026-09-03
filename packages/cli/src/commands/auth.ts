import { hostname } from "node:os";
import { Command } from "commander";
import { getMe } from "../api/account.ts";
import { createApiKey, deleteApiKey } from "../api/api-keys.ts";
import { API_KEY_SCOPES } from "../api/schemas.ts";
import type { App } from "../app.ts";
import { exchangeDeviceCode, requestDeviceAuthorization } from "../auth/workos.ts";
import { AuthError, CliError, DeviceFlowError } from "../errors.ts";
import { glyph, print, printErr, printJson } from "../output/print.ts";
import { sleep } from "../utils/async.ts";
import { jsonOption, type JsonFlag } from "./options.ts";

const DASHBOARD_URL = "https://mynth.io/dashboard";
const SLOW_DOWN_STEP_MS = 5_000;
const DEFAULT_POLL_INTERVAL_SECONDS = 5;

const keyName = (): string => `mynth-cli (${hostname()})`;

/**
 * Polls WorkOS until the user approves the device code in their browser.
 * `authorization_pending` and `slow_down` are the only codes worth waiting on.
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

/**
 * Logging in trades a WorkOS session for a long-lived API key and stores only
 * the key. WorkOS sessions cap out at 7 days (2 days idle) and their refresh
 * tokens rotate, which races when an agent runs commands concurrently; an API
 * key has neither problem, and can be inspected, limited and revoked from the
 * dashboard.
 */
const login = (app: App): Command =>
  new Command("login")
    .description("Authenticate with Mynth and store a long-lived API key")
    .option(
      "--scopes <list>",
      `Comma-separated scopes for the created key (default: ${API_KEY_SCOPES.join(",")})`,
    )
    .addOption(jsonOption())
    .action(async (options: JsonFlag & { readonly scopes?: string }) => {
      if (app.session.envApiKeySet) {
        throw new AuthError(
          "MYNTH_API_KEY is set and takes precedence over login. Unset it to log in, or keep using the env API key.",
        );
      }

      const scopes =
        options.scopes !== undefined
          ? options.scopes
              .split(",")
              .map((scope) => scope.trim())
              .filter(Boolean)
          : [...API_KEY_SCOPES];

      const unknown = scopes.filter(
        (scope) => !(API_KEY_SCOPES as ReadonlyArray<string>).includes(scope),
      );
      if (scopes.length === 0 || unknown.length > 0) {
        throw new AuthError(
          `invalid --scopes: ${unknown.join(", ") || "empty"}. Valid scopes: ${API_KEY_SCOPES.join(", ")}`,
        );
      }

      const device = await requestDeviceAuthorization();

      print("");
      print(`  First copy your one-time code: ${device.user_code}`);
      print(`  Then open: ${device.verification_uri_complete ?? device.verification_uri}`);
      print("");
      print("Waiting for confirmation...");

      const session = await awaitApproval(
        device.device_code,
        (device.interval ?? DEFAULT_POLL_INTERVAL_SECONDS) * 1000,
        Date.now() + device.expires_in * 1000,
      );

      const name = keyName();
      const created = await createApiKey(app.api, {
        name,
        scopes,
        token: session.access_token,
      });

      await app.session.save({
        kind: "api_key",
        api_key: created.raw,
        id: created.apiKey.id,
        name: created.apiKey.name ?? name,
        scopes: created.apiKey.scopes,
      });

      const who = session.user?.email ?? session.user?.id ?? "unknown user";

      if (options.json) {
        printJson({
          user: session.user?.id ?? null,
          apiKey: {
            id: created.apiKey.id,
            name: created.apiKey.name ?? name,
            keyPreview: created.apiKey.keyPreview,
            scopes: created.apiKey.scopes,
          },
          storedAt: app.session.store.filePath,
        });
        return;
      }

      print(`${glyph.ok} Logged in as ${who}`);
      print(`  Created API key "${name}" with scopes: ${created.apiKey.scopes.join(", ")}`);
      print(`  Stored in ${app.session.store.filePath}`);
      print(`  Adjust its scopes or set a spending limit at ${DASHBOARD_URL}`);
    });

const logout = (app: App): Command =>
  new Command("logout")
    .description("Revoke this machine's API key and clear local credentials")
    .action(async () => {
      const status = await app.session.status();
      const id = status.kind === "stored" ? status.credentials.id : undefined;

      // Revoke before clearing: once the file is gone we lose the ability to
      // authenticate the delete.
      let revoked = false;
      if (id !== undefined) {
        try {
          await deleteApiKey(app.api, id);
          revoked = true;
        } catch (error) {
          printErr(`Warning: could not revoke API key ${id}: ${(error as Error).message}`);
          printErr(`Revoke it manually at ${DASHBOARD_URL}`);
        }
      }

      await app.session.clear();

      print(`${glyph.ok} Local credentials cleared${revoked ? " and API key revoked" : ""}`);
      if (id === undefined && status.kind === "stored") {
        print(`  The stored key was not created by \`auth login\`, so it was left active.`);
      }
      if (app.session.envApiKeySet) {
        print("Note: MYNTH_API_KEY is still set in your environment and will still be used.");
      }
    });

const status = (app: App): Command =>
  new Command("status")
    .description("Show how this machine is authenticated, without calling the API")
    .addOption(jsonOption())
    .action(async (options: JsonFlag) => {
      const current = await app.session.status();

      if (options.json) {
        printJson({
          source: current.kind,
          ...(current.kind === "stored"
            ? {
                apiKey: {
                  id: current.credentials.id ?? null,
                  name: current.credentials.name ?? null,
                  scopes: current.credentials.scopes ?? null,
                },
                path: app.session.store.filePath,
              }
            : {}),
        });
        return;
      }

      switch (current.kind) {
        case "env":
          print("Authenticated via env: MYNTH_API_KEY");
          return;
        case "none":
          print("Not authenticated. Run `mynth auth login`, or set an API key.");
          return;
        case "stored": {
          const { name, scopes } = current.credentials;
          print(`Authenticated via stored API key${name !== undefined ? ` "${name}"` : ""}`);
          if (scopes !== undefined) print(`  scopes: ${scopes.join(", ")}`);
          print(`  stored: ${app.session.store.filePath}`);
        }
      }
    });

/**
 * Verifies credentials against the API, so a revoked key fails here instead of
 * part-way through a real command.
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

      print(current.kind === "env" ? "env:MYNTH_API_KEY" : "api-key");
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
