"use client";

import { useRef, useState } from "react";
import { symbolForCurrency } from "@/lib/audit/currency";
import { useRouter } from "next/navigation";
import { ExportGuideSteps } from "./ExportGuide";

type Phase =
  | { kind: "idle" }
  | { kind: "uploading"; pct: number }
  | { kind: "checking" }
  | { kind: "error-inline"; message: string } // format/size problems (DESIGN §4.4)
  | { kind: "error-card"; message: string; columnsFound: string[] | null } // parse problems (§4.5)
  | { kind: "email"; auditId: string; rows: number; spend: number; currency: string };

const INDUSTRIES = [
  "E-commerce / retail",
  "Local services",
  "SaaS / apps",
  "Coaching / education",
  "Real estate",
  "Health & fitness",
  "Agency (for a client)",
  "Other",
];

export function UploadBox() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [over, setOver] = useState(false);
  const [level, setLevel] = useState<"adset" | "ad">("adset");
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });

  // email modal state
  const [email, setEmail] = useState("");
  const [emailErr, setEmailErr] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSendErr, setEmailSendErr] = useState<string | null>(null);

  const busy = phase.kind === "uploading" || phase.kind === "checking";

  function pick(f: File | null) {
    setFile(f);
    if (phase.kind === "error-inline" || phase.kind === "error-card") setPhase({ kind: "idle" });
  }

  function upload() {
    if (!file) return;
    const form = new FormData();
    form.append("file", file);
    form.append("level", level);
    const cpa = (document.getElementById("opt-cpa") as HTMLInputElement)?.value;
    const industry = (document.getElementById("opt-industry") as HTMLSelectElement)?.value;
    if (cpa) form.append("target_cpa", cpa);
    if (industry) form.append("industry", industry);

    setPhase({ kind: "uploading", pct: 0 });
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/upload");
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        setPhase({ kind: "uploading", pct: Math.round((e.loaded / e.total) * 100) });
      }
    };
    xhr.onload = () => {
      let body: Record<string, unknown> = {};
      try { body = JSON.parse(xhr.responseText); } catch { /* keep empty */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        setPhase({
          kind: "email",
          auditId: String(body.audit_id),
          rows: Number(body.row_count),
          spend: Number(body.total_spend),
          currency: typeof body.currency === "string" ? body.currency : "USD",
        });
        return;
      }
      const code = typeof body.code === "string" ? body.code : "";
      const message = typeof body.error === "string" ? body.error : "Upload failed. Please try again.";
      if (["missing_columns", "too_few_rows", "zero_spend", "no_rows"].includes(code)) {
        setPhase({ kind: "error-card", message, columnsFound: null });
      } else {
        setPhase({ kind: "error-inline", message });
      }
    };
    xhr.onerror = () => setPhase({ kind: "error-inline", message: "The upload didn't go through. Check your connection and try again." });
    xhr.send(form);
    // once bytes are sent the server is checking the file
    xhr.upload.onload = () => setPhase((p) => (p.kind === "uploading" ? { kind: "checking" } : p));
  }

  async function submitEmail(auditId: string) {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setEmailErr("That doesn't look like an email address.");
      return;
    }
    setEmailErr(null);
    setEmailSendErr(null);
    setEmailBusy(true);
    try {
      const resp = await fetch(`/api/audit/${auditId}/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = (await resp.json().catch(() => ({}))) as { token?: string; error?: string };
      if (!resp.ok || !body.token) {
        setEmailSendErr(body.error || "Something went wrong sending that. Your file data is safe — try again.");
        return;
      }
      router.push(`/report/${body.token}`);
    } catch {
      setEmailSendErr("Something went wrong sending that. Your file data is safe — try again.");
    } finally {
      setEmailBusy(false);
    }
  }

  if (phase.kind === "error-card") {
    return (
      <div className="upload-box" style={{ borderLeft: "3px solid var(--red)" }}>
        <h3>⚠ We can&apos;t audit this file yet</h3>
        <p>{phase.message}</p>
        <p className="muted">
          How to fix: Ads Manager → Columns → Customize Columns → tick the missing ones → Export again.{" "}
          <a href="/#how-to-export">See the step-by-step guide</a>
        </p>
        <button className="btn" onClick={() => { setPhase({ kind: "idle" }); setFile(null); }}>
          Upload a corrected file
        </button>
        <p className="small muted" style={{ marginTop: 10 }}>
          Your file has been deleted — we don&apos;t keep it.
        </p>
      </div>
    );
  }

  return (
    <div className="upload-box">
      <h3 style={{ marginBottom: 4 }}>Step 1 — Export from Ads Manager</h3>
      <ExportGuideSteps />

      <h3 style={{ margin: "22px 0 10px" }}>Step 2 — Upload your file</h3>
      <div
        className={`dropzone${over ? " over" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); pick(e.dataTransfer.files?.[0] ?? null); }}
      >
        {phase.kind === "uploading" ? (
          <div>
            <p style={{ margin: 0 }}>Uploading {file?.name}… {phase.pct}%</p>
            <div className="progress-track"><div className="progress-fill" style={{ width: `${phase.pct}%` }} /></div>
          </div>
        ) : phase.kind === "checking" ? (
          <p style={{ margin: 0 }}><span className="spinner" /> Checking your file… reading columns, checking data quality</p>
        ) : file ? (
          <p style={{ margin: 0 }}>
            <strong>{file.name}</strong> · {(file.size / 1024).toFixed(0)} KB{" "}
            <button type="button" onClick={() => pick(null)} style={{ background: "none", border: "none", color: "var(--brand)", cursor: "pointer", fontSize: 15 }}>
              ✕ Remove
            </button>
          </p>
        ) : (
          <>
            <p style={{ margin: "0 0 8px" }}>⬆ Drag your .csv or .xlsx here</p>
            <button type="button" className="btn secondary" onClick={() => fileRef.current?.click()}>
              Browse files
            </button>
            <p className="small" style={{ margin: "10px 0 0" }}>Max 10 MB · Up to 50,000 rows</p>
          </>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx"
          hidden
          onChange={(e) => pick(e.target.files?.[0] ?? null)}
        />
      </div>

      {phase.kind === "error-inline" && (
        <div className="alert error">
          {phase.message}{" "}
          <button type="button" onClick={() => setPhase({ kind: "idle" })} style={{ background: "none", border: "none", color: "inherit", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      )}

      <div className="field">
        <label>Data level</label>
        <div className="radio-row">
          <label>
            <input type="radio" name="level" checked={level === "adset"} onChange={() => setLevel("adset")} />
            Ad sets (recommended)
          </label>
          <label>
            <input type="radio" name="level" checked={level === "ad"} onChange={() => setLevel("ad")} />
            Ads
          </label>
        </div>
      </div>

      <details className="more">
        <summary>Optional: help us tune the audit — skip if you&apos;re not sure</summary>
        <div className="body">
          <div className="field">
            <label htmlFor="opt-cpa">Target CPA (in your account currency) — Optional</label>
            <input id="opt-cpa" type="number" min="0" step="0.01" placeholder="e.g. 25" />
          </div>
          <div className="field">
            <label htmlFor="opt-industry">Industry — Optional</label>
            <select id="opt-industry" defaultValue="">
              <option value="">Select…</option>
              {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </div>
        </div>
      </details>

      <button className="btn" disabled={!file || busy} onClick={upload} style={{ marginTop: 16 }}>
        {busy ? "Working…" : "Analyze my ads — free"}
      </button>
      {!file && <span className="muted small" style={{ marginLeft: 12 }}>Choose a file to continue</span>}

      <div className="alert info desktop-hint" style={{ marginTop: 16 }}>
        🖥 Best done on a desktop — Ads Manager exports are easier to download on a computer.
        You can read everything here and come back on your computer to run the audit.
      </div>

      {phase.kind === "email" && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <div className="modal">
            <button className="x" aria-label="Close"
              onClick={() => {
                if (window.confirm("Close and discard this upload? Your file data will be deleted and you'll need to upload again.")) {
                  setPhase({ kind: "idle" });
                  setFile(null);
                }
              }}>✕</button>
            <h3>Where should we send your audit?</h3>
            <p>
              Your file checks out — <strong>{phase.rows} rows</strong>,{" "}
              <strong>{symbolForCurrency(phase.currency)}{phase.spend.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong> spent in the period.
            </p>
            {emailSendErr && <div className="alert error">{emailSendErr}</div>}
            <div className="field">
              <label htmlFor="email-input">Email</label>
              <input
                id="email-input"
                type="email"
                className={emailErr ? "err" : ""}
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") submitEmail(phase.auditId); }}
                autoFocus
              />
              {emailErr && <p className="small" style={{ color: "var(--red)", marginTop: 5 }}>{emailErr}</p>}
            </div>
            <p className="muted" style={{ fontSize: 14.5 }}>
              We&apos;ll email you the report link. The link is your key — there&apos;s no account and no password.
            </p>
            <button className="btn" disabled={emailBusy} onClick={() => submitEmail(phase.auditId)} style={{ width: "100%" }}>
              {emailBusy ? "Sending…" : "Send my free preview"}
            </button>
            <p className="small muted" style={{ marginTop: 12, marginBottom: 0 }}>
              We never sell your data. Your file is already deleted.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
