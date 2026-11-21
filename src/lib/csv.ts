// Panel menu "Save as CSV" (Guy, 21 Nov): the one place a panel's rows become a CSV file.
//
// Pure: no DOM, no React, so the unit tests and the rule tests run it directly. The browser half
// (the Blob and the download) is downloadCsv, the only function here that touches `document`.
//
// The file (docs/v0.8/panel_menu_csv_v1.md, "The file"):
// - RFC 4180: comma-separated, CRLF line ends, a field quoted when it holds a comma, a quote, CR or
//   LF, a quote doubled inside a quoted field. Every row has the header's number of fields.
// - A UTF-8 byte-order mark first, so Excel opens "Côte", "Hôtel" and the en dash correctly.
// - A header row. A percentage is a number under a header that says so -- "Share (%)" over 45 --
//   never "45%" as text, so a spreadsheet can add it up.
// - Numbers as the panel shows them: rounded to the panel's own precision by the panel (the
//   builder), written here without thousands separators. Years as the panel shows them ("2024/25").
// - What the figures rest on -- the comparison set and the data year -- as LEADING COLUMNS
//   ("Comparison set", "Data year") repeated on every row, not a comment or an "about" line above
//   the header: a comment line breaks a strict parser and Excel's filters, and a column keeps with
//   its row when someone sorts or pastes a selection.
// - A withheld figure stays withheld: the panel's builder writes the words the screen shows
//   ("Too few schools (3)", "too few entries", "Suppressed") in place of the number, never the number.

export type CsvCell = string | number | null | undefined;

/** One panel's rows: exactly what the panel draws (its set, filters, year and suppression). */
export type CsvTable = {
  columns: string[];
  rows: CsvCell[][];
  /** What every row rests on, written as leading columns. Absent or null = no such column. */
  about?: { set?: string | null; year?: string | null };
};

export const CSV_BOM = "﻿";
export const ABOUT_SET = "Comparison set";
export const ABOUT_YEAR = "Data year";

// A cell Excel would read as a formula (=, +, @, or a leading tab/CR) is prefixed with an
// apostrophe -- the OWASP "CSV injection" guard. Numbers are never prefixed: a negative number is
// written as a number. Only text that begins that way, which no real school or subject name does.
const FORMULA = /^[=+@\t\r]/;

/** One field, RFC 4180-quoted. null, undefined and non-finite numbers are an empty field. */
export function csvField(v: CsvCell): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") {
    if (!Number.isFinite(v)) return "";
    // Never exponent form or a "-0": what the panel shows, as a spreadsheet reads it.
    const n = Object.is(v, -0) ? 0 : v;
    const str = String(n);
    if (!str.includes("e")) return str;
    return Math.abs(n) >= 1 ? BigInt(Math.round(n)).toString() : n.toFixed(20).replace(/0+$/, "");
  }
  let s = String(v);
  // The screen's dash for "no figure" is an empty cell (R-PANEL-CSV-SUPPRESSED): words stay words.
  if (/^\s*[—–-]\s*$/.test(s)) return "";
  if (FORMULA.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** The table with its "about" as leading columns (only those given). */
export function withAbout(t: CsvTable): { columns: string[]; rows: CsvCell[][] } {
  const lead: { label: string; value: string }[] = [];
  if (t.about?.set) lead.push({ label: ABOUT_SET, value: t.about.set });
  if (t.about?.year) lead.push({ label: ABOUT_YEAR, value: t.about.year });
  // A column the table already has (a trend table's own Year) isn't repeated.
  const keep = lead.filter((l) => !t.columns.includes(l.label));
  return { columns: [...keep.map((l) => l.label), ...t.columns], rows: t.rows.map((r) => [...keep.map((l) => l.value), ...r]) };
}

/** The whole file: BOM, header, rows, CRLF. A short row is padded, a long one is an error. */
export function toCsv(t: CsvTable): string {
  const { columns, rows } = withAbout(t);
  const lines = [columns.map(csvField).join(",")];
  for (const r of rows) {
    if (r.length > columns.length) throw new Error(`CSV row has ${r.length} fields, the header ${columns.length}`);
    const full = r.length < columns.length ? [...r, ...Array<CsvCell>(columns.length - r.length).fill(null)] : r;
    lines.push(full.map(csvField).join(","));
  }
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/** A lower-case, ASCII, underscore-free slug: "St Mary's C of E (VA)" -> "st-marys-c-of-e-va". */
export function slug(s: string): string {
  return (
    s
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60)
      .replace(/-+$/g, "") || "panel"
  );
}

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** vicdata_<school-or-group>_<panel-title>_<YYYY-MM-DD>.csv, each part slugged. */
export function csvFileName(who: string | null | undefined, title: string, on: Date = new Date()): string {
  return ["vicdata", ...(who ? [slug(who)] : []), slug(title), ymd(on)].join("_") + ".csv";
}

// ------------------------------------------------------------------ figures as the panel shows them

/** A number at the panel's precision (null stays null). */
export function shown(v: number | null | undefined, digits = 0): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

/** A 0-1 share as the percentage the panel shows (45, under a "(%)" header). */
export function pct(share: number | null | undefined, digits = 0): number | null {
  return share === null || share === undefined ? null : shown(share * 100, digits);
}

/** Parse a CSV back (tests and the hand check): RFC 4180, BOM stripped. */
export function parseCsv(text: string): string[][] {
  const s = text.startsWith(CSV_BOM) ? text.slice(1) : text;
  const out: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\r" && s[i + 1] === "\n") { row.push(field); out.push(row); row = []; field = ""; i++; }
    else if (ch === "\n") { row.push(field); out.push(row); row = []; field = ""; }
    else field += ch;
  }
  if (field || row.length) { row.push(field); out.push(row); }
  return out;
}

/** The browser half: hand the file to the browser as a download. */
export function downloadCsv(fileName: string, text: string): void {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
