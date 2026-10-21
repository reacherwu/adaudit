"use client";

import { useState } from "react";

/**
 * "Request a re-check link" — for buyers who no longer have their report
 * open. Submitting an email here never unlocks anything by itself: the API
 * emails a signed, expiring magic link to that address, and only control
 * of the inbox can activate the credit.
 */
export function RecheckRequest() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setErr("That doesn't look like an email address.");
      return;
    }
    setErr(null);
    setBusy(true);
    try {
      const resp = await fetch("/api/recheck/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: value }),
      });
      const body = (await resp.json().catch(() => ({}))) as { error?: string };
      if (!resp.ok) {
        setErr(body.error || "Something went wrong. Please try again.");
        return;
      }
      setSent(true);
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card" style={{ marginTop: 22 }}>
      <h3 style={{ marginTop: 0 }}>Already paid for a report in the last 30 days?</h3>
      <p className="muted" style={{ marginTop: 0 }}>
        Your purchase includes 1 free re-check. Enter the email you paid with and we&apos;ll send a
        secure link that activates it — or open your original report and tap
        &ldquo;Start free re-check&rdquo; there.
      </p>
      {sent ? (
        <p style={{ marginBottom: 0 }}>
          ✓ If that email has a free re-check available, a link is on its way. It works for 1 hour.
        </p>
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-start" }}>
          <input
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            style={{ flex: "1 1 240px" }}
            aria-label="Email you paid with"
          />
          <button className="btn secondary" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Email me the link"}
          </button>
          {err && (
            <p className="small" style={{ color: "var(--red)", width: "100%", margin: 0 }}>{err}</p>
          )}
        </div>
      )}
    </div>
  );
}
