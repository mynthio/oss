import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { credentials as credentialsSchema, type Credentials } from "../api/schemas.ts";
import { CliError } from "../errors.ts";

const FILE_NAME = "credentials.json";
const FILE_MODE = 0o600;

/**
 * Credentials live in a `0600` file, the same as vercel, gcloud, npm and
 * wrangler.
 *
 * A system keychain was tried and removed. A keychain ACL binds to a code
 * signature, and there is no mynth binary to bind to — only a JS file run by
 * whichever `node` is on PATH. macOS therefore prompted on every read, which is
 * unanswerable for this CLI's main callers: agents, CI, containers and SSH. The
 * protection was close to nil anyway, since anything able to run `node` could
 * read the secret back out through the CLI itself.
 */
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

export class CredentialsStore {
  readonly filePath: string;

  constructor() {
    this.filePath = join(configDir(), FILE_NAME);
  }

  async get(): Promise<Credentials | undefined> {
    if (!(await exists(this.filePath))) return undefined;

    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (cause) {
      throw new CliError(`could not read ${this.filePath}: ${(cause as Error).message}`, { cause });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (cause) {
      throw new CliError(`${this.filePath} is not valid JSON`, { cause });
    }

    const result = credentialsSchema.safeParse(parsed);
    if (!result.success) {
      throw new CliError(`${this.filePath} has an unexpected shape; run \`mynth auth login\``, {
        cause: result.error,
      });
    }
    return result.data;
  }

  async set(credentials: Credentials): Promise<void> {
    try {
      await mkdir(dirname(this.filePath), { recursive: true, mode: 0o700 });
      // `mode` only applies when a file is created, so writing over an existing
      // file would keep its old permissions. Write a fresh file and rename it,
      // which is atomic and always lands as 0600.
      const temporary = `${this.filePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify(credentials), {
        encoding: "utf8",
        mode: FILE_MODE,
      });
      await rename(temporary, this.filePath);
    } catch (cause) {
      throw new CliError(`could not write ${this.filePath}: ${(cause as Error).message}`, {
        cause,
      });
    }
  }

  async clear(): Promise<void> {
    try {
      await rm(this.filePath, { force: true });
    } catch (cause) {
      throw new CliError(`could not delete ${this.filePath}: ${(cause as Error).message}`, {
        cause,
      });
    }
  }
}
