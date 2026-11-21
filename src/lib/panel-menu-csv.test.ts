// Panel menu "Save as CSV" and the one menu order (Guy, 21 Nov; docs/v0.8/panel_menu_csv_v1.md).
// R-PANEL-CSV-FILE: the file itself (src/lib/csv.ts). R-PANEL-MENU-ORDER: every panel's ··· menu has the
// same rows in the same order (PanelFooter's panelMenuRows, the only menu every product draws).
// R-PANEL-CSV-ROWS / R-PANEL-CSV-SUPPRESSED: SMT Overview's rows match what its views draw (the other
// products' are in panel-csv-{smt,admissions,teacher,group}.test.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { CSV_BOM, csvField, csvFileName, parseCsv, pct, shown, slug, toCsv, withAbout } from "./csv";
import { PANEL_MENU, panelMenuRows } from "@/components/shell/PanelFooter";
import { createCsvRegistry } from "@/components/shell/panel-csv";
import { bandCsv, marketCsv, rollCsv, scorecardCsv } from "@/components/smt/csv";
import { Scorecard } from "@/components/smt/views/Scorecard";
import { BandTable, MarketTable, RollTable } from "@/components/smt/views/Tables";
import type { Overview } from "@/lib/smt/overview";

// ------------------------------------------------------------------ R-PANEL-CSV-FILE

test("R-PANEL-CSV-FILE: RFC 4180 quoting, a BOM, a header row, CRLF, every row the header's width", () => {
  const text = toCsv({ columns: ["School", "Share (%)", "Note"], rows: [["St Mary's, Reading", 45.3, 'the "best"'], ["Line\nbreak", null, undefined], ["Côte – école", -0.31]] });
  assert.ok(text.startsWith(CSV_BOM), "UTF-8 BOM first, so Excel reads accents");
  const body = text.slice(1);
  assert.equal(body.split("\r\n")[0], "School,Share (%),Note");
  assert.ok(body.includes(`"St Mary's, Reading",45.3,"the ""best"""`));
  assert.ok(body.includes(`"Line\nbreak",,`));
  assert.ok(body.includes("Côte – école,-0.31,"), "a short row is padded to the header's width");
  assert.ok(body.endsWith("\r\n"));
  const back = parseCsv(text);
  assert.deepEqual(back, [["School", "Share (%)", "Note"], ["St Mary's, Reading", "45.3", 'the "best"'], ["Line\nbreak", "", ""], ["Côte – école", "-0.31", ""]]);
  assert.throws(() => toCsv({ columns: ["a"], rows: [[1, 2]] }));
});

