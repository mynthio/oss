/** Environment variable used when no webhook secret is passed explicitly. */
const WEBHOOK_SECRET_ENV_VAR = "MYNTH_WEBHOOK_SECRET";

/** Read the webhook secret without assuming a Node.js runtime. */
export function getWebhookSecretFromEnv(): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    return process.env[WEBHOOK_SECRET_ENV_VAR];
  }

  return undefined;
}

function parseSignatureHeader(signatureHeader: string): {
  timestamp: number;
  signatures: string[];
} | null {
  let timestamp: number | undefined;
  const signatures: string[] = [];

  for (const part of signatureHeader.split(",")) {
    const [key, value] = part.trim().split("=", 2);

    if (key === "t" && value !== undefined) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) timestamp = parsed;
    } else if (key === "v1" && value) {
      signatures.push(value);
    }
  }

  if (timestamp === undefined || signatures.length === 0) return null;

  return { timestamp, signatures };
}

/** Verify a Mynth HMAC-SHA256 signature against the unmodified request body. */
export async function verifySignature(
  body: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds?: number,
): Promise<boolean> {
  const parsed = parseSignatureHeader(signatureHeader);
  if (!parsed) return false;

  if (
    toleranceSeconds !== undefined &&
    Math.abs(Math.floor(Date.now() / 1000) - parsed.timestamp) > toleranceSeconds
  ) {
    return false;
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`${parsed.timestamp}.${body}`),
  );
  const expected = toHex(new Uint8Array(signed));

  return parsed.signatures.some((signature) => timingSafeEqual(expected, signature));
}

function toHex(bytes: Uint8Array): string {
  let hex = "";

  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
