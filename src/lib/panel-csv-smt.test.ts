// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/panel-csv-smt.test.ts
// Panel menu "Save as CSV" (21 Nov), SMT Pupils, Context and Academic (src/components/smt/csv-*.ts):
//   R-PANEL-CSV-ROWS        a builder's rows are the rows the view draws: the view rendered on a small
//                           fixture (renderToStaticMarkup) and its cells read back against the CSV, or the
//                           CSV checked against the same data the chart is given.
//   R-PANEL-CSV-SUPPRESSED  a figure the view withholds (a subject under the entries floor, a school with no
//                           published figure, an independent school's free school meals) is written in the
//                           view's words, never as a number.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "http://supabase.test";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";

import { parseCsv, toCsv, type CsvTable } from "./csv";
import type { Academic } from "./smt/academic";
import type { Context } from "./smt/context";
import type { ContextMap } from "./smt/context-map";
import type { Pupils } from "./smt/pupils";
import { academicCsv, boardCsv } from "@/components/smt/csv-academic";
import { contextCsv, projectionCsv } from "@/components/smt/csv-context";
import { pupilsCsv } from "@/components/smt/csv-pupils";
import { AreasView, RankTable } from "@/components/smt/views/Academic";
import { BirthsTable } from "@/components/smt/views/Context";
import { EntryPoints } from "@/components/smt/views/Pupils";

// ------------------------------------------------------------------------------- helpers

/** The table body's cells, as text, row by row (the header row has <th>, so it isn't here). */
function cells(html: string): string[][] {
  const text = (s: string) =>
    s
      .replace(/<div[^>]*>.*?<\/div>/g, "")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;|&rsquo;/g, "'")
      .trim();
  return Array.from(html.matchAll(/<tr[^>]*>(.*?)<\/tr>/g))
    .map((m) => Array.from(m[1].matchAll(/<td[^>]*>(.*?)<\/td>/g)).map((c) => text(c[1])))
    .filter((r) => r.length > 1);
}
/** The CSV as text cells (header first), after the file round trip. */
const round = (t: CsvTable) => parseCsv(toCsv(t));
const col = (t: string[][], name: string) => {
  const i = t[0].indexOf(name);
  assert.ok(i >= 0, `no column "${name}" in ${t[0].join(" | ")}`);
  return t.slice(1).map((r) => r[i]);
};
// "1,234" as the screen prints it, as the CSV writes it.
const plain = (s: string) => s.replace(/,/g, "").replace(/^\+/, "").replace(/^−/, "-");
/** A screen cell as the CSV writes it: "—" empty, a figure as its number ("38.50" is 38.5). */
const asCsv = (s: string, none = "") => (s === "—" || s === "–" ? none : Number.isFinite(Number(plain(s))) && plain(s) !== "" ? String(Number(plain(s))) : s);

// ------------------------------------------------------------------------------- fixtures

const SCHOOL = { urn: "110110", name: "Leighton Park School", mixed: true, low: 11, high: 18, laName: "Reading" };

const pupils = {
  urn: "110110",
  set: { kind: "nearest", label: "10 nearest", size: 10 },
  level: { phase: "whole", area: null },
  highlight: null,
  now: { census: 2024, roll: 551.4, changePct: 6.4, girls: 260, boys: 291, boarding: { day: 401, boarders: 150 }, stayingOn: { pct: 87.6, from: 80, to: 70, year: 2024 }, sizes: [{ key: "secondary", label: "Secondary", total: 388, badge: "L", laMean: 900, englandMean: 950 }], mainBand: "secondary", laName: "Reading" },
  shape: { yearGroups: [{ age: 11, label: "Y7", female: 30, male: 40, total: 70 }, { age: 12, label: "Y8", female: 31, male: 41, total: 72 }], label: "tube", sinceYear: 2021, was: null, around: { la: null, set: [], stayingOnSet: { pct: 72.4, schools: 6 }, nearest: null, setMiddle: null } },
  entries: { status: "ready", rows: [{ entry: "11+", label: "11+ (Year 7)", age: 11, cohort: 1234.4, pool: 5321, poolYear: 2026, poolSource: "counted" }, { entry: "13+", label: "13+ (Year 9)", age: 13, cohort: 88, pool: null, poolYear: null, poolSource: null }] },
  leaving: [{ year: 2023, year11: 80, year12: 70, leaving: 10, stayingPct: 87.5 }],
  market: { status: "empty", reason: "No lists" },
  girlsBoys: null,
  dayBoarding: null,
  trends: { phases: [], base: null, pool: { status: "empty", reason: "none" }, area: { laName: "Reading", pts: [], ages: [11, 15], agesWord: "11–15", forward: null } },
} as unknown as Pupils;

