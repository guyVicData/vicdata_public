// VicData 0.6.1 S4: the Add a view / Edit view screens' logic -- the honest options (D7,
// from the catalogue), Show this view for's greying, the output ViewSpec round-trip, and a
// view added under a measure being tagged with it.
// Run: npx -y tsx --test src/lib/view-editor.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEACHER_DASHBOARDS } from "@/catalogue/dashboards";
import { contextFromPanel } from "@/catalogue/pick";
import { presetSpec, type CompareSeriesKind } from "@/catalogue/viewspec";
import { averageHow, compareHonest, perHonest, shownAsHonest, showForOptions, viewHonest, type HonestContext, type HonestMeasure } from "@/catalogue/honest";
import type { DashboardConfig, Phase, ResultsMeasure } from "@/catalogue/types";
import { addLine, buildInstance, columnHostOf, describeChanges, honestTicks, removeLine, setPer, setView, showForOf, sideOf, startDraft, withAutoTicks, type EditorEnv } from "@/components/view-editor/model";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { oneViewConfig, oneViewPinned } from "@/components/dashboard-config/embed";
import * as ops from "./editor-ops";

const dash = (id: string): DashboardConfig => TEACHER_DASHBOARDS.find((d) => d.id === id)!;

function envFor(config: DashboardConfig, panelId: string, measure: HonestMeasure): EditorEnv {
  const ctx = contextFromPanel(config, panelId, { school: "The Chase", subject: { label: "History" }, category: "Humanities & Social Sciences", ...(measure !== "entries" ? { results: measure } : {}) });
  return {
    phase: ctx.phase,
    columnHost: columnHostOf(config, panelId)!,
    side: sideOf(config, panelId),
    measure,
    followsPill: ctx.data === "academic.results",
    ctx: measure === "entries" ? ctx : { ...ctx, results: measure },
  };
}

// ------------------------------------------------------------------- D7, the table

const subjectCol = (phase: Phase, measure: HonestMeasure): HonestContext => ({ phase, measure, host: measure === "entries" ? "teacher.c1.candidates" : "teacher.c1.results" });
const ok = (c: HonestContext, k: CompareSeriesKind, span = false) => compareHonest(c, k, { span }).ok;

test("D7: Points -- every comparison", () => {
  for (const phase of ["ks4", "ks5"] as const) {
    const c = subjectCol(phase, "points");
    for (const k of ["self", "category", "allSubjects", "selectedSubjects", "la", "region", "england", "nearest", "savedSet"] as const) assert.ok(ok(c, k, true), `${phase} points ${k}`);
  }
});

test("D7: Grade 4+ / A*-E -- LA, region and England greyed with R-NO-GRADE-RATE-GEO", () => {
  for (const phase of ["ks4", "ks5"] as const) {
    const c = subjectCol(phase, "threshold");
    for (const k of ["self", "category", "allSubjects", "selectedSubjects"] as const) assert.ok(ok(c, k), `${phase} threshold ${k}`);
    for (const k of ["la", "region", "england"] as const) {
      const v = compareHonest(c, k);
      assert.equal(v.ok, false, `${phase} threshold ${k}`);
      assert.equal(v.rule, "R-NO-GRADE-RATE-GEO");
      assert.ok(v.reason && v.reason.length > 10);
    }
  }
  assert.match(compareHonest(subjectCol("ks5", "threshold"), "england").reason!, /A\*–E rate/);
});

test("D7: Bands -- England latest year only (R-BANDS-ENGLAND-BENCH, 5 schools); LA / region greyed", () => {
  const c = subjectCol("ks4", "bands");
  for (const k of ["self", "category", "allSubjects", "selectedSubjects"] as const) assert.ok(ok(c, k, true), k);
  assert.ok(ok(c, "england", false));
  assert.match(compareHonest(c, "england").note!, /5 schools/);
  const span = compareHonest(c, "england", { span: true });
  assert.equal(span.ok, false);
  assert.equal(span.rule, "R-BANDS-ENGLAND-BENCH");
  for (const k of ["la", "region"] as const) assert.equal(compareHonest(c, k).rule, "R-BANDS-ENGLAND-BENCH");
});

