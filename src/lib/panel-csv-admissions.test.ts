// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/panel-csv-admissions.test.ts
// Panel menu "Save as CSV" (21 Nov), Admissions (src/components/admissions/csv.ts):
//   R-PANEL-CSV-ROWS        a view's CSV is the rows the view draws: each table view rendered on the server
//                           (renderToStaticMarkup) and its cells read back against the CSV's, on small
//                           hand-made answers and on the walks' real fixtures (docs/v0.8/review_14nov/fixtures);
//                           and every Admissions view's builder writes a well-formed file from a real answer.
//   R-PANEL-CSV-SUPPRESSED  what a view withholds stays withheld in its words: "IGCSE" / "none" for a rival
//                           with no ranked results, "Too few pupils to call" for an area trend, "too few to
//                           index" for a rival full screen doesn't draw -- never the number behind it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseCsv, toCsv, type CsvTable } from "@/lib/csv";
import type { Load, MarketView, PipelineOk, RivalsView } from "@/components/admissions/api";
import { DEFAULT_FILTERS } from "@/components/admissions/api";
import { EntryTable, FeederTable, RivalsTable, ShareTable } from "@/components/admissions/views/Tables";
import { AreaPopulation, PoolTable, ShareNeeded } from "@/components/admissions/views/Lines";
import { FlagList } from "@/components/admissions/views/Momentum";
import { ADMISSIONS_DASHBOARDS } from "@/catalogue/dashboards/admissions";
import {
  admissionsViewCsv,
  areaPopulationCsv,
  entryTrendCsv,
  feederTableCsv,
  flagsCsv,
  poolTrendsCsv,
  rankedBarsCsv,
  rivalsTableCsv,
  rollTrendCsv,
  shareNeededCsv,
  shareTableCsv,
} from "@/components/admissions/csv";

// ------------------------------------------------------------------------------- helpers

/** A hand-made answer: only the fields the views read, typed against the real answer. */
const fixture = <T>(x: unknown): T => x as T;
const FX = "docs/v0.8/review_14nov/fixtures";
type Adm = { p: PipelineOk; m: MarketView; r: RivalsView };
const real = (name: string): Adm => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as Adm;

const decode = (s: string) => s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").trim();
/** The table body's rows as the screen prints them, cell by cell. */
function bodyCells(html: string): string[][] {
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/)?.[1] ?? "";
  return Array.from(body.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)).map((r) => Array.from(r[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)).map((c) => decode(c[1])));
}
/** A screen figure as the CSV writes it: "1,234" 1234, "12.3%" 12.3, "−4%" -4, "±0%" 0, "—" empty. */
function asCsv(screen: string): string {
  const t = screen.replace(/ /g, " ").trim();
  if (t === "—" || t === "–" || t === "") return "";
  const m = t.match(/^([+−±-]?)([\d,]+(?:\.\d+)?)(%| km| pts)?$/);
  if (!m) return t;
  const n = Number(m[2].replace(/,/g, ""));
  return String(m[1] === "−" || m[1] === "-" ? -n : n);
}
/** The CSV's body, as written to the file (about columns dropped: they lead every row). */
function csvBody(t: CsvTable): string[][] {
  const lead = (t.about?.set ? 1 : 0) + (t.about?.year && !t.columns.includes("Data year") ? 1 : 0);
  return parseCsv(toCsv(t)).slice(1).map((r) => r.slice(lead));
}

// ------------------------------------------------------------------------------- hand-made answers

