import { NextRequest, NextResponse } from "next/server";
import {
  getAuditById,
  updateAudit,
  newToken,
  countAuditsByEmailSince,
} from "@/lib/store";
import { takePendingRows } from "@/lib/pending";
import { runAuditPipeline } from "@/lib/report/run";
import { LIMITS, RECHECK_WINDOW_DAYS } from "@/lib/audit/thresholds";
import { RECHECK_COOKIE, verifyPayload } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/audit/[id]/email — attach the email (the report's only credential,
 * PRD F8), mint the report token, apply a free re-check if the caller holds
 * a valid grant (PRD F7), and start the audit pipeline.
 *
 * SECURITY: a re-check credit is NEVER granted on an email string match —
 * knowing a payer's email address proves nothing. The grant must arrive as
 * a signed, expiring cookie set either by the original paid report page
 * (holder of that report's secret token) or by the magic-link verify step
 * (holder of the payer's inbox). The grant names the source audit id and
 * the email it was issued to; both are re-validated here and the credit is
 * consumed exactly once.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as { email?: string };
  const email = (body.email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "That doesn't look like an email address." }, { status: 400 });
  }

  const audit = await getAuditById(id);
  if (!audit) return NextResponse.json({ error: "Audit not found." }, { status: 404 });
  if (audit.email) {
    return NextResponse.json({ token: audit.token }, { status: 200 });
  }

  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  if ((await countAuditsByEmailSince(email, dayStart.getTime())) >= LIMITS.FREE_AUDITS_PER_EMAIL_PER_DAY) {
    return NextResponse.json(
      { error: "This email has used today's 3 free audits. Please come back tomorrow." },
      { status: 429 },
    );
  }

  const rows = await takePendingRows(id);
  if (!rows) {
    return NextResponse.json(
      { error: "Your upload session expired (files are only held briefly). Please upload the export again." },
      { status: 410 },
    );
  }

  const token = newToken();
  const patch: Parameters<typeof updateAudit>[1] = {
    email,
    token,
    status: "processing",
    stage: "File received & checked",
  };

  // Free re-check: only via a signed grant naming this email + source audit.
  const grantRaw = req.cookies.get(RECHECK_COOKIE)?.value;
  if (grantRaw) {
    const grant = verifyPayload(grantRaw, "recheck");
    if (grant && grant.email === email) {
      const source = await getAuditById(grant.sid);
      const withinWindow =
        source !== null &&
        Date.now() - new Date(source.created_at).getTime() <=
          RECHECK_WINDOW_DAYS * 24 * 3600 * 1000;
      if (
        source &&
        source.id !== id &&
        source.email === grant.email &&
        source.paid &&
        source.paid_via === "creem" &&
        !source.recheck_used &&
        withinWindow
      ) {
        patch.paid = true;
        patch.paid_via = "recheck";
        patch.recheck_source_audit_id = source.id;
        await updateAudit(source.id, { recheck_used: true });
      }
    }
  }

  await updateAudit(id, patch);

  const origin = new URL(req.url).origin;
  // Fire-and-forget: the report page polls status until ready.
  void runAuditPipeline(id, rows, origin);

  const res = NextResponse.json({ token });
  // The grant cookie is single-use: consumed or stale, it never lingers.
  if (grantRaw) res.cookies.delete(RECHECK_COOKIE);
  return res;
}
