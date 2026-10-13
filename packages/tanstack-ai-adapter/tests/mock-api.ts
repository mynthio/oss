/**
 * A fake Mynth API behind a `fetch` function, so tests run the real client,
 * uploads and polling against canned responses.
 */

type Handler = (request: Request) => Response;

/** A route answers with its handlers in turn; the last one repeats. */
type Routes = Record<string, Handler | Handler[]>;

export const BASE_URL = "https://api.test";

export function ok(data: unknown, init?: ResponseInit): Handler {
  return () => Response.json({ data }, init);
}

export function apiError(
  status: number,
  error: Record<string, unknown> = {},
  headers?: HeadersInit,
): Handler {
  return () => Response.json({ error }, { status, ...(headers ? { headers } : {}) });
}

export function networkError(): Handler {
  return () => {
    throw new TypeError("fetch failed");
  };
}

export function completedTask(
  overrides: { result?: Record<string, unknown>; cost?: string } = {},
): Record<string, unknown> {
  return {
    id: "tsk_1",
    status: "completed",
    cost: overrides.cost ?? "0.01",
    errors: null,
    result: {
      model: "krea/krea-2-large",
      images: [
        {
          status: "success",
          url: "https://cdn.mynth.io/1.webp",
          mynth_url: "https://cdn.mynth.io/1.webp",
        },
      ],
      ...overrides.result,
    },
  };
}

/** Routes for a generation that completes on the first poll. */
export function generationRoutes(overrides: Routes = {}): Routes {
  return {
    "POST /image/generate": ok({ task_id: "tsk_1", estimated_cost: "0.01" }),
    "GET /tasks/tsk_1/status": ok({ status: "completed" }),
    "GET /tasks/tsk_1": ok(completedTask()),
    ...overrides,
  };
}

export interface MockApi {
  fetch: typeof fetch;
  /** Every request made, in order. */
  requests: Request[];
  /** Requests made to one route, e.g. `"GET /tasks/tsk_1/status"`. */
  requestsTo: (key: string) => Request[];
}

export function createMockApi(routes: Routes): MockApi {
  const requests: Request[] = [];
  const calls = new Map<string, number>();

  const fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    init?.signal?.throwIfAborted();

    const request = new Request(input, init);
    const key = `${request.method} ${new URL(request.url).pathname}`;
    const route = routes[key];

    if (!route) {
      throw new Error(`No mock route for ${key}`);
    }

    requests.push(request);
    const handlers = Array.isArray(route) ? route : [route];
    const call = calls.get(key) ?? 0;
    calls.set(key, call + 1);

    return handlers[Math.min(call, handlers.length - 1)]!(request);
  };

  const requestsTo = (key: string): Request[] =>
    requests.filter((request) => `${request.method} ${new URL(request.url).pathname}` === key);

  return { fetch, requests, requestsTo };
}
