import * as keychain from "cross-keychain";
import { mkdir, readFile, rm, stat, writeFile, chmod } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { CredentialsStoreError } from "../domain/Errors.ts";
import { CredentialsSchema, type Credentials } from "../domain/Schemas.ts";

const SERVICE_NAME = "mynth-cli";
const ACCOUNT_NAME = "default";
const FILE_NAME = "credentials.json";

const isKeychainUnavailable = (cause: unknown): boolean => {
  const name = (cause as { name?: string } | undefined)?.name;
  return name === "NoKeyringError" || name === "InitError";
};

const tryKeychain = async <A>(
  fn: () => Promise<A>,
  message: string,
): Promise<{ readonly available: true; readonly value: A } | { readonly available: false }> => {
  try {
    return { available: true, value: await fn() };
  } catch (cause) {
    if (isKeychainUnavailable(cause)) return { available: false };
    throw new CredentialsStoreError({ message, cause });
  }
};

const decode = (raw: string): Credentials => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (cause) {
    throw new CredentialsStoreError({ message: "credentials JSON parse failed", cause });
  }

  const result = CredentialsSchema.safeParse(parsed);
  if (!result.success) {
    throw new CredentialsStoreError({
      message: "credentials shape invalid",
      cause: result.error,
    });
  }
  return result.data;
};

const encode = (creds: Credentials): string => JSON.stringify(creds);

const resolveConfigDir = (): string => {
  const xdg = process.env["XDG_CONFIG_HOME"];
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "mynth");
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
};

export class CredentialsStore {
  readonly filePath: string;
  private readonly dir: string;

  constructor() {
    this.dir = resolveConfigDir();
    this.filePath = join(this.dir, FILE_NAME);
  }

  async get(): Promise<Credentials | undefined> {
    const fromKeychain = await tryKeychain(
      () => keychain.getPassword(SERVICE_NAME, ACCOUNT_NAME),
      "keychain get failed",
    );

    if (fromKeychain.available) {
      return fromKeychain.value === null ? undefined : decode(fromKeychain.value);
    }

    if (!(await fileExists(this.filePath))) return undefined;

    try {
      return decode(await readFile(this.filePath, "utf8"));
    } catch (cause) {
      if (cause instanceof CredentialsStoreError) throw cause;
      throw new CredentialsStoreError({ message: "read credentials file failed", cause });
    }
  }

  async set(creds: Credentials): Promise<void> {
    const wrote = await tryKeychain(
      () => keychain.setPassword(SERVICE_NAME, ACCOUNT_NAME, encode(creds)),
      "keychain set failed",
    );

    if (wrote.available) {
      await this.deleteFileSilently();
      return;
    }

    await mkdir(this.dir, { recursive: true }).catch((cause) => {
      throw new CredentialsStoreError({ message: "create config dir failed", cause });
    });
    await writeFile(this.filePath, encode(creds), "utf8").catch((cause) => {
      throw new CredentialsStoreError({ message: "write credentials file failed", cause });
    });
    await chmod(this.filePath, 0o600).catch(() => undefined);
  }

  async clear(): Promise<void> {
    await tryKeychain(
      () => keychain.deletePassword(SERVICE_NAME, ACCOUNT_NAME),
      "keychain delete failed",
    ).catch(() => undefined);
    await this.deleteFileSilently();
  }

  async usingKeychain(): Promise<boolean> {
    const result = await tryKeychain(() => keychain.getKeyring(), "keychain probe failed");
    return result.available && result.value !== null;
  }

  private async deleteFileSilently(): Promise<void> {
    if (!(await fileExists(this.filePath))) return;
    await rm(this.filePath).catch((cause) => {
      throw new CredentialsStoreError({ message: "delete credentials file failed", cause });
    });
  }
}
