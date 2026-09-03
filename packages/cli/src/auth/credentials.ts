import * as keychain from "cross-keychain";
import { chmod, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CliError } from "../errors.ts";
import { credentials as credentialsSchema, type Credentials } from "../api/schemas.ts";

const SERVICE_NAME = "mynth-cli";
const ACCOUNT_NAME = "default";
const FILE_NAME = "credentials.json";

/** Escape hatch for CI and containers where a keyring exists but is unusable. */
const keychainDisabled = (): boolean =>
  process.env["MYNTH_NO_KEYCHAIN"] === "1" || process.env["MYNTH_NO_KEYCHAIN"] === "true";

/** `cross-keychain` signals "no keyring on this machine" through these names. */
const isKeychainUnavailable = (cause: unknown): boolean => {
  const name = (cause as { name?: string } | null)?.name;
  return name === "NoKeyringError" || name === "InitError";
};

type KeychainAttempt<A> =
  | { readonly available: true; readonly value: A }
  | { readonly available: false };

const tryKeychain = async <A>(fn: () => Promise<A>, label: string): Promise<KeychainAttempt<A>> => {
  if (keychainDisabled()) return { available: false };
  try {
    return { available: true, value: await fn() };
  } catch (cause) {
    if (isKeychainUnavailable(cause)) return { available: false };
    throw new CliError(`${label} failed: ${(cause as Error).message}`, { cause });
  }
};

const decode = (raw: string): Credentials => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CliError("stored credentials are not valid JSON", { cause });
  }

  const result = credentialsSchema.safeParse(parsed);
  if (!result.success) {
    throw new CliError("stored credentials have an unexpected shape", { cause: result.error });
  }
  return result.data;
};

const configDir = (): string => {
  const xdg = process.env["XDG_CONFIG_HOME"];
  return join(xdg !== undefined && xdg.length > 0 ? xdg : join(homedir(), ".config"), "mynth");
};

const exists = async (path: string): Promise<boolean> => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

/**
 * Credentials live in the system keychain when one is available, and fall back
 * to a 0600 file under `$XDG_CONFIG_HOME/mynth` (headless CI, containers).
 */
export class CredentialsStore {
  readonly filePath: string;
  private readonly dir: string;

  constructor() {
    this.dir = configDir();
    this.filePath = join(this.dir, FILE_NAME);
  }

  async get(): Promise<Credentials | undefined> {
    const stored = await tryKeychain(
      () => keychain.getPassword(SERVICE_NAME, ACCOUNT_NAME),
      "keychain read",
    );

    if (stored.available) return stored.value === null ? undefined : decode(stored.value);
    if (!(await exists(this.filePath))) return undefined;

    try {
      return decode(await readFile(this.filePath, "utf8"));
    } catch (cause) {
      if (cause instanceof CliError) throw cause;
      throw new CliError(`could not read ${this.filePath}: ${(cause as Error).message}`, { cause });
    }
  }

  async set(credentials: Credentials): Promise<void> {
    const encoded = JSON.stringify(credentials);
    const wrote = await tryKeychain(
      () => keychain.setPassword(SERVICE_NAME, ACCOUNT_NAME, encoded),
      "keychain write",
    );

    if (wrote.available) {
      // Never leave a stale plaintext copy behind once the keychain works.
      await this.removeFile();
      return;
    }

    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.filePath, encoded, { encoding: "utf8", mode: 0o600 });
      await chmod(this.filePath, 0o600);
    } catch (cause) {
      throw new CliError(`could not write ${this.filePath}: ${(cause as Error).message}`, {
        cause,
      });
    }
  }

  async clear(): Promise<void> {
    await tryKeychain(
      () => keychain.deletePassword(SERVICE_NAME, ACCOUNT_NAME),
      "keychain delete",
    ).catch(() => undefined);
    await this.removeFile();
  }

  /** Whether credentials are (or would be) stored in the system keychain. */
  async usingKeychain(): Promise<boolean> {
    const result = await tryKeychain(() => keychain.getKeyring(), "keychain probe");
    return result.available && result.value !== null;
  }

  /** Human-readable description of where credentials live. */
  async backend(): Promise<string> {
    return (await this.usingKeychain()) ? "system keychain" : `file (${this.filePath})`;
  }

  private async removeFile(): Promise<void> {
    if (!(await exists(this.filePath))) return;
    await rm(this.filePath).catch((cause: unknown) => {
      throw new CliError(`could not delete ${this.filePath}: ${(cause as Error).message}`, {
        cause,
      });
    });
  }
}
