import { NextRequest, NextResponse } from "next/server";
import { getAuditByToken, createOrder, updateOrder } from "@/lib/store";
import { createCheckout, CreemNotConfigured } from "@/lib/creem";
import { PRICE_USD } from "@/lib/audit/thresholds";

/**
 * POST /api/checkout { token } — create a Creem checkout for the $49
 * one-time full report. The price comes from the Creem product itself;
 * the client never supplies an amount (PRD §8).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { token?: string };
  if (!body.token) return NextResponse.json({ error: "Missing report token." }, { status: 400 });
  const audit = await getAuditByToken(body.token);
  if (!audit) return NextResponse.json({ error: "Report not found." }, { status: 404 });
  if (audit.paid) return NextResponse.json({ error: "This report is already unlocked." }, { status: 409 });
  if (!audit.email) return NextResponse.json({ error: "Report has no email attached." }, { status: 409 });

  const order = await createOrder({
    audit_id: audit.id,
    email: audit.email,
    amount_usd: PRICE_USD,
    status: "pending",
  });

  const origin = new URL(req.url).origin;
  try {
    const { checkoutUrl, checkoutId } = await createCheckout({
      orderId: order.id,
      auditToken: body.token,
      email: audit.email,
      successUrl: `${origin}/report/${audit.token}?paid=1`,
    });
    await updateOrder(order.id, { creem_checkout_id: checkoutId });
    return NextResponse.json({ checkout_url: checkoutUrl });
  } catch (err) {
    await updateOrder(order.id, { status: "failed" });
    if (err instanceof CreemNotConfigured) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: "The payment page couldn't be opened. Please try again in a moment." },
      { status: 502 },
    );
  }
}
