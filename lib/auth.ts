/**
 * Small auth primitives shared by the re-check flow.
 *
 * - Signed payloads (HMAC-SHA256): used for the re-check grant cookie and
 *   the email magic link. A payload proves "the holder controls the email /
 *   report token it was issued for" without any server-side session table.
 * - getClientIp: rate limiting must key on an IP the client cannot forge.
 *   `X-Forwarded-For`'s FIRST entry is client-supplied and trivially
 *   spoofable, so it is never trusted; platform-injected headers win, and
 *   the LAST XFF entry (appended by the closest trusted proxy) is the
 *   fallback before giving up.
 */

import { NextRequest } from "next/server";
import { createHmac, timingSafeEqual, randomBytes } from "crypto";
import { readFileSync, writeFileSync, mkdirSync } from "fs";
import path from "path";

export const RECHECK_COOKIE = "adaudit_recheck";

let cachedSecret: string | null = null;

function signingSecret(): string {
  if (cachedSecret) return cachedSecret;
  const env =
    process.env.AUTH_SECRET || process.env.CREEM_WEBHOOK_SECRET || process.env.ADMIN_KEY;
  if (env) {
    cachedSecret = env;
    return env;
  }
  // No configured secret (local dev): persist a random one next to the data
  // store so links survive restarts but are never guessable.
  const dir = process.env.DATA_DIR || path.join(process.cwd(), "data");
  const file = path.join(dir, ".auth-secret");
  try {
    cachedSecret = readFileSync(file, "utf-8").trim();
    if (cachedSecret) return cachedSecret;
  } catch {
    /* fall through to generation */
  }
  cachedSecret = randomBytes(32).toString("hex");
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, cachedSecret, { mode: 0o600 });
  } catch {
    /* in-memory only — links simply stop working on restart (fail-closed) */
  }
  return cachedSecret;
}

export interface SignedPayload {
  purpose: string;
  /** source audit id the grant applies to */
  sid: string;
  email: string;
  /** expiry, epoch ms */
  exp: number;
}

export function signPayload(input: {
  purpose: string;
  sid: string;
  email: string;
  ttlMs: number;
}): string {
  const payload: SignedPayload = {
    purpose: input.purpose,
    sid: input.sid,
    email: input.email,
    exp: Date.now() + input.ttlMs,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const sig = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyPayload(token: string, purpose: string): SignedPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac("sha256", signingSecret()).update(body).digest("base64url");
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf-8")) as SignedPayload;
    if (payload.purpose !== purpose) return null;
    if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (!payload.sid || !payload.email) return null;
    return payload;
  } catch {
    return null;
  }
}

/** Client IP for rate limiting — never the spoofable first XFF entry. */
export function getClientIp(req: NextRequest): string {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const vercel = req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }
  return "local";
}
