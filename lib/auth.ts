// Web Crypto only (no Node 'crypto'/'Buffer') so this module works in both
// the Node.js API routes and the Edge middleware runtime.

const COOKIE_NAME = "session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET env var is not set");
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return toHex(signature);
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

// Single-user auth: no user table, just a shared admin password and a
// signed, expiring cookie. Good enough for a personal one-user tool.
export async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const signature = await hmacSha256Hex(getSecret(), payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(token: string | undefined | null): Promise<boolean> {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = await hmacSha256Hex(getSecret(), payload);
  if (!timingSafeEqualStr(signature, expected)) return false;

  const expiresAt = Number(payload);
  return Number.isFinite(expiresAt) && Date.now() < expiresAt;
}

export function verifyPassword(candidate: string): boolean {
  const actual = process.env.ADMIN_PASSWORD;
  if (!actual) {
    throw new Error("ADMIN_PASSWORD env var is not set");
  }
  return timingSafeEqualStr(candidate, actual);
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
