/**
 * A fake Mynth API behind `fetch`, so tests run the real Mynth SDK (uploads,
 * creates, polling) and the AI SDK against canned responses.
 */

type Handler = (request: Request) => Response | Promise<Response>;

/** A route answers with its handlers in turn; the last one repeats. */
type Routes = Record<string, Handler | Handler[]>;

export const BASE_URL = "https://api.test";

export function ok(data: unknown, init?: ResponseInit): Handler {
  return () => Response.json({ data }, init);
}

export function apiError(status: number, error: Record<string, unknown> = {}): Handler {
  return () => Response.json({ error }, { status });
}

export function bytes(body: Uint8Array, contentType: string): Handler {
  return () => new Response(new Uint8Array(body), { headers: { "content-type": contentType } });
}

export function imageTask(
  overrides: { result?: Record<string, unknown>; cost?: string } = {},
): Record<string, unknown> {
  return {
    id: "tsk_img",
    status: "completed",
    cost: overrides.cost ?? "0.004",
    errors: null,
    request: { prompt: "A cat", model: "black-forest-labs/flux-1-schnell" },
    result: {
      model: "black-forest-labs/flux-1-schnell",
      images: [
        {
          status: "success",
          id: "img_1",
          url: "https://cdn.test/img_1.webp",
          mynth_url: "https://cdn.test/img_1.webp",
          size: "1024x1024",
          format: "webp",
        },
      ],
      ...overrides.result,
    },
  };
}

export function videoTask(
  overrides: { result?: Record<string, unknown>; cost?: string } = {},
): Record<string, unknown> {
  return {
    id: "tsk_vid",
    status: "completed",
    cost: overrides.cost ?? "0.12",
    errors: null,
    request: { prompt: "A cat surfing", model: "xai/grok-imagine-video-1.5-lite" },
    result: {
      model: "xai/grok-imagine-video-1.5-lite",
      videos: [
        {
          status: "success",
          id: "vid_1",
          url: null,
          mynth_url: "https://cdn.test/vid_1.mp4",
          cost: "0.12",
          duration: 6,
          resolution: "480p",
          aspect_ratio: "16:9",
          audio: true,
        },
      ],
      ...overrides.result,
    },
  };
}

export const PNG_BYTES: Uint8Array = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

/** Routes for an image generation that completes on the first poll. */
export function imageRoutes(overrides: Routes = {}): Routes {
  return {
    "POST /image/generate": ok({ task_id: "tsk_img", estimated_cost: "0.004" }),
    "GET /tasks/tsk_img/status": ok({ status: "completed" }),
    "GET /tasks/tsk_img": ok(imageTask()),
    "GET /img_1.webp": bytes(PNG_BYTES, "image/webp"),
    ...overrides,
  };
}

/** Routes for a video generation that completes on the first poll. */
export function videoRoutes(overrides: Routes = {}): Routes {
  return {
    "POST /video/generate": ok({ task_id: "tsk_vid" }),
    "GET /tasks/tsk_vid/status": ok({ status: "completed" }),
    "GET /tasks/tsk_vid": ok(videoTask()),
    "GET /vid_1.mp4": bytes(new Uint8Array([0, 0, 0, 24]), "video/mp4"),
    ...overrides,
  };
}

export interface MockApi {
  fetch: typeof fetch;
  /** Every request made, in order. */
  requests: Request[];
  /** Requests made to one route, e.g. `"POST /image/generate"`. */
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

/** The JSON body of the only request made to `key`. */
export async function bodyOf(api: MockApi, key: string): Promise<Record<string, unknown>> {
  const [request] = api.requestsTo(key);
  if (!request) throw new Error(`No request to ${key}`);
  return (await request.clone().json()) as Record<string, unknown>;
}

/** The error a model call rejects with. Fails the test if it resolves. */
export async function errorOf(call: PromiseLike<unknown>): Promise<unknown> {
  try {
    await call;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to reject");
}