const SCHOOL = "100001";
const market = fixture<MarketView>({
  urn: SCHOOL,
  entry: { id: "11+", age: 11, label: "11+ (Year 7)" },
  rivals: [SCHOOL, "100002", "100003", "100004"],
  band: { from: 11, to: 15 },
  entryAge: {
    periods: [2023, 2024],
    totals: { 2023: 300, 2024: 320 },
    rows: [
      { urn: SCHOOL, period: 2023, count: 100, share: 33.333, rank: 1 },
      { urn: SCHOOL, period: 2024, count: 104, share: 32.5, rank: 1 },
      { urn: "100002", period: 2024, count: 96, share: 30, rank: 2 },
      { urn: "100003", period: 2024, count: 70, share: 21.875, rank: 3 },
      { urn: "100004", period: 2024, count: 50, share: 15.625, rank: 4 },
    ],
  },
  ageBand: {
    periods: [2023, 2024],
    totals: { 2023: 1500, 2024: 1520 },
    rows: [
      { urn: SCHOOL, period: 2023, count: 500, share: 33.3 },
      { urn: SCHOOL, period: 2024, count: 510, share: 33.6 },
      { urn: "100002", period: 2023, count: 20, share: 1.3 },
      { urn: "100002", period: 2024, count: 60, share: 3.9 },
    ],
  },
  schools: { [SCHOOL]: { name: "Hill School" }, "100002": { name: "Vale Academy" }, "100003": { name: "St Anne's, Upper" }, "100004": { name: "Brook College" } },
  summary: {
    latest: 2024, first: 2023, rank: 1, of: 4, share: 32.5, shareFirst: 33.333, changePts: -0.833, total: 320, rivals: 3, independent: 2, state: 1, boarding: 1, rollRank: 1, rollOf: 4,
    trend: { [SCHOOL]: 4, "100002": -2.5, "100003": null, "100004": 10 },
    shareChange: { [SCHOOL]: -0.833 },
    rivalsAverage: [{ year: 2023, value: 70 }, { year: 2024, value: 72 }],
    vsIndexed: { base: 2023, mine: [{ year: 2023, value: 100 }, { year: 2024, value: 104 }], rivals: [{ year: 2023, value: 100 }, { year: 2024, value: 102.9 }] },
    rollIndexed: {
      base: 2023,
      mine: [{ year: 2023, value: 100 }, { year: 2024, value: 102 }],
      average: [{ year: 2023, value: 100 }, { year: 2024, value: 101 }],
      averageOf: 1,
      // A rival with 20 pupils at its base: under ROLL_INDEX_MIN, so full screen names it rather than drawing it.
      rivals: [{ urn: "100002", from: 2023, base: 20, values: [{ year: 2023, value: 100 }, { year: 2024, value: 300 }], small: true }],
    },
  },
  extras: [
    { urn: SCHOOL, roll: 900, distanceKm: 0, entryChangePctAll: 4, traits: { sector: "independent", boarding: true, gender: "mixed" } },
    { urn: "100002", roll: 1200.4, distanceKm: 2.345, entryChangePctAll: -12.3, traits: { sector: "state", boarding: false, gender: "mixed" } },
    { urn: "100003", roll: 650, distanceKm: 4.04, entryChangePctAll: 3, traits: { sector: "independent", boarding: false, gender: "girls" } },
    { urn: "100004", roll: 400, distanceKm: 7.5, entryChangePctAll: null, traits: { sector: "independent", boarding: false, gender: "boys" } },
  ],
  fe: null,
});
const rivals = fixture<RivalsView>({
  urn: SCHOOL,
  stage: "ks4",
  resultsPeriod: 2024,
  thresholds: "loaded",
  overall: { rank: 1, of: 2, measure: "Attainment 8", national: { rank: 897, of: 4736 }, change: 1.2, unranked: [] },
  momentum: null,
  areas: [],
  areaLabels: {},
  resultsChange: { [SCHOOL]: { points: 1.2 }, "100002": { points: -0.4 }, "100003": { points: 3.7 }, "100004": { points: null } },
  rows: [
    { urn: SCHOOL, name: "Hill School", isSchool: true, results: { value: 52.1, note: null, national: { rank: 897, of: 4736 }, regional: { rank: 120, of: 600 } }, size: { badge: "L" }, momentum: [] },
    { urn: "100002", name: "Vale Academy", isSchool: false, results: { value: 48.3, note: null, national: { rank: 1500, of: 4736 }, regional: { rank: 250, of: 600 } }, size: { badge: "XL" }, momentum: [{ id: "losing_pupils_3y", label: "Losing pupils", figures: {} }] },
    // Withheld: an IGCSE school (listed, never ranked) with a headline figure behind it, and one with no results.
    { urn: "100003", name: "St Anne's, Upper", isSchool: false, results: { value: 61.9, note: "igcse_not_ranked", national: { rank: 12, of: 4736 }, regional: { rank: 2, of: 600 } }, size: { badge: "M" }, momentum: [] },
    { urn: "100004", name: "Brook College", isSchool: false, results: { value: null, note: "no_published_results", national: null, regional: null }, size: null, momentum: [] },
  ],
});
const readyR: Load<RivalsView> = { status: "ready", data: rivals };

