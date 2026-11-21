// Run: node --env-file=.env --env-file=.env.local --import tsx --test --test-force-exit src/lib/panel-csv-group.test.ts
// Panel menu "Save as CSV" (21 Nov) on the group (head office) dashboards (src/components/groups/dash/csv.ts):
//   R-PANEL-CSV-ROWS        a view's CSV is the rows the view draws -- the view rendered on the production
//                           fixtures (docs/v0.8/groups_fixtures: Harris, Dukes, the Nexus special trust),
//                           its cells read back and compared with the builder's, on every phase tab; every
//                           group view on every dashboard gives a well-formed table or none.
//   R-PANEL-CSV-SUPPRESSED  a pooled figure on fewer than 5 schools: the CSV says "Too few schools (n)" where
//                           the view does, never the figure (R-MIN-SCHOOLS), in every view that withholds one.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { toCsv, parseCsv, type CsvTable } from "./csv";
import { buildOverview, buildSchools, FOCI, kindsFor, type Focus, type GroupOverview, type GroupSchools } from "./groups/dash";
import { buildAcademic, buildPupils, type GroupAcademic } from "./groups/dash-r3";
import { NM_COMPARISON_KINDS, type ComparisonRow, type GroupAggregate, type SchoolYearRow } from "./groups/aggregates";
import { GROUP_VIEWS, type DashResponse, type ViewId } from "../components/groups/dash/GroupDashboard";
import { AgainstOthers, SchoolsTable, schoolsSort } from "../components/groups/dash/views";
import { LeavingAt16, SchoolsRanked, ValueAddedPanel } from "../components/groups/dash/views-r3";
import { NmAgainst } from "../components/groups/dash/views-nm";
import { againstCsv, groupViewCsv, leavingCsv, nmAgainstCsv, resultsTrendCsv, schoolsRankedCsv, schoolsTableCsv, academicNowCsv, valueAddedCsv, SELF_REGISTERING } from "../components/groups/dash/csv";

const FX = path.join(__dirname, "../../docs/v0.8/groups_fixtures");
const read = <T,>(f: string) => JSON.parse(readFileSync(path.join(FX, f), "utf8")) as T;

type Tag = "harris" | "dukes" | "nexus";
const GROUPS: { tag: Tag; id: string }[] = [
  { tag: "harris", id: "3320" },
  { tag: "dukes", id: "club_iss:dukes-education" },
  { tag: "nexus", id: "16125" },
];

/** The four dashboards' answers for one group and phase, as /api/group/dash builds them (no database). */
function dashOf(tag: Tag, groupId: string, focus: Focus): Record<"overview" | "schools" | "academic" | "pupils", DashResponse> {
  const agg = read<GroupAggregate>(`${tag}_group_aggregate_lookup_at_time.json`);
  const named = (() => { try { return read<ComparisonRow[]>(`${tag}_group_comparison_lookup_named.json`); } catch { return []; } })();
  const all = [...read<ComparisonRow[]>(`${tag}_group_comparison_lookup.json`), ...named];
  const nm = tag === "nexus";
  const comps = nm ? all.filter((r) => (NM_COMPARISON_KINDS as readonly string[]).includes(r.kind)) : all.filter((r) => kindsFor("peer_band").includes(r.kind));
  const schools = read<SchoolYearRow[]>(`${tag}_group_schools_year_lookup.json`);
  const viewer = { as: "head_office" as const, accountId: "a1", groupId, name: agg.group.name, urn: null };
  const map = schools.filter((s) => s.role === "member").map((s) => ({ urn: s.urn, name: s.name ?? s.urn, easting: s.easting, northing: s.northing, roll: 900, trend: 1.25, outside: s.outside_england, likely: s.confidence === "likely", phases: [] }));
  const membership = schools.filter((s) => s.role === "member").slice(0, 8).map((s, i) => ({ urn: s.urn, name: s.name ?? s.urn, confidence: s.confidence as "confirmed" | "likely", joined: i % 2 ? `20${10 + i}-09-01` : null, lastSeen: "2025-06-01", source: "gias_groups" }));
  const base = { viewer, source: "fixtures" as const, membership, map };
  const o = buildOverview({ agg, comps, compare: "peer_band", focus });
  const input = { agg, comps: all, schools, compare: "peer_band" as const, focus };
  const a = buildAcademic(input);
  const p = buildPupils(input);
  const pools = nm ? all.filter((r) => r.kind === "pools") : undefined;
  return {
    overview: { ...base, overview: o },
    academic: { ...base, academic: a, now: a.overview, overview: a.overview },
    pupils: { ...base, pupils: p, now: p.overview, overview: p.overview },
    schools: { ...base, now: o, overview: o, schools: buildSchools({ agg, schools, focus, members: [], vicdata: new Set(), headOffice: true, pools }) },
  };
}

