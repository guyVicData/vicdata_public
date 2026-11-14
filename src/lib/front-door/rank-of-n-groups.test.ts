// Run: VICDATA_GROUP_FIXTURES=true VICDATA_GROUP_FIXTURES_DIR=docs/v0.8/groups_fixtures \
//   npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/rank-of-n-groups.test.ts
// VicData 0.8 review fixes (14 Nov, M4): R-RANK-OF-N -- every rank in a table reads "X of N" with its measure
// and year, comparator columns say rank or value, cut lists keep the highlighted school and say "showing x
// of N". The real components rendered on real fixtures: the group fixtures (Harris), the review's own
// (docs/v0.8/review_14nov/fixtures: Leighton Park's Admissions and SMT, The Chase's GCSE). No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { groupAggregate, groupComparisons, groupSchoolsYear } from "@/lib/groups/aggregates";
import { buildSchools } from "@/lib/groups/dash";
import { buildAcademic } from "@/lib/groups/dash-r3";
import { SchoolsTable, schoolsSort, headlineHeader, joinedAfterResults } from "@/components/groups/dash/views";
import { SchoolsRanked, cutRows } from "@/components/groups/dash/views-r3";
import { RivalsTable, ShareTable } from "@/components/admissions/views/Tables";
import { Scorecard } from "@/components/smt/views/Scorecard";
import { ChangeList } from "@/components/teacher/SeriesViews";
import { RankedList } from "@/components/teacher/RankedList";
import { WalkChart, palette } from "@/components/front-door/charts";
import { teacherScreen } from "./teacher-screens";
import { walkById } from "./walks";
import type { TeacherModel } from "./teacher-model";

const FX = "docs/v0.8/review_14nov/fixtures";
const fx = <T,>(name: string): T => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as T;
const html = (el: Parameters<typeof renderToStaticMarkup>[0]) => renderToStaticMarkup(el);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

async function harris() {
  const agg = (await groupAggregate("3320", "at_time"))!;
  const schools = await groupSchoolsYear("3320");
  return { agg, schools, comps: await groupComparisons("3320", ["peer_band", "non_group", "sat", "areas", "england", "mix_matched"]) };
}

test("R-RANK-OF-N: the Group Schools table never sorts across unlike measures; headers name measure and year; Roll, 3 yrs; joined after results", async () => {
  const h = await harris();
  const all = buildSchools({ agg: h.agg, schools: h.schools, focus: "all", members: [], vicdata: new Set(), headOffice: true });
  const head = headlineHeader(all.rows);
  assert.equal(head.mixed, true, "Harris's All phases mixes KS2, Attainment 8 and A-level");
  for (const k of ["headline", "national"] as const) {
    const sorted = schoolsSort(all.rows, k).filter((r) => r.headline);
    // Each measure's rows sit together: a measure never comes back after another has started.
    const seen: string[] = [];
    for (const r of sorted) if (seen[seen.length - 1] !== r.headline!.measure) {
      assert.ok(!seen.includes(r.headline!.measure), `${k}: ${r.headline!.measure} split`);
      seen.push(r.headline!.measure);
    }
    assert.ok(seen.length > 1);
  }
  const sec = buildSchools({ agg: h.agg, schools: h.schools, focus: "secondary", members: [], vicdata: new Set(), headOffice: true });
  const sh = headlineHeader(sec.rows);
  assert.equal(sh.mixed, false);
  assert.match(sh.headline, /^Att 8, \d{4}\/\d{2}$/);
  const t = text(html(createElement(SchoolsTable, { s: sec, highlight: null, onHighlight: () => {} })));
  assert.match(t, /Rank in group/);
  assert.match(t, /Rank in England/);
  assert.match(t, /Roll, 3 yrs/);
  assert.match(t, /VA \(P8 \/ A-level\)/);
  assert.doesNotMatch(t, /\bIn group\b|\bTrend\b/);
  // Every rank cell reads "X of N".
  for (const r of sec.rows) if (r.inGroup) assert.ok(r.inGroup.of > 0);
  assert.ok((t.match(/\d+(st|nd|rd|th)=? of [\d,]+/g) ?? []).length >= sec.rows.filter((r) => r.inGroup).length);
  // "joined after results": a school with a headline and no in-group rank because it joined later.
  const late = { ...sec.rows.find((r) => r.headline)!, inGroup: null, joined: "2026-09-01" };
  assert.equal(joinedAfterResults(late), true);
  assert.equal(joinedAfterResults({ ...late, joined: "2020-09-01" }), false);
});

