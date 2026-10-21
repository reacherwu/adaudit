import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, type CreemEvent } from "@/lib/creem";
import { getOrder, updateOrder, getAuditById, updateAudit } from "@/lib/store";
import { sendUnlockEmail } from "@/lib/mail";

/**
 * POST /api/webhooks/creem — unlock reports on checkout.completed.
 *
 * Defense in depth: the HMAC signature proves the event came from Creem,
 * but that alone does not prove it pays for THIS order. Before unlocking
 * we additionally require:
 *  - the event's checkout id equals the checkout id stored on the order
 *    when the checkout was created (a genuine event for a different,
 *    cheaper checkout must not unlock this order);
 *  - the checkout status is "completed" and the order is in a state that
 *    may legally transition to paid;
 *  - the paid amount in the event equals the order amount (accepting the
 *    cents representation Creem uses in its order object).
 * Any mismatch is logged and refused — the report stays locked.
 * Replays of a fully valid event remain idempotent.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get("creem-signature");
  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  let event: CreemEvent;
  try {
    event = JSON.parse(raw) as CreemEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const type = event.eventType || event.event_type;
  if (type !== "checkout.completed") {
    return NextResponse.json({ received: true, ignored: type ?? "unknown" });
  }

  const orderId = event.object?.metadata?.order_id;
  if (!orderId) return NextResponse.json({ received: true, note: "no order_id in metadata" });

  const order = await getOrder(orderId);
  if (!order) return NextResponse.json({ received: true, note: "order not found" });

  const reject = (reason: string) => {
    console.error(
      `[creem-webhook] unlock REFUSED for order ${order.id}: ${reason} ` +
        `(event checkout=${event.object?.id ?? "?"}, status=${event.object?.status ?? "?"})`,
    );
    return NextResponse.json({ received: true, rejected: reason });
  };

  // 1. The event must be about the exact checkout created for this order.
  if (!order.creem_checkout_id || !event.object?.id || event.object.id !== order.creem_checkout_id) {
    return reject("checkout_id_mismatch");
  }

  // Idempotent replay of an already-processed, identity-verified event.
  if (order.status === "paid") {
    return NextResponse.json({ received: true, idempotent: true });
  }

  // 2. Legal state transitions only.
  if (order.status !== "pending") {
    return reject(`order_status_${order.status}`);
  }
  if (event.object.status !== "completed") {
    return reject(`checkout_status_${event.object.status ?? "missing"}`);
  }

  // 3. The money must match the order — dollars or cents representation.
  const amountRaw = event.object.order?.amount ?? event.object.amount;
  if (typeof amountRaw !== "number" || !Number.isFinite(amountRaw)) {
    return reject("amount_missing");
  }
  const amountMatches =
    Math.abs(amountRaw - order.amount_usd) < 0.01 ||
    Math.abs(amountRaw / 100 - order.amount_usd) < 0.01;
  if (!amountMatches) {
    return reject("amount_mismatch");
  }

  await updateOrder(order.id, {
    status: "paid",
    paid_at: new Date().toISOString(),
    // Capture Creem's own ids so a later refund can target the transaction
    // directly instead of having to resolve it at refund time.
    creem_order_id: event.object.order?.id ?? order.creem_order_id ?? null,
    creem_transaction_id: event.object.order?.transaction ?? order.creem_transaction_id ?? null,
  });
  const audit = await getAuditById(order.audit_id);
  if (audit && !audit.paid) {
    await updateAudit(audit.id, { paid: true, paid_via: "creem", order_id: order.id });
    if (audit.email && audit.token) {
      const origin = process.env.PUBLIC_BASE_URL || new URL(req.url).origin;
      await sendUnlockEmail(audit.email, `${origin}/report/${audit.token}`);
    }
  }
  return NextResponse.json({ received: true, unlocked: true });
}
