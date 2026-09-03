import { ApiError, UsageError } from "../errors.ts";

export type DocsPage = {
  readonly path: string;
  readonly content: string;
};

const MAX_PATH_LENGTH = 2048;
const SAFE_SEGMENT = /^[A-Za-z0-9._~%-]+$/;

/**
 * Documentation paths become URL path segments on the docs host, so they are
 * validated rather than escaped: no URLs, no queries, no traversal.
 */
const normalizePath = (raw: string): string => {
  const path = raw.trim();
  if (path.length === 0) throw new UsageError("documentation path must not be empty");
  if (path.length > MAX_PATH_LENGTH) throw new UsageError("documentation path is too long");
  if (path.startsWith("//") || path.includes("://")) {
    throw new UsageError("documentation path must be a path, not a URL");
  }
  if (/[?#\\]/.test(path)) {
    throw new UsageError("documentation path must not contain a query, fragment, or backslash");
  }

  const trimmed = path.startsWith("/") ? path.slice(1) : path;
  if (trimmed.endsWith(".md")) {
    throw new UsageError("documentation path must not include the .md suffix");
  }

  const segments = trimmed.split("/");
  if (
    segments.some((segment) => !SAFE_SEGMENT.test(segment) || segment === "." || segment === "..")
  ) {
    throw new UsageError("documentation path contains an invalid segment");
  }
  return segments.join("/");
};

const truncate = (body: string) => (body.length > 500 ? `${body.slice(0, 500)}…` : body);

const fetchText = async (url: string, label: string): Promise<string> => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch (cause) {
    throw new ApiError(`${label} failed: ${(cause as Error).message}`, { status: 0, cause });
  }

  const body = await response.text().catch(() => "");
  if (!response.ok) {
    throw new ApiError(`${label} failed (${response.status}): ${truncate(body) || "no body"}`, {
      status: response.status,
    });
  }
  return body;
};

/** The docs site is public and served from its own host, so it bypasses ApiClient. */
export class DocsClient {
  constructor(private readonly docsUrl: string) {}

  async get(path: string): Promise<DocsPage> {
    const normalized = normalizePath(path);
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return {
      path: normalized,
      content: await fetchText(`${this.docsUrl}/${encoded}.md`, `docs fetch for ${normalized}`),
    };
  }

  list(): Promise<string> {
    return fetchText(`${this.docsUrl}/llms.txt`, "docs index fetch");
  }
}
