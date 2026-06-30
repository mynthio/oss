import { afterEach, describe, expect, it, vi } from "vitest";
import type { CliContext } from "../src/context.ts";
import { createDocsCommand } from "../src/commands/docs.ts";
import { CliUsageError } from "../src/domain/Errors.ts";
import { DocsService } from "../src/services/DocsService.ts";

const appConfig = {
  mynthApiUrl: "https://api.mynth.test",
  mynthDocsUrl: "https://docs.mynth.test",
};

const createContext = (docs: Partial<CliContext["docs"]>): CliContext =>
  ({ docs }) as unknown as CliContext;

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("docs command", () => {
  it("prints a fetched page as human-readable Markdown", async () => {
    // Arrange
    const get = vi.fn().mockResolvedValue({
      path: "guides/generate-images",
      content: "# Generate images\n\nSend a prompt.",
    });
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = createDocsCommand(createContext({ get }));

    // Act
    await command.parseAsync(["node", "docs", "get", "guides/generate-images"]);

    // Assert
    expect({
      calls: get.mock.calls,
      output: write.mock.calls.map((call) => String(call[0])).join(""),
    }).toEqual({
      calls: [["guides/generate-images"]],
      output: "# Generate images\n\nSend a prompt.\n",
    });
  });

  it("prints the documentation index as structured JSON", async () => {
    // Arrange
    const list = vi.fn().mockResolvedValue("# Mynth docs\n- [Quickstart](/quickstart)");
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const command = createDocsCommand(createContext({ list }));

    // Act
    await command.parseAsync(["node", "docs", "list", "--json"]);

    // Assert
    expect({
      calls: list.mock.calls,
      output: write.mock.calls.map((call) => String(call[0])).join(""),
    }).toEqual({
      calls: [[]],
      output: `${JSON.stringify(
        { content: "# Mynth docs\n- [Quickstart](/quickstart)" },
        null,
        2,
      )}\n`,
    });
  });
});

describe("DocsService", () => {
  it("fetches Markdown directly from the deployed documentation site", async () => {
    // Arrange
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response("# Async and polling", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const service = new DocsService(appConfig);

    // Act
    const page = await service.get("/guides/async-and-polling");

    // Assert
    expect({ page, calls: fetchMock.mock.calls }).toEqual({
      page: {
        path: "guides/async-and-polling",
        content: "# Async and polling",
      },
      calls: [["https://docs.mynth.test/guides/async-and-polling.md", undefined]],
    });
  });

  it("rejects traversal paths before making a request", async () => {
    // Arrange
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal("fetch", fetchMock);
    const service = new DocsService(appConfig);

    // Act
    const result = service.get("guides/../secrets");

    // Assert
    await expect(result).rejects.toEqual(
      new CliUsageError("documentation path contains an invalid segment"),
    );
  });

  it("reports network failures with the failed operation", async () => {
    // Arrange
    vi.stubGlobal("fetch", vi.fn<typeof fetch>().mockRejectedValue(new Error("offline")));
    const service = new DocsService(appConfig);

    // Act
    const result = service.list();

    // Assert
    await expect(result).rejects.toMatchObject({
      message: "documentation index fetch failed: offline",
      status: 0,
    });
  });
});