// ------------------------------------------------------------------------------- reading a view back

const decode = (s: string) => s.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&#x27;|&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
/** Each body row's cells, as text (a ⋯ break row has one cell and is left out). */
function bodyRows(html: string): string[][] {
  const body = html.match(/<tbody>([\s\S]*?)<\/tbody>/g) ?? [];
  return body.flatMap((b) => (b.match(/<tr[\s\S]*?<\/tr>/g) ?? []).map((tr) => (tr.match(/<td[\s\S]*?<\/td>/g) ?? []).map(decode)).filter((r) => r.length > 1));
}
/** The first number a cell shows, unsigned ("▲ 3.2%" -> 3.2, "1,204" -> 1204, "—" -> null). */
const firstNum = (t: string) => {
  const m = t.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return m ? Number(m[0]) : null;
};
const abs = (v: unknown) => (typeof v === "number" ? Math.abs(v) : v);
const draw = (el: ReactElement) => renderToStaticMarkup(el);
/** The file a spreadsheet gets, read back. */
const fileOf = (t: CsvTable) => parseCsv(toCsv(t));

// ------------------------------------------------------------------------------- R-PANEL-CSV-ROWS

for (const g of GROUPS.filter((x) => x.tag !== "nexus")) {
  for (const focus of FOCI) {
    test(`R-PANEL-CSV-ROWS: Against others' CSV is its table, cell for cell (${g.tag}, ${focus})`, () => {
      const o = dashOf(g.tag, g.id, focus).overview.overview!;
      for (const average of [false, true]) {
        const t = againstCsv(o, average);
        const screen = bodyRows(draw(createElement(AgainstOthers, { o, average })));
        assert.equal(t.rows.length, screen.length, "one CSV row per table row");
        assert.ok(t.rows.length >= 2);
        t.rows.forEach((r, i) => {
          const s = screen[i];
          assert.equal(s[0].replace(/ \(mix-matched\)$/, ""), String(r[0]).replace(/ \(mix-matched\)$/, ""), "the set");
          assert.equal(firstNum(s[1]), r[1] ?? null, `${r[0]}: schools`);
          assert.equal(firstNum(s[2]), abs(r[2]) ?? null, `${r[0]}: roll`);
          assert.equal(firstNum(s[3]), r[3] ?? null, `${r[0]}: growing`);
          o.against.columns.forEach((m, j) => {
            const v = r[6 + 2 * j];
            const n = r[7 + 2 * j];
            if (typeof v === "string") assert.equal(s[4 + j], v, `${r[0]} ${m}: withheld words`);
            else {
              assert.equal(firstNum(s[4 + j]), abs(v) ?? null, `${r[0]} ${m}: ${s[4 + j]} against ${v}`);
              if (n !== null && n !== undefined) assert.ok(s[4 + j].endsWith(`(${Number(n).toLocaleString("en-GB")})`), `${r[0]} ${m}: n`);
            }
          });
        });
        // What the figures rest on is a leading column of the file.
        const file = fileOf(t);
        assert.equal(file[0][0], "Comparison set");
        assert.equal(file[1][0], o.compare.label);
      }
    });

    test(`R-PANEL-CSV-ROWS: Schools' CSV is the table in its sort order (${g.tag}, ${focus})`, () => {
      const s = dashOf(g.tag, g.id, focus).schools.schools!;
      const t = schoolsTableCsv(s, schoolsSort(s.rows, "roll"));
      if (!s.rows.length) return assert.equal(t, null);
      const screen = bodyRows(draw(createElement(SchoolsTable, { s, highlight: null, onHighlight: () => {} })));
      assert.equal(t!.rows.length, screen.length);
      t!.rows.forEach((r, i) => {
        assert.ok(screen[i][0].startsWith(String(r[0])), `${screen[i][0]} is ${r[0]}`);
        assert.equal(firstNum(screen[i][2]), r[4] ?? null, `${r[0]}: roll`);
        const head = screen[i][5];
        if (r[9] !== null) assert.equal(Number(head.replace(/,/g, "").match(/-?\d+(\.\d+)?%?$/)?.[0].replace("%", "")), r[9], `${r[0]}: headline ${head}`);
        else assert.equal(head, r[11], `${r[0]}: why no headline`);
      });
      // ViewBody leaves this view's rows to the table, which holds the sort.
      assert.equal(groupViewCsv("GRP-S-TABLE", { d: dashOf(g.tag, g.id, focus).schools, o: dashOf(g.tag, g.id, focus).schools.now!, s, average: false, projection: null }), null);
    });
  }

  test(`R-PANEL-CSV-ROWS: Schools ranked, Value added and Leaving at 16 save every row full screen shows (${g.tag})`, () => {
    const d = dashOf(g.tag, g.id, "all");
    const a = d.academic.academic!;
    const ranked = schoolsRankedCsv(a);
    if (ranked) {
      const html = draw(createElement(SchoolsRanked, { a, highlight: null, fullscreen: true }));
      const schools = ranked.rows.filter((r) => r[1] !== null);
      assert.equal(schools.length, a.ranked.rows.length);
      // Each school's name in the order drawn, highest first.
      let at = 0;
      for (const r of schools) {
        const k = html.indexOf(String(r[0]).replace(/&/g, "&amp;").replace(/'/g, "&#x27;"), at);
        assert.ok(k >= at, `${r[0]} in order`);
        at = k;
      }
    }
    const va = valueAddedCsv(a);
    if (va) {
      const screen = bodyRows(draw(createElement(ValueAddedPanel, { a, fullscreen: true, highlight: null })));
      const schools = va.rows.filter((r) => r[3] !== null);
      assert.equal(schools.length, screen.length);
      schools.forEach((r, i) => {
        assert.equal(screen[i][0], r[2]);
        if (typeof r[4] === "number") assert.equal(firstNum(screen[i][1]), Math.abs(r[4]));
      });
    }
    const p = d.pupils.pupils!;
    const lv = leavingCsv(p);
    if (lv) {
      const screen = bodyRows(draw(createElement(LeavingAt16, { p, fullscreen: true, highlight: null })));
      assert.equal(lv.rows.length - 1, screen.length, "every school, then the group's row");
      screen.forEach((s, i) => {
        assert.equal(s[0], lv.rows[i][0]);
        assert.equal(firstNum(s[1]), lv.rows[i][2]);
        assert.equal(firstNum(s[2]), lv.rows[i][3]);
        assert.equal(firstNum(s[3]), lv.rows[i][4]);
      });
    }
  });
}

test("R-PANEL-CSV-ROWS: a special trust's Against others is its table (nexus)", () => {
  const o = dashOf("nexus", "16125", "all").overview.overview!;
  assert.ok(o.nm, "non-mainstream");
  const t = nmAgainstCsv(o)!;
  const screen = bodyRows(draw(createElement(NmAgainst, { o })));
  assert.equal(t.rows.length, screen.length);
  t.rows.forEach((r, i) => {
    const s = screen[i];
    assert.equal(s[0], r[0]);
    assert.equal(firstNum(s[1]), r[1] ?? null);
    assert.equal(firstNum(s[2]), r[2] ?? null);
    if (typeof r[3] === "string") assert.equal(s[3], r[3]);
    else {
      assert.equal(firstNum(s[3]), abs(r[3]) ?? null);
      assert.equal(firstNum(s[4]), r[4] ?? null);
    }
  });
});

for (const g of GROUPS) {
  test(`R-PANEL-CSV-ROWS: every group view on every phase tab gives a well-formed table or none (${g.tag})`, () => {
    let tables = 0;
    for (const focus of FOCI) {
      const dash = dashOf(g.tag, g.id, focus);
      for (const [which, d] of Object.entries(dash)) {
        const o = (which === "schools" ? d.now : d.overview)!;
        for (const id of Object.keys(GROUP_VIEWS) as ViewId[]) {
          if (id.startsWith("GRP-N-") !== !!o.nm && id !== "GRP-N-RESULTS") continue;
          const t = groupViewCsv(id, { d, o, s: d.schools ?? null, average: false, projection: [] });
          if (SELF_REGISTERING.includes(id) || id === "GRP-A-BANDS" || id === "GRP-N-RESULTS") {
            assert.equal(t, null, `${id}: registered by the view, or no figures`);
            continue;
          }
          if (!t) continue;
          tables++;
          const text = toCsv(t);
          assert.doesNotMatch(text, /NaN|undefined|\[object|Infinity/, `${which} ${id} (${focus})`);
          for (const r of t.rows) assert.ok(r.length <= t.columns.length, `${id}: ${r.length} > ${t.columns.length}`);
          // A percentage is a number under a "(%)" header, never "45.3%" in a cell.
          for (const r of t.rows) for (const c of r) if (typeof c === "string") assert.doesNotMatch(c, /^-?\d+(\.\d+)?%$/, `${id}: ${c}`);
        }
      }
    }
    assert.ok(tables > 40, `${tables} tables`);
  });
}

// ------------------------------------------------------------------------------- R-PANEL-CSV-SUPPRESSED

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

test("R-PANEL-CSV-SUPPRESSED: Against others -- a pool on 3 schools reads \"Too few schools (3)\" in the CSV, never its figure", () => {
  const o = clone(dashOf("harris", "3320", "secondary").overview.overview!);
  const m = o.against.columns[0];
  const row = o.against.rows.find((r) => r.key === "areas:la") ?? o.against.rows[1];
  // Production keeps the figure; the page must not show it.
  row.cells[m] = { value: 41.739, average: 40.111, n: 3, tooFew: true };
  for (const average of [false, true]) {
    const html = draw(createElement(AgainstOthers, { o, average }));
    assert.match(html, /Too few schools \(3\)/);
    const t = againstCsv(o, average);
    const r = t.rows.find((x) => String(x[0]).startsWith(row.label))!;
    const j = 6 + 2 * o.against.columns.indexOf(m);
    assert.equal(r[j], "Too few schools (3)");
    assert.equal(r[j + 1], null, "no n beside the words");
    const text = toCsv(t);
    assert.ok(text.includes("Too few schools (3)"));
    assert.ok(!text.includes("41.7") && !text.includes("40.1"), "never the figure");
  }
});

test("R-PANEL-CSV-SUPPRESSED: a special trust's pool on 4 schools reads \"Too few schools (4)\" for its roll and FSM", () => {
  const o = clone(dashOf("nexus", "16125", "all").overview.overview!);
  const row = o.nm!.against.find((r) => !r.ours)!;
  Object.assign(row, { schools: 4, tooFew: true, change1: 12.345, fsm: 61.987 });
  assert.match(draw(createElement(NmAgainst, { o })), /Too few schools \(4\)/);
  const t = nmAgainstCsv(o)!;
  const r = t.rows.find((x) => x[0] === row.label)!;
  assert.deepEqual(r.slice(3), ["Too few schools (4)", "Too few schools (4)"]);
  const text = toCsv(t);
  assert.ok(!text.includes("12.3") && !text.includes("62"), "never the figure");
});

test("R-PANEL-CSV-SUPPRESSED: Academic's set and Schools ranked's set on 2 schools, and a results-trend year on 3", () => {
  const d = dashOf("harris", "3320", "secondary");
  const a = clone(d.academic.academic!) as GroupAcademic;
  const h = a.headlines[0];
  h.measures[0].set = { weighted: null, average_school: null, n_with_figure: 2, tooFew: true };
  const now = academicNowCsv(a, false)!;
  const setRow = now.rows.find((r) => String(r[2]).startsWith(`${h.measures[0].label}: ${a.overview.picker.short}`))!;
  assert.equal(setRow[3], "Too few schools (2)");

  a.ranked.set = { label: "Its LAs", value: null, n: 2 };
  assert.match(draw(createElement(SchoolsRanked, { a, highlight: null, fullscreen: true })), /Too few schools \(2\)/);
  const ranked = schoolsRankedCsv(a)!;
  const r = ranked.rows.find((x) => String(x[0]).startsWith("Its LAs"))!;
  assert.equal(r[0], "Its LAs", "no school count beside the words");
  assert.equal(r[3], "Too few schools (2)");

  const o = clone(d.overview.overview!) as GroupOverview;
  const part = o.trends.results[0];
  const line = part.lines[1];
  line.pts[line.pts.length - 1] = { ...line.pts[line.pts.length - 1], value: null };
  line.n[line.n.length - 1] = 3;
  const t = resultsTrendCsv(o, false, 0)!;
  const last = t.rows[t.rows.length - 1];
  assert.equal(last[1 + 2], "Too few schools (3)");
  assert.equal(last[1 + 3], null);
});

test("R-PANEL-CSV-SUPPRESSED: a special school's regional pool on 3 schools -- its pool's FSM and change read \"Too few schools (3)\"", () => {
  const s = clone(dashOf("nexus", "16125", "all").schools.schools!) as GroupSchools;
  assert.ok(s.nm, "a special trust's Schools table");
  const row = s.rows.find((r) => r.placing)!;
  row.placing = { ...row.placing!, pool: { label: "Special schools, London", n: 3, tooFew: true }, fsm: { school: row.placing!.fsm.school, pool: null }, change: { school: row.placing!.change.school, pool: null, years: 3 } };
  assert.match(draw(createElement(SchoolsTable, { s, highlight: null, onHighlight: () => {} })), /Too few schools \(3\)/);
  const t = schoolsTableCsv(s, s.rows)!;
  const r = t.rows.find((x) => x[1] === row.urn)!;
  assert.equal(r[7], "Too few schools (3)");
  assert.equal(r[9], "Too few schools (3)");
  assert.equal(r[10], "Too few schools (3)");
});
