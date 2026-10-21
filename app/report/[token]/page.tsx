import { notFound } from "next/navigation";
import { getAuditByToken, expireAuditIfNeeded } from "@/lib/store";
import { buildReportView } from "@/lib/report/view";
import { ReportClient } from "@/components/ReportClient";

export const metadata = {
  title: "Your audit report — AdAudit",
  robots: { index: false, follow: false }, // PRD F9: report pages are noindex
};
export const dynamic = "force-dynamic";

export default async function ReportPage(ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const audit = await getAuditByToken(token);
  if (!audit) {
    return (
      <main className="section">
        <div className="report-wrap">
          <div className="card">
            <h2>This report link doesn&apos;t work</h2>
            <p>
              The link was copied incompletely, or the report is no longer available.
            </p>
            <p>
              <a className="btn" href="mailto:service@adaudit.app">Contact support</a>{" "}
              <a className="btn secondary" href="/">Back to home</a>
            </p>
          </div>
        </div>
      </main>
    );
  }
  // Retention (90 days): an expired report is never served. Reading it
  // lazily deletes it (unless a refund is still pending on its order, in
  // which case deletion waits but the content still stops being served).
  const expiry = await expireAuditIfNeeded(audit);
  if (expiry !== "not_expired") {
    return (
      <main className="section">
        <div className="report-wrap">
          <div className="card">
            <h2>This report has expired</h2>
            <p>
              Reports are kept for 90 days and then automatically deleted — this one has passed
              that date, so its data has been removed, as promised in our privacy policy.
            </p>
            <p>
              <a className="btn" href="/audit">Run a new audit</a>{" "}
              <a className="btn secondary" href="mailto:service@adaudit.app">Contact support</a>
            </p>
          </div>
        </div>
      </main>
    );
  }
  return (
    <main>
      <div className="report-wrap" style={{ paddingTop: 8 }}>
        <p className="muted" style={{ paddingTop: 14, margin: 0 }}>
          <strong style={{ color: "var(--ink)" }}>Ad<span style={{ color: "var(--brand)" }}>Audit</span></strong>
        </p>
      </div>
      <ReportClient token={token} initial={buildReportView(audit)} />
    </main>
  );
}
