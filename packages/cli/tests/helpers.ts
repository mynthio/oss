import { spawn } from "node:child_process";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export type CliResult = {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
};

/** Runs the CLI from source in a child process, exactly as a user would. */
export const runCli = (
  args: ReadonlyArray<string>,
  env: NodeJS.ProcessEnv = {},
): Promise<CliResult> =>
  new Promise((resolvePromise, reject) => {
    const child = spawn("bun", ["run", "./src/bin.ts", ...args], {
      cwd: packageRoot,
      env: {
        ...process.env,
        MYNTH_API_KEY: undefined,
        // Never touch the developer's real keychain from a test run.
        MYNTH_NO_KEYCHAIN: "1",
        ...env,
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (status) => resolvePromise({ status, stdout, stderr }));
  });

export type RecordedRequest = {
  readonly method: string;
  readonly url: string;
  readonly body: unknown;
  readonly authorization: string | undefined;
};

export type Route = (request: RecordedRequest, response: ServerResponse) => void;

export const json = (response: ServerResponse, status: number, payload: unknown): void => {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json");
  response.end(JSON.stringify(payload));
};

const readBody = (request: IncomingMessage): Promise<string> =>
  new Promise((resolvePromise) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk: string) => (body += chunk));
    request.on("end", () => resolvePromise(body));
  });

/**
 * Boots a throwaway API on localhost, runs `fn` with `MYNTH_API_URL` pointed at
 * it, and returns every request the CLI made so the wire format can be asserted.
 */
export const withApi = async <T>(
  route: Route,
  fn: (env: NodeJS.ProcessEnv, requests: ReadonlyArray<RecordedRequest>) => Promise<T>,
): Promise<T> => {
  const requests: RecordedRequest[] = [];

  const server = createServer((request, response) => {
    void readBody(request).then((raw) => {
      const recorded: RecordedRequest = {
        method: request.method ?? "GET",
        url: request.url ?? "/",
        body: raw.length > 0 && raw.startsWith("{") ? JSON.parse(raw) : raw,
        authorization: request.headers.authorization,
      };
      requests.push(recorded);
      route(recorded, response);
    });
  });

  await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
  const { port } = server.address() as AddressInfo;

  try {
    return await fn(
      { MYNTH_API_URL: `http://127.0.0.1:${port}`, MYNTH_API_KEY: "mak_test" },
      requests,
    );
  } finally {
    await new Promise<void>((done, fail) =>
      server.close((error) => (error ? fail(error) : done())),
    );
  }
};

/** Serves a completed task: create -> status -> full task. */
export const taskRoutes = (args: {
  readonly taskId: string;
  readonly createPath: string;
  readonly task: Record<string, unknown>;
  readonly createStatus?: number;
}): Route => {
  const task: Record<string, unknown> & { status?: string } = {
    id: args.taskId,
    userId: "user_test",
    apiKeyId: null,
    cost: null,
    request: {},
    result: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:01.000Z",
    ...args.task,
  };

  return (request, response) => {
    if (request.url === args.createPath) {
      json(response, args.createStatus ?? 201, {
        data: { taskId: args.taskId, estimatedCost: "0.01" },
      });
      return;
    }
    if (request.url === `/tasks/${args.taskId}/status`) {
      json(response, 200, { data: { status: task.status ?? "completed" } });
      return;
    }
    if (request.url === `/tasks/${args.taskId}`) {
      json(response, 200, { data: task });
      return;
    }
    json(response, 404, { code: "NOT_FOUND" });
  };
};
