/**
 * The money-back promise, implemented: terms/FAQ/report page all say
 * "if we cannot generate your report, your payment is refunded in full,
 * automatically." This module is where that happens.
 *
 * Flow (called from the audit pipeline's failure path, and retried by the
 * cleanup cron for anything left pending):
 *   order "paid" → Creem refund created → order "refunded"
 *   any failure (no API key, API down, transaction unresolvable)
 *     → order "refund_pending" + reason stored + admin alert recorded.
 * An order is NEVER marked refunded without a successful Creem API call.
 */

import { createRefund, CreemNotConfigured } from "./creem";
import {
  getAuditById,
  getOrder,
  listOrdersByStatus,
  updateAudit,
  updateOrder,
} from "./store";
import { sendAdminAlert } from "./mail";

export type RefundOutcome =
  | { outcome: "refunded"; refundId: string | null }
  | { outcome: "refund_pending"; reason: string }
  | { outcome: "skipped"; reason: string };

export async function attemptRefundForOrder(
  orderId: string,
  reason: string,
): Promise<RefundOutcome> {
  const order = await getOrder(orderId);
  if (!order) return { outcome: "skipped", reason: "order_not_found" };
  if (order.status === "refunded") return { outcome: "skipped", reason: "already_refunded" };
  if (order.status !== "paid" && order.status !== "refund_pending") {
    return { outcome: "skipped", reason: `order_status_${order.status}` };
  }

  try {
    const result = await createRefund({
      transactionId: order.creem_transaction_id,
      checkoutId: order.creem_checkout_id,
      creemOrderId: order.creem_order_id,
      amountCents: Math.round(order.amount_usd * 100),
      reason,
    });
    await updateOrder(order.id, {
      status: "refunded",
      refund_id: result.refundId,
      refund_error: null,
      refund_attempted_at: new Date().toISOString(),
    });
    // The money is back with the customer: this audit no longer counts as
    // paid (also closes free-recheck eligibility for it).
    const audit = await getAuditById(order.audit_id);
    if (audit && audit.paid) {
      await updateAudit(audit.id, { paid: false, paid_via: null });
    }
    return { outcome: "refunded", refundId: result.refundId };
  } catch (err) {
    const why =
      err instanceof CreemNotConfigured
        ? "Creem API key not configured — refund cannot be issued automatically right now."
        : err instanceof Error
          ? err.message
          : "Unknown refund error";
    await updateOrder(order.id, {
      status: "refund_pending",
      refund_error: why,
      refund_attempted_at: new Date().toISOString(),
    });
    await sendAdminAlert(
      "Refund pending — manual action needed",
      [
        `An automatic refund could not be completed and needs manual processing in the Creem dashboard.`,
        ``,
        `Order (internal): ${order.id}`,
        `Audit: ${order.audit_id}`,
        `Customer email: ${order.email}`,
        `Amount: $${order.amount_usd.toFixed(2)}`,
        `Creem checkout: ${order.creem_checkout_id ?? "unknown"}`,
        `Reason for refund: ${reason}`,
        `Why automatic refund failed: ${why}`,
        ``,
        `The order is stored as refund_pending and the cleanup cron keeps retrying it.`,
      ].join("\n"),
    );
    return { outcome: "refund_pending", reason: why };
  }
}

/** Pipeline failure hook: if this audit was paid for directly via Creem,
 *  refund its order in full. Recheck-funded audits (paid_via "recheck")
 *  made no payment of their own, so there is nothing to refund. */
export async function refundFailedAuditIfPaid(auditId: string): Promise<RefundOutcome> {
  const audit = await getAuditById(auditId);
  if (!audit) return { outcome: "skipped", reason: "audit_not_found" };
  if (!audit.paid || audit.paid_via !== "creem" || !audit.order_id) {
    return { outcome: "skipped", reason: "audit_not_directly_paid" };
  }
  return attemptRefundForOrder(
    audit.order_id,
    "Report generation failed — automatic full refund (AdAudit money-back promise)",
  );
}

/** Cron retry pass: re-attempt every order stuck in refund_pending. */
export async function retryPendingRefunds(): Promise<{
  attempted: number;
  refunded: number;
  still_pending: number;
}> {
  const orders = await listOrdersByStatus("refund_pending");
  let refunded = 0;
  for (const order of orders) {
    const res = await attemptRefundForOrder(
      order.id,
      "Report generation failed — automatic full refund (AdAudit money-back promise)",
    );
    if (res.outcome === "refunded") refunded += 1;
  }
  return { attempted: orders.length, refunded, still_pending: orders.length - refunded };
}