test("0.6.2 S3: Grade 4+ / A*-E and bands -- across schools offered on a subject column too (each school's own grade counts, R-COMPARATOR-RATE-PER-QUAL); S3d greyed it", () => {
  for (const phase of ["ks4", "ks5"] as const)
    for (const measure of ["threshold", "bands"] as const) {
      for (const host of ["teacher.c1.results", "teacher.c2.context"] as const)
        for (const k of ["nearest", "savedSet"] as const) {
          const v = compareHonest({ phase, measure, host }, k, { span: true });
          assert.equal(v.ok, true, `${phase} ${measure} ${host} ${k}`);
          assert.equal(v.rule, "R-COMPARATOR-RATE-PER-QUAL");
          assert.match(v.note!, /own grade counts/);
        }
      for (const k of ["nearest", "savedSet"] as const) assert.ok(compareHonest({ phase, measure, host: "teacher.c3.comparisons" }, k, { span: true }).ok, `${phase} ${measure} Comparisons ${k}`);
    }
  // Points and entries keep the set's average on a subject column.
  for (const k of ["nearest", "savedSet"] as const) {
    assert.ok(ok(subjectCol("ks4", "points"), k, true));
    assert.ok(ok(subjectCol("ks4", "entries"), k, true));
  }
});

test("D7: Counts -- self, England ticks, and (0.6.2 S3) the set's share ticks on Column 1; no groups, no areas", () => {
  const c = subjectCol("ks4", "counts");
  assert.ok(ok(c, "self"));
  assert.ok(ok(c, "england"));
  assert.match(compareHonest(c, "england").note!, /ticks/);
  for (const k of ["category", "allSubjects", "selectedSubjects", "la", "region"] as const) assert.equal(ok(c, k), false, k);
  for (const host of ["teacher.c1.counts", "teacher.c1.results"] as const)
    for (const k of ["nearest", "savedSet"] as const) {
      const v = compareHonest({ phase: "ks5", measure: "counts", host }, k);
      assert.ok(v.ok, `${host} ${k}`);
      assert.equal(v.rule, "R-COMPARATOR-GRADE-SHARE");
      assert.match(v.note!, /share.*not a count/);
    }
  // Comparisons and Context compare on one figure: there Grade counts follows the selected
  // grade (0.6.3 S1), no longer a fallback to points.
  for (const host of ["teacher.c3.comparisons", "teacher.c2.context"] as const) assert.equal(compareHonest({ phase: "ks4", measure: "counts", host }, "nearest").rule, "R-COUNTS-SELECTION");
  // Shares are averaged plainly (each school counts once): no weighting by entries.
  assert.equal(averageHow(c, "weighted").ok, false);
  assert.equal(perHonest({ ...c, host: "teacher.c3.comparisons" }, "school").rule, "R-MEASURE-FALLBACK");
});

test("D7: Entries -- areas are points-eligible only (GCSE) / scored qualifications only (Post-16)", () => {
  for (const k of ["self", "category", "allSubjects", "selectedSubjects", "la", "region", "england", "nearest", "savedSet"] as const) assert.ok(ok(subjectCol("ks4", "entries"), k), k);
  assert.match(compareHonest(subjectCol("ks4", "entries"), "la").note!, /Points-eligible/);
  assert.equal(compareHonest(subjectCol("ks4", "entries"), "england").rule, "R-GEO-POINTS-ELIGIBLE");
  assert.match(compareHonest(subjectCol("ks5", "entries"), "england").note!, /Scored qualifications only/);
});

test("D7: Post-16 -- R-KS5-ASAEA-EXCL on groups; All subjects on points keeps to the family", () => {
  assert.equal(compareHonest(subjectCol("ks5", "entries"), "category").rule, "R-KS5-ASAEA-EXCL");
  assert.equal(compareHonest(subjectCol("ks5", "threshold"), "selectedSubjects").rule, "R-KS5-ASAEA-EXCL");
  assert.equal(compareHonest(subjectCol("ks5", "points"), "allSubjects").rule, "R-QUAL-FAMILY-MATCH");
  assert.equal(compareHonest(subjectCol("ks5", "points"), "england").rule, "R-KS5-ENGLAND-EXACT");
  assert.equal(compareHonest(subjectCol("ks4", "points"), "category").rule, undefined);
});

