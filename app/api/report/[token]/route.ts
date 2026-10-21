import { NextRequest, NextResponse } from "next/server";
import { getAuditByToken, expireAuditIfNeeded } from "@/lib/store";
import { buildReportView } from "@/lib/report/view";

/**
 * GET /api/report/[token] — the paywall-enforced JSON view (PRD F7, §9.4).
 * Unpaid reports are trimmed server-side by buildReportView: locked
 * findings carry no evidence, no amounts, no fix text.
 * Expired reports (90-day retention) are deleted on read and answer 410.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const audit = await getAuditByToken(token);
  if (!audit) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  const expiry = await expireAuditIfNeeded(audit);
  if (expiry !== "not_expired") {
    return NextResponse.json(
      { error: "This report has expired and its data has been deleted.", expired: true },
      { status: 410 },
    );
  }
  return NextResponse.json(buildReportView(audit));
}
