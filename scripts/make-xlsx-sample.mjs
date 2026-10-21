/**
 * One-off utility: converts test-data/sample-ads-manager-export.csv into an
 * equivalent .xlsx so the ExcelJS parsing path can be tested with identical
 * data. Not part of the product runtime.
 */
import fs from "fs";
import Papa from "papaparse";
import ExcelJS from "exceljs";

const csv = fs.readFileSync(new URL("../test-data/sample-ads-manager-export.csv", import.meta.url), "utf-8");
const rows = Papa.parse(csv, { skipEmptyLines: true }).data;

const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Advertiser report");
for (const row of rows) {
  ws.addRow(row.map((c) => {
    if (c === "") return null;
    const n = Number(String(c).replace(/,/g, ""));
    return Number.isFinite(n) && /^\d/.test(String(c)) ? n : c;
  }));
}
await wb.xlsx.writeFile(new URL("../test-data/sample-ads-manager-export.xlsx", import.meta.url).pathname);
console.log("xlsx written", rows.length, "rows");
