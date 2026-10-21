/**
 * Audit pipeline orchestration: parsed rows -> rules engine -> narrative ->
 * stored report. Runs asynchronously after the email step; the report page
 * polls status. Stages are written to the record so the progress UI shows
 * REAL stages, never fake percentages (DESIGN §6).
 */

import type { AdRow } from "../audit/types";
import { runAudit } from "../audit/rules";
import { generateNarrative } from "./generate";
import { getAuditById, updateAudit } from "../store";
import { sendReportEmail } from "../mail";
import { refundFailedAuditIfPaid } from "../refund";

export async function runAuditPipeline(
  auditId: string,
  rows: AdRow[],
  publicBaseUrl: string,
): Promise<void> {
  const audit = await getAuditById(auditId);
  if (!audit) return;
  try {
    await updateAudit(auditId, { status: "processing", stage: "Running 12 checks against your data" });
    const result = runAudit(rows, { level: audit.level, targetCpa: audit.target_cpa });

    await updateAudit(auditId, { stage: "Writing your report" });
    const narrative = await generateNarrative(auditId, result, audit.industry);

    await updateAudit(auditId, {
      status: "ready",
      stage: "Preparing your preview",
      aggregates: result.aggregates,
      findings: result.findings,
      health_score: result.health_score,
      grade: result.grade,
      total_waste: result.total_waste,
      issue_count: result.issue_count,
      narrative,
    });

    if (audit.email && audit.token) {
      await sendReportEmail(audit.email, `${publicBaseUrl}/report/${audit.token}`);
    }
  } catch (err) {
    await updateAudit(auditId, {
      status: "failed",
      stage: "Failed",
      error: err instanceof Error ? err.message : "Unknown error",
    });
    // Money-back promise (terms/FAQ): a paid-for report that fails to
    // generate is refunded in full, automatically. If the refund cannot
    // be completed right now the order lands in refund_pending and the
    // cleanup cron keeps retrying — it is never silently dropped, and a
    // refund failure must never mask the generation failure above.
    try {
      await refundFailedAuditIfPaid(auditId);
    } catch (refundErr) {
      console.error(`[run] refund attempt for audit ${auditId} threw:`, refundErr);
    }
  }
}
