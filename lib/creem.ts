/**
 * Creem payments (PRD F7). One-time $49 product, price lives server-side in
 * Creem (CREEM_PRODUCT_ID) — the client never sends an amount.
 * Webhook: Creem signs the raw body with HMAC-SHA256 in the
 * `creem-signature` header; we verify before unlocking anything.
 */

import { createHmac, timingSafeEqual } from "crypto";

export class CreemNotConfigured extends Error {
  constructor() {
    super("Payments are not configured yet (CREEM_API_KEY / CREEM_PRODUCT_ID missing).");
  }
}

const API_BASE = process.env.CREEM_API_BASE || "https://api.creem.io/v1";

/** api.creem.io sits behind Cloudflare and rejects non-browser agents
 *  (verified 2026-10-07) — send a browser UA on server-side calls. */
const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function createCheckout(params: {
  orderId: string;
  auditToken: string;
  email: string;
  successUrl: string;
}): Promise<{ checkoutUrl: string; checkoutId: string }> {
  const apiKey = process.env.CREEM_API_KEY;
  const productId = process.env.CREEM_PRODUCT_ID;
  if (!apiKey || !productId) throw new CreemNotConfigured();

  const resp = await fetch(`${API_BASE}/checkouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "User-Agent": UA },
    body: JSON.stringify({
      product_id: productId,
      success_url: params.successUrl,
      customer: { email: params.email },
      metadata: { order_id: params.orderId, audit_token: params.auditToken },
    }),
  });
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    throw new Error(`Creem checkout failed: HTTP ${resp.status} ${body.slice(0, 200)}`);
  }
  const json = (await resp.json()) as { id?: string; checkout_url?: string };
  if (!json.checkout_url || !json.id) throw new Error("Creem checkout response missing URL");
  return { checkoutUrl: json.checkout_url, checkoutId: json.id };
}

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.CREEM_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader.trim());
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface CreemEvent {
  eventType?: string;
  event_type?: string;
  object?: {
    /** the checkout id — must match the one stored on the order at creation */
    id?: string;
    /** checkout lifecycle status; only "completed" may unlock */
    status?: string;
    /** amount as reported by Creem (cents in the order object) */
    amount?: number;
    metadata?: Record<string, string>;
    order?: {
      id?: string;
      amount?: number;
      currency?: string;
      status?: string;
      /** the payment transaction for this order, when Creem includes it */
      transaction?: string;
    };
  };
}

/* ------------------------------------------------------------------ */
/* Refunds                                                             */
/*                                                                     */
/* Creem refunds are issued against a TRANSACTION: POST                */
/* /v1/transactions/{transaction_id}/refund — the same resource shape  */
/* as the officially documented POST /v1/subscriptions/{id}/cancel and */
/* the official CLI's `creem transactions refund <id>`. The refund     */
/* object carries id / status / refund_amount (cents) / reason, and    */
/* Creem emails the customer and fires a refund.created webhook.       */
/* ------------------------------------------------------------------ */

export interface CreemRefundResult {
  refundId: string | null;
  status: string | null;
  refundAmountCents: number | null;
}

/** Resolve the Creem transaction id for a checkout/order when it wasn't
 *  captured from the webhook: checkout → its order → transaction id,
 *  falling back to the transactions search filtered by Creem order id. */
async function resolveTransactionId(params: {
  apiKey: string;
  checkoutId?: string | null;
  creemOrderId?: string | null;
}): Promise<string | null> {
  let orderId = params.creemOrderId ?? null;
  if (params.checkoutId) {
    const resp = await fetch(`${API_BASE}/checkouts/${params.checkoutId}`, {
      headers: { "x-api-key": params.apiKey, "User-Agent": UA },
    });
    if (resp.ok) {
      const json = (await resp.json()) as {
        transaction?: string;
        order?: { id?: string; transaction?: string } | string;
      };
      if (typeof json.transaction === "string" && json.transaction) return json.transaction;
      if (json.order && typeof json.order === "object") {
        if (json.order.transaction) return json.order.transaction;
        orderId = json.order.id ?? orderId;
      }
    }
  }
  if (orderId) {
    const resp = await fetch(
      `${API_BASE}/transactions/search?order_id=${encodeURIComponent(orderId)}`,
      { headers: { "x-api-key": params.apiKey, "User-Agent": UA } },
    );
    if (resp.ok) {
      const json = (await resp.json()) as { items?: { id?: string; status?: string }[] };
      const items = json.items ?? [];
      const paid = items.find((t) => t.status === "paid" || t.status === "succeeded") ?? items[0];
      if (paid?.id) return paid.id;
    }
  }
  return null;
}

/** Create a refund for a payment. Amount omitted → Creem refunds the
 *  full remaining amount of the transaction. Throws CreemNotConfigured
 *  when no API key is set, and a descriptive Error on any API failure —
 *  callers must treat a throw as "NOT refunded" (see lib/refund.ts). */
export async function createRefund(params: {
  transactionId?: string | null;
  checkoutId?: string | null;
  creemOrderId?: string | null;
  amountCents?: number;
  reason?: string;
}): Promise<CreemRefundResult> {
  const apiKey = process.env.CREEM_API_KEY;
  if (!apiKey) throw new CreemNotConfigured();

  let transactionId = params.transactionId ?? null;
  if (!transactionId) {
    transactionId = await resolveTransactionId({
      apiKey,
      checkoutId: params.checkoutId,
      creemOrderId: params.creemOrderId,
    });
  }
  if (!transactionId) {
    throw new Error(
      "Could not resolve the Creem transaction id for this order (checkout/order lookup found none).",
    );
  }

  const body: Record<string, unknown> = {};
  if (typeof params.amountCents === "number") body.amount = params.amountCents;
  if (params.reason) body.reason = params.reason;

  const resp = await fetch(`${API_BASE}/transactions/${transactionId}/refund`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": apiKey, "User-Agent": UA },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Creem refund failed: HTTP ${resp.status} ${text.slice(0, 200)}`);
  }
  const json = (await resp.json()) as {
    id?: string;
    status?: string;
    refund_amount?: number;
  };
  return {
    refundId: json.id ?? null,
    status: json.status ?? null,
    refundAmountCents: typeof json.refund_amount === "number" ? json.refund_amount : null,
  };
}
