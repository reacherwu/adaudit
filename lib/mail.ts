/**
 * Transactional email via Resend's HTTP API. Real sends when RESEND_API_KEY
 * is configured; when it isn't, the attempt is recorded honestly in the
 * store as "not_configured" (the report link is also shown on-page, so the
 * user journey never depends on email alone).
 */

import { recordEmail } from "./store";

export async function sendRecheckEmail(to: string, verifyUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "AdAudit <reports@adaudit.app>";
  const subject = "Your free re-check link";
  if (!key) {
    await recordEmail({ to, subject, status: "not_configured" });
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to,
        subject,
        text:
          `Here's the secure link to activate the free re-check included with your paid report:\n\n${verifyUrl}\n\n` +
          `The link works for 1 hour. It opens the upload page with your re-check activated — ` +
          `upload a fresh export and use this same email address, and the new report unlocks in full.\n\n— AdAudit`,
      }),
    });
    await recordEmail({ to, subject, status: resp.ok ? "sent" : "failed" });
  } catch {
    await recordEmail({ to, subject, status: "failed" });
  }
}

export async function sendReportEmail(to: string, reportUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "AdAudit <reports@adaudit.app>";
  const subject = "Your ad account audit is ready";
  if (!key) {
    await recordEmail({ to, subject, status: "not_configured" });
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to,
        subject,
        text:
          `Your Meta ads audit is ready.\n\nOpen your report: ${reportUrl}\n\n` +
          `Keep this link — it's your key to the report (there's no account or password). ` +
          `Your uploaded file was deleted immediately after analysis. The report is kept for 90 days.\n\n— AdAudit`,
      }),
    });
    await recordEmail({ to, subject, status: resp.ok ? "sent" : "failed" });
  } catch {
    await recordEmail({ to, subject, status: "failed" });
  }
}

/** Admin notification (e.g. a refund that could not be completed and is
 *  waiting in refund_pending). Always recorded in the store's email log —
 *  that record is the audit trail; a real send happens when Resend is
 *  configured. Recipient: ADMIN_ALERT_EMAIL, else the support inbox. */
export async function sendAdminAlert(subject: string, text: string): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL || "service@adaudit.app";
  const fullSubject = `[AdAudit admin] ${subject}`;
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "AdAudit <reports@adaudit.app>";
  if (!key) {
    await recordEmail({ to, subject: fullSubject, status: "not_configured" });
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ from, to, subject: fullSubject, text }),
    });
    await recordEmail({ to, subject: fullSubject, status: resp.ok ? "sent" : "failed" });
  } catch {
    await recordEmail({ to, subject: fullSubject, status: "failed" });
  }
}

export async function sendUnlockEmail(to: string, reportUrl: string): Promise<void> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.MAIL_FROM || "AdAudit <reports@adaudit.app>";
  const subject = "Your full audit report is unlocked";
  if (!key) {
    await recordEmail({ to, subject, status: "not_configured" });
    return;
  }
  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        from,
        to,
        subject,
        text:
          `Payment received — your full audit report is unlocked.\n\nOpen it here: ${reportUrl}\n\n` +
          `You can download the PDF from the report page, and you get 1 free re-check within 30 days: ` +
          `open your report and tap "Start free re-check", or request a secure re-check link from the ` +
          `audit page with this email address.\n\n— AdAudit`,
      }),
    });
    await recordEmail({ to, subject, status: resp.ok ? "sent" : "failed" });
  } catch {
    await recordEmail({ to, subject, status: "failed" });
  }
}
