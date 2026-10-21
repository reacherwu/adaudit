import { NextRequest, NextResponse } from "next/server";
import { getAuditByToken } from "@/lib/store";
import { RECHECK_COOKIE, signPayload } from "@/lib/auth";
import { RECHECK_WINDOW_DAYS } from "@/lib/audit/thresholds";

/**
 * POST /api/report/[token]/recheck-grant — start a free re-check from the
 * original paid report page. Possession of the report's secret token (the
 * report's only credential) is what authorizes this: the response sets a
 * signed, expiring grant cookie naming the source audit + its email. The
 * credit itself is only consumed later, in the email step, after the
 * grant is re-validated against the source audit.
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const audit = await getAuditByToken(token);
  if (!audit) return NextResponse.json({ error: "Report not found." }, { status: 404 });

  const unavailable = (error: string) => NextResponse.json({ error }, { status: 409 });
  if (!audit.paid || audit.paid_via !== "creem" || !audit.email) {
    return unavailable("A free re-check is only included with a paid report.");
  }
  if (audit.recheck_used) {
    return unavailable("This report's free re-check has already been used.");
  }
  if (
    Date.now() - new Date(audit.created_at).getTime() >
    RECHECK_WINDOW_DAYS * 24 * 3600 * 1000
  ) {
    return unavailable("The 30-day free re-check window for this report has closed.");
  }

  const res = NextResponse.json({ ok: true, next: "/audit" });
  res.cookies.set(
    RECHECK_COOKIE,
    signPayload({
      purpose: "recheck",
      sid: audit.id,
      email: audit.email,
      ttlMs: 2 * 3600 * 1000,
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 2 * 3600,
      secure: process.env.NODE_ENV === "production",
    },
  );
  return res;
}
