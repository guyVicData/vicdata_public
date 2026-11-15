// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/feedback-c.test.tsx
// VicData 0.8 feedback 15 Nov, build C (charts): value axes (R-CHART-AXES), the SMT charts' redraws, the
// flags' nearest figures, the dumbbells' keys, the Results chart's gaps, independent schools at 11+. On the
// fixtures captured read-only through the routes' own handlers (docs/v0.8/feedback_15nov/fixtures/*_c.json)
// and the 14 Nov Teacher fixtures. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { createElement, type ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { InitialWidth, LineChart, axisValues } from "@/components/admissions/views/charts";
import type { Overview } from "@/lib/smt/overview";
import type { Academic } from "@/lib/smt/academic";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context } from "@/lib/smt/context";
import type { SmtSchool } from "@/lib/smt/school";
import type { TeacherModel } from "./teacher-model";
import { teacherScreen, dumbbellRows, SMALL_COHORT } from "./teacher-screens";
import { walkById } from "./walks";
import { keyProblems } from "./walks-check";
import { smtAnswer } from "./smt-answers";

const FX = "docs/v0.8/feedback_15nov/fixtures";
const fx = <T,>(name: string): T => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as T;
const old = <T,>(name: string): T => JSON.parse(readFileSync(`docs/v0.8/review_14nov/fixtures/${name}.json`, "utf8")) as T;
type Smt = { school: SmtSchool; overview: Overview; academic: Academic; academic16: Academic; pupils: Pupils; context: Context };
const SCHOOLS = ["110110", "137625"] as const;
const smt = (urn: string) => fx<Smt>(`smt_${urn}_c`);
const html = (el: ReactElement) => renderToStaticMarkup(createElement(InitialWidth.Provider, { value: 900 }, el));
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&").replace(/&rsquo;/g, "’").replace(/\s+/g, " ");

// ------------------------------------------------------------------------------------------- C1
test("R-CHART-AXES: the shared line chart draws a value axis, labels an indexed chart's 100, and a strip keeps its reference", () => {
  const series = [{ id: "a", label: "A", colour: "#000", points: [{ x: 2019, y: 100 }, { x: 2020, y: 112 }, { x: 2021, y: 131 }] }];
  const h = html(createElement(LineChart, { series, height: 160, reference: { y: 100 }, yFormat: (v: number) => v.toFixed(0) }));
  const grid = Array.from(h.matchAll(/data-y-grid="([\d.-]+)"/g)).map((m) => Number(m[1]));
  assert.ok(grid.length >= 3, `values on the axis: ${grid}`);
  assert.ok(grid.includes(100), "100 is labelled on an indexed chart");
  assert.match(h, /data-reference="100"/);
  // No two labels crowd the base.
  const step = grid[1] - grid[0];
  for (const v of grid) if (v !== 100) assert.ok(Math.abs(v - 100) >= step * 0.45, `${v} too close to 100`);
  // A 44 px strip: its reference alone; yAxis={false}: none.
  assert.deepEqual(axisValues([40, 60], 44, null, 50), [50]);
  assert.deepEqual(axisValues([40, 60], 160, null, null, false), []);
});

