import { describe, expect, test, vi } from "vitest";

import { MynthClient, SDK_CLIENT } from "./client.ts";
import { API_URL } from "./constants.ts";

describe("MynthClient", () => {
  test("getUrl drops a trailing slash from the base URL", () => {
    // Arrange
    const client = new MynthClient({ baseUrl: "https://api.test/" });

    // Act
    const url = client.getUrl("/models");

    // Assert
    expect(url).toBe("https://api.test/models");
  });

  test("getUrl falls back to the Mynth API without a base URL", () => {
    // Arrange
    const client = new MynthClient({});

    // Act
    const url = client.getUrl("/models");

    // Assert
    expect(url).toBe(`${API_URL}/models`);
  });

  test("getAuthHeaders is empty without an API key or access token", () => {
    // Arrange
    const client = new MynthClient({});

    // Act
    const headers = client.getAuthHeaders();

    // Assert
    expect(headers).toEqual({});
  });
});

describe("MynthClient errors", () => {
  test("reads the code, message and issues from the error envelope", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "validation_error",
            message: "count: Unknown field.",
            issues: [{ path: ["count"], message: "Unknown field." }],
          },
        },
        { status: 400 },
      ),
    );

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        name: "MynthAPIError",
        status: 400,
        code: "validation_error",
        message: "count: Unknown field.",
        issues: [{ path: ["count"], message: "Unknown field." }],
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("reads the task a failed create left behind", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      Response.json(
        {
          error: {
            code: "public_access_token_failed",
            message: "Task tsk_123 was created and will run.",
            task_id: "tsk_123",
          },
        },
        { status: 500 },
      ),
    );

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        name: "MynthAPIError",
        status: 500,
        code: "public_access_token_failed",
        taskId: "tsk_123",
      });
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("falls back to the status when the body is not the error envelope", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<html>Bad gateway</html>", { status: 502 }));

    try {
      // Act
      const error: unknown = await client.post("/image/generate", {}).catch((caught) => caught);

      // Assert
      expect(error).toMatchObject({
        status: 502,
        code: undefined,
        message: "Request failed with status 502",
      });
    } finally {
      fetchMock.mockRestore();
    }
  });
});

describe("MynthClient.createTask", () => {
  const created = () => Response.json({ data: { task_id: "tsk_1" } }, { status: 201 });

  function headersOf(call: unknown[]): Record<string, string> {
    return (call[1] as RequestInit).headers as Record<string, string>;
  }

  test("sends the client tag and a fresh idempotency key per create", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => created());

    try {
      // Act
      await client.createTask("/image/generate", { prompt: "a" });
      await client.createTask("/image/generate", { prompt: "a" });

      // Assert
      const [first, second] = fetchMock.mock.calls.map((call) => headersOf(call));
      expect(first).toMatchObject({
        "X-Mynth-Client": SDK_CLIENT,
        Authorization: "Bearer mak_test",
        "Idempotency-Key": expect.any(String),
      });
      expect(SDK_CLIENT).toMatch(/^[a-z0-9@][a-z0-9@._/-]{0,63}$/);
      expect(first?.["Idempotency-Key"]).not.toBe(second?.["Idempotency-Key"]);
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("retries a 5xx and a network error with the same key, then returns the task", async () => {
    // Arrange
    vi.useFakeTimers();
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("bad gateway", { status: 502 }))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(created());

    try {
      // Act
      const pending = client.createTask(
        "/image/generate",
        { prompt: "a" },
        { idempotencyKey: "k1" },
      );
      await vi.runAllTimersAsync();
      const result = await pending;

      // Assert
      expect(result).toEqual({ data: { task_id: "tsk_1" } });
      expect(fetchMock.mock.calls.map((call) => headersOf(call)["Idempotency-Key"])).toEqual([
        "k1",
        "k1",
        "k1",
      ]);
    } finally {
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  });

  test("gives up after two retries and throws the last API error", async () => {
    // Arrange
    vi.useFakeTimers();
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json({ error: { code: "internal_error", message: "Boom." } }, { status: 500 }),
      );

    try {
      // Act
      const pending = client.createTask("/image/generate", {}).catch((caught: unknown) => caught);
      await vi.runAllTimersAsync();
      const error = await pending;

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(error).toMatchObject({ name: "MynthAPIError", status: 500, code: "internal_error" });
    } finally {
      fetchMock.mockRestore();
      vi.useRealTimers();
    }
  });

  test("does not retry a 4xx, which fails the same way every time", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async () =>
        Response.json(
          { error: { code: "insufficient_balance", message: "Top up." } },
          { status: 402 },
        ),
      );

    try {
      // Act
      const error: unknown = await client
        .createTask("/image/generate", {})
        .catch((caught) => caught);

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(error).toMatchObject({ status: 402, code: "insufficient_balance" });
    } finally {
      fetchMock.mockRestore();
    }
  });

  test("does not retry once the caller aborts", async () => {
    // Arrange
    const client = new MynthClient({ apiKey: "mak_test", baseUrl: "https://api.test" });
    const controller = new AbortController();
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async () => {
      controller.abort();
      throw new DOMException("The operation was aborted.", "AbortError");
    });

    try {
      // Act
      const error: unknown = await client
        .createTask("/image/generate", {}, { signal: controller.signal })
        .catch((caught) => caught);

      // Assert
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(error).toMatchObject({ name: "AbortError" });
    } finally {
      fetchMock.mockRestore();
    }
  });
});
