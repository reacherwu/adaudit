import { NextRequest, NextResponse } from "next/server";
import { findRecheckCandidateByEmail } from "@/lib/store";
import { signPayload } from "@/lib/auth";
import { sendRecheckEmail } from "@/lib/mail";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/recheck/request { email } — email a signed magic link that
 * activates the free re-check included with a paid report. Proof of
 * ownership is control of the payer's inbox, never the email string
 * itself: the link carries an HMAC-signed, 1-hour token naming the source
 * audit. The response is identical whether or not a credit exists, so
 * this endpoint can't be used to probe who has paid.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const candidate = await findRecheckCandidateByEmail(email);
  if (candidate) {
    const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
    const link = `${origin}/recheck/verify?t=${signPayload({
      purpose: "recheck",
      sid: candidate.id,
      email,
      ttlMs: 3600 * 1000,
    })}`;
    await sendRecheckEmail(email, link);
  }

  return NextResponse.json({
    ok: true,
    message: "If that email has a free re-check available, we've sent a link to activate it.",
  });
}
