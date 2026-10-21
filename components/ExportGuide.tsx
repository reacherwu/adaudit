import { REQUIRED_COLUMN_LABELS } from "@/lib/audit/columns";

/** Three-layer export guide (DESIGN §4.2): mini steps always visible,
 *  full guide as a section, required-columns table expandable. The column
 *  names come from the same constants the parser uses. */
export function ExportGuideSteps() {
  return (
    <div>
      <div className="steps">
        <div className="step">
          <b>Step 1</b>
          Open <strong>Ads Manager</strong> → pick your ad account → set the date range to <strong>Last 30 days</strong>
        </div>
        <div className="step">
          <b>Step 2</b>
          Go to the <strong>Ad sets</strong> tab (or Ads, if you prefer ad level)
        </div>
        <div className="step">
          <b>Step 3</b>
          <strong>Columns → Customize Columns</strong> → tick the required columns (list below)
        </div>
        <div className="step">
          <b>Step 4</b>
          <strong>Export</strong> → CSV or Excel → upload the file here
        </div>
      </div>
      <details className="more">
        <summary>The required columns — tick these in Ads Manager</summary>
        <div className="body">
          <p>Ticking extra columns is fine — missing one of these is what breaks the export.</p>
          <table className="cols">
            <thead>
              <tr><th>Column in Ads Manager</th><th>Why we need it</th></tr>
            </thead>
            <tbody>
              {REQUIRED_COLUMN_LABELS.map((c) => (
                <tr key={c.field}><td>{c.label}</td><td className="muted">{c.why}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

export function ExportGuideFull() {
  return (
    <div>
      <ExportGuideSteps />
      <div className="alert warn" style={{ marginTop: 14 }}>
        The #1 mistake: forgetting the <strong>Results</strong> and <strong>Cost per result</strong> columns.
        Without them we can&apos;t measure waste.
      </div>
      <p className="muted">
        Use the last 30 days. Shorter ranges make the audit unreliable; we&apos;ll tell you if your file
        covers too little data to audit.
      </p>
    </div>
  );
}
