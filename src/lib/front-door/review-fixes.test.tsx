// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/review-fixes.test.tsx
// VicData 0.8 review fixes (14 Nov, M1): the wrong figures and wrong charts in the walks, on real fixtures
// captured read-only from production by the app's own routes and loaders (docs/v0.8/review_14nov/fixtures:
// Leighton Park 110110 and The Chase 137625). Each test failed before its fix. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { WALKS, walkById, walkDashboardConfig, type Walk } from "./walks";
import { teacherScreen } from "./teacher-screens";
import type { TeacherModel } from "./teacher-model";
import { admissionsAnswer, feederCount } from "./admissions-answers";
import { largestYearGroup, smtAnswer } from "./smt-answers";
import { fillTitle, titleProblem, entryYearWord, entryBandWord, admissionsTitleFill, smtTitleFill } from "./walk-titles";
import { GROUP_LAYOUT_IDS } from "@/lib/groups/dash-layout";
import { dataviewById } from "@/catalogue/dataviews";
import { entryPoint } from "@/lib/admissions/entry-points";
import { AdmissionsWalkBody } from "@/components/admissions/AdmissionsDashboard";
import { EntryNow } from "@/components/admissions/panels/EntryNow";
import { PoolTrends, EntryTrend } from "@/components/admissions/views/Lines";
import { WalkHeader } from "@/components/front-door/WalkPage";

const FX = "docs/v0.8/review_14nov/fixtures";
const fx = <T,>(name: string): T => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as T;
type Adm = { p: Parameters<typeof admissionsAnswer>[1]["p"]; m: Parameters<typeof admissionsAnswer>[1]["m"]; r: Parameters<typeof admissionsAnswer>[1]["r"] };
const chase = () => fx<TeacherModel>("teacher_137625_ks4_geography");

test("R-WALK-PANEL-LINK: every walk screen's mini-map spot is its view's panel on the dashboard config", () => {
  const COL = { c1: 0, c2: 1, c3: 2 } as Record<string, number>;
  let n = 0;
  for (const w of WALKS)
    for (const s of w.screens) {
      n++;
      if (w.product === "group") {
        const L = GROUP_LAYOUT_IDS[({ O: "overview", S: "schools", A: "academic", P: "pupils" } as const)[s.view.charAt(4) as "O"]];
        const row = L.now.some((c) => c.views.includes(s.view)) ? 0 : 1;
        const cells = row === 0 ? L.now : L.trends;
        const i = cells.findIndex((c) => c.views.includes(s.view));
        assert.ok(i >= 0, `${w.id} ${s.view} is on its group dashboard`);
        assert.equal(s.spot.col, cells.slice(0, i).reduce((t, c) => t + c.span, 0), `${w.id} ${s.view} column`);
        assert.equal(s.spot.row, row, `${w.id} ${s.view} row`);
        continue;
      }
      const cfg = walkDashboardConfig(w, s)!;
      const panel = cfg.panels.find((p) => p.dataviews.some((v) => v.kind === "view" && v.dataview === s.view));
      assert.ok(panel, `${w.id} ${s.view} is on ${cfg.id}`);
      assert.equal(s.spot.col, COL[panel!.column], `${w.id} ${s.view} column`);
      assert.equal(s.spot.row, panel!.row === "trends" ? 1 : 0, `${w.id} ${s.view} row`);
      assert.equal(s.spot.span, (panel!.span?.cols ?? 1) as 1 | 2, `${w.id} ${s.view} span`);
    }
  assert.ok(n > 80);
  // The nine the review found pointing at the wrong panel (dashboards.md #5), now where they live.
  const spot = (walk: string, view: string) => walkById(walk)!.screens.find((s) => s.view === view)!.spot;
  assert.deepEqual([spot("admissions-pipeline", "DV-ADM-P-POOL-INDEXED").col, spot("admissions-pipeline", "DV-ADM-P-POOL-INDEXED").row], [1, 1]);
  assert.deepEqual([spot("admissions-pipeline", "DV-ADM-P-ENTRY-LINE").col, spot("admissions-pipeline", "DV-ADM-P-ENTRY-LINE").row], [0, 1]);
  assert.deepEqual([spot("admissions-market", "DV-ADM-M-SHARE-LINE").col, spot("admissions-market", "DV-ADM-M-SHARE-LINE").row], [2, 1]);
  assert.deepEqual([spot("smt-context", "DV-SMT-C-BIRTHS").col, spot("smt-context", "DV-SMT-C-BIRTHS").row], [1, 0]);
  assert.deepEqual([spot("smt-context", "DV-SMT-C-NEARBY").col, spot("smt-context", "DV-SMT-C-NEARBY").row], [1, 0]);
  assert.deepEqual([spot("smt-pupils", "DV-SMT-P-AREA").col, spot("smt-pupils", "DV-SMT-P-AREA").row], [2, 1]);
  assert.equal(spot("group-pupils", "GRP-P-PROJECTION").col, 1);
  assert.equal(spot("group-pupils", "GRP-P-GROWING").col, 2);
  assert.equal(spot("group-academic", "GRP-A-IMPROVING").col, 2);
});