// ------------------------------------------------------------------------------- R-PANEL-CSV-ROWS

test("R-PANEL-CSV-ROWS: Admissions rivals table -- each row's cells are the table's, in its order, at its precision", () => {
  for (const sort of ["latest", "listed"] as const) {
    const screen = bodyCells(renderToStaticMarkup(createElement(RivalsTable, { m: market, rivals: readyR, fullscreen: true, sort })));
    const t = rivalsTableCsv(market, rivals, sort)!;
    assert.equal(t.about?.year, "2024/25");
    const rows = csvBody(t);
    assert.equal(rows.length, screen.length, `${sort}: one CSV row per table row`);
    rows.forEach((r, i) => {
      // The results cell prints "897th of 4,736": the CSV's rank and "of" columns.
      const results = r[8] ? `${r[7]} of ${r[8]}` : r[7];
      const s = screen[i];
      assert.deepEqual([r[0], r[1], r[2], r[3], r[4], r[5], r[6]], s.slice(0, 7).map(asCsv), `${sort} row ${i}`);
      assert.equal(results, s[7].replace(/(\d)(st|nd|rd|th)\b/, "$1").replace(/,/g, ""), `${sort} row ${i}: results`);
    });
  }
  // Listed: nearest first, the school at the top.
  assert.deepEqual(csvBody(rivalsTableCsv(market, rivals, "listed")!).map((r) => r[1]), ["Hill School", "Vale Academy", "St Anne's, Upper", "Brook College"]);
});

test("R-PANEL-CSV-ROWS: Admissions share table, entry table, pool table and share needed -- the CSV is the table, year by year", () => {
  const screen = bodyCells(renderToStaticMarkup(createElement(ShareTable, { m: market })));
  const rows = csvBody(shareTableCsv(market)!);
  assert.equal(rows.length, screen.length);
  // Rank by share prints "1st of 4": the CSV's rank and schools ranked.
  rows.forEach((r, i) => assert.deepEqual([r[0], r[1], r[2], r[3], r[5] ? `${r[4]} of ${r[5]}` : ""], [screen[i][0], ...screen[i].slice(1, 4).map(asCsv), screen[i][4].replace(/(\d)(st|nd|rd|th)\b/, "$1")]));

  // The walks' real answers (Leighton Park 11+ and 16+, a second school at 11+).
  for (const name of ["adm_110110_11", "adm_110110_16", "adm_137625_11"]) {
    const { p } = real(name);
    const entry = bodyCells(renderToStaticMarkup(createElement(EntryTable, { p })));
    assert.deepEqual(csvBody(entryTrendCsv(p, false)!), entry.map((r) => [r[0], ...r.slice(1).map(asCsv)]), `${name}: entry table`);
    const pool = bodyCells(renderToStaticMarkup(createElement(PoolTable, { p, la: true, england: true })));
    assert.deepEqual(csvBody(poolTrendsCsv(p, { la: true, england: true, indexed: false })!), pool.map((r) => [r[0], ...r.slice(1).map(asCsv)]), `${name}: pool table`);
    const hold = shareNeededCsv(p);
    if (hold) {
      const s = bodyCells(renderToStaticMarkup(createElement(ShareNeeded, { p, fullscreen: false, table: true })));
      const c = csvBody(hold);
      assert.equal(c.length, s.length, `${name}: share needed rows`);
      // The range prints "4.1–5.0%": the CSV's low and high.
      c.forEach((r, i) => assert.deepEqual([r[0], r[1], r[2] ? `${r[2]}–${r[3]}` : "", r[4]], [s[i][0], asCsv(s[i][1]), s[i][2] === "—" ? "" : s[i][2].replace(/%$/, "").replace(/(\d)\.0(?=–|$)/g, "$1"), s[i][3]], `${name}: share needed row ${i}`));
    }
  }
});

