import { CliUsageError, MynthApiError } from "../domain/Errors.ts";
import type { AppConfig } from "./AppConfig.ts";
import { readText } from "./MynthApi.ts";

export type DocsPage = {
  readonly path: string;
  readonly content: string;
};

const parseErrorBody = (body: string): string => {
  if (body.length === 0) return "no response body";

  try {
    const parsed = JSON.parse(body) as { readonly error?: unknown };
    if (typeof parsed.error === "string" && parsed.error.length > 0) return parsed.error;
  } catch {
    // The response is plain text.
  }

  return body.length > 500 ? `${body.slice(0, 500)}…` : body;
};

const assertSuccess = async (response: Response, operation: string): Promise<void> => {
  if (response.ok) return;
  const detail = parseErrorBody(await readText(response));
  throw new MynthApiError({
    message: `${operation} failed (${response.status}): ${detail}`,
    status: response.status,
  });
};

const request = async (url: string, operation: string, init?: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (cause) {
    throw new MynthApiError({
      message: `${operation} failed: ${(cause as Error).message}`,
      status: 0,
      cause,
    });
  }
};

const readDocumentText = async (response: Response, operation: string): Promise<string> => {
  try {
    return await response.text();
  } catch (cause) {
    throw new MynthApiError({
      message: `${operation} failed while reading the response: ${(cause as Error).message}`,
      status: response.status,
      cause,
    });
  }
};

const normalizePath = (path: string): string => {
  const normalized = path.trim();
  if (normalized.length === 0) throw new CliUsageError("documentation path must not be empty");
  if (normalized.length > 2_048) throw new CliUsageError("documentation path is too long");
  if (normalized.startsWith("//") || normalized.includes("://")) {
    throw new CliUsageError("documentation path must be a path, not a URL");
  }
  if (normalized.includes("?") || normalized.includes("#") || normalized.includes("\\")) {
    throw new CliUsageError("documentation path must not contain a query, fragment, or backslash");
  }

  const withoutLeadingSlash = normalized.startsWith("/") ? normalized.slice(1) : normalized;
  if (withoutLeadingSlash.endsWith(".md")) {
    throw new CliUsageError("documentation path must not include the .md suffix");
  }

  const segments = withoutLeadingSlash.split("/");
  if (
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        !/^[A-Za-z0-9._~%-]+$/.test(segment),
    )
  ) {
    throw new CliUsageError("documentation path contains an invalid segment");
  }

  return segments.join("/");
};

export class DocsService {
  private readonly docsUrl: string;

  constructor(config: AppConfig) {
    this.docsUrl = config.mynthDocsUrl.replace(/\/$/, "");
  }

  async get(path: string): Promise<DocsPage> {
    const normalizedPath = normalizePath(path);
    const encodedPath = normalizedPath.split("/").map(encodeURIComponent).join("/");
    const response = await request(
      `${this.docsUrl}/${encodedPath}.md`,
      `documentation page fetch for ${normalizedPath}`,
    );
    await assertSuccess(response, `documentation page fetch for ${normalizedPath}`);
    return {
      path: normalizedPath,
      content: await readDocumentText(response, `documentation page fetch for ${normalizedPath}`),
    };
  }

  async list(): Promise<string> {
    const response = await request(`${this.docsUrl}/llms.txt`, "documentation index fetch");
    await assertSuccess(response, "documentation index fetch");
    return readDocumentText(response, "documentation index fetch");
  }
}