test("R-WALK-WORDS: no walk title, on any walk, keeps a placeholder or starts with punctuation", () => {
  const titles: { where: string; t: string }[] = [];
  for (const name of ["teacher_137625_ks4_geography", "teacher_137625_ks4_small", "teacher_110110_ks5", "teacher_110110_ks5_physics"]) {
    const m = fx<TeacherModel>(name);
    for (const w of WALKS.filter((x) => x.product === (m.phase === "ks4" ? "gcse" : "post16"))) w.screens.forEach((_, i) => titles.push({ where: `${name} ${w.id} ${i + 1}`, t: teacherScreen(m, w, i).title }));
  }
  for (const [name, entry] of [["adm_110110_11", "11+"], ["adm_110110_16", "16+"], ["adm_137625_11", "11+"]] as const) {
    const d = fx<Adm>(name);
    for (const w of WALKS.filter((x) => x.product === "admissions"))
      for (const s of w.screens) {
        const dv = dataviewById(s.view)!;
        titles.push({ where: `${name} ${s.view}`, t: fillTitle(dv.titleTemplate, admissionsTitleFill(entry, d.p), dv.label) });
        titles.push({ where: `${name} ${s.view} (no pool)`, t: fillTitle(dv.titleTemplate, admissionsTitleFill(entry, null), dv.label) });
      }
  }
  for (const w of WALKS.filter((x) => x.product === "smt" || x.product === "smt_primary"))
    for (const s of w.screens) {
      const dv = dataviewById(s.view)!;
      titles.push({ where: `${w.id} ${s.view}`, t: fillTitle(dv.titleTemplate, smtTitleFill("Leighton Park School"), dv.label) });
    }
  const bad = titles.filter((x) => titleProblem(x.t)).map((x) => `${x.where}: "${x.t}"`);
  assert.deepEqual(bad, []);
  // The fragments the review quoted, now whole.
  const lp = fx<Adm>("adm_110110_11");
  const f = admissionsTitleFill("11+", lp.p);
  assert.equal(fillTitle(dataviewById("DV-ADM-P-POOL-INDEXED")!.titleTemplate, f, "x"), `10-year-olds: your feeders, ${lp.p!.poolTrends.laName} and England`);
  assert.equal(fillTitle(dataviewById("DV-ADM-M-NOW")!.titleTemplate, f, "x"), "Your place among the rivals, at 11+ (Year 7)");
  assert.equal(fillTitle(dataviewById("DV-ADM-P-MAP")!.titleTemplate, f, "x"), "Your feeders, sized by pupils aged 10, coloured by trend");
  assert.equal(entryYearWord(11), "Year 7");
  assert.equal(entryBandWord(11), "Years 7–11");
  // A placeholder with no word for it gives the view's label, never a fragment.
  assert.equal(fillTitle("[nothing]-year-olds", {}, "Pool trends"), "Pool trends");
});

test("R-WALK-WORDS: the Admissions walk header names the chosen entry point", () => {
  const w = walkById("admissions-pipeline")!;
  const html = renderToStaticMarkup(createElement(WalkHeader, { walk: w, step: 0, steps: 5, chip: "Admissions · 16+ (Year 12)", ctx: { entry: "16+ (Year 12)" }, band: "dark" }));
  assert.match(html, /How many children could join us at 16\+ \(Year 12\)\?/);
  assert.doesNotMatch(html, /your entry point/);
});