const context = {
  urn: "110110",
  area: "around",
  level: "whole",
  ages: [11, 15],
  agesWord: "11–15",
  radius: "5 km",
  place: { town: "Reading", la: "Reading", region: "South East" },
  now: { children: { value: 9876, year: 2023, scope: "within 5 km", since: null }, mix: null, pupilsNearby: null, births: null, projection: null, schools: { count: 12, scope: "within 5 km", phaseWord: "secondary" }, oneNeighbourhood: false },
  social: { lsoa: null, imd: null, idaci: null, edition: null, mix: null, deprived20: null, fsm: { status: "independent" } },
  map: { las: [], schools: [], shade: "pupils aged 11–15", period: 2024 },
  byAge: { period: 2023, ages: [], scope: "around", laName: "Reading" },
  births: { la: [{ year: 2012, value: 2345.2 }, { year: 2013, value: 2290 }, { year: 2014, value: null }], england: [{ year: 2012, value: 661496 }, { year: 2013, value: 646904 }, { year: 2014, value: 640000 }], indexed: { la: [{ year: 2012, value: 100 }, { year: 2013, value: 97.65 }, { year: 2014, value: null }], england: [{ year: 2012, value: 100 }, { year: 2013, value: 97.8 }, { year: 2014, value: 96.75 }] }, base: 2012, laName: "Reading" },
  forward: {
    scope: "around",
    where: "within 5 km",
    estimates: [{ year: 2022, value: 9000 }, { year: 2023, value: 9100.4 }],
    projection: [
      { year: 2023, middle: 9100.4, low: 9100, high: 9101, scenario: 9100, ons: 9100, includesUnborn: false },
      { year: 2024, middle: 9200.6, low: 9000, high: 9400, scenario: 9300, ons: 9150, includesUnborn: false },
    ],
    latestYear: 2023,
    horizonEnd: 2024,
    unbornFrom: null,
    tile: null,
    ons: { base: 2022, around: true },
    scenarioLabel: "births held at the latest year",
    bandMissing: false,
  },
  nearby: { school: [], la: [], england: [], indexed: { school: [], la: [], england: [] }, base: null },
  notes: { births: "", projection: "", popByAge: "" },
} as unknown as Context;

const boardRow = (o: Partial<Academic["board"]["rows"][number]>) => ({ urn: "x", name: "X", you: false, km: null, easting: null, northing: null, value: null, lo: null, hi: null, band: null, grade: null, entries: null, share: null, last: null, change: null, england: null, quarter: null, why: null, ...o });
const subject = (o: Partial<Academic["areas"]["outside"][number]>) => ({ subject: "S", qualification: "GCE A level", vicdata: false, entries: 10, counts: [8, 9, 10], value: null, lo: null, hi: null, band: null, grade: null, setValues: [], typical: null, offering: null, place: null, only: false, size: null, ranked: false, why: null, ...o });

const academic = {
  urn: "110110",
  state: { phase: "post16", mode: "results", group: "alevel", applied: "ag", area: null },
  offer: { phases: { gcse: true, post16: true }, main: "post16", groups: ["alevel"], applied: [], areas: { gcse: [] } },
  period: 2024,
  set: { kind: "nearest", label: "10 nearest offering A level", pill: "10 nearest offering A level", size: 10, offering: 3, chosen: false, reachKm: 20, urns: [] },
  areaLabel: null,
  lines: [],
  col1: { title: "Results now", sub: "", note: null, summary: [] },
  board: {
    title: "A level, against the 10 nearest",
    subtitle: "Points per entry, A level 2024/25 · the set, ranked",
    measure: "Points per entry",
    unit: "points",
    period: 2024,
    rows: [
      boardRow({ urn: "1", name: "Abbey College", km: 3.456, easting: 1, northing: 1, value: 41.236, last: 40.004, quarter: "top", entries: 120 }),
      boardRow({ urn: "110110", name: "Leighton Park School", you: true, km: null, easting: 2, northing: 2, value: 38.5, last: 37.25, quarter: "middle", entries: 95 }),
      boardRow({ urn: "3", name: "Distant School", km: 14.6, value: null, why: "No A level points published for 2024/25." }),
    ],
    median: 38.5,
    england: null,
    place: { set: { rank: 2, of: 2 }, region: null, england: null },
    counts: null,
    setNote: null,
    empty: null,
  },
  areas: {
    blocks: [{ id: "sciences", label: "Sciences", quals: [{ qualification: "GCE A level", short: "A level", subjects: [subject({ subject: "Physics", entries: 3, value: null, why: "Subjects with fewer than 6 entries aren't ranked: one or two pupils would decide the rank.", ranked: false }), subject({ subject: "Biology", entries: 14, value: 40.456, place: { rank: 2, of: 4 }, ranked: true })] }] }],
    outside: [],
    none: null,
    period: 2024,
  },
  grades: [],
  trends: { label: "Points per entry", unit: "points", school: [], band: [], schoolLabel: null, note: "", lines: [], moves: [], movesKind: null, mix: { keys: [], years: [], sentence: null }, against: [] },
  notes: {},
} as unknown as Academic;

