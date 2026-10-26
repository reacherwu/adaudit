"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ReportView } from "@/lib/report/view";
import { symbolForCurrency } from "@/lib/audit/currency";

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function gradeColor(score: number): string {
  if (score >= 80) return "var(--green)";
  if (score >= 40) return "var(--amber)";
  return "var(--red)";
}

export function ReportClient({ token, initial }: { token: string; initial: ReportView }) {
  const [view, setView] = useState<ReportView>(initial);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [recheckBusy, setRecheckBusy] = useState(false);
  const [recheckError, setRecheckError] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [paidParam] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("paid") === "1",
  );
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const startedAt = useRef(Date.now());

  const refresh = useCallback(async () => {
    try {
      const resp = await fetch(`/api/report/${token}`, { cache: "no-store" });
      if (resp.ok) setView((await resp.json()) as ReportView);
    } catch { /* transient; next poll retries */ }
  }, [token]);

  // Poll while processing, and for up to 30s after a ?paid=1 return while the
  // webhook unlock lands (DESIGN §8.1 — never show a paid user the paywall).
  useEffect(() => {
    const needsPoll =
      view.status === "processing" ||
      (paidParam && !view.paid && Date.now() - startedAt.current < 30_000);
    if (!needsPoll) return;
    const t = setInterval(refresh, 2500);
    return () => clearInterval(t);
  }, [view.status, view.paid, paidParam, refresh]);

  // Track consecutive payment failures via sessionStorage so a fresh
  // redirect back doesn't reset the "stuck? email us" logic (DESIGN §8.2).
  useEffect(() => {
    const failed = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("payment") === "failed";
    if (failed) {
      const key = `adaudit-payfails-${token}`;
      const n = Number(sessionStorage.getItem(key) || 0) + 1;
      sessionStorage.setItem(key, String(n));
      setFailCount(n);
    }
  }, [token]);

  async function unlock() {
    setUnlocking(true);
    setUnlockError(null);
    try {
      const resp = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const body = (await resp.json().catch(() => ({}))) as { checkout_url?: string; error?: string };
      if (!resp.ok || !body.checkout_url) {
        setUnlockError(body.error || "The payment page couldn't be opened. Please try again in a moment.");
        return;
      }
      window.location.href = body.checkout_url;
    } catch {
      setUnlockError("The payment page couldn't be opened. Please try again in a moment.");
    } finally {
      setUnlocking(false);
    }
  }

  async function startRecheck() {
    setRecheckBusy(true);
    setRecheckError(null);
    try {
      const resp = await fetch(`/api/report/${token}/recheck-grant`, { method: "POST" });
      const body = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setRecheckError(body.error || "The free re-check couldn't be started. Please try again.");
        return;
      }
      window.location.href = "/audit";
    } catch {
      setRecheckError("The free re-check couldn't be started. Please try again.");
    } finally {
      setRecheckBusy(false);
    }
  }

  // ---------- failed ----------
  if (view.status === "failed") {
    return (
      <div className="card">
        <h2>We couldn&apos;t finish your audit</h2>
        <p>
          Something went wrong while generating your report. You haven&apos;t been charged — and if a
          payment somehow did go through, it will be refunded automatically.
        </p>
        <p>
          <a className="btn secondary" href="/audit">Start over</a>{" "}
          <a className="btn" href="mailto:service@adaudit.app">Contact us</a>
        </p>
      </div>
    );
  }

  // ---------- processing ----------
  if (view.status === "processing" || view.status === "awaiting_email") {
    const elapsed = Date.now() - startedAt.current;
    const stages = [
      { label: "File received & checked", done: true },
      { label: "12 checks run against your data", done: view.stage === "Writing your report" || view.stage === "Preparing your preview" },
      { label: "Writing your report", done: view.stage === "Preparing your preview" },
      { label: "Preparing your preview", done: false },
    ];
    const activeIdx = stages.findIndex((s) => !s.done);
    return (
      <div className="card">
        <h2><span className="spinner" /> Auditing your account…</h2>
        <ul className="stage-list">
          {stages.map((s, i) => (
            <li key={s.label} className={s.done ? "done" : i === activeIdx ? "" : "todo"}>
              {s.done ? "✓" : i === activeIdx ? "◌" : "○"} {s.label}
            </li>
          ))}
        </ul>
        <p className="muted">
          This usually takes 1–3 minutes. You can close this page — we&apos;ll email the link to{" "}
          {view.email_masked ?? "you"} when it&apos;s ready.
        </p>
        {elapsed > 180_000 && (
          <div className="alert warn">
            Taking longer than usual — this can happen with larger accounts. We&apos;ll email you the
            moment it&apos;s ready. You can safely leave this page.
          </div>
        )}
      </div>
    );
  }

  // ---------- ready ----------
  const score = view.health_score ?? 0;
  const fullFixItems = view.fixes?.mode === "full" ? view.fixes.items : [];
  const unlockingWait = paidParam && !view.paid;
  const showPaidBanner = paidParam && view.paid && !bannerDismissed;

  return (
    <div>
      {failCount > 0 && !view.paid && (
        <div className="alert error">
          <strong>✗ Your payment didn&apos;t go through.</strong> No charge was made. Your preview is
          still here — pick up right where you left off.{" "}
          <button className="btn" onClick={unlock} disabled={unlocking} style={{ minHeight: 38, padding: "6px 14px", fontSize: 14.5 }}>
            {unlocking ? "Opening…" : "Try again — $49"}
          </button>
          {failCount >= 3 && (
            <div style={{ marginTop: 8 }}>
              Still stuck? Email us at <a href="mailto:service@adaudit.app">service@adaudit.app</a> — we&apos;ll sort it out.
            </div>
          )}
        </div>
      )}
      {unlockingWait && (
        <div className="alert info">
          <span className="spinner" /> Payment received — unlocking your report… this takes a few seconds.
        </div>
      )}
      {showPaidBanner && (
        <div className="alert success">
          ✓ Payment received — your full report is unlocked.{" "}
          <button onClick={() => setBannerDismissed(true)} style={{ background: "none", border: "none", cursor: "pointer", fontWeight: 700, color: "inherit" }}>
            Dismiss
          </button>
        </div>
      )}

      {!view.paid && !unlockingWait && (
        <div className="sticky-unlock">
          <div className="report-wrap">
            <span>Free preview — 1 of {view.issue_count} issues shown in full.</span>
            <button className="btn" onClick={unlock} disabled={unlocking}>
              {unlocking ? "Opening…" : "Unlock full report — $49"}
            </button>
          </div>
        </div>
      )}
      {unlockError && <div className="alert error">{unlockError}</div>}

      <div style={{ padding: "26px 0" }}>
        <p className="muted small">
          AdAudit — Audit report · Generated {new Date(view.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })} ·
          Data: last 30 days{view.email_masked ? ` · Report for ${view.email_masked}` : ""}
        </p>
        {view.paid && (
          <p className="small" style={{ color: "var(--green)" }}>
            ✓ Full report unlocked{view.recheck?.source ? " (via your free re-check)" : ""}
          </p>
        )}

        <div className="card score-card" style={{ margin: "14px 0 22px" }}>
          <span className="score-num" style={{ color: gradeColor(score) }}>{score}</span>
          <span>
            <span className="score-grade" style={{ color: gradeColor(score) }}>/100 — {view.grade}</span>
            <br />
            <span className="muted">{view.score_reason}</span>
            <br />
            <span>
              {view.total_waste !== null ? (
                <>
                  Estimated waste last 30 days:{" "}
                  <strong className="waste-amount num">{symbolForCurrency(view.currency)}{money(view.total_waste)} (estimated)</strong>
                </>
              ) : (
                <>
                  Estimated waste last 30 days:{" "}
                  <strong>🔒 unlock the full report to see the exact total</strong>
                </>
              )}
            </span>
          </span>
        </div>

        {view.narrative_source === "template" && (
          <p className="small muted">Summary generated from rule data.</p>
        )}

        <h3>Executive summary</h3>
        <p>{view.executive_summary}</p>

        <h3 style={{ marginTop: 26 }}>Waste list — {view.issue_count} issue{view.issue_count === 1 ? "" : "s"} found</h3>
        {view.findings.length === 0 ? (
          <div className="card" style={{ borderLeft: "3px solid var(--green)" }}>
            <strong>No waste found in the checks we run.</strong> Your account passed all 12 checks for
            this period.
          </div>
        ) : (
          view.findings.map((f, i) => (
            <div className="card waste-card" key={f.rule_id}>
              <h3>
                {i + 1}. <span className={`sev ${f.severity}`}>{f.severity.toUpperCase()}</span>
                {f.title}
              </h3>
              {f.locked ? (
                <>
                  <p className="evidence">
                    Evidence: <span className="locked-blocks">████ ██████ ████</span>
                  </p>
                  <p className="muted">🔒 Unlock the full report to see the evidence, the estimated waste, and how to fix it.</p>
                </>
              ) : (
                <>
                  <p className="evidence">Evidence: {f.evidence_text}</p>
                  {f.why_it_matters && <p>Why it matters: {f.why_it_matters}</p>}
                  {f.waste_usd !== null ? (
                    <p>Estimated waste: <strong className="waste-amount num">{symbolForCurrency(view.currency)}{money(f.waste_usd)} (estimated)</strong>
                      {f.waste_note ? <span className="muted"> — {f.waste_note}</span> : null}
                    </p>
                  ) : (
                    <p className="muted">{f.note ?? "No waste amount estimated for this item."}</p>
                  )}
                  {f.note && f.waste_usd !== null && (
                    <p className="small muted" style={{ fontStyle: "italic" }}>{f.note}</p>
                  )}
                  {f.applies_to && f.applies_to.length > 0 && (
                    <p className="small muted">Applies to: {f.applies_to.map((n) => `“${n}”`).join(", ")}</p>
                  )}
                </>
              )}
            </div>
          ))
        )}

        {!view.paid && !unlockingWait && view.findings.length > 0 && (
          <div className="card highlight" style={{ margin: "22px 0" }}>
            <h3>Unlock the full report</h3>
            <ul>
              <li>All {view.issue_count} waste items — with evidence &amp; amounts</li>
              <li>The full fix checklist, ordered by priority</li>
              <li>PDF download for your records</li>
              <li>1 free re-check within 30 days</li>
            </ul>
            <button className="btn" onClick={unlock} disabled={unlocking}>
              {unlocking ? "Opening…" : "Unlock now — $49 one-time"}
            </button>
            <p className="small muted" style={{ marginTop: 10, marginBottom: 0 }}>
              One-time payment. Not a subscription. If we can&apos;t generate your report, you&apos;re
              refunded automatically.
            </p>
          </div>
        )}

        <h3 style={{ marginTop: 26 }}>Fix checklist</h3>
        {view.fixes?.mode === "full" ? (
          <div>
            {["This week", "This month", "Later"].map((group) => {
              const items = fullFixItems.filter((x) => x.group_label === group);
              if (items.length === 0) return null;
              return (
                <div key={group}>
                  <h4 className="fix-group">{group}</h4>
                  {items.map((item) => (
                    <div className="fix-item" key={item.key}>
                      <strong>[{item.priority}] {item.action}</strong>
                      <div className="fix-path">{item.path}</div>
                      <div className="muted" style={{ fontSize: 14.5 }}>Expected effect: {item.expected}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ) : view.fixes?.mode === "counts" ? (
          <div>
            {view.fixes.counts.map((c) => (
              <p key={c.label} style={{ marginBottom: 6 }}>
                <strong>{c.label}</strong> — {c.count} fix{c.count === 1 ? "" : "es"}{" "}
                <span className="muted">🔒 <span className="locked-blocks">████████████</span></span>
              </p>
            ))}
          </div>
        ) : null}

        <h3 style={{ marginTop: 26 }}>What&apos;s working</h3>
        {view.whats_working ? (
          <p>{view.whats_working}</p>
        ) : (
          <p className="muted">
            🔒 <span className="locked-blocks">████████████████████</span> — unlock the full report to
            see which ad sets are carrying this account.
          </p>
        )}

        {view.paid && (
          <div className="card" style={{ marginTop: 26 }}>
            <p style={{ marginBottom: 10 }}>
              <a className="btn secondary" href={`/api/report/${token}/pdf`}>Download PDF</a>{" "}
              <span className="muted">Same content as this page, with date and methodology notes.</span>
            </p>
            {view.recheck?.used ? (
              <p className="muted" style={{ margin: 0 }}>Your free re-check has been used.</p>
            ) : view.recheck?.source ? (
              <p className="muted" style={{ margin: 0 }}>
                This report was generated with the free re-check from an earlier paid report.
              </p>
            ) : (
              <div style={{ margin: 0 }}>
                <p style={{ margin: "0 0 8px" }}>
                  Fixed things? This report includes 1 free re-check within 30 days.
                </p>
                <button className="btn secondary" onClick={startRecheck} disabled={recheckBusy}>
                  {recheckBusy ? "Starting…" : "Start free re-check"}
                </button>
                {recheckError && <p className="small" style={{ color: "var(--red)", margin: "8px 0 0" }}>{recheckError}</p>}
                <p className="small muted" style={{ margin: "8px 0 0" }}>
                  You&apos;ll upload a fresh export; use the same email address ({view.email_masked}) when asked.
                </p>
              </div>
            )}
          </div>
        )}

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "30px 0 16px" }} />
        {view.data_notes?.map((n, i) => (
          <p className="small muted" key={i}>
            Note on your data: {n}
          </p>
        ))}
        <p className="small muted">
          How this score works: the score is a heuristic based on the checks above — not an industry
          standard. Waste figures marked (estimated) are estimates from your own data; each item shows
          its math.
        </p>
        <p className="small muted">
          Your uploaded file was processed in memory and never stored. This report and its summary data
          are kept for 90 days, then deleted.{" "}
          <a href="mailto:service@adaudit.app?subject=Early%20deletion%20request">Request early deletion</a>
        </p>
      </div>
    </div>
  );
}
