/**
 * Currency support for audits.
 *
 * An Ads Manager export is denominated in ONE account currency, but until
 * now the parser stripped the symbols and the whole product presented the
 * numbers as USD. This module is the single source of truth for:
 *  - recognizing a currency (ISO code in a header, a "Currency" column, or
 *    a symbol inside a money cell),
 *  - the display symbol for a code,
 *  - formatting an amount with that symbol.
 *
 * Amounts themselves are plain numbers end to end — the currency only
 * changes how they are labelled, never how they are computed or checked.
 */

export interface CurrencyInfo {
  code: string;
  symbol: string;
  /** plain-English unit word for prose ("dollar", "euro", …) */
  word: string;
}

const TABLE: Record<string, { symbol: string; word: string }> = {
  USD: { symbol: "$", word: "dollar" },
  EUR: { symbol: "€", word: "euro" },
  GBP: { symbol: "£", word: "pound" },
  JPY: { symbol: "¥", word: "yen" },
  CNY: { symbol: "¥", word: "yuan" },
  INR: { symbol: "₹", word: "rupee" },
  AUD: { symbol: "A$", word: "dollar" },
  CAD: { symbol: "C$", word: "dollar" },
  BRL: { symbol: "R$", word: "real" },
  MXN: { symbol: "$", word: "peso" },
  CHF: { symbol: "CHF ", word: "franc" },
  SEK: { symbol: "kr ", word: "krona" },
  NOK: { symbol: "kr ", word: "krone" },
  DKK: { symbol: "kr ", word: "krone" },
  PLN: { symbol: "zł ", word: "zloty" },
  HUF: { symbol: "Ft ", word: "forint" },
  CZK: { symbol: "Kč ", word: "koruna" },
  TRY: { symbol: "₺", word: "lira" },
  ZAR: { symbol: "R ", word: "rand" },
  AED: { symbol: "د.إ ", word: "dirham" },
  SGD: { symbol: "S$", word: "dollar" },
  HKD: { symbol: "HK$", word: "dollar" },
  NZD: { symbol: "NZ$", word: "dollar" },
  KRW: { symbol: "₩", word: "won" },
  RUB: { symbol: "₽", word: "ruble" },
  THB: { symbol: "฿", word: "baht" },
  IDR: { symbol: "Rp ", word: "rupiah" },
  PHP: { symbol: "₱", word: "peso" },
  VND: { symbol: "₫", word: "dong" },
  MYR: { symbol: "RM ", word: "ringgit" },
  ILS: { symbol: "₪", word: "shekel" },
};

export const DEFAULT_CURRENCY = "USD";

export function currencyInfo(code: string | null | undefined): CurrencyInfo {
  const c = (code ?? DEFAULT_CURRENCY).toUpperCase();
  const t = TABLE[c];
  if (t) return { code: c, symbol: t.symbol, word: t.word };
  // Unknown but well-formed code: label with the code itself, never a
  // wrong symbol — "EUR 12.00"-style honesty over a guessed glyph.
  return { code: c, symbol: `${c} `, word: c };
}

export function symbolForCurrency(code: string | null | undefined): string {
  return currencyInfo(code).symbol;
}

export function isKnownCurrencyCode(s: string): boolean {
  return /^[A-Z]{3}$/.test(s) && s in TABLE;
}

/** Extract an ISO code from a header like "Amount spent (EUR)" or a bare
 *  "Account Currency" value cell like "EUR" / "eur" / "Euro (EUR)". */
export function currencyCodeFromText(text: string): string | null {
  const s = String(text ?? "");
  const paren = /\(([A-Za-z]{3})\)/.exec(s);
  if (paren && isKnownCurrencyCode(paren[1].toUpperCase())) return paren[1].toUpperCase();
  const bare = s.trim().toUpperCase();
  if (isKnownCurrencyCode(bare)) return bare;
  const word = /\b(USD|EUR|GBP|JPY|CNY|INR|AUD|CAD|BRL|MXN|CHF|SEK|NOK|DKK|PLN|HUF|CZK|TRY|ZAR|AED|SGD|HKD|NZD|KRW|RUB|THB|IDR|PHP|VND|MYR|ILS)\b/.exec(s.toUpperCase());
  return word ? word[1] : null;
}

/** Symbols that can appear inside a money cell, longest first so "A$"
 *  wins over "$". ¥ is ambiguous (JPY/CNY) — Meta exports using ¥ are
 *  overwhelmingly JPY accounts, so it maps to JPY. */
const CELL_SYMBOLS: [string, string][] = [
  ["US$", "USD"], ["A$", "AUD"], ["C$", "CAD"], ["CA$", "CAD"],
  ["HK$", "HKD"], ["NZ$", "NZD"], ["S$", "SGD"], ["R$", "BRL"],
  ["€", "EUR"], ["£", "GBP"], ["¥", "JPY"], ["₹", "INR"],
  ["₩", "KRW"], ["₽", "RUB"], ["₺", "TRY"], ["฿", "THB"],
  ["₱", "PHP"], ["₫", "VND"], ["₪", "ILS"], ["$", "USD"],
];

export function currencyCodeFromCellSymbol(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  for (const [sym, code] of CELL_SYMBOLS) {
    if (raw.includes(sym)) return code;
  }
  return null;
}

/** All currency glyphs that may prefix an amount in report prose — used
 *  by the LLM amount check and the free-preview redaction so non-USD
 *  reports are screened/redacted exactly like USD ones. */
export const AMOUNT_SYMBOL_RE = /US\$|A\$|C\$|CA\$|HK\$|NZ\$|S\$|R\$|[$€£¥₹₩₽₺฿₱₫₪]/;
