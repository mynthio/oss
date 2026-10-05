import { Webhook } from "standardwebhooks";
import { describe, expect, test } from "vitest";

import { WEBHOOK_EVENTS, WEBHOOK_SECRET } from "./events.fixture.ts";
import { verifySignature } from "./utils.ts";
import { MynthWebhookVerificationError, verifyWebhook } from "./verify.ts";

const event = WEBHOOK_EVENTS["task.image.rate.completed"];
const body = JSON.stringify(event);

/** Headers for `body`, signed by the reference standardwebhooks library. */
function signedHeaders(timestamp = new Date()) {
  return {
    "webhook-id": event.id,
    "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
    "webhook-signature": new Webhook(WEBHOOK_SECRET).sign(event.id, timestamp, body),
  };
}

describe("verifySignature", () => {
  test("verifies the Standard Webhooks reference test vector", async () => {
    // Act
    const verified = await verifySignature({
      id: "msg_p5jXN8AQM9LWM0D4loKWxJek",
      timestamp: "1614265330",
      signature: "v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE=",
      body: new TextEncoder().encode('{"test": 2432232314}'),
      secret: "whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw",
      now: 1614265330 * 1000,
    });

    // Assert
    expect(verified).toBe(true);
  });

  test("throws for a secret that is not one Mynth issued", async () => {
    // Act
    const verify = verifySignature({
      id: event.id,
      timestamp: "1614265330",
      signature: "v1,abc",
      body: new Uint8Array(),
      secret: "wbs_0123456789abcdef!",
    });

    // Assert
    await expect(verify).rejects.toThrow("The Mynth webhook secret is not valid");
  });
});

describe("verifyWebhook", () => {
  test("returns the event the standardwebhooks library signed", async () => {
    // Act
    const verified = await verifyWebhook({ body, headers: signedHeaders() }, WEBHOOK_SECRET);

    // Assert
    expect(verified).toEqual(event);
  });

  test("reads Headers objects and byte bodies", async () => {
    // Act
    const verified = await verifyWebhook(
      { body: new TextEncoder().encode(body), headers: new Headers(signedHeaders()) },
      WEBHOOK_SECRET,
    );

    // Assert
    expect(verified.id).toBe(event.id);
  });

  test("reads Node-style header records with any casing", async () => {
    // Arrange
    const headers = Object.fromEntries(
      Object.entries(signedHeaders()).map(([name, value]) => [name.toUpperCase(), [value]]),
    );

    // Act
    const verified = await verifyWebhook({ body, headers }, WEBHOOK_SECRET);

    // Assert
    expect(verified.id).toBe(event.id);
  });

  test.each([
    ["an unsigned delivery", { "webhook-signature": undefined }],
    ["another webhook-id", { "webhook-id": "evt_replayed" }],
    ["a stale timestamp", signedHeaders(new Date(Date.now() - 10 * 60 * 1000))],
  ])("rejects %s", async (_, change) => {
    // Act
    const verify = verifyWebhook(
      { body, headers: { ...signedHeaders(), ...change } },
      WEBHOOK_SECRET,
    );

    // Assert
    await expect(verify).rejects.toThrow(MynthWebhookVerificationError);
  });

  test.each([
    ["before", (valid: string) => `v1,A ${valid}`],
    ["after", (valid: string) => `${valid} v1,A`],
  ])("accepts a valid signature with a malformed entry %s it", async (_, header) => {
    // Arrange
    const headers = signedHeaders();

    // Act
    const verified = await verifyWebhook(
      { body, headers: { ...headers, "webhook-signature": header(headers["webhook-signature"]) } },
      WEBHOOK_SECRET,
    );

    // Assert
    expect(verified.id).toBe(event.id);
  });

  test("rejects a header with only malformed entries as a verification error", async () => {
    // Act
    const verify = verifyWebhook(
      { body, headers: { ...signedHeaders(), "webhook-signature": "v1,A v1,!!" } },
      WEBHOOK_SECRET,
    );

    // Assert
    await expect(verify).rejects.toThrow(MynthWebhookVerificationError);
  });

  test("rejects a signed body whose id is not the webhook-id", async () => {
    // Arrange
    const tampered = JSON.stringify({ ...event, id: "evt_other" });
    const timestamp = new Date();
    const headers = {
      "webhook-id": event.id,
      "webhook-timestamp": String(Math.floor(timestamp.getTime() / 1000)),
      "webhook-signature": new Webhook(WEBHOOK_SECRET).sign(event.id, timestamp, tampered),
    };

    // Act
    const verify = verifyWebhook({ body: tampered, headers }, WEBHOOK_SECRET);

    // Assert
    await expect(verify).rejects.toThrow("not a Mynth event for this webhook-id");
  });

  test("produces nothing the reference library would reject", async () => {
    // Arrange: verified by this SDK, then by the reference library.
    const headers = signedHeaders();
    await verifyWebhook({ body, headers }, WEBHOOK_SECRET);

    // Act
    const reference = new Webhook(WEBHOOK_SECRET).verify(body, headers);

    // Assert
    expect(reference).toEqual(event);
  });
});
