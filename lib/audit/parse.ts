/**
 * Upload validation + export parsing (PRD F2/F3, §7, §8).
 *
 * Privacy by construction: the uploaded file is processed entirely in
 * memory and is NEVER written to disk or object storage, so there is no
 * original file left to delete — parsing *is* the end of its lifecycle.
 */

import Papa from "papaparse";
import ExcelJS from "exceljs";
import type { AdRow, Level } from "./types";
import { mapHeader, missingRequiredFields, labelForField, type FieldKey } from "./columns";
import {
  DEFAULT_CURRENCY,
  currencyCodeFromCellSymbol,
  currencyCodeFromText,
} from "./currency";
import { LIMITS } from "./thresholds";

export class UploadError extends Error {
  /** machine code for the client to pick the right help copy */
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

export type FileKind = "csv" | "xlsx";

const PK_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // ZIP local file header

export function validateUpload(buffer: Buffer, filename: string): FileKind {
  const lower = filename.toLowerCase();
  if (buffer.length > LIMITS.MAX_FILE_BYTES) {
    throw new UploadError(
      "too_large",
      `This file is ${(buffer.length / 1024 / 1024).toFixed(1)} MB — over the 10 MB limit. Export the last 30 days only, at ad set level, and try again.`,
    );
  }
  if (lower.endsWith(".xlsm") || lower.endsWith(".xlsb") || lower.endsWith(".xls")) {
    throw new UploadError(
      "macro_file",
      "This file looks like a macro or legacy Excel file, which we can't accept. In Ads Manager, choose Export → CSV instead.",
    );
  }
  const isZip = PK_MAGIC.every((b, i) => buffer[i] === b);
  if (lower.endsWith(".xlsx")) {
    if (!isZip) {
      throw new UploadError(
        "bad_xlsx",
        "This .xlsx file doesn't look like a real Excel workbook. Re-export from Ads Manager and try again.",
      );
    }
    return "xlsx";
  }
  if (lower.endsWith(".csv")) {
    if (isZip) {
      throw new UploadError(
        "fake_csv",
        "This file is actually an archive, not a CSV. In Ads Manager, choose Export → CSV and upload that file.",
      );
    }
    return "csv";
  }
  throw new UploadError(
    "bad_type",
    "That file type won't work. Upload a .csv or .xlsx export from Ads Manager.",
  );
}

/**
 * Parse a numeric cell, locale-aware.
 *
 * Ads Manager exports follow the account's locale, so the same value can
 * arrive as "1,234.56" (US), "1.234,56" (DE), "1 234,56" (FR) or plain
 * "1234.56". Rules:
 *  - both '.' and ',' present → the RIGHTMOST one is the decimal
 *    separator, the other is thousands and is dropped;
 *  - only ',' → multiple commas are thousands separators; a single comma
 *    followed by 1–2 digits is a decimal comma; a single comma followed
 *    by exactly 3 digits is a thousands separator (US style "1,234");
 *  - only '.' → multiple dots are thousands separators (DE "1.234.567");
 *    a single dot is a decimal point;
 *  - spaces (incl. NBSP / narrow NBSP) and apostrophes are thousands
 *    separators (FR "1 234,56", CH "1'234.56");
 *  - currency symbols / '%' are stripped (currency is detected separately,
 *    see detectCurrency); a leading '-' or wrapping parentheses negate.
 * Empty/junk -> null.
 */
export function parseNumber(raw: unknown): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim();
  if (!s || s === "-" || s === "—" || s.toLowerCase() === "n/a") return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1).trim();
  }
  // Strip currency symbols/codes, %, and grouping spaces/apostrophes.
  s = s
    .replace(/[A-Z]{3}(?=\s*\d)/gi, "") // leading ISO code, e.g. "EUR 1.234,56"
    .replace(/[^\d.,\s'’-]/g, " ")
    .replace(/[\s'’]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  s = s.replace(/-/g, "");
  if (!s || !/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Both present: rightmost is the decimal separator.
    if (lastComma > lastDot) {
      normalized = s.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = s.replace(/,/g, "");
    }
  } else if (lastComma >= 0) {
    const parts = s.split(",");
    if (parts.length > 2) {
      normalized = parts.join(""); // thousands separators
    } else if (parts[1].length === 3) {
      normalized = parts.join(""); // "1,234" — US thousands
    } else {
      normalized = `${parts[0]}.${parts[1]}`; // decimal comma
    }
  } else if (lastDot >= 0) {
    const parts = s.split(".");
    normalized = parts.length > 2 ? parts.join("") : s; // DE thousands vs decimal point
  } else {
    normalized = s;
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

function cellText(raw: unknown): string {
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    if (typeof o.text === "string") return o.text;
    if (o.result !== undefined) return cellText(o.result);
    if (Array.isArray(o.richText)) {
      return o.richText.map((p) => cellText(p)).join("");
    }
    return "";
  }
  return String(raw).trim();
}

export interface ParseSuccess {
  rows: AdRow[];
  columnsFound: string[];
  /** rows whose negative spend was clamped to 0 (refunds/adjustments) */
  clampedSpendRows: number;
  /** ISO 4217 code the export is denominated in (see detectCurrency) */
  currency: string;
  /** every distinct currency detected in the file, in detection order.
   *  More than one means a mixed-currency export — amounts are audited
   *  as `currency` (the first/majority one) and the mix is disclosed. */
  currenciesSeen: string[];
}

/**
 * Detect the export's currency, in priority order:
 *  1. the money columns' own headers ("Amount spent (EUR)");
 *  2. a dedicated Currency / Account Currency column's cell values;
 *  3. symbols inside the money cells themselves (€, £, $, …);
 *  4. USD (Ads Manager's most common account currency — and the only
 *     honest fallback: the report never claims another currency without
 *     evidence in the file).
 */
function detectCurrency(
  headerRaw: string[],
  fieldByCol: Map<number, FieldKey>,
  dataRows: unknown[][],
): { currency: string; currenciesSeen: string[] } {
  const seen: string[] = [];
  const note = (c: string | null) => {
    if (c && !seen.includes(c)) seen.push(c);
    return c;
  };

  // 1. Money-column headers carry the code in Ads Manager exports.
  for (const [i, f] of fieldByCol) {
    if (f === "amount_spent" || f === "cost_per_result" || f === "daily_budget" || f === "lifetime_budget") {
      const c = note(currencyCodeFromText(headerRaw[i] ?? ""));
      if (c) return { currency: c, currenciesSeen: seen };
    }
  }
  // 2. A dedicated currency column.
  const curCol = headerRaw.findIndex((h) => /currency/i.test(h ?? ""));
  if (curCol >= 0) {
    const counts = new Map<string, number>();
    for (const r of dataRows) {
      const c = currencyCodeFromText(cellText(r[curCol]));
      if (c) {
        note(c);
        counts.set(c, (counts.get(c) ?? 0) + 1);
      }
    }
    if (counts.size > 0) {
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
      return { currency: top, currenciesSeen: seen };
    }
  }
  // 3. Symbols inside money cells (first consistent symbol wins; all
  //    distinct symbols are collected for the mixed-currency disclosure).
  const moneyCols = [...fieldByCol.entries()]
    .filter(([, f]) => f === "amount_spent" || f === "cost_per_result")
    .map(([i]) => i);
  let first: string | null = null;
  for (const r of dataRows) {
    for (const i of moneyCols) {
      const c = currencyCodeFromCellSymbol(r[i]);
      if (c) {
        note(c);
        if (!first) first = c;
      }
    }
  }
  if (first) return { currency: first, currenciesSeen: seen };
  return { currency: DEFAULT_CURRENCY, currenciesSeen: seen };
}

function buildRows(
  headerRaw: string[],
  dataRows: unknown[][],
  level: Level,
): ParseSuccess {
  const fieldByCol = new Map<number, FieldKey>();
  const found = new Set<FieldKey>();
  headerRaw.forEach((h, i) => {
    const f = mapHeader(h);
    if (f && !found.has(f)) {
      fieldByCol.set(i, f);
      found.add(f);
    }
  });

  const missing = missingRequiredFields(found, level);
  if (missing.length > 0) {
    const labels = missing.map(labelForField);
    throw new UploadError(
      "missing_columns",
      `Your export is missing ${labels.length} column${labels.length > 1 ? "s" : ""} we need: ${labels.join(", ")}. ` +
        `In Ads Manager go to Columns → Customize Columns, tick the missing ones, and export again.`,
    );
  }

  if (dataRows.length > LIMITS.MAX_ROWS) {
    throw new UploadError(
      "too_many_rows",
      `This file has ${dataRows.length.toLocaleString()} rows — over the 50,000-row limit. Split by campaign or shorten the date range.`,
    );
  }

  const rows: AdRow[] = [];
  let clampedSpendRows = 0;
  for (const raw of dataRows) {
    const get = (f: FieldKey): unknown => {
      for (const [i, field] of fieldByCol) if (field === f) return raw[i];
      return null;
    };
    const spend = parseNumber(get("amount_spent"));
    if (spend === null) continue; // summary/blank rows in exports carry no spend
    // Negative spend rows are refund/adjustment artifacts of the export.
    // Counting them would subtract phantom money from every total and
    // could push an account's spend negative — clamp to 0 and disclose
    // the count on the report (see ParseSuccess.clampedSpendRows).
    if (spend < 0) clampedSpendRows += 1;
    let frequency = parseNumber(get("frequency"));
    const impressions = parseNumber(get("impressions"));
    const reach = parseNumber(get("reach"));
    if (frequency === null && impressions !== null && reach !== null && reach > 0) {
      frequency = impressions / reach;
    }
    rows.push({
      campaign_name: cellText(get("campaign_name")),
      adset_name: cellText(get("adset_name")),
      ad_name: level === "ad" ? cellText(get("ad_name")) || null : null,
      amount_spent: Math.max(0, spend),
      impressions,
      reach,
      frequency,
      clicks: parseNumber(get("clicks")),
      ctr: parseNumber(get("ctr")),
      cpc: parseNumber(get("cpc")),
      results: parseNumber(get("results")),
      cost_per_result: parseNumber(get("cost_per_result")),
      daily_budget: parseNumber(get("daily_budget")),
      lifetime_budget: parseNumber(get("lifetime_budget")),
    });
  }

  if (rows.length === 0) {
    throw new UploadError(
      "no_rows",
      "We couldn't read any rows in this file. Re-export from Ads Manager and make sure the date range actually has data.",
    );
  }

  const { currency, currenciesSeen } = detectCurrency(headerRaw, fieldByCol, dataRows);
  return { rows, columnsFound: headerRaw.filter(Boolean), clampedSpendRows, currency, currenciesSeen };
}

/** Data-quality gate (PRD F3): refuse files that can't support an audit. */
export function qualityGate(rows: AdRow[]): void {
  if (rows.length < LIMITS.MIN_ROWS) {
    throw new UploadError(
      "too_few_rows",
      `Only ${rows.length} row${rows.length === 1 ? "" : "s"} in this file — too little data to audit. Export at ad set level for the last 30 days.`,
    );
  }
  const totalSpend = rows.reduce((s, r) => s + r.amount_spent, 0);
  if (totalSpend <= 0) {
    throw new UploadError(
      "zero_spend",
      "This export shows zero spend. That usually means the date range was empty or the wrong ad account was selected. Check the range covers days with active ads, then re-export.",
    );
  }
}

/**
 * Decompression-bomb pre-check for XLSX files, run BEFORE ExcelJS touches
 * the buffer. Reads only the zip central directory (a few KB at the end of
 * the file) and totals the *uncompressed* size of every entry. A 10 MB
 * upload limit means nothing if the XML inside inflates to gigabytes, so
 * an oversized total is rejected here — no entry is ever decompressed
 * first. ZIP64 archives put 0xFFFFFFFF sentinels in these fields; since
 * their true sizes can't be verified from the directory, they're refused.
 */
export function assertXlsxWithinLimits(buffer: Buffer): void {
  // Locate the End Of Central Directory record (signature PK\x05\x06),
  // scanning backwards over the maximum possible comment length.
  let eocd = -1;
  const scanFloor = Math.max(0, buffer.length - 22 - 0xffff);
  for (let i = buffer.length - 22; i >= scanFloor; i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) {
    throw new UploadError(
      "bad_xlsx",
      "This .xlsx file doesn't look like a real Excel workbook. Re-export from Ads Manager and try again.",
    );
  }
  const entryCount = buffer.readUInt16LE(eocd + 10);
  const cdOffset = buffer.readUInt32LE(eocd + 16);
  if (entryCount === 0xffff || cdOffset === 0xffffffff) {
    throw new UploadError(
      "bad_xlsx",
      "This Excel file uses an archive format we can't safely verify. In Ads Manager, choose Export → CSV instead.",
    );
  }
  if (entryCount > LIMITS.MAX_XLSX_ENTRIES) {
    throw new UploadError(
      "bad_xlsx",
      "This Excel file contains an unusual number of parts. In Ads Manager, choose Export → CSV instead.",
    );
  }
  let totalUncompressed = 0;
  let pos = cdOffset;
  for (let n = 0; n < entryCount; n++) {
    if (pos + 46 > buffer.length || buffer.readUInt32LE(pos) !== 0x02014b50) {
      throw new UploadError(
        "bad_xlsx",
        "This .xlsx file doesn't look like a real Excel workbook. Re-export from Ads Manager and try again.",
      );
    }
    const uncompressed = buffer.readUInt32LE(pos + 24);
    if (uncompressed === 0xffffffff) {
      throw new UploadError(
        "bad_xlsx",
        "This Excel file uses an archive format we can't safely verify. In Ads Manager, choose Export → CSV instead.",
      );
    }
    totalUncompressed += uncompressed;
    if (totalUncompressed > LIMITS.MAX_XLSX_UNCOMPRESSED_BYTES) {
      throw new UploadError(
        "too_large",
        "This Excel file expands to far more data than a 30-day Ads Manager export should contain. Export the last 30 days only, or choose Export → CSV, and try again.",
      );
    }
    const nameLen = buffer.readUInt16LE(pos + 28);
    const extraLen = buffer.readUInt16LE(pos + 30);
    const commentLen = buffer.readUInt16LE(pos + 32);
    pos += 46 + nameLen + extraLen + commentLen;
  }
}

export async function parseExport(
  buffer: Buffer,
  kind: FileKind,
  level: Level,
): Promise<ParseSuccess> {
  if (kind === "csv") {
    const text = buffer.toString("utf-8").replace(/^﻿/, "");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    const grid = parsed.data.filter((r) => r.some((c) => String(c).trim() !== ""));
    if (grid.length < 2) {
      throw new UploadError(
        "no_rows",
        "We couldn't read any rows in this file. Re-export from Ads Manager and make sure the date range actually has data.",
      );
    }
    const [headers, ...data] = grid;
    const out = buildRows(headers.map((h) => String(h)), data, level);
    qualityGate(out.rows);
    return out;
  }

  assertXlsxWithinLimits(buffer);
  const wb = new ExcelJS.Workbook();
  try {
    // exceljs typings expect a specific Buffer flavour; cast is safe here.
    await wb.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new UploadError(
      "bad_xlsx",
      "We couldn't open this Excel file. Re-export from Ads Manager (Export → Excel) and try again.",
    );
  }
  const ws = wb.worksheets[0];
  if (!ws) {
    throw new UploadError("no_rows", "This Excel file has no worksheets we can read.");
  }
  const grid: unknown[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    // Enforce the row cap DURING the scan — never build a full in-memory
    // grid of an oversized sheet and only check afterwards.
    if (grid.length > LIMITS.MAX_ROWS + 1) {
      throw new UploadError(
        "too_many_rows",
        `This file has over ${LIMITS.MAX_ROWS.toLocaleString()} rows — over the limit. Split by campaign or shorten the date range.`,
      );
    }
    const values = (row.values as unknown[]).slice(1); // exceljs is 1-indexed
    grid.push(values);
  });
  if (grid.length < 2) {
    throw new UploadError(
      "no_rows",
      "We couldn't read any rows in this file. Re-export from Ads Manager and make sure the date range actually has data.",
    );
  }
  const headers = (grid[0] as unknown[]).map((h) => cellText(h));
  const out = buildRows(headers, grid.slice(1), level);
  qualityGate(out.rows);
  return out;
}