test("R-PANEL-CSV-ROWS: Admissions feeder table -- the look's order and columns, Main feeders first, flags in the table's words", () => {
  const { p } = real("adm_110110_11");
  for (const look of [{}, { sort: "latest" as const, showKm: false, showGender: false }, { sort: "change" as const, showSector: false, showSize: false }]) {
    const screen = bodyCells(renderToStaticMarkup(createElement(FeederTable, { p, fullscreen: true, look })));
    const t = feederTableCsv(p, look)!;
    const rows = csvBody(t).slice(0, -1); // the last row is the whole set's line, under the table
    assert.equal(rows.length, screen.length, JSON.stringify(look));
    rows.forEach((r, i) => {
      const s = screen[i];
      const name = r[2] === "Main" ? `Main${r[0]}` : r[0];
      // School · Aged N · Trend · Flag, then the look's columns (the CSV adds URN, Main and the earlier count).
      // (Gender is capitalised by the cell's CSS on screen, in the text by the CSV: compared without case.)
      const lower = (xs: string[]) => xs.map((x) => x.toLowerCase());
      assert.deepEqual(lower([name, r[3], r[5], r[6], ...r.slice(7)]), lower([s[0], asCsv(s[1]), asCsv(s[2]), s[3], ...s.slice(4).map((x, j) => (t.columns[7 + j] === "km" ? asCsv(x) : x === "—" ? "" : x))]), `${JSON.stringify(look)} row ${i}`);
    });
  }
});

test("R-PANEL-CSV-ROWS: every Admissions view on the dashboards writes a well-formed file from the real answers", () => {
  const dvs = Array.from(new Set(ADMISSIONS_DASHBOARDS.flatMap((d) => d.panels.flatMap((p) => p.dataviews.flatMap((v) => (v.kind === "view" ? [v.dataview] : []))))));
  assert.ok(dvs.length >= 30, `${dvs.length} views`);
  for (const name of ["adm_110110_11", "adm_110110_16", "adm_137625_11"]) {
    const { p, m, r } = real(name);
    const c = { entry: p.entry.id, entryAge: p.entry.age, filters: DEFAULT_FILTERS, projection: false, pipeline: { status: "ready", data: p }, market: { status: "ready", data: m }, rivals: { status: "ready", data: r }, shape: { status: "loading" } } as const;
    const drawn: string[] = [];
    for (const dv of dvs)
      for (const fullscreen of [false, true]) {
        const t = admissionsViewCsv(dv, c as never, { fullscreen, look: {}, lines: new Set(["la", "england", "region"]), set: dv.startsWith("DV-ADM-M") ? "10 nearest" : null });
        if (!t) continue;
        const rows = parseCsv(toCsv(t));
        assert.ok(rows.every((row) => row.length === rows[0].length), `${name} ${dv}: every row has the header's fields`);
        if (dv.startsWith("DV-ADM-M")) assert.equal(rows[0][0], "Comparison set", `${name} ${dv}: the rivals set leads`);
        if (!fullscreen) drawn.push(dv);
      }
    // The demo's views: the home's panels and each dashboard's default views have rows.
    for (const dv of ["DV-ADM-P-NOW", "DV-ADM-P-PIPELINE", "DV-ADM-P-TABLE", "DV-ADM-P-ENTRY-LINE", "DV-ADM-P-POOL-INDEXED", "DV-ADM-M-NOW", "DV-ADM-M-BARS", "DV-ADM-M-TABLE", "DV-ADM-M-VS-LINE", "DV-ADM-M-SHARE-LINE"]) assert.ok(drawn.includes(dv), `${name}: ${dv} has rows`);
  }
  // Nothing loaded, nothing to save.
  const loading = { entry: "11+", entryAge: 11, filters: DEFAULT_FILTERS, projection: false, pipeline: { status: "loading" }, market: { status: "loading" }, rivals: { status: "loading" }, shape: { status: "loading" } } as const;
  for (const dv of dvs) assert.equal(admissionsViewCsv(dv, loading as never, { fullscreen: false, look: {}, lines: new Set(), set: null }), null, dv);
});