test("R-RANK-OF-N: Group Academic ranks are 'of N in group · of N in England'; a cut list keeps the highlighted school and says 'Showing x of N'", async () => {
  const h = await harris();
  const a = buildAcademic({ agg: h.agg, comps: h.comps, schools: h.schools, compare: "peer_band" as never, focus: "secondary" });
  const rows = a.ranked.rows;
  assert.ok(rows.length > 12);
  const low = rows[rows.length - 2];
  const t = text(html(createElement(SchoolsRanked, { a, highlight: low.urn, fullscreen: false })));
  assert.match(t, /=?\d+(st|nd|rd|th) of \d+ in group · =?\d+(st|nd|rd|th) of [\d,]+ in England/);
  assert.ok(t.includes(low.name), "the highlighted school is drawn though it ranks below the cut");
  assert.match(t, new RegExp(`Showing \\d+ of ${rows.length}, highest first`));
  const cut = cutRows(rows, low.urn, false);
  assert.ok(cut.includes(null), "a ⋯ break");
  assert.ok(cut.some((r) => r?.urn === low.urn));
});

test("R-RANK-OF-N: Admissions' Rivals table names each column; results are 'X of N' with measure and year; Share table shows share and rank", () => {
  const d = fx<{ m: Parameters<typeof RivalsTable>[0]["m"]; r: Extract<Parameters<typeof RivalsTable>[0]["rivals"], { status: "ready" }>["data"] }>("adm_137625_11");
  const t = text(html(createElement(RivalsTable, { m: d.m, rivals: { status: "ready", data: d.r }, fullscreen: true })));
  assert.match(t, /Rank by aged 11/);
  assert.match(t, /Share of all aged 11/);
  assert.match(t, /Results: England rank, Attainment 8 \d{4}\/\d{2}/);
  assert.match(t, /\d+(st|nd|rd|th) of [\d,]+/);
  assert.doesNotMatch(t, /\d+(st|nd|rd|th) in England/);
  // A rival at 0.0 km prints 0.0, never "—".
  const zero = { ...d.m, extras: d.m.extras.map((e, i) => (i === 1 ? { ...e, distanceKm: 0 } : e)) };
  const z = html(createElement(RivalsTable, { m: zero, rivals: { status: "ready", data: d.r }, fullscreen: true }));
  assert.match(z, />0\.0</);
  const s = text(html(createElement(ShareTable, { m: d.m })));
  assert.match(s, /Share\s+Rank by share/);
  assert.match(s, /\d+(st|nd|rd|th) of \d+/);
  assert.match(s, /You and your rivals/);
});

test("R-RANK-OF-N: SMT's Scorecard heads its rank columns as ranks (1 = highest) and shows the figure on a phone", () => {
  const d = fx<{ school: Parameters<typeof Scorecard>[0]["school"]; overview: Parameters<typeof Scorecard>[0]["o"] }>("smt_110110");
  const t = text(html(createElement(Scorecard, { o: d.overview, school: d.school })));
  assert.match(t, /England rank/);
  assert.match(t, /1 = highest/);
  const ph = text(html(createElement(Scorecard, { o: d.overview, school: d.school, phone: true })));
  assert.match(ph, /581 · \d+ of \d+/);
});

test("R-RANK-OF-N: Teacher's ranked % change shows its counts and lists a small base after the others; RankedList shades the focus", () => {
  const rows = [
    { key: "a", label: "Big", colour: "#888", value: 20, from: 50, to: 60, small: false },
    { key: "b", label: "Tiny", colour: "#888", value: 200, from: 2, to: 6, small: true },
    { key: "c", label: "Mid", colour: "#888", value: -10, from: 30, to: 27, small: false },
  ];
  const h = html(createElement(ChangeList, { rows, focusKey: "a" }));
  const t = text(h);
  assert.ok(t.indexOf("Big") < t.indexOf("Mid") && t.indexOf("Mid") < t.indexOf("Tiny"), "the 2-to-6 subject doesn't top the list");
  assert.match(t, /2→6/);
  assert.match(t, /Tiny †/);
  assert.match(t, /fewer than 5 entries/);
  const rl = html(createElement(RankedList, { rows: [{ key: "x", label: "Physics", value: 5, rank: 1 }, { key: "y", label: "Maths", value: 4, rank: 2 }] as never, measure: { id: "points", format: (v: number) => v.toFixed(1) } as never, focusKey: "y" }));
  assert.match(rl, /data-featured-row=""[^>]*>[^<]*<span[^>]*>2</);
});

test("R-RANK-OF-N: the walk's nearby ranking shows each school's entries, the year and how many", () => {
  const m = fx<TeacherModel>("teacher_137625_ks4_geography");
  const w = walkById("gcse-nearby")!;
  const sc = teacherScreen(m, w, w.screens.findIndex((s) => s.answer === "nearby-rank"));
  assert.equal(sc.chart.kind, "ranking");
  const t = text(html(createElement(WalkChart, { chart: sc.chart, p: palette({ dark: false, accent: { hex: "#34d399", light: "#12a05c" }, categoryId: m.category.id }) })));
  assert.match(t, /Average points, 2025\/26/);
  assert.match(t, /Entries/);
  assert.match(t, /Ranked highest first on average points per entry, 2025\/26: \d+ schools with a figure/);
  const tab = text(html(createElement(WalkChart, { chart: sc.chart, p: palette({ dark: false, accent: { hex: "#34d399", light: "#12a05c" }, categoryId: null }), asTable: true })));
  assert.match(tab, /\d+(st|nd|rd|th) of \d+/);
});