test("R-PANEL-CSV-FILE: numbers as numbers (no %, no separators, no exponent), a formula-looking text defused", () => {
  assert.equal(csvField(1234567), "1234567");
  assert.equal(csvField(-0), "0");
  assert.equal(csvField(Number.NaN), "");
  assert.equal(csvField(Infinity), "");
  assert.equal(csvField(1e-7), "0.0000001");
  assert.equal(csvField(1e21), "1000000000000000000000");
  assert.equal(csvField("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(csvField("+44"), "'+44");
  assert.equal(csvField("—"), "—");
  assert.equal(pct(0.4531), 45);
  assert.equal(pct(0.4531, 1), 45.3);
  assert.equal(shown(12.345, 2), 12.35);
  assert.equal(shown(null), null);
});

test("R-PANEL-CSV-FILE: the comparison set and data year are leading columns, never repeated", () => {
  const t = withAbout({ columns: ["Subject", "Entries"], rows: [["Maths", 12]], about: { set: "10 nearest", year: "2024/25" } });
  assert.deepEqual(t.columns, ["Comparison set", "Data year", "Subject", "Entries"]);
  assert.deepEqual(t.rows, [["10 nearest", "2024/25", "Maths", 12]]);
  const own = withAbout({ columns: ["Data year", "Roll"], rows: [["2024/25", 400]], about: { set: null, year: "2024/25" } });
  assert.deepEqual(own.columns, ["Data year", "Roll"]);
  assert.deepEqual(withAbout({ columns: ["x"], rows: [[1]] }).columns, ["x"]);
});

test("R-PANEL-CSV-FILE: the file name is vicdata_<school-or-group>_<panel-title>_<YYYY-MM-DD>.csv, slugged", () => {
  const on = new Date(2026, 10, 23);
  assert.equal(csvFileName("Leighton Park School", "Scorecard", on), "vicdata_leighton-park-school_scorecard_2026-11-23.csv");
  assert.equal(csvFileName("Harris Federation", "Roll by phase · 2024/25", on), "vicdata_harris-federation_roll-by-phase-2024-25_2026-11-23.csv");
  assert.equal(csvFileName(null, "Map", on), "vicdata_map_2026-11-23.csv");
  assert.equal(slug("St Mary's C of E (VA) & Côte"), "st-marys-c-of-e-va-and-cote");
  assert.equal(slug("!!!"), "panel");
});

// ------------------------------------------------------------------ R-PANEL-MENU-ORDER

const ORDER = ["Copy to a dashboard…", "Copy to a meeting…", "Print or save as PDF", "Save as CSV"];

test("R-PANEL-MENU-ORDER: the rows are always Copy to a dashboard…, Copy to a meeting…, Print or save as PDF, Save as CSV, in that order", () => {
  assert.deepEqual(Object.values(PANEL_MENU), ORDER);
  const label = (h: Parameters<typeof panelMenuRows>[0]) => panelMenuRows(h).map((k) => PANEL_MENU[k]);
  // Each host, by what it can do: a custom dashboard (both copies), SMT and Admissions (a meeting only),
  // View as / head office / a meeting slide (print and CSV only), a view with no rows (no CSV row).
  const hosts = {
    "custom dashboard": { dashboard: true, meeting: true, csv: true },
    "SMT, Admissions": { dashboard: false, meeting: true, csv: true },
    "View as, head office, group, meeting slide": { dashboard: false, meeting: false, csv: true },
    "a view with no rows": { dashboard: false, meeting: true, csv: false },
  };
  for (const [name, has] of Object.entries(hosts)) {
    const rows: string[] = label(has);
    assert.ok(rows.includes("Print or save as PDF"), `${name}: print is always there`);
    // The same relative order everywhere: each menu is ORDER with rows left out, never reordered.
    assert.deepEqual(rows, ORDER.filter((r) => rows.includes(r)), name);
  }
  assert.deepEqual(label({ dashboard: true, meeting: true, csv: true }), ORDER);
  assert.deepEqual(label({ dashboard: false, meeting: false, csv: false }), ["Print or save as PDF"]);
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = path.join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f) ? [p] : [];
  });
}

test("R-PANEL-MENU-ORDER: no product draws its own copy or print rows, and no disabled Coming soon rows are left", () => {
  const src = path.resolve(__dirname, "..");
  const found: string[] = [];
  for (const file of walk(path.join(src, "components"))) {
    const text = readFileSync(file, "utf8");
    // Old labels, as a string a menu row would carry (comments may still name the history).
    for (const old of ['"Print this graph"', '"Print this view"', '"Copy this view…"', '"Copy to meeting slides…"', '"Copy to custom dashboard"', '"Copy to a presentation"'])
      if (text.includes(`label: ${old}`) || text.includes(`label=${old}`)) found.push(`${path.relative(src, file)}: ${old}`);
  }
  assert.deepEqual(found, []);
  const footer = readFileSync(path.join(src, "components/shell/PanelFooter.tsx"), "utf8");
  assert.ok(!/tag="Coming soon"/.test(footer), "the Coming soon rows are gone");
  // Every ··· menu is PanelExport (the only data-panel-menu button).
  const menus = walk(path.join(src, "components")).filter((f) => readFileSync(f, "utf8").includes("data-panel-menu=\"\""));
  assert.deepEqual(menus.map((f) => path.relative(src, f)), ["components/shell/PanelFooter.tsx"]);
});

