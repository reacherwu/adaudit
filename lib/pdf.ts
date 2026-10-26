/**
 * Server-side PDF of the full report (PRD F9). Built with pdf-lib from the
 * same data as the web page — no HTML rendering, no headless browser.
 * Cell values are formula-escaped so user-controlled names can never become
 * spreadsheet formulas if the PDF text is copied into a sheet (PRD §8).
 */

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AuditRecord } from "./store";
import { symbolForCurrency } from "./audit/currency";

const INK = rgb(0.078, 0.125, 0.18);
const MUTED = rgb(0.35, 0.42, 0.486);
const RED = rgb(0.725, 0.11, 0.11);
const BLUE = rgb(0.114, 0.306, 0.847);

export function escapeFormula(s: string): string {
  return /^[=+\-@]/.test(s.trim()) ? `'${s}` : s;
}

/** Standard PDF fonts encode WinAnsi only — replace anything outside it
 *  (arrows, emoji in user ad-set names, …) so user data can never break
 *  PDF generation. */
const WINANSI_EXTRA = new Set(
  [
    0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
    0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
    0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
  ].map((cp) => String.fromCodePoint(cp)),
);
export function sanitizePdfText(s: string): string {
  return s
    .replace(/→/g, ">")
    .replace(/✓/g, "OK")
    .split("")
    .filter((ch) => {
      const cp = ch.codePointAt(0) ?? 0;
      return cp <= 0xff || WINANSI_EXTRA.has(ch);
    })
    .join("");
}

const money = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export async function buildReportPdf(audit: AuditRecord): Promise<Uint8Array> {
  // pdf-lib's standard fonts are WinAnsi-encoded: glyphs like ₹/₩/₽
  // would throw at draw time. Use the symbol only when WinAnsi can
  // encode it, else fall back to the ISO code ("INR 1,234.56").
  const rawSym = symbolForCurrency(audit.currency ?? "USD");
  const sym = /^[\x20-\x7E]*$/.test(rawSym) || ["€", "£", "¥"].includes(rawSym)
    ? rawSym
    : `${(audit.currency ?? "USD").toUpperCase()} `;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const PAGE_W = 595, PAGE_H = 842, MARGIN = 54;
  let page = doc.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const ensure = (need: number) => {
    if (y - need < MARGIN) {
      page = doc.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };
  const wrap = (textIn: string, size: number, f = font, width = PAGE_W - MARGIN * 2): string[] => {
    const text = sanitizePdfText(textIn);
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = "";
    for (const w of words) {
      const trial = line ? `${line} ${w}` : w;
      if (f.widthOfTextAtSize(trial, size) > width && line) {
        lines.push(line);
        line = w;
      } else line = trial;
    }
    if (line) lines.push(line);
    return lines;
  };
  const text = (t: string, size = 11, f = font, color = INK, gap = 6) => {
    for (const line of wrap(t, size, f)) {
      ensure(size + gap);
      page.drawText(line, { x: MARGIN, y: y - size, size, font: f, color });
      y -= size + gap;
    }
  };
  const heading = (t: string) => {
    y -= 10;
    text(t, 15, bold, INK, 8);
  };

  const a = audit.aggregates!;
  const n = audit.narrative!;
  const date = new Date(audit.created_at).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric",
  });

  text("AdAudit — Meta Ads Audit Report", 17, bold);
  text(`Generated ${date} · Data: last 30 days (as exported)`, 10, font, MUTED, 10);

  heading(`Health Score: ${audit.health_score}/100 — ${audit.grade}`);
  text(`Estimated waste in the period: ${sym}${money(audit.total_waste ?? 0)} (estimated)`, 12, bold, RED, 8);
  if (n.score_reason) text(n.score_reason, 11);

  heading("Executive summary");
  text(n.executive_summary, 11);
  if (n.source === "template") text("Summary generated from rule data.", 9, font, MUTED);

  heading(`Waste list — ${audit.issue_count} issue${audit.issue_count === 1 ? "" : "s"} found`);
  for (const [i, f] of (audit.findings ?? []).entries()) {
    text(`${i + 1}. [${f.severity.toUpperCase()}] ${escapeFormula(f.title)}`, 11.5, bold, INK, 4);
    text(`Evidence: ${escapeFormula(f.evidence_text)}`, 10, font, MUTED, 4);
    const why = n.waste_notes[f.rule_id];
    if (why) text(`Why it matters: ${why}`, 10.5, font, INK, 4);
    text(
      f.waste_usd !== null
        ? `Estimated waste: ${sym}${money(f.waste_usd)} (estimated)${f.waste_note ? ` — ${f.waste_note}` : ""}`
        : (f.note ?? "No waste amount estimated for this item."),
      10.5, font, INK, 10,
    );
  }

  heading("Fix checklist");
  let currentGroup = "";
  for (const item of n.fixes) {
    if (item.group_label !== currentGroup) {
      currentGroup = item.group_label;
      text(currentGroup, 12, bold, BLUE, 5);
    }
    text(`[${item.priority}] ${escapeFormula(item.action)}`, 11, font, INK, 3);
    text(`Where: ${item.path}`, 9.5, font, MUTED, 3);
    text(`Expected effect: ${item.expected}`, 10, font, INK, 8);
  }

  heading("What's working");
  text(n.whats_working, 11);

  y -= 8;
  text(
    "How this score works: the score is a heuristic based on the checks above — not an industry standard. " +
      "Waste figures marked (estimated) are estimates from your own data; each item shows its math.",
    9, font, MUTED, 4,
  );
  text(
    "Your uploaded file was processed in memory and never stored. This report and its summary data are kept for 90 days, then deleted.",
    9, font, MUTED, 4,
  );

  return doc.save();
}
