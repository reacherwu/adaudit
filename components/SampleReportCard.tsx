/**
 * The sample report card on the landing page.
 * DEMO DATA — written by hand to show the report's shape, rendered from the
 * example in PRD §6, and visibly labelled SAMPLE everywhere it appears
 * (PRD F1.4 / DESIGN §3.4). It is not a real user's report and claims nothing.
 */
export function SampleReportCard({ compact = false }: { compact?: boolean }) {
  return (
    <div className="card" style={{ position: "relative" }}>
      <span className="sample-badge" style={{ position: "absolute", top: 14, right: 14 }}>Sample</span>
      <p className="muted small" style={{ marginBottom: 6 }}>Audit report — demo account</p>
      <div style={{ display: "flex", gap: 20, alignItems: "baseline", flexWrap: "wrap" }}>
        <span className="score-num" style={{ fontSize: 52, color: "var(--amber)" }}>47</span>
        <span>
          <span className="score-grade" style={{ color: "var(--amber)" }}>/100 — Wasteful</span>
          <br />
          <span className="muted">Estimated waste last 30 days: </span>
          <strong className="waste-amount num">$612 (estimated)</strong>
        </span>
      </div>
      <div style={{ marginTop: 16 }}>
        <p style={{ marginBottom: 8 }}>
          <span className="sev high">HIGH</span>
          <strong>3 ad sets spent $847 with zero conversions</strong>
        </p>
        {!compact && (
          <>
            <p style={{ marginBottom: 8 }}>
              <span className="sev high">HIGH</span>
              <strong>No conversion tracking detected</strong>
            </p>
            <p style={{ marginBottom: 8 }}>
              <span className="sev medium">MED</span>
              <strong>Frequency hit 6.2 on “Retargeting — 30d”</strong>
            </p>
            <p className="muted" style={{ marginBottom: 4 }}>
              🔒 Fix checklist — 6 fixes, ordered by priority <span className="locked-blocks">████ ████████</span>
            </p>
          </>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
        Sample report generated from demo data. Your numbers will differ.
      </p>
    </div>
  );
}