test("R-WALK-RHYTHM: the Admissions walk draws the dashboard's own view for each screen (Entry point now, Pipeline)", () => {
  const d = fx<Adm>("adm_110110_11");
  const body = (dv: string) => renderToStaticMarkup(createElement(AdmissionsWalkBody, { dv, urn: "110110", schoolName: "Leighton Park School", entry: "11+", pipeline: d.p, market: d.m, rivals: d.r }));
  // DV-ADM-P-NOW is the dashboard's EntryNow tiles, not the cohort bars it used to draw.
  assert.equal(body("DV-ADM-P-NOW"), renderToStaticMarkup(createElement(EntryNow, { p: d.p!, shape: null })));
  assert.notEqual(body("DV-ADM-P-NOW"), renderToStaticMarkup(createElement(EntryTrend, { p: d.p!, as: "bars", fullscreen: false, room: 240 })));
  // DV-ADM-P-PIPELINE is the pipeline chart, not the pool trends (screen 4's chart).
  assert.notEqual(body("DV-ADM-P-PIPELINE"), body("DV-ADM-P-POOL-INDEXED"));
  assert.notEqual(body("DV-ADM-P-PIPELINE"), renderToStaticMarkup(createElement(PoolTrends, { p: d.p!, fullscreen: false, room: 240 })));
  // Each screen is a different drawing.
  const w = walkById("admissions-pipeline")!;
  const all = w.screens.map((s) => body(s.view));
  assert.equal(new Set(all).size, all.length);
  // A missing answer says so (never an empty panel).
  assert.match(renderToStaticMarkup(createElement(AdmissionsWalkBody, { dv: "DV-ADM-P-PIPELINE", urn: "1", schoolName: "x", entry: "11+", pipeline: null, market: null, rivals: null })), /No pool is published for 11\+ \(Year 7\) yet/);
});

test("R-WALK-WORDS: every Admissions answer is a whole sentence, on the fixtures and with nothing loaded; the pipeline's change has its year", () => {
  for (const name of ["adm_110110_11", "adm_110110_16", "adm_137625_11"]) {
    const d = fx<Adm>(name);
    const label = entryPoint(name.endsWith("16") ? "16+" : "11+")!.label;
    for (const w of WALKS.filter((x) => x.product === "admissions"))
      for (const s of w.screens)
        for (const data of [{ p: d.p, m: d.m, r: d.r }, { p: null, m: null, r: null }]) {
          const a = admissionsAnswer(s.view, { label, ...data });
          assert.ok(a.trim().length > 10, `${name} ${s.view}: "${a}"`);
          assert.match(a, /^[A-Z0-9]/, `${name} ${s.view}: capital`);
          assert.match(a, /[.?!]$/, `${name} ${s.view}: a full stop`);
          assert.doesNotMatch(a, /\. (up|down|level)\b/, `${name} ${s.view}: no fragment`);
        }
  }
  const d = fx<Adm>("adm_110110_11");
  if (d.p!.change) assert.match(admissionsAnswer("DV-ADM-P-PIPELINE", { label: "11+ (Year 7)", ...d }), new RegExp(`in ${d.p!.changeYear} \\((up|down|level)`));
  // Feeders counted once (a school in two rungs' sets is one school).
  const urns = new Set(d.p!.rungSets.flatMap((x) => x.schools.map((y) => y.urn)).filter((u) => u !== "110110"));
  assert.equal(feederCount(d.p!), urns.size);
});

test("R-WALK-WORDS: SMT's largest year group is the largest (it sorted on a field year groups don't have)", () => {
  for (const urn of ["110110", "137625"]) {
    const p = fx<{ pupils: Parameters<typeof largestYearGroup>[0] }>(`smt_${urn}`).pupils;
    const big = largestYearGroup(p)!;
    assert.equal(big.total, Math.max(...p.shape.yearGroups.map((y) => y.total)), urn);
    assert.match(smtAnswer("DV-SMT-P-SHAPE", { name: "x" }, p), new RegExp(`largest year group is ${big.label}, with ${big.total} pupils`));
  }
  // Leighton Park: Year 13 (98), not Year 7 (57), the first in the list.
  const lp = fx<{ pupils: Parameters<typeof largestYearGroup>[0] }>("smt_110110").pupils;
  assert.equal(largestYearGroup(lp)!.label, "Y13");
});

