import { NextRequest, NextResponse } from "next/server";
import { getAuditByToken, expireAuditIfNeeded } from "@/lib/store";
import { buildReportPdf } from "@/lib/pdf";

/** GET /api/report/[token]/pdf — full report PDF, paid reports only.
 *  Expired reports (90-day retention) are deleted on read and answer 410. */
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
  if (audit.status !== "ready" || !audit.narrative || !audit.aggregates) {
    return NextResponse.json({ error: "Report isn't ready yet." }, { status: 409 });
  }
  if (!audit.paid) {
    return NextResponse.json({ error: "The PDF is part of the full report ($49)." }, { status: 402 });
  }
  try {
    const pdf = await buildReportPdf(audit);
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="adaudit-report.pdf"`,
      },
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't build the PDF just now — try again in a minute, or email us and we'll send it." },
      { status: 500 },
    );
  }
}
