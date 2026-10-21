import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { purgeExpiredAudits } from "@/lib/store";
import { retryPendingRefunds } from "@/lib/refund";

export const dynamic = "force-dynamic";

/**
 * GET/POST /api/cron/cleanup — external scheduler entry point.
 *
 * Does two jobs:
 *  1. Retention: delete audits (and their orders / LLM records) older
 *     than 90 days — the deletion the privacy page promises. Reports are
 *     also expired lazily on read; this job is what removes data nobody
 *     ever opens again.
 *  2. Refund retries: re-attempt any order stuck in refund_pending.
 *
 * Auth: shared secret in CRON_SECRET, sent as
 * `Authorization: Bearer <secret>` (the header Vercel Cron sends when
 * CRON_SECRET is set) or `x-cron-secret: <secret>`. No secret configured
 * → 503; the endpoint never runs unauthenticated.
 * Scheduling: see vercel.json (daily cron) in the repo root / README.
 */
async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Cleanup endpoint is not configured (CRON_SECRET missing)." },
      { status: 503 },
    );
  }
  const presented =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    req.headers.get("x-cron-secret") ??
    "";
  const a = createHmac("sha256", "adaudit-cron").update(presented).digest();
  const b = createHmac("sha256", "adaudit-cron").update(secret).digest();
  if (!timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const purge = await purgeExpiredAudits();
  const refunds = await retryPendingRefunds();
  return NextResponse.json({ ok: true, purge, refunds });
}

export async function GET(req: NextRequest) {
  return handle(req);
}

export async function POST(req: NextRequest) {
  return handle(req);
}