test("R-WALK-WORDS: 'Has our position changed?' compares the last year with a place, each labelled with its own year and of N", () => {
  const m = chase();
  const w = walkById("gcse-nearby")!;
  const i = w.screens.findIndex((s) => s.answer === "nearby-trend");
  const before = teacherScreen(m, w, i).answer;
  assert.match(before, /^(Up|Down|The same): \d+(st|nd|rd|th) of \d+ in \d{4}\/\d{2}, \d+(st|nd|rd|th) of \d+ in \d{4}\/\d{2}\.$/);
  // The school with no figure in the latest year: the place compared is the last real one, with its year.
  const gap: TeacherModel = { ...m, nearest: m.nearest.map((x) => (x.isTarget ? { ...x, points: [...x.points.slice(0, -1), null] } : x)) };
  const a = teacherScreen(gap, w, i).answer;
  const last = gap.periods.length - 1;
  assert.doesNotMatch(a, new RegExp(`in ${["2025/26"][0].replace("/", "\\/")}\\.$`), a);
  assert.match(a, /in 2024\/25\. The school has no place for 2025\/26\.$/, a);
  assert.ok(last > 0);
});

test("R-WALK-WORDS: the entries comparison is right when entries fall, names each comparator's value, and leaves out one with no figure", () => {
  const m = fx<TeacherModel>("teacher_110110_ks5_physics");
  const w = walkById("post16-many")!;
  const i = w.screens.findIndex((s) => s.answer === "entries-area");
  const sc = teacherScreen(m, w, i);
  const c = sc.chart;
  assert.equal(c.kind, "lines");
  if (c.kind !== "lines") return;
  const mine = c.series[0].values[c.series[0].values.length - 1]!;
  if (mine < 100) assert.match(sc.answer, /entries here fell \d+% since/);
  if (mine > 100) assert.match(sc.answer, /entries here rose \d+% since/);
  assert.doesNotMatch(sc.answer, /grown (faster|more slowly)/);
  for (const s of c.series.slice(1)) {
    const v = s.values[s.values.length - 1];
    if (v !== null) assert.ok(sc.answer.includes(String(Math.round(v))), `${s.label} ${Math.round(v)} in "${sc.answer}"`);
  }
  // With no LA line, the LA isn't named ("in the LA").
  const noLa: TeacherModel = { ...m, area: { ...m.area, la: null } };
  const a = teacherScreen(noLa, w, i).answer;
  assert.doesNotMatch(a, /the LA|Reading/);
});

test("R-WALK-WORDS: the indexed 'nearby and nationally' chart is 100 at the year its caption names", () => {
  for (const m of [chase(), fx<TeacherModel>("teacher_110110_ks5_physics"), fx<TeacherModel>("teacher_110110_ks5")]) {
    const w = walkById(m.phase === "ks4" ? "gcse-many" : "post16-many")!;
    const i = w.screens.findIndex((s) => s.answer === "entries-area");
    const sc = teacherScreen(m, w, i);
    if (sc.chart.kind !== "lines") continue;
    const c = sc.chart;
    assert.ok(c.yCaption.includes(`(${c.years[0]} = 100)`), c.yCaption);
    for (const s of c.series) assert.ok(s.values[0] !== null && Math.abs(s.values[0]! - 100) < 1e-9, `${m.school.name} ${s.label} starts at ${s.values[0]} in ${c.years[0]}`);
    assert.ok(sc.note.includes(`starts at 100 in ${c.years[0]}`));
    if (/\(index \d+\)/.test(sc.answer)) assert.match(sc.answer, new RegExp(`since ${c.years[0].replace("/", "\\/")}`));
  }
});

test("the phone bar chart caps the name column, so the bars keep their width at 390 px", () => {
  const src = readFileSync("src/components/front-door/charts.tsx", "utf8");
  const hb = src.slice(src.indexOf("function HBars"), src.indexOf("// ------------------------------------------------------------------------------------------------ dumbbell"));
  assert.match(hb, /grid-cols-\[minmax\(0,38%\)_minmax\(0,1fr\)_3rem\]/);
  assert.match(hb, /sm:grid-cols-\[minmax\(0,16rem\)_minmax\(0,1fr\)_3\.5rem\]/);
});

export type { Walk };
