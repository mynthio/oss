import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliContext } from "../src/context.ts";
import { createChangelogCommand } from "../src/commands/changelog.ts";
import { CliUsageError } from "../src/domain/Errors.ts";
import { ChangelogService } from "../src/services/ChangelogService.ts";

const appConfig = {
  mynthApiUrl: "https://api.mynth.test",
  mynthDocsUrl: "https://docs.mynth.test",
  mynthChangelogUrl: "https://mynth.test/changelog",
};

const createContext = (changelog: Partial<CliContext["changelog"]>): CliContext =>
  ({ changelog }) as unknown as CliContext;

const entries = [
  {
    slug: "2026-08-06-image-review-and-alt-text",
    date: "2026-08-06",
    title: "Image review and alt text",
    summary: "Score generated images and produce alt text.",
    products: ["api", "sdk", "cli"],
    type: "feature",
    breaking: false,
    version: "sdk 0.0.36",
    url: "https://mynth.test/changelog/2026-08-06-image-review-and-alt-text",
  },
  {
    slug: "2026-07-08-destinations-and-webhooks-in-the-cli",
    date: "2026-07-08",
    title: "Destinations and webhooks in the CLI",
    summary: "Manage storage destinations and webhooks from the terminal.",
    products: ["cli"],
    type: "feature",
    breaking: false,
    url: "https://mynth.test/changelog/2026-07-08-destinations-and-webhooks-in-the-cli",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("changelog command", () => {
  it("lists entries in a human-readable form with the detail command", async () => {
    // Arrange
    const list = vi.fn().mockResolvedValue(entries);
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = createChangelogCommand(createContext({ list }));

    // Act
    await command.parseAsync(["node", "changelog"]);

    // Assert
    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(output).toBe(
      [
        "Image review and alt text",
        "  2026-08-06 · feature · api, sdk, cli · sdk 0.0.36",
        "  Score generated images and produce alt text.",
        "  mynth changelog get 2026-08-06-image-review-and-alt-text",
        "",
        "Destinations and webhooks in the CLI",
        "  2026-07-08 · feature · cli",
        "  Manage storage destinations and webhooks from the terminal.",
        "  mynth changelog get 2026-07-08-destinations-and-webhooks-in-the-cli",
        "",
      ].join("\n"),
    );
  });

  it("filters by product and date and outputs JSON", async () => {
    // Arrange
    const list = vi.fn().mockResolvedValue(entries);
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = createChangelogCommand(createContext({ list }));

    // Act
    await command.parseAsync([
      "node",
      "changelog",
      "--product",
      "sdk",
      "--since",
      "2026-08-01",
      "--json",
    ]);

    // Assert
    const output = write.mock.calls.map((call) => String(call[0])).join("");
    expect(JSON.parse(output)).toEqual([entries[0]]);
  });

  it("rejects a malformed --since date", async () => {
    // Arrange
    const list = vi.fn().mockResolvedValue(entries);
    const command = createChangelogCommand(createContext({ list }));

    // Act
    const parse = command.parseAsync(["node", "changelog", "--since", "last week"]);

    // Assert
    await expect(parse).rejects.toThrow(CliUsageError);
  });

  it("prints a fetched entry as Markdown", async () => {
    // Arrange
    const get = vi.fn().mockResolvedValue({
      slug: "2026-08-06-image-review-and-alt-text",
      content: "# Image review and alt text\n\nDetails.",
    });
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = createChangelogCommand(createContext({ get }));

    // Act
    await command.parseAsync(["node", "changelog", "get", "2026-08-06-image-review-and-alt-text"]);

    // Assert
    expect({
      calls: get.mock.calls,
      output: write.mock.calls.map((call) => String(call[0])).join(""),
    }).toEqual({
      calls: [["2026-08-06-image-review-and-alt-text"]],
      output: "# Image review and alt text\n\nDetails.\n",
    });
  });
});

describe("ChangelogService", () => {
  it("fetches the index from the changelog JSON endpoint", async () => {
    // Arrange
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json([entries[1]], { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const service = new ChangelogService(appConfig);

    // Act
    const index = await service.list();

    // Assert
    expect({ index, calls: fetchMock.mock.calls }).toEqual({
      index: [entries[1]],
      calls: [["https://mynth.test/changelog.json", undefined]],
    });
  });

  it("fetches one entry as Markdown by slug", async () => {
    // Arrange
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("# Entry", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const service = new ChangelogService(appConfig);

    // Act
    const entry = await service.get("2026-08-06-image-review-and-alt-text");

    // Assert
    expect({ entry, calls: fetchMock.mock.calls }).toEqual({
      entry: { slug: "2026-08-06-image-review-and-alt-text", content: "# Entry" },
      calls: [["https://mynth.test/changelog/2026-08-06-image-review-and-alt-text.md", undefined]],
    });
  });

  it("rejects a slug with path separators", async () => {
    // Arrange
    const service = new ChangelogService(appConfig);

    // Act
    const get = service.get("../secrets");

    // Assert
    await expect(get).rejects.toThrow(CliUsageError);
  });
});
