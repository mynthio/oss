import type { MynthSDKTypes } from "../types.ts";
import {
  getWebhookSecretFromEnv,
  parseWebhookEvent,
  readHeader,
  verifySignature,
  WEBHOOK_ID_HEADER,
  WEBHOOK_SIGNATURE_HEADER,
  WEBHOOK_TIMESTAMP_HEADER,
  type WebhookHeaders,
} from "./utils.ts";

/** A webhook request failed verification: unsigned, wrongly signed, stale, or not an event. */
export class MynthWebhookVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MynthWebhookVerificationError";
  }
}

/** A webhook request as it arrived. */
export type MynthWebhookRequest = {
  /**
   * The raw body, exactly as received. Parsing and serializing the JSON again
   * can change the bytes, and the signature covers the bytes.
   */
  body: string | Uint8Array | ArrayBuffer;
  /** A `Headers` object, or a Node-style header record such as `req.headers`. */
  headers: WebhookHeaders;
};

function toBytes(body: MynthWebhookRequest["body"]): Uint8Array {
  if (typeof body === "string") return new TextEncoder().encode(body);

  return body instanceof Uint8Array ? body : new Uint8Array(body);
}

/**
 * Verify a signed Mynth webhook and return its event.
 *
 * Checks the Standard Webhooks signature over `webhook-id`, `webhook-timestamp`
 * and the raw body, rejects a timestamp more than five minutes off, and checks
 * that the body's `id` is the `webhook-id`. Deduplicate on `event.id`: every
 * delivery of the event repeats it.
 *
 * An event type newer than this SDK is returned as is, so keep a `default`
 * branch when you switch on `event.type`.
 *
 * @param secret - The webhook's `whsec_` secret. Defaults to MYNTH_WEBHOOK_SECRET.
 * @throws {MynthWebhookVerificationError} If the request is not a valid, signed event
 * @throws {Error} If there is no secret, or it is not a `whsec_` secret
 *
 * @example
 * ```typescript
 * const event = await verifyWebhook({ body: await request.text(), headers: request.headers });
 *
 * switch (event.type) {
 *   case "task.image.generate.completed":
 *     console.log(event.data.result.images);
 *     break;
 * }
 * ```
 */
export async function verifyWebhook(
  request: MynthWebhookRequest,
  secret: string | undefined = getWebhookSecretFromEnv(),
): Promise<MynthSDKTypes.WebhookEvent> {
  if (!secret) {
    throw new Error(
      "MYNTH_WEBHOOK_SECRET is required. Either pass the secret or set the environment variable.",
    );
  }

  const id = readHeader(request.headers, WEBHOOK_ID_HEADER);
  const timestamp = readHeader(request.headers, WEBHOOK_TIMESTAMP_HEADER);
  const signature = readHeader(request.headers, WEBHOOK_SIGNATURE_HEADER);

  if (!id || !timestamp || !signature) {
    throw new MynthWebhookVerificationError(
      `Missing ${[
        !id && WEBHOOK_ID_HEADER,
        !timestamp && WEBHOOK_TIMESTAMP_HEADER,
        !signature && WEBHOOK_SIGNATURE_HEADER,
      ]
        .filter(Boolean)
        .join(", ")} header. Only registered webhooks are signed.`,
    );
  }

  const body = toBytes(request.body);

  if (!(await verifySignature({ id, timestamp, signature, body, secret }))) {
    throw new MynthWebhookVerificationError(
      "The webhook signature does not match, or its timestamp is more than five minutes off.",
    );
  }

  const event = parseWebhookEvent(body, id);

  if (!event) {
    throw new MynthWebhookVerificationError(
      "The webhook body is not a Mynth event for this webhook-id.",
    );
  }

  return event;
}
