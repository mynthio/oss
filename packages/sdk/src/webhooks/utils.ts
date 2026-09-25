/** Environment variable used when no webhook secret is passed explicitly. */
const WEBHOOK_SECRET_ENV_VAR = "MYNTH_WEBHOOK_SECRET";

/** Maximum allowed distance between the signature timestamp and the local clock. */
export const SIGNATURE_TOLERANCE_SECONDS: number = 5 * 60;

/** Hex-encoded HMAC-SHA256 digests are always 32 bytes. */
const SIGNATURE_PATTERN = /^[0-9a-f]{64}$/i;
const TIMESTAMP_PATTERN = /^\d{1,15}$/;

const encoder = new TextEncoder();

/** Read the webhook secret without assuming a Node.js runtime. */
export function getWebhookSecretFromEnv(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[WEBHOOK_SECRET_ENV_VAR];
  }

  return undefined;
}

type ParsedSignatureHeader = {
  /** The timestamp exactly as sent, because the signed message uses its original digits. */
  timestamp: string;
  signatures: Uint8Array<ArrayBuffer>[];
};

function parseSignatureHeader(signatureHeader: string): ParsedSignatureHeader | null {
  let timestamp: string | undefined;
  const signatures: Uint8Array<ArrayBuffer>[] = [];

  for (const part of signatureHeader.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === "t" && TIMESTAMP_PATTERN.test(value)) {
      timestamp = value;
    } else if (key === "v1" && SIGNATURE_PATTERN.test(value)) {
      signatures.push(hexToBytes(value));
    }
  }

  if (timestamp === undefined || signatures.length === 0) return null;

  return { timestamp, signatures };
}

/**
 * Verify a Mynth HMAC-SHA256 signature against the raw request body.
 *
 * Rejects timestamps more than five minutes from `now` to limit replays. The
 * comparison runs inside Web Crypto, so it does not leak timing information.
 */
export async function verifySignature(
  body: Uint8Array<ArrayBuffer>,
  signatureHeader: string,
  secret: string,
  now: number = Date.now(),
): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  const ageSeconds = Math.floor(now / 1000) - Number(parsed.timestamp);
  if (Math.abs(ageSeconds) > SIGNATURE_TOLERANCE_SECONDS) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const message = concatBytes(encoder.encode(`${parsed.timestamp}.`), body);

  for (const signature of parsed.signatures) {
    if (await crypto.subtle.verify("HMAC", key, signature, message)) return true;
  }

  return false;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);

  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }

  return bytes;
}

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(a.length + b.length);
  bytes.set(a);
  bytes.set(b, a.length);

  return bytes;
}
