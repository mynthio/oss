import { ApiClient } from "./api/client.ts";
import { DocsClient } from "./api/docs.ts";
import { Session } from "./auth/session.ts";
import { loadConfig, type Config } from "./config.ts";

/**
 * Everything a command needs, built once per process. Construction does no I/O,
 * so `--help` and usage errors never touch the filesystem or the network.
 */
export type App = {
  readonly config: Config;
  readonly session: Session;
  readonly api: ApiClient;
  readonly docs: DocsClient;
};

export const createApp = (): App => {
  const config = loadConfig();
  const session = new Session(config);
  return {
    config,
    session,
    api: new ApiClient(config, session),
    docs: new DocsClient(config.docsUrl),
  };
};
