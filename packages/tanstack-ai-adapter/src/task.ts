import {
  type ImageGenerationTask,
  parseImageGenerationTask,
  parseTaskStatus,
  type TaskStatus,
} from "./api.ts";
import type { MynthClient } from "./client.ts";
import { MynthAPIError, MynthError, MynthTaskTimeoutError } from "./errors.ts";

/**
 * Most images finish within seconds, so the wait polls often at first and
 * backs off as the task runs longer. The status endpoint is served from a
 * cache, which keeps the frequent early polls cheap.
 */
const POLL_SCHEDULE = [
  { untilMs: 10_000, intervalMs: 1_000 },
  { untilMs: 60_000, intervalMs: 2_000 },
] as const;
const POLL_INTERVAL_MS = 5_000;
/** Spreads the polls of tasks created together. */
const POLL_JITTER_MS = 250;
/** Total wait budget. TanStack AI's `timeout` option stops the wait sooner. */
const TASK_TIMEOUT_MS = 30 * 60_000;
/**
 * How long polls may keep failing in a row (network errors, 5xx, a cache
 * miss) before the wait gives up. The task was created and is owed an answer,
 * so a deploy or a short outage is worth waiting out.
 */
const OUTAGE_BUDGET_MS = 2 * 60_000;
/** Ceiling for the backoff after failed or rate-limited polls. */
const MAX_BACKOFF_MS = 30_000;

export type SettledImageGenerationTask = Exclude<ImageGenerationTask, { status: "pending" }>;

type PollFailure = "fatal" | "transient" | "rate-limited";

function classify(error: unknown): PollFailure {
  if (error instanceof MynthAPIError) {
    if (error.status === 429) return "rate-limited";
    // 404 is a cold or replicating cache: the task was just created.
    if (error.status === 404 || error.status === 408 || error.status >= 500) return "transient";
    return "fatal";
  }

  // Malformed responses do not fix themselves. Anything else is the network.
  return error instanceof MynthError ? "fatal" : "transient";
}

function scheduledInterval(elapsedMs: number): number {
  return POLL_SCHEDULE.find((phase) => elapsedMs < phase.untilMs)?.intervalMs ?? POLL_INTERVAL_MS;
}

function sleep(ms: number, signal: AbortSignal | undefined): Promise<void> {
  return new Promise((resolve, reject) => {
    signal?.throwIfAborted();

    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason);
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);

    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Poll a task until it settles. Status polls go to the cheap status endpoint;
 * the full task is read once, when the status says it is done.
 *
 * Only reads are retried. Aborting stops the wait but not the task: Mynth
 * keeps generating it, and bills it.
 *
 * @throws {MynthTaskTimeoutError} When the task does not settle in time
 * @throws {MynthAPIError} On an error status a retry cannot fix (401, 403, other 4xx),
 * or once polls have failed for longer than the outage budget
 */
export async function waitForImageGenerationTask(
  client: MynthClient,
  taskId: string,
  {
    signal,
    onStatus,
  }: {
    signal?: AbortSignal | undefined;
    /** Called with every polled status, for debug logging. */
    onStatus?: ((status: TaskStatus) => void) | undefined;
  } = {},
): Promise<SettledImageGenerationTask> {
  const taskPath = `/tasks/${encodeURIComponent(taskId)}`;
  const startedAt = Date.now();
  let failingSince: number | undefined;
  let consecutiveFailures = 0;
  let delayMs = scheduledInterval(0);

  while (true) {
    const remainingMs = TASK_TIMEOUT_MS - (Date.now() - startedAt);

    if (remainingMs <= 0) {
      throw new MynthTaskTimeoutError(taskId, TASK_TIMEOUT_MS);
    }

    await sleep(Math.min(delayMs + Math.random() * POLL_JITTER_MS, remainingMs), signal);

    try {
      const status = parseTaskStatus(await client.get(`${taskPath}/status`, { signal }));
      onStatus?.(status);

      if (status !== "pending") {
        const task = parseImageGenerationTask(await client.get(taskPath, { signal }));
        if (task.status !== "pending") return task;
      }

      failingSince = undefined;
      consecutiveFailures = 0;
      delayMs = scheduledInterval(Date.now() - startedAt);
    } catch (error) {
      // An abort is the caller's decision, not a failure to retry.
      signal?.throwIfAborted();

      const failure = classify(error);
      if (failure === "fatal") throw error;

      // Being told to slow down is not an outage: only the timeout bounds it.
      if (failure === "transient") {
        failingSince ??= Date.now();
        if (Date.now() - failingSince > OUTAGE_BUDGET_MS) throw error;
      }

      consecutiveFailures++;
      delayMs =
        (error instanceof MynthAPIError ? error.retryAfterMs : undefined) ??
        Math.min(
          scheduledInterval(Date.now() - startedAt) * 2 ** consecutiveFailures,
          MAX_BACKOFF_MS,
        );
    }
  }
}
