import { CliUsageError, MynthApiError } from "../domain/Errors.ts";
import type { AppConfig } from "./AppConfig.ts";
import { assertSuccess, readDocumentText, request } from "./DocsService.ts";

export type ChangelogIndexEntry = {
  readonly slug: string;
  readonly date: string;
  readonly title: string;
  readonly summary: string;
  readonly products: ReadonlyArray<string>;
  readonly type: string;
  readonly breaking: boolean;
  readonly version?: string;
  readonly url: string;
};

export type ChangelogEntryPage = {
  readonly slug: string;
  readonly content: string;
};

const normalizeSlug = (slug: string): string => {
  const normalized = slug.trim();
  if (normalized.length === 0) throw new CliUsageError("changelog slug must not be empty");
  if (normalized.endsWith(".md")) {
    throw new CliUsageError("changelog slug must not include the .md suffix");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(normalized)) {
    throw new CliUsageError("changelog slug contains an invalid character");
  }
  return normalized;
};

export class ChangelogService {
  private readonly changelogUrl: string;

  constructor(config: AppConfig) {
    this.changelogUrl = config.mynthChangelogUrl.replace(/\/$/, "");
  }

  async list(): Promise<ReadonlyArray<ChangelogIndexEntry>> {
    const response = await request(`${this.changelogUrl}.json`, "changelog index fetch");
    await assertSuccess(response, "changelog index fetch");
    const body = await readDocumentText(response, "changelog index fetch");

    try {
      return JSON.parse(body) as ChangelogIndexEntry[];
    } catch (cause) {
      throw new MynthApiError({
        message: "changelog index fetch returned invalid JSON",
        status: response.status,
        cause,
      });
    }
  }

  async get(slug: string): Promise<ChangelogEntryPage> {
    const normalizedSlug = normalizeSlug(slug);
    const operation = `changelog entry fetch for ${normalizedSlug}`;
    const response = await request(
      `${this.changelogUrl}/${encodeURIComponent(normalizedSlug)}.md`,
      operation,
    );
    await assertSuccess(response, operation);
    return {
      slug: normalizedSlug,
      content: await readDocumentText(response, operation),
    };
  }
}