// ------------------------------------------------------------------ the registry

test("R-PANEL-CSV-ROWS: a panel's rows are its view's, the latest view on screen first, none once it's gone", () => {
  const reg = createCsvRegistry("Roll");
  assert.equal(reg.get(), null, "no view registered: no CSV row");
  const card = { current: () => ({ columns: ["a"], rows: [[1]] }) };
  const modal = { current: () => ({ columns: ["a"], rows: [[2]] }) };
  const off = reg.add(card);
  const offModal = reg.add(modal);
  assert.deepEqual(reg.get()?.rows, [[2]], "full screen: the modal's view");
  offModal();
  assert.deepEqual(reg.get()?.rows, [[1]], "closed: the card's again");
  const empty = reg.add({ current: () => null });
  assert.deepEqual(reg.get()?.rows, [[1]], "a view with nothing to give doesn't hide one that has rows");
  empty();
  off();
  assert.equal(reg.get(), null);
});

// ------------------------------------------------------------------ SMT Overview

const cells = (html: string) =>
  Array.from(html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)).map((m) => Array.from(m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)).map((c) => c[1].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim()));
const asShown = (v: string) => (v === "—" || v === "" ? null : Number(v.replace(/[%,]/g, "").replace("−", "-").replace(/^\+/, "")));

const OV = {
  urn: "110110",
  set: { kind: "nearest", label: "10 nearest independent schools", short: "10 nearest", size: 10 },
  igcse: false,
  schools: { "110110": { name: "Leighton Park School", easting: 1, northing: 2 } },
  rolls: {},
  now: { census: 2024, roll: 553, base: { period: 2010, roll: 500 }, changePct: 10.6, girls: 250, boys: 303, boarding: null, entry: null, sizes: [], setSizes: [], laName: "Reading" },
  rows: [
    { key: "roll", label: "Roll", stage: null, unit: "pupils", value: 553, period: 2024, set: { rank: 3, of: 11, label: "in 10 nearest" }, region: { rank: 120, of: 1400, name: "South East" }, england: { rank: 900, of: 9000 }, since: { from: 2022, to: 2024, change: 4.2, unit: "pct", period: "since 2022/23" }, note: null },
    { key: "Academic::aps_per_entry", label: "Academic: points per entry", stage: "ks5", unit: "points", value: 38.456, period: 2024, set: null, region: null, england: null, since: null, note: null },
    { key: "market11", label: "Market share at 11+", stage: null, unit: "share", value: 12.34, period: 2024, set: { rank: 2, of: 10, label: "" }, region: null, england: null, since: { from: 2022, to: 2024, change: -1.26, unit: "pp", period: "since 2022/23" }, note: null },
  ],
  p8: { status: "independent", text: "" },
  va: null,
  flags: [],
  flagsLoaded: true,
  trends: {
    roll: { lines: [{ key: "school", label: "Leighton Park", pts: [{ year: 2022, value: 100 }, { year: 2023, value: 103.4 }], actual: [{ year: 2022, value: 530 }, { year: 2023, value: 548 }] }], base: 2022, laName: "Reading" },
    results: [{ stage: "ks5", label: "A-level points", school: [{ year: 2023, value: 39.12 }, { year: 2024, value: 38.456 }], band: [{ year: 2023, p25: 35, p75: 41.25, n: 9 }, { year: 2024, p25: null, p75: null, n: 2 }] }],
    market: { status: "ready", school: [{ year: 2023, value: 12.34 }, { year: 2024, value: 11.08 }], rival: [{ year: 2023, value: 20.5 }], rivalName: "Reading Blue Coat", rivals: 9, defaultRivals: false, setRivals: "10 nearest", middle: [{ year: 2023, value: 8.25 }, { year: 2024, value: null }] },
  },
  notes: { since: "", middleHalf: "", rollIndexed: "", trendYears: "" },
} as unknown as Overview;
const SCHOOL = { name: "Leighton Park School", regionName: "South East", phases: { gcse: true, post16: true } } as never;