// ------------------------------------------------------------------------------- R-PANEL-CSV-ROWS

test("R-PANEL-CSV-ROWS: Academic's ranking table and its CSV carry the same schools, ranks and figures", () => {
  const html = renderToStaticMarkup(createElement(RankTable, { a: academic }));
  const screen = cells(html);
  const csv = round(academicCsv("DV-SMT-A-TABLE", academic)!);
  assert.equal(screen.length, csv.length - 1);
  assert.deepEqual(col(csv, "School"), screen.map((r) => r[1]));
  // Ranks: the table's "–" for a school with no figure is an empty cell; its "—" figure is "no figure".
  assert.deepEqual(col(csv, "Rank in set"), screen.map((r) => asCsv(r[0])));
  assert.deepEqual(col(csv, "Km"), screen.map((r) => asCsv(r[2])));
  assert.deepEqual(col(csv, "Points per entry"), screen.map((r) => asCsv(r[3], "no figure")));
  assert.deepEqual(col(csv, "Entries"), screen.map((r) => asCsv(r[4])));
  assert.deepEqual(col(csv, "2023/24"), screen.map((r) => asCsv(r[5])));
  // The about columns: the set and the board's year.
  assert.deepEqual(csv[0].slice(0, 2), ["Comparison set", "Data year"]);
  assert.equal(csv[1][0], "10 nearest offering A level");
  assert.equal(csv[1][1], "2024/25");
});

test("R-PANEL-CSV-ROWS: Academic's map exports only the schools it places; chart and table share the rows", () => {
  const map = boardCsv(academic, true)!;
  assert.deepEqual(map.rows.map((r) => r[1]), ["Abbey College", "Leighton Park School"]);
  assert.deepEqual(academicCsv("DV-SMT-A-CHART", academic), academicCsv("DV-SMT-A-TABLE", academic));
});

test("R-PANEL-CSV-ROWS: Context's births table and its CSV carry the same years, births and indexes", () => {
  const html = renderToStaticMarkup(createElement(BirthsTable, { c: context }));
  const screen = cells(html);
  const csv = round(contextCsv("DV-SMT-C-BIRTHS-TABLE", context)!);
  assert.equal(screen.length, csv.length - 1);
  csv.slice(1).forEach((r, i) => assert.deepEqual(r, screen[i].map((x) => asCsv(x))));
  assert.deepEqual(csv[0], ["Year", "Reading: births", "Reading: index (2012 = 100)", "England: births", "England: index"]);
});

test("R-PANEL-CSV-ROWS: Pupils' entry points table and its CSV carry the same cohorts and pools", () => {
  const html = renderToStaticMarkup(createElement(EntryPoints, { p: pupils }));
  const screen = cells(html);
  const csv = round(pupilsCsv("DV-SMT-P-ENTRIES", pupils, SCHOOL)!);
  assert.equal(screen.length, csv.length - 1);
  assert.deepEqual(col(csv, "Entry point"), screen.map((r) => r[0]));
  assert.deepEqual(col(csv, "Cohort now"), screen.map((r) => plain(r[1])));
  // The pool cell reads "5,321 · 2026 entry": its figure, then its year in the next column.
  assert.deepEqual(col(csv, "The pool, next entry"), screen.map((r) => (r[2].startsWith("—") ? "" : plain(r[2].split(" ")[0]))));
  assert.deepEqual(col(csv, "Pool entry year"), ["2026", ""]);
});

test("R-PANEL-CSV-ROWS: Pupils' tiles are Measure / Value / Unit rows at the tiles' precision", () => {
  const t = pupilsCsv("DV-SMT-P-NOW", pupils, SCHOOL)!;
  const by = Object.fromEntries(t.rows.map((r) => [r[0], r[1]]));
  assert.equal(by["Roll"], 551);
  assert.equal(by["Roll change since 2019/20"], 6);
  assert.equal(by["Girls"], 47);
  assert.equal(by["Boys"], 53);
  assert.equal(by["Boarding"], 150);
  assert.equal(by["Senior: pupils"], 388);
  assert.deepEqual(t.columns, ["Measure", "Value", "Unit", "Note"]);
  assert.equal(t.about?.year, "2024/25");
});