test("numbers and views: indexed is for headcounts, change is the measure's own, donut per shareApplies, map needs a school set", () => {
  const pts = subjectCol("ks4", "points");
  assert.equal(shownAsHonest(pts, "indexed", "year").rule, "R-INDEX-HEADCOUNTS");
  assert.ok(shownAsHonest(subjectCol("ks4", "entries"), "indexed", "year").ok);
  assert.equal(perHonest(subjectCol("ks4", "entries"), "grade").ok, false);
  assert.equal(perHonest(pts, "school").ok, false);
  assert.ok(perHonest({ ...pts, host: "teacher.c3.comparisons" }, "school").ok);
  const bySubject = { per: "subject" as const, years: { latest: true as const } };
  assert.equal(viewHonest(pts, "donut", bySubject).rule, "R-DONUT-COUNTS-ONLY");
  assert.ok(viewHonest(subjectCol("ks4", "entries"), "donut", bySubject).ok);
  assert.ok(viewHonest(subjectCol("ks4", "bands"), "donut", bySubject).ok);
  assert.equal(viewHonest({ ...subjectCol("ks4", "bands"), hasBandRange: false }, "donut", bySubject).ok, false);
  assert.equal(viewHonest(pts, "map", { per: "school", years: { latest: true } }).ok, false);
  assert.ok(viewHonest({ ...pts, host: "teacher.c3.comparisons" }, "map", { per: "school", years: { latest: true } }).ok);
  assert.equal(viewHonest(pts, "line", bySubject).ok, false);
  assert.equal(viewHonest(pts, "spread", bySubject).ok, false);
});

// ------------------------------------------------------------- Show this view for