// ------------------------------------------------------------------------------- R-PANEL-CSV-SUPPRESSED

test("R-PANEL-CSV-SUPPRESSED: Admissions -- a rival with no ranked results keeps the table's \"IGCSE\" / \"none\", never its rank or figure", () => {
  const byName = (t: CsvTable, col: string) => Object.fromEntries(csvBody(t).map((r) => [r[t.columns.indexOf("School")], r[t.columns.indexOf(col)]]));
  const table = rivalsTableCsv(market, rivals)!;
  const res = byName(table, table.columns.find((c) => c.startsWith("Results"))!);
  assert.equal(res["St Anne's, Upper"], "IGCSE");
  assert.equal(res["Brook College"], "none");
  assert.equal(res["Vale Academy"], "1500");
  // The screen says the same words.
  const html = renderToStaticMarkup(createElement(RivalsTable, { m: market, rivals: readyR, fullscreen: true }));
  assert.match(html, />IGCSE</);
  assert.match(html, />none</);
  // The IGCSE school's withheld national rank (12) and headline (61.9) are nowhere in the file.
  const file = toCsv(table);
  assert.doesNotMatch(file, /St Anne's, Upper[^\r]*,12(,|\r)/);
  assert.doesNotMatch(file, /61\.9/);
  const bars = rankedBarsCsv(market, rivals)!;
  const region = byName(bars, "Results: region rank");
  assert.equal(region["St Anne's, Upper"], "IGCSE");
  assert.equal(byName(bars, "Results: England rank")["St Anne's, Upper"], "");
  // The flag list: the IGCSE rival's results change is the word, a rival with no flag says so.
  const flags = flagsCsv(market, rivals, "all")!;
  const f = Object.fromEntries(csvBody(flags).map((r) => [r[0], r]));
  assert.equal(f["St Anne's, Upper"][3], "IGCSE");
  assert.equal(f["Brook College"][1], "No change worth flagging");
  const list = renderToStaticMarkup(createElement(FlagList, { m: market, r: rivals }));
  assert.match(list, /No change worth flagging/);
  assert.doesNotMatch(toCsv(flags), /3\.7/);
  // The real fixture: Leighton Park itself sits IGCSE -- its results cell is the word.
  const lp = real("adm_110110_11");
  const lpTable = rivalsTableCsv(lp.m, lp.r)!;
  assert.equal(byName(lpTable, lpTable.columns.find((c) => c.startsWith("Results"))!)["Leighton Park School"], "IGCSE");
});

test("R-PANEL-CSV-SUPPRESSED: Admissions -- an area with too few pupils for a trend and a rival too small to index keep the screen's words", () => {
  const { p } = real("adm_110110_11");
  const thin = fixture<PipelineOk>({ ...p, areaPopulation: { ...p.areaPopulation!, laTrend: null } });
  const html = renderToStaticMarkup(createElement(AreaPopulation, { p: thin }));
  assert.match(html, /Too few pupils to call/);
  const t = areaPopulationCsv(thin, { la: true, region: true })!;
  const la = csvBody(t).filter((r) => r[0] === thin.areaPopulation!.laName);
  assert.ok(la.length > 0 && la.every((r) => r[1] === "Too few pupils to call" && r[2] === ""), "the LA's trend is the words, its % blank");
  // Full screen's roll lines don't draw a rival under ROLL_INDEX_MIN at its base: the CSV names it, never its 300.
  const full = rollTrendCsv(market, true)!;
  const col = full.columns.indexOf("Vale Academy: index");
  assert.ok(col > 0);
  assert.ok(full.rows.every((r) => String(r[col]).startsWith("too few to index")));
  assert.doesNotMatch(toCsv(full), /,300(,|\r)/);
  // The panel (not full screen) draws only you and the average: no rival column.
  assert.ok(!rollTrendCsv(market, false)!.columns.some((c) => c.includes("Vale")));
});