test("R-PANEL-CSV-ROWS: SMT Scorecard -- each row's figure and ranks are the table's, at its precision", () => {
  const html = renderToStaticMarkup(createElement(Scorecard, { o: OV, school: SCHOOL }));
  const table = cells(html).slice(1);
  const csv = scorecardCsv(OV, "South East");
  assert.equal(csv.rows.length, table.length);
  csv.rows.forEach((r, i) => {
    assert.equal(r[0], table[i][0], "measure");
    assert.equal(r[2], asShown(table[i][1]), `${r[0]}: the figure as shown`);
    assert.equal(table[i][2], r[4] === null ? "—" : `${r[4]} of ${r[5]}`, `${r[0]}: set rank`);
  });
  assert.equal(csv.rows[1][2], 38.46, "points per entry to 2 places, as fmt shows it");
  assert.equal(csv.rows[2][3], "%", "a share's unit is %, the figure a number");
  assert.equal(csv.rows[2][6], "n/a", "market share has no region rank: the table's n/a");
  assert.equal(csv.about?.set, "10 nearest independent schools");
  assert.ok(toCsv(csv).includes("Comparison set,Measure,Year,You,Unit"));
});

test("R-PANEL-CSV-ROWS: SMT roll, results and market trend tables -- the CSV is the table, year by year", () => {
  const roll = cells(renderToStaticMarkup(createElement(RollTable, { o: OV }))).slice(1);
  const rc = rollCsv(OV.trends.roll.lines, OV.trends.roll.base)!;
  rc.rows.forEach((r, i) => assert.deepEqual([r[0], r[1], r[2]], [roll[i][0], asShown(roll[i][1]), asShown(roll[i][2])]));
  const t = OV.trends.results[0];
  const band = cells(renderToStaticMarkup(createElement(BandTable, { title: "x", school: t.school, band: t.band, unit: "points", setLabel: OV.set.label, valueKey: "Academic::aps_per_entry" }))).slice(1);
  const bc = bandCsv(t.school, t.band, "points", OV.set.label, t.label, "Academic::aps_per_entry")!;
  bc.rows.forEach((r, i) => {
    assert.equal(r[0], band[i][0]);
    assert.equal(r[2], asShown(band[i][1]));
    assert.equal(band[i][2], r[3] === null ? "—" : `${(r[3] as number).toFixed(2)} – ${(r[4] as number).toFixed(2)}`);
  });
  const market = cells(renderToStaticMarkup(createElement(MarketTable, { o: OV }))).slice(1);
  const mc = marketCsv(OV.trends.market, "Leighton Park School")!;
  assert.deepEqual(mc.columns, ["Year", "Leighton Park School (%)", "Reading Blue Coat (%)", "Rivals' middle (%)"]);
  mc.rows.forEach((r, i) => assert.deepEqual(r.map((v, j) => (j === 0 ? v : v)), [market[i][0], ...market[i].slice(1).map(asShown)]));
});

test("R-PANEL-CSV-SUPPRESSED: SMT -- a year whose set band rests on too few schools stays blank, as the table's dash", () => {
  const t = OV.trends.results[0];
  const bc = bandCsv(t.school, t.band, "points", OV.set.label, t.label, "Academic::aps_per_entry")!;
  const y24 = bc.rows.find((r) => r[0] === "2024/25")!;
  assert.deepEqual([y24[3], y24[4], y24[5]], [null, null, 2], "no quartiles the screen doesn't draw; its school count kept");
  const market = { ...OV.trends.market, band: [{ year: 2023, p25: 5, p75: 9, n: 2 }, { year: 2024, p25: 6, p75: 9, n: 2 }] } as Overview["trends"]["market"];
  assert.ok(!marketCsv(market, "x")!.columns.some((c) => /quartile/.test(c)), "a rivals' band on fewer than 3 schools isn't drawn, so isn't exported");
  assert.equal(marketCsv({ status: "empty", reason: "No rivals" }, "x"), null, "an empty view: no CSV row");
});
