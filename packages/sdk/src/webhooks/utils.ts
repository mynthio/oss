import type { MynthSDKTypes } from "../types.ts";

/** Environment variable used when no webhook secret is passed explicitly. */
const WEBHOOK_SECRET_ENV_VAR = "MYNTH_WEBHOOK_SECRET";

/** Maximum allowed distance between `webhook-timestamp` and the local clock. */
export const WEBHOOK_TOLERANCE_SECONDS: number = 5 * 60;

/** Standard Webhooks headers (https://www.standardwebhooks.com). */
export const WEBHOOK_ID_HEADER = "webhook-id";
export const WEBHOOK_TIMESTAMP_HEADER = "webhook-timestamp";
export const WEBHOOK_SIGNATURE_HEADER = "webhook-signature";

const SECRET_PREFIX = "whsec_";
const TIMESTAMP_PATTERN = /^\d{1,15}$/;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

const encoder = new TextEncoder();

/** Read the webhook secret without assuming a Node.js runtime. */
export function getWebhookSecretFromEnv(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[WEBHOOK_SECRET_ENV_VAR];
  }

  return undefined;
}

/** The headers of a webhook request, from a `Headers` or a Node-style header object. */
export type WebhookHeaders = Headers | Record<string, string | string[] | undefined>;

/** A header by name, ignoring case. A repeated header reads as its first value. */
export function readHeader(headers: WebhookHeaders, name: string): string | undefined {
  if (typeof Headers !== "undefined" && headers instanceof Headers) {
    return headers.get(name) ?? undefined;
  }

  const record = headers as Record<string, string | string[] | undefined>;
  const key = Object.keys(record).find((candidate) => candidate.toLowerCase() === name);
  const value = key === undefined ? undefined : record[key];

  return Array.isArray(value) ? value[0] : value;
}

/** The bytes a base64 string encodes, or `null` when it is not valid base64. */
function base64ToBytes(value: string): Uint8Array<ArrayBuffer> | null {
  if (!BASE64_PATTERN.test(value)) return null;

  let binary: string;

  try {
    // throws on what the pattern lets through but base64 cannot be, such as a bad length
    binary = atob(value);
  } catch {
    return null;
  }

  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

/**
 * The HMAC key a `whsec_` secret stands for: the bytes it encodes.
 *
 * @throws {Error} If the secret is not one Mynth issued, which is a setup problem
 */
function secretKeyBytes(secret: string): Uint8Array<ArrayBuffer> {
  const bytes = base64ToBytes(
    secret.startsWith(SECRET_PREFIX) ? secret.slice(SECRET_PREFIX.length) : secret,
  );

  if (!bytes) {
    throw new Error(
      `The Mynth webhook secret is not valid. Copy it from the dashboard: it starts with "${SECRET_PREFIX}".`,
    );
  }

  return bytes;
}

/** Every `v1` signature in a space-separated `webhook-signature` header. */
function v1Signatures(header: string): Uint8Array<ArrayBuffer>[] {
  return header.split(" ").flatMap((entry) => {
    const separator = entry.indexOf(",");
    if (separator === -1 || entry.slice(0, separator) !== "v1") return [];

    const signature = base64ToBytes(entry.slice(separator + 1));
    return signature ? [signature] : [];
  });
}

function concatBytes(...parts: Uint8Array[]): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;

  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }

  return bytes;
}

/**
 * Verify a Standard Webhooks signature: HMAC-SHA256 over
 * `<webhook-id>.<webhook-timestamp>.<body>`, keyed with the secret's bytes.
 *
 * Accepts any matching `v1` signature in the header, and rejects a timestamp
 * more than five minutes from `now` to limit replays. The comparison runs
 * inside Web Crypto, so it does not leak timing information.
 *
 * @throws {Error} If the secret is not a valid `whsec_` secret
 */
export async function verifySignature({
  id,
  timestamp,
  signature,
  body,
  secret,
  now = Date.now(),
}: {
  id: string;
  timestamp: string;
  signature: string;
  body: Uint8Array;
  secret: string;
  now?: number;
}): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );

  if (!TIMESTAMP_PATTERN.test(timestamp)) return false;

  const ageSeconds = Math.floor(now / 1000) - Number(timestamp);
  if (Math.abs(ageSeconds) > WEBHOOK_TOLERANCE_SECONDS) return false;

  const message = concatBytes(encoder.encode(`${id}.${timestamp}.`), body);

  for (const candidate of v1Signatures(signature)) {
    if (await crypto.subtle.verify("HMAC", key, candidate, message)) return true;
  }

  return false;
}

/**
 * Read a webhook body as an event, or `null` when it is not one: not JSON, not
 * shaped like an event, or with an `id` other than the `webhook-id` header.
 */
export function parseWebhookEvent(body: Uint8Array, id: string): MynthSDKTypes.WebhookEvent | null {
  let event: unknown;
  try {
    event = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch {
    return null;
  }

  if (
    typeof event !== "object" ||
    event === null ||
    !("id" in event) ||
    event.id !== id ||
    !("type" in event) ||
    typeof event.type !== "string" ||
    !("timestamp" in event) ||
    typeof event.timestamp !== "string" ||
    !("data" in event) ||
    typeof event.data !== "object" ||
    event.data === null ||
    !("id" in event.data) ||
    typeof event.data.id !== "string"
  ) {
    return null;
  }

  return event as MynthSDKTypes.WebhookEvent;
}