test("R-PANEL-CSV-ROWS: Context's projection rows follow the view's toggles; ViewBody leaves them to the view", () => {
  assert.equal(contextCsv("DV-SMT-C-PROJECTION", context), null);
  const off = projectionCsv(context)!;
  assert.deepEqual(off.columns, ["Year", "Estimate: aged 11–15, within 5 km", "Projection", "Range, low", "Range, high", "Projection includes children not yet born"]);
  assert.deepEqual(off.rows, [[2022, 9000, null, null, null, null], [2023, 9100, 9100, 9100, 9101, "no"], [2024, null, 9201, 9000, 9400, "no"]]);
  const on = projectionCsv(context, { ons: true, scenario: true })!;
  assert.equal(on.columns.length, off.columns.length + 2);
  assert.deepEqual(on.rows[2].slice(-2), [9300, 9150]);
});

test("R-PANEL-CSV-ROWS: a view that draws nothing registers nothing", () => {
  assert.equal(pupilsCsv("DV-SMT-P-GIRLS-BOYS", pupils, SCHOOL), null);
  assert.equal(pupilsCsv("DV-SMT-P-POOL", pupils, SCHOOL), null);
  assert.equal(pupilsCsv("DV-SMT-P-MARKET", pupils, SCHOOL), null);
  assert.equal(contextCsv("DV-SMT-C-BYAGE", context), null);
  assert.equal(contextCsv("DV-SMT-C-NEARBY", context), null);
  // The map waits for its neighbourhoods.
  assert.equal(contextCsv("DV-SMT-C-MAP", context, { status: "loading" }), null);
  assert.equal(academicCsv("DV-SMT-A-GRADES", academic), null);
  assert.equal(academicCsv("DV-SMT-A-MOVES", academic), null);
  assert.equal(academicCsv("DV-SMT-A-CHART", { ...academic, board: { ...academic.board, empty: "Nothing to rank." } }), null);
});

// ------------------------------------------------------------------------------- R-PANEL-CSV-SUPPRESSED

test("R-PANEL-CSV-SUPPRESSED: a subject under the entries floor is 'not ranked' with the view's reason, never a figure", () => {
  const html = renderToStaticMarkup(createElement(AreasView, { a: academic }));
  const physics = cells(html).find((r) => r[0] === "Physics")!;
  assert.equal(physics[2], "not ranked");
  const csv = round(academicCsv("DV-SMT-A-AREAS", academic)!);
  const row = csv.find((r) => r.includes("Physics"))!;
  const at = (name: string) => row[csv[0].indexOf(name)];
  assert.equal(at("Points per entry"), "not ranked");
  assert.equal(at("Place in set"), "");
  assert.match(at("Why not ranked"), /fewer than 6 entries/);
  const biology = csv.find((r) => r.includes("Biology"))!;
  assert.equal(biology[csv[0].indexOf("Points per entry")], "40.46");
  assert.equal(biology[csv[0].indexOf("Place in set")], "2");
});

test("R-PANEL-CSV-SUPPRESSED: a school without a published figure is 'no figure', with its reason, and no rank", () => {
  const csv = round(academicCsv("DV-SMT-A-TABLE", academic)!);
  const row = csv.find((r) => r.includes("Distant School"))!;
  assert.equal(row[csv[0].indexOf("Points per entry")], "no figure");
  assert.equal(row[csv[0].indexOf("Rank in set")], "");
  assert.equal(row[csv[0].indexOf("Why no figure")], "No A level points published for 2024/25.");
});

test("R-PANEL-CSV-SUPPRESSED: free school meals an independent school doesn't publish stay words, on the map and the tiles", () => {
  const map: ContextMap = {
    state: "lsoa",
    urn: "110110",
    ages: [11, 15],
    year: 2023,
    centre: { easting: 0, northing: 0 },
    radiusKm: 5,
    radius: "5 km",
    ringKm: 7,
    dots: false,
    lsoas: [],
    counted: { here: 0, lookup: null },
    schools: [
      { urn: "110110", name: "Leighton Park School", easting: 0, northing: 0, isSchool: true, fsm: null, fsmNotPublished: true },
      { urn: "2", name: "Reading Girls' School", easting: 1, northing: 1, isSchool: false, fsm: { period: 2024, value: 23.456 }, fsmNotPublished: false },
      { urn: "3", name: "New School", easting: 2, northing: 2, isSchool: false, fsm: null, fsmNotPublished: false },
    ],
    fsmYear: 2024,
    edition: null,
  };
  const t = contextCsv("DV-SMT-C-MAP", context, { status: "ready", data: map }, "fsm")!;
  assert.deepEqual(t.rows.map((r) => r[3]), ["free school meals not published", 23.5, "no free-school-meals figure"]);
  const now = contextCsv("DV-SMT-C-NOW", context)!;
  const fsm = now.rows.find((r) => r[0] === "Free school meals")!;
  assert.equal(fsm[1], null);
  assert.match(String(fsm[3]), /\S/);
});
