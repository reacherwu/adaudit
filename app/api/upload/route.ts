import { NextRequest, NextResponse } from "next/server";
import { validateUpload, parseExport, UploadError } from "@/lib/audit/parse";
import {
  createAudit,
  countAuditsByIpSince,
  countUploadAttemptsSince,
  recordUploadAttempt,
} from "@/lib/store";
import { getClientIp } from "@/lib/auth";
import { putPendingRows } from "@/lib/pending";
import { LIMITS } from "@/lib/audit/thresholds";
import type { Level } from "@/lib/audit/types";

/**
 * POST /api/upload — validate + parse the export (in memory only), then
 * create an audit in `awaiting_email` state. The raw FILE is never written
 * to disk or object storage (PRD §7); only normalized rows are kept — in
 * the shared store with a 15-minute TTL (lib/pending.ts) — until the
 * email step consumes them.
 *
 * Abuse controls, in order:
 * 1. Rate limiting keys on a non-spoofable client IP (lib/auth).
 * 2. EVERY attempt is counted — including uploads that fail parsing — so
 *    parse-bombing can't reset the meter; successes have their own cap.
 * 3. An oversized declared Content-Length is rejected before the body is
 *    read at all.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const since = dayStart.getTime();

  if ((await countUploadAttemptsSince(ip, since)) >= LIMITS.MAX_UPLOAD_ATTEMPTS_PER_IP_PER_DAY) {
    return NextResponse.json(
      { error: "You've hit today's upload limit for this connection. Please come back tomorrow." },
      { status: 429 },
    );
  }
  await recordUploadAttempt(ip);

  if ((await countAuditsByIpSince(ip, since)) >= LIMITS.FREE_AUDITS_PER_IP_PER_DAY) {
    return NextResponse.json(
      { error: "You've used today's 3 free audits for this connection. Please come back tomorrow." },
      { status: 429 },
    );
  }

  // Reject an oversized body from its declared length, before reading it.
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > LIMITS.MAX_FILE_BYTES + LIMITS.FORM_OVERHEAD_BYTES) {
    return NextResponse.json(
      { error: "That file is over the 10 MB limit. Export the last 30 days only, at ad set level, and try again." },
      { status: 413 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Upload didn't arrive. Please try again." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file was attached." }, { status: 400 });
  }
  const level = (form.get("level") === "ad" ? "ad" : "adset") as Level;
  const targetCpaRaw = Number(form.get("target_cpa"));
  const targetCpa = Number.isFinite(targetCpaRaw) && targetCpaRaw > 0 ? targetCpaRaw : null;
  const industry = (form.get("industry") as string) || null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const kind = validateUpload(buffer, file.name);
    const parsed = await parseExport(buffer, kind, level);

    const dataNotes: string[] = [];
    if (parsed.currenciesSeen.length > 1) {
      dataNotes.push(
        `Your export appears to mix currencies (${parsed.currenciesSeen.join(", ")}). We audited the amounts as ${parsed.currency} — if part of the file is denominated differently, re-export a single account so the totals are exact.`,
      );
    }
    if (parsed.clampedSpendRows > 0) {
      dataNotes.push(
        `${parsed.clampedSpendRows} row${parsed.clampedSpendRows === 1 ? "" : "s"} in your export had negative spend (usually refund or adjustment rows). We counted ${parsed.clampedSpendRows === 1 ? "it" : "them"} as 0 so refunds don't distort your totals.`,
      );
    }

    const audit = await createAudit({
      ip,
      level,
      target_cpa: targetCpa,
      industry,
      columns_found: parsed.columnsFound,
      currency: parsed.currency,
      data_notes: dataNotes,
      stage: "File checked",
    });
    await putPendingRows(audit.id, parsed.rows);
    const totalSpend = parsed.rows.reduce((s, r) => s + r.amount_spent, 0);
    return NextResponse.json({
      audit_id: audit.id,
      row_count: parsed.rows.length,
      total_spend: Math.round(totalSpend * 100) / 100,
      currency: parsed.currency,
      columns_found: parsed.columnsFound,
    });
  } catch (err) {
    if (err instanceof UploadError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: 422 });
    }
    return NextResponse.json(
      { error: "Something went wrong reading that file. Please re-export and try again." },
      { status: 500 },
    );
  }
}
