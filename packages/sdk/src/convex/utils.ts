/** Environment variable name for the webhook secret */
const WEBHOOK_SECRET_ENV_VAR = "MYNTH_WEBHOOK_SECRET";

/**
 * Attempts to read the webhook secret from environment variables.
 * @internal
 */
export const tryToGetWebhookSecretFromEnv = (): string | undefined => {
  if (typeof process !== "undefined" && process.env) {
    return process.env[WEBHOOK_SECRET_ENV_VAR];
  }
  return undefined;
};

/**
 * Parse the signature header format: `t={timestamp},v1={signature}`
 * @internal
 */
function parseSignatureHeader(signatureHeader: string): {
  timestamp: string;
  signature: string;
} | null {
  const parts = signatureHeader.split(",");
  let timestamp: string | undefined;
  let signature: string | undefined;

  for (const part of parts) {
    const [key, value] = part.split("=");
    if (key === "t") {
      timestamp = value;
    } else if (key === "v1") {
      signature = value;
    }
  }

  if (!timestamp || !signature) {
    return null;
  }

  return { timestamp, signature };
}

/**
 * Verifies the HMAC-SHA256 signature of a webhook payload.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param body - The raw request body
 * @param signatureHeader - The X-Mynth-Signature header value
 * @param secret - The webhook secret
 * @returns True if the signature is valid
 * @internal
 */
export async function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string,
): Promise<boolean> {
  // Parse the signature header to extract timestamp and signature
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) {
    return false;
  }

  const { timestamp, signature } = parsed;

  // Recreate the signed message: `{timestamp}.{body}` (same as signing)
  const message = `${timestamp}.${body}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signed = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  const expected = toHex(new Uint8Array(signed));

  return timingSafeEqual(expected, signature);
}

/** Convert bytes to hex string */
function toHex(bytes: Uint8Array): string {
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

/** Timing-safe string comparison to prevent timing attacks */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