test("R-CHART-AXES: every trend chart in SMT, Admissions and Group goes through an axis (no line chart turns it off)", () => {
  const dirs = ["src/components/smt", "src/components/admissions", "src/components/groups"];
  const files = dirs.flatMap((d) => (readdirSync(d, { recursive: true }) as string[]).filter((f) => f.endsWith(".tsx")).map((f) => path.join(d, f)));
  const off = files.filter((f) => /<LineChart[^>]*yAxis=\{false\}/.test(readFileSync(f, "utf8")));
  assert.deepEqual(off, []);
  // SMT's results band and Academic's trend draw their own axes.
  assert.match(readFileSync("src/components/smt/views/Lines.tsx", "utf8"), /export function BandChart[\s\S]*?axisValues\(/);
  assert.match(readFileSync("src/components/smt/views/Academic.tsx", "utf8"), /export function AcTrendChart[\s\S]*?niceTicks\(/);
  // Admissions' pipeline draws its own SVG: the same axis.
  assert.match(readFileSync("src/components/admissions/views/PipelineChart.tsx", "utf8"), /axisValues\(yd/);
});

test("R-CHART-AXES: SMT Overview's market share draws the rivals its title names, on a value axis (SMT 4, C2)", async () => {
  const { MarketLine } = await import("@/components/smt/views/Lines");
  for (const urn of SCHOOLS) {
    const s = smt(urn);
    const m = s.overview.trends.market;
    assert.equal(m.status, "ready", urn);
    if (m.status !== "ready") continue;
    assert.ok((m.middle ?? []).filter((p) => p.value !== null).length >= 2, `${urn}: the rivals' middle`);
    const h = html(createElement(MarketLine, { o: s.overview, schoolName: s.school.name, fullscreen: false }));
    const title = text(h.split('data-market-title=""')[1]?.split("</div>")[0] ?? "");
    assert.match(title, /and the middle of/, `${urn}: ${title}`);
    assert.match(text(h.split('data-market-key=""')[1] ?? ""), /Middle of/);
    assert.ok((h.match(/data-y-grid=/g) ?? []).length >= 3, `${urn}: a value axis`);
    // The middle is the rivals' median share each year (the school left out).
    const y = m.middle!.find((p) => p.value !== null)!;
    assert.ok(y.value! > 0 && y.value! < 100);
  }
});

test("R-CHART-AXES: SMT Academic's every line is drawn at its real width with figures, entries and zero (SMT 6, C3)", async () => {
  const { EveryLine } = await import("@/components/smt/views/Academic");
  const src = readFileSync("src/components/smt/views/Academic.tsx", "utf8");
  assert.doesNotMatch(src.split("export function EveryLine")[1].split("\nexport function ")[0], /preserveAspectRatio="none"/, "no stretched drawing");
  const a = smt("110110").academic16;
  const h = html(createElement(EveryLine, { a }));
  const lines = a.trends.lines.filter((l) => l.from !== null || l.to !== null);
  assert.equal((h.match(/data-ac-line="/g) ?? []).length, lines.length);
  assert.match(h, /data-ac-lines-tick="0"/, "zero on the axis");
  const t = text(h);
  for (const l of lines.filter((x) => x.from !== null && x.to !== null)) {
    assert.ok(t.includes(l.from!.toFixed(1)) && t.includes(l.to!.toFixed(1)), `${l.label}: both years' figures`);
    if (l.sub && /entries?$/.test(l.sub)) assert.ok(t.includes(l.sub), `${l.label}: its entries`);
  }
  assert.match(t, /2023\/24 \(last year\)/);
});

// ------------------------------------------------------------------------------------------- C4
test("R-SMT-SHAPE-PICTURES: Shapes around you are two small year-group charts; each shape shows its picture and meaning (SMT 8, C4)", async () => {
  const { ShapeAndSize, SHAPE_MEANING } = await import("@/components/smt/views/Pupils");
  for (const urn of SCHOOLS) {
    const p = smt(urn).pupils;
    const a = p.shape.around;
    assert.ok(a.nearest && a.setMiddle, `${urn}: the nearest and the set's middle`);
    assert.deepEqual(a.nearest!.yearGroups.map((g) => g.age), p.shape.yearGroups.map((g) => g.age), "the same year groups as the main chart");
    const h = html(createElement(ShapeAndSize, { p }));
    assert.match(h, /data-shape-nearest=""/);
    assert.match(h, /data-shape-set=""/);
    // Values on every bar of the main chart (and the two small ones).
    assert.ok((h.match(/data-bar-value=""/g) ?? []).length >= p.shape.yearGroups.length * 3);
    // The school's shape: its picture and what it means.
    assert.ok(p.shape.label && h.includes(`data-shape="${p.shape.label}"`));
    assert.ok(text(h).includes(SHAPE_MEANING[p.shape.label as keyof typeof SHAPE_MEANING]));
    // The counted shape words are gone where the charts can be drawn.
    assert.doesNotMatch(text(h), /\d+ Wineglass · \d+/);
  }
});

// ------------------------------------------------------------------------------------------- C5
test("R-CHART-AXES: Leaving at 16 is a ± bar per year with the set's middle as a reference; the table has one signed column (SMT 10, C5)", async () => {
  const { LeavingAt16 } = await import("@/components/smt/views/Pupils");
  for (const urn of SCHOOLS) {
    const s = smt(urn);
    const h = html(createElement(LeavingAt16, { p: s.pupils, school: s.school }));
    assert.match(h, /data-leaving-chart=""/);
    assert.equal((h.match(/data-leaving-year=/g) ?? []).length, s.pupils.leaving.length);
    if (s.pupils.shape.around.stayingOnSet.pct !== null) assert.ok((h.match(/data-leaving-ref=""/g) ?? []).length >= 1, "the set's middle drawn");
    assert.match(h, /data-y-grid="0"/, "zero on the axis");
    // Each bar's figure, signed, joiners up and leavers down.
    const t = text(h);
    for (const r of s.pupils.leaving) if (r.year11 !== null && r.year12 !== null && r.year12 !== r.year11) assert.ok(t.includes(`${r.year12 > r.year11 ? "+" : "−"}${Math.abs(r.year12 - r.year11)}`), `${urn} ${r.year}`);
    assert.match(t, /As a table/);
  }
  // The table's last column is one signed figure (no "5 more joined").
  const src = readFileSync("src/components/smt/views/Pupils.tsx", "utf8");
  assert.doesNotMatch(src.split("function LeavingTable")[1], /more joined/);
});

// ------------------------------------------------------------------------------------------- C6
test("R-ROLL-BY-PHASE-LA: each phase against the LA's residents of that phase's ages, one line each, labelled with the ages (SMT 11, D7)", () => {
  for (const urn of SCHOOLS) {
    const s = smt(urn);
    const ph = s.pupils.trends.phases;
    const mine = ph.filter((l) => !l.key.startsWith("la-"));
    const la = ph.filter((l) => l.key.startsWith("la-"));
    assert.ok(!ph.some((l) => l.key === "england"), "no single England line");
    assert.equal(la.length, mine.length, `${urn}: one LA line per phase`);
    for (const l of la) {
      assert.ok(mine.some((x) => `la-${x.key}` === l.key));
      assert.match(l.label, new RegExp(`^${s.school.laName}, ages \\d+–\\d+$`));
    }
    assert.ok(la.find((l) => l.key === "la-secondary")?.label.endsWith("ages 11–15"));
    assert.ok(la.find((l) => l.key === "la-sixth_form")?.label.endsWith("ages 16–17"));
    // Indexed to one base year, 100 there on every line.
    const base = s.pupils.trends.base;
    for (const l of ph) assert.equal(Math.round(l.pts.find((p) => p.year === base)?.value ?? NaN), 100, `${urn} ${l.key}`);
    assert.match(smtAnswer("DV-SMT-P-PHASES", s.school, s.pupils), new RegExp(`${s.school.laName}, ages 11–15`));
  }
});

// ------------------------------------------------------------------------------------------- C7
test("R-BIRTHS-STORY: births and the children nearby tell one story on their own scales, the lag marked; within the radius reaches the LA's last year (SMT 12-13, C7)", async () => {
  const { BirthsAndProjections, NearbyOverTime, birthsPeak } = await import("@/components/smt/views/Context");
  for (const urn of SCHOOLS) {
    const c = smt(urn).context;
    // No births year missing between the first and the last.
    const ys = c.births.la.map((p) => p.year);
    assert.deepEqual(ys, Array.from({ length: ys.at(-1)! - ys[0] + 1 }, (_, i) => ys[0] + i), `${urn}: births every year`);
    const pk = birthsPeak(c);
    assert.ok(pk, `${urn}: a peak before the last year`);
    assert.equal(pk!.lag, 11);
    const h = html(createElement(BirthsAndProjections, { c, fullscreen: false }));
    assert.match(text(h), new RegExp(`born since births peaked in ${pk!.peak} reach 11 from ${pk!.peak + 11}`));
    assert.match(h, /data-x-labels2=""/, "each birth year's year at 11");
    assert.ok((h.match(/data-y-grid=/g) ?? []).length >= 6, "two value axes");
    // Within the radius reaches the same last year as the LA and England.
    const last = (xs: { year: number; value: number | null }[]) => xs.filter((p) => p.value !== null).at(-1)?.year;
    const within = Math.max(last(c.nearby.indexed.school) ?? 0, last(c.nearby.indexed.projected ?? []) ?? 0);
    assert.equal(within, Math.max(last(c.nearby.indexed.la)!, last(c.nearby.indexed.england)!), `${urn}: the same last year`);
    const n = html(createElement(NearbyOverTime, { c, fullscreen: false }));
    assert.match(n, /data-y-grid="100"/);
    assert.match(n, /data-births-lag=""/);
  }
});

// ------------------------------------------------------------------------------------------- C8, C9
test("R-SMT-FLAGS-CLOSEST: with no flag, the figures closest to one, each with what a flag needs (SMT 5, D5)", async () => {
  const { ClosestToAFlag } = await import("@/components/smt/views/Flags");
  const { SMT_FLAG_RULES } = await import("@/lib/smt/flags-rules");
  for (const urn of SCHOOLS) {
    const s = smt(urn);
    assert.equal(s.overview.flags.length, 0, `${urn} has no flags (the fixture's case)`);
    const w = s.overview.flagWatch!;
    assert.ok(w.roll, `${urn}: the roll's falls`);
    for (const r of w.results) {
      assert.equal(r.threshold, SMT_FLAG_RULES.resultsGap[r.stage as "ks4" | "ks5"]);
      assert.ok(Math.abs(r.gap) < r.threshold, "below the threshold, else it would be a flag");
      assert.equal(Math.round((r.change - r.setMiddle) * 100) / 100, r.gap);
    }
    const h = html(createElement(ClosestToAFlag, { o: s.overview }));
    assert.match(h, /Closest to a flag/);
    assert.match(text(h), /a flag needs/);
  }
  // The Chase: GCSE +1.0 against the set's −0.6 (a gap of +1.6; a flag needs ±2).
  const c = smt("137625").overview.flagWatch!.results.find((r) => r.stage === "ks4")!;
  assert.deepEqual([c.change, c.setMiddle, c.gap, c.threshold], [1, -0.6, 1.6, 2]);
  assert.match(smtAnswer("DV-SMT-O-FLAGS", smt("137625").school, smt("137625").overview), /Closest: GCSE results \+1\.0 against the set's −0\.6; a flag needs a gap of ±2/);
});

test("R-CHART-AXES: Size by phase sets the figure beside its place, no spring between them (SMT 3, C8)", () => {
  const src = readFileSync("src/components/smt/views/Now.tsx", "utf8");
  const set = src.split("export function SetSizeByPhase")[1].split("\nexport function ")[0];
  assert.doesNotMatch(set, /<span className="grow" \/>/);
  assert.match(set, /data-set-size-figure=""[\s\S]*data-set-size-rank=""/);
});

// ------------------------------------------------------------------------------------------- C10
test("R-DUMBBELL-KEY: SMT Academic draws the whole school's entries dumbbell per level; Teacher's key reads right (Teacher 2, C10)", async () => {
  const { EntriesDumbbell } = await import("@/components/smt/views/Academic");
  for (const urn of SCHOOLS) {
    for (const k of ["academic", "academic16"] as const) {
      const a = smt(urn)[k];
      const d = a.trends.dumbbell;
      assert.ok(d && d.rows.length >= 5, `${urn} ${k}: a dumbbell`);
      for (let i = 1; i < d!.rows.length; i++) assert.ok(d!.rows[i - 1].latest >= d!.rows[i].latest, "largest first");
      // The level's main qualification goes unnamed.
      assert.ok(!d!.rows.some((r) => /GCE A level|^GCSE$/.test(r.qualification ?? "")), `${urn} ${k}: no "(GCE A level)" tag`);
      const h = html(createElement(EntriesDumbbell, { a }));
      assert.equal((h.match(/data-smt-dumbbell-row="subject"/g) ?? []).length, d!.rows.length);
      assert.match(text(h), /○ \d{4}\/\d{2} \(first year\) → ● \d{4}\/\d{2} \(latest\)/);
    }
  }
  // Teacher: the focus is highlighted (not a family), one ring-to-dot entry, the average labels its own row.
  for (const name of ["teacher_137625_ks4_geography", "teacher_110110_ks5"]) {
    const m = old<TeacherModel>(name);
    const w = walkById(m.phase === "ks5" ? "post16-many" : "gcse-many")!;
    const i = w.screens.findIndex((s) => s.answer === "entries-dumbbell");
    assert.ok(i >= 0, name);
    const c = teacherScreen(m, w, i).chart;
    assert.equal(c.kind, "dumbbell");
    if (c.kind !== "dumbbell") continue;
    assert.deepEqual(keyProblems(c), []);
    assert.equal(c.keys.find((k) => k.role === "focus")?.mark, "highlight");
    assert.ok(c.keys.some((k) => k.mark === "ringdot" && /^○ .* \(first year\) → ● .* \(latest\)$/.test(k.label)));
    assert.ok(!c.keys.some((k) => k.label === "School average"));
    const d = dumbbellRows(m)!;
    const labels = d.rows.map((r) => r.label);
    assert.ok(labels.filter((l) => / \(GCE A level\)$/.test(l)).every((l) => labels.includes(l.replace(/ \(GCE A level\)$/, ""))), `${name}: "(GCE A level)" only where it tells two rows apart`);
  }
});

// ------------------------------------------------------------------------------------------- C11
test("R-RESULTS-GAPS: the Results chart leaves an unpublished year as a gap with its reason, and marks small cohorts (Teacher 4, C11)", async () => {
  const { WalkChart } = await import("@/components/front-door/charts");
  const { palette } = await import("@/components/front-door/charts");
  const src = readFileSync("src/components/front-door/charts.tsx", "utf8");
  assert.doesNotMatch(src, /strokeDasharray="1 5"/, "no dotted bridge");
  for (const name of ["teacher_137625_ks4_small", "teacher_110110_ks5_small", "teacher_110110_ks5"]) {
    const m = old<TeacherModel>(name);
    const w = walkById(m.phase === "ks5" ? "post16-well" : "gcse-well")!;
    const i = w.screens.findIndex((s) => s.answer === "points-trend");
    assert.ok(i >= 0, name);
    const c = teacherScreen(m, w, i).chart;
    if (c.kind !== "lines") continue;
    assert.deepEqual(keyProblems(c), [], name);
    for (const s of c.small ?? []) assert.ok(s.entries > 0 && s.entries < SMALL_COHORT);
    const h = renderToStaticMarkup(createElement(WalkChart, { chart: c, p: palette({ dark: false, accent: { hex: "#a78bfa", light: "#7c5ce6" }, categoryId: m.category.id }) }));
    assert.equal((h.match(/data-small-cohort=/g) ?? []).length, (c.small ?? []).length, name);
    if (c.unpublished.length) assert.match(h, /data-html-label="gap"/);
    if ((c.small ?? []).length) assert.ok(c.keys.some((k) => k.mark === "ring" && /Fewer than 10 entries/.test(k.label)));
  }
});

// ------------------------------------------------------------------------------------------- C12
test("R-IGCSE-POST16-AT-11: an IGCSE school at 11+ is ranked with its rivals on Post-16, and the view says so (Admissions 9-10, D3)", async () => {
  const { AcademicRanking } = await import("@/components/admissions/panels/Academic");
  const lp = fx<{ r: Parameters<typeof AcademicRanking>[0]["r"] }>("adm_110110_11_c").r;
  assert.equal(lp.stage, "ks5");
  assert.equal(lp.switchedFrom, "ks4");
  assert.equal(lp.overall?.measure, "A-level points per entry");
  assert.ok(lp.overall && lp.overall.rank >= 1 && lp.overall.of >= 3, "ranked among its rivals (R-RANK-MIN)");
  assert.ok(!lp.rows.some((x) => x.results.note === "igcse_not_ranked"), "no rival dropped as IGCSE on Post-16");
  const h = text(renderToStaticMarkup(createElement(AcademicRanking, { r: lp })));
  assert.match(h, /Ranked on Post-16 \(A-level points per entry\): Leighton Park School sits IGCSE/);
  assert.doesNotMatch(h, /No ranked GCSE headline/);
  assert.doesNotMatch(h, /rivals? not ranked: IGCSE school/);
  // The stray "–" after a gap with no change since 2022/23 is gone.
  assert.doesNotMatch(renderToStaticMarkup(createElement(AcademicRanking, { r: lp })), /<span>–<\/span>/);
  // A GCSE school stays on GCSE.
  const ch = fx<{ r: { stage: string; switchedFrom?: string } }>("adm_137625_11_c").r;
  assert.equal(ch.stage, "ks4");
  assert.equal(ch.switchedFrom, undefined);
});