test("Show for: a school-only line greys Grade counts with the reason; bands drops the area lines with a note", () => {
  const config = dash("vicdata.ks4.results");
  const env = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  let spec = presetSpec("DV-C1-RES-TR-CHART");
  delete spec.data.rows;
  spec = removeLine(spec, -1); // follows the page -> this school only
  const only = showForOptions(spec, { phase: "ks4", host: env.columnHost }, "teacher.c1.results", ["points", "threshold", "bands"]);
  const counts = only.find((o) => o.measure === "counts")!;
  assert.equal(counts.ok, false);
  assert.equal(counts.reason, "A line needs one number a year. Use Grade spread instead.");
  assert.ok(only.filter((o) => o.measure !== "counts").every((o) => o.ok && o.note === "This school only"));

  const withAreas = addLine(addLine(addLine(spec, "category"), "la"), "england");
  const opts = showForOptions(withAreas, { phase: "ks4", host: env.columnHost }, "teacher.c1.results", ["points", "threshold", "bands"]);
  assert.equal(opts.find((o) => o.measure === "points")!.note, "All four lines");
  assert.match(opts.find((o) => o.measure === "bands")!.note!, /^School \+ category only: LA & England aren't published/);
  assert.match(opts.find((o) => o.measure === "threshold")!.note!, /LA & England/);
});

test("0.6.2 S3, step 3: an average across the 10 nearest / a saved set is no longer dropped on Grade 4+ and bands", () => {
  const config = dash("vicdata.ks4.results");
  const env = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  let spec = presetSpec("DV-C1-RES-TR-CHART");
  delete spec.data.rows;
  spec = removeLine(spec, -1);
  for (const kind of ["nearest", "savedSet"] as const) {
    const withSet = { ...spec, compare: [{ kind: "self" as const, colour: "accent" }, { kind, colour: "muted", average: "mean" as const }] };
    const opts = showForOptions(withSet, { phase: "ks4", host: env.columnHost }, "teacher.c1.results", ["points", "threshold", "bands"]);
    for (const m of ["points", "threshold", "bands"] as const) {
      const o = opts.find((x) => x.measure === m)!;
      assert.ok(o.ok, `${kind} ${m}`);
      assert.doesNotMatch(o.note ?? "", /isn't published|aren't published/, `${kind} ${m}`);
    }
  }
  // A Grade counts spread with the set's share ticks ticks Grade counts.
  const spread = { ...presetSpec("DV-C1-CNT-CUR-DIST"), compare: [{ kind: "self" as const, colour: "accent" }, { kind: "nearest" as const, colour: "muted", average: "mean" as const }] };
  const o = showForOptions(spread, { phase: "ks4", host: "teacher.c1.results" }, "teacher.c1.counts", ["counts"]);
  assert.ok(o.find((x) => x.measure === "counts")!.ok);
});

test("Show for: a Grade counts view is counts-only; Context follows the counts selection (0.6.3 S1)", () => {
  const spread = presetSpec("DV-C1-CNT-CUR-DIST");
  const o = showForOptions(spread, { phase: "ks4", host: "teacher.c1.results" }, "teacher.c1.counts", ["counts"]);
  assert.deepEqual(o.map((x) => x.ok), [false, false, false, true]);
  const ctxBars = showForOptions(presetSpec("DV-C2-CUR-BARS"), { phase: "ks4", host: "teacher.c2.context" }, "teacher.c2.context", ["points", "threshold", "bands", "counts"]);
  assert.equal(ctxBars.find((x) => x.measure === "counts")!.rule, "R-COUNTS-SELECTION");
});

// ---------------------------------------------------------------------- output

test("output: an unchanged draft is its preset; edits round-trip through Edit view", () => {
  const config = dash("vicdata.ks4.results");
  const env = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  const draft = startDraft(env);
  const plain = buildInstance(draft, env);
  assert.equal(plain.dataview, "DV-C1-RES-TR-CHART");
  assert.deepEqual(plain.spec, presetSpec("DV-C1-RES-TR-CHART"));
  assert.equal(plain.title, undefined);

  // History, this school only, with England and an average, as a table: a spec of its own.
  let spec = removeLine(draft.spec, -1);
  spec = addLine(spec, "england");
  spec = setView(spec, "table");
  const own = buildInstance({ ...draft, spec }, env);
  assert.equal(own.dataview, "DV-C1-RES-TR-TABLE");
  assert.equal(own.spec.preset, own.dataview);
  assert.notDeepEqual(own.spec, presetSpec(own.dataview));
  assert.deepEqual(own.spec.compare, [{ kind: "self", colour: "accent" }, { kind: "england", colour: "palette:3" }]);
  assert.equal(own.spec.view.kind, "table");

  // Into the config and back: validated, same spec, and re-opening + saving changes nothing.
  const added = ops.addView(config, "vicdata.ks4.results.c1.trends", own);
  assert.deepEqual(ops.validateConfig(added.config).problems, []);
  const stored = added.config.panels.find((p) => p.id === added.panelId)!.dataviews.find((v) => v.id === added.instanceId)!;
  assert.ok(stored.kind === "view");
  assert.notEqual(added.instanceId, "new");
  const reopened = startDraft(env, stored as Parameters<typeof startDraft>[1]);
  const again = buildInstance(reopened, env, stored as Parameters<typeof buildInstance>[2]);
  assert.deepEqual(again, stored);
  assert.deepEqual(describeChanges(reopened, reopened, "ks4", "points"), []);
  const saved = ops.updateView(added.config, added.instanceId, again);
  assert.equal(saved.instanceId, added.instanceId);
  assert.deepEqual(saved.config, added.config);

  // A renamed preset stays its preset; the title is the instance's.
  const renamed = buildInstance({ ...draft, title: "[subject] over time" }, env);
  assert.deepEqual(renamed.spec, presetSpec("DV-C1-RES-TR-CHART"));
  assert.equal(renamed.title, "[subject] over time");

  // Edit keeps the id even when the view moves to another preset (D10).
  const edited = buildInstance({ ...reopened, spec: setView(reopened.spec, "line") }, env, stored as Parameters<typeof buildInstance>[2]);
  assert.equal(edited.id, added.instanceId);
  const kept = ops.updateView(added.config, added.instanceId, edited);
  assert.equal(kept.instanceId, added.instanceId);
});

test("output: a view made on Grade counts is drawn by Grade counts' own panels", () => {
  const config = dash("vicdata.ks4.results");
  const env = envFor(config, "vicdata.ks4.results.c1.current", "counts");
  const d = startDraft(env);
  assert.equal(d.spec.preset, "DV-C1-CNT-CUR-DIST");
  assert.equal(d.spec.view.kind, "spread");
  const table = buildInstance({ ...d, spec: setView(d.spec, "table") }, env);
  assert.equal(table.dataview, "DV-C1-CNT-CUR-DIST");
  assert.equal(table.spec.view.kind, "table");
  // Over time, one value per year is not honest on counts; a Data change to Year moves the
  // View off the spread to one that can draw it.
  const trend = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  const line = setPer(startDraft(trend).spec, "grade", trend);
  assert.equal(line.view.kind, "spread");
  assert.equal(line.data.per, "grade");
});

// ------------------------------------------------- adding under a measure tags it

test("Add a view's Show for starts on every measure the view can honestly be drawn on (AddView3)", () => {
  const config = dash("vicdata.ks4.results");
  for (const m of ["points", "threshold", "bands"] as ResultsMeasure[]) {
    const env = envFor(config, "vicdata.ks4.results.c1.trends", m);
    const d = startDraft(env);
    const honest = showForOf(d, env);
    // Every honest measure ticked, the editor's own included; the greyed ones unticked.
    assert.deepEqual(d.ticks, honest.filter((o) => o.ok).map((o) => o.measure));
    assert.ok(d.ticks.includes(m), `${m} ticked`);
    for (const o of honest) if (!o.ok) assert.ok(!d.ticks.includes(o.measure), `${o.measure} greyed, unticked`);
    assert.deepEqual(d.ticks, ["points", "threshold", "bands"]);
    // Every measure the view can be drawn on is the preset's default: no tag.
    assert.equal(buildInstance(d, env).resultsMeasures, undefined);
    // Unticking one tags the rest.
    const off = { ...d, ticksAuto: false, ticks: d.ticks.filter((x) => x !== "threshold") };
    assert.deepEqual(buildInstance(off, env).resultsMeasures, ["points", "bands"]);
  }
  // Grade counts: its own panels draw it, so the other three are greyed and unticked.
  const counts = envFor(config, "vicdata.ks4.results.c1.current", "counts");
  const c = startDraft(counts);
  assert.deepEqual(c.ticks, ["counts"]);
  assert.deepEqual(showForOf(c, counts).filter((o) => !o.ok).map((o) => o.measure), ["points", "threshold", "bands"]);
  // Untouched, the ticks follow the draft; once ticked by hand they stay as set.
  const env = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  const d = startDraft(env);
  assert.equal(d.ticksAuto, true);
  const moved = withAutoTicks({ ...d, spec: setView(d.spec, "table") }, env);
  assert.deepEqual(moved.ticks, honestTicks(moved, env));
  const byHand = withAutoTicks({ ...d, ticksAuto: false, ticks: ["points"] }, env);
  assert.deepEqual(byHand.ticks, ["points"]);
  // A Candidates dashboard has no Results pill: nothing to tick.
  const cand = envFor(dash("vicdata.ks4.candidates"), "vicdata.ks4.candidates.c1.trends", "entries");
  const e = startDraft(cand);
  assert.deepEqual(e.ticks, []);
  assert.equal(buildInstance(e, cand).resultsMeasures, undefined);
});

test("Edit keeps the instance's existing ticks", () => {
  const config = dash("vicdata.ks4.results");
  const env = envFor(config, "vicdata.ks4.results.c1.trends", "points");
  const inst = buildInstance({ ...startDraft(env), ticksAuto: false, ticks: ["points"] }, env);
  const d = startDraft(env, inst);
  assert.deepEqual(d.ticks, ["points"]);
  assert.equal(d.ticksAuto, undefined);
});

test("the editor's preview draws on the measure the page is on (asPage), as members see it", () => {
  const dv = DATAVIEWS.find((x) => x.id === "DV-C1-RES-TR-GEO-CHART")!;
  const pin = { phase: "ks4" as const, data: "academic.results" as const, results: "bands" as const };
  // Meeting slots: a measure the view's figures don't support falls back to one they do.
  assert.equal(oneViewConfig(dv, pin, "x").columns[0].data.results, "points");
  // The editor's previews: the page's own measure, so its host draws the not-applicable note.
  assert.equal(oneViewConfig(dv, pin, "x", undefined, undefined, { asPage: true }).columns[0].data.results, "bands");
  assert.equal(oneViewPinned(dv, pin, true, { asPage: true }).pinned.results, "bands");
  // A measure the view doesn't show on is still never drawn.
  assert.equal(oneViewConfig(dv, { ...pin, results: "counts" }, "x", undefined, undefined, { asPage: true }).columns[0].data.results, "points");
});

test("Show this view for: the wider-system views (S6 follow-up) grey Grade 4+, Grade bands and Grade counts on the Results geography views, with the reason", async () => {
    const { showForOptions } = await import("@/catalogue/honest");
    for (const preset of ["DV-C1-RES-TR-GEO-CHART", "DV-C1-RES-TR-GEO-TABLE"] as const) {
      const spec = presetSpec(preset);
      const opts = showForOptions(spec, { phase: "ks4", host: "teacher.c1.results" } as never, "teacher.c1.results", ["points", "threshold", "bands"]);
      const byM = Object.fromEntries(opts.map((o) => [o.measure, o]));
      assert.equal(byM.points.ok, true);
      for (const m of ["threshold", "bands", "counts"]) assert.equal(byM[m].ok, false, `${preset} ${m}`);
      assert.match(byM.bands.reason ?? "", /average points only/);
    }
  });
