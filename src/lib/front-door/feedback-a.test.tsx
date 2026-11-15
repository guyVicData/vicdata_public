// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/feedback-a.test.tsx
// VicData 0.8 feedback 15 Nov, build A: subject matching (A1, R-SUBJECT-MATCH), the rank guards (A5, R-RANK-MIN)
// and no repeated screens (A5, R-WALK-NO-REPEAT), on real fixtures captured read-only from production by the
// walk's own loader (docs/v0.8/feedback_15nov/fixtures: The Chase 137625, Post-16, Art and Design; its 10
// nearest trimmed to their Arts, Media & Design rows) and the 14 Nov fixtures. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WALKS, walksFor, type Walk } from "./walks";
import { teacherScreen, unpublishedReason, RANK_MIN, type Chart } from "./teacher-screens";
import { buildTeacherModel, teacherTileFigures, type TeacherModel, type TeacherModelInput } from "./teacher-model";
import { ART_AND_DESIGN_ALL, isGrouped, mergeFigures, normaliseQualification, sameSubject, subjectMatchKey } from "@/lib/subject-match";
import { matchedHeadlineRows, ownHeadlineRows } from "@/lib/teacher-view-measures";

const chaseInput = () => JSON.parse(readFileSync("docs/v0.8/feedback_15nov/fixtures/teacher_137625_ks5_input.json", "utf8")) as TeacherModelInput;
const chaseArt = () => buildTeacherModel(chaseInput(), "Art and Design::GCE A level");
const OLD = "docs/v0.8/review_14nov/fixtures";
const old = (n: string) => JSON.parse(readFileSync(`${OLD}/${n}.json`, "utf8")) as TeacherModel;
const screensOf = (m: TeacherModel, w: Walk) => w.screens.map((_, i) => teacherScreen(m, w, i));
const teacherWalks = (m: TeacherModel) => walksFor(m.phase === "ks5" ? "post16" : "gcse");

test("R-SUBJECT-MATCH: the A level Art and Design titles are one subject; labels normalised across years", () => {
  for (const t of ["Art and Design", "Fine Art", "Photography", "Graphics", "Textiles", "3D Studies", "Critical Studies"]) assert.equal(subjectMatchKey("ks5", t, "GCE A level"), ART_AND_DESIGN_ALL, t);
  // The stored pre-2024/25 label reads as its latest name.
  assert.equal(subjectMatchKey("ks5", "Art and Design (Fine Art)", "GCE A level"), ART_AND_DESIGN_ALL);
  // Not a BTEC, not GCSE, not History of Art, not Design and Technology.
  assert.equal(isGrouped("ks5", "Art and Design", "BTEC National Extended Certificate L3 - Band F - P-D*"), false);
  assert.equal(isGrouped("ks4", "Art and Design", "GCSE (9-1) Full Course"), false);
  assert.equal(isGrouped("ks5", "History of Art", "GCE A level"), false);
  assert.equal(isGrouped("ks5", "Design and Technology (Textiles Technology)", "GCE A level"), false);
  assert.equal(normaliseQualification("A level"), "GCE A level");
  assert.ok(sameSubject("ks5", { subject: "Art and Design", qualificationType: "GCE A level" }, { subject: "Fine Art", qualificationType: "A level" }));
  assert.ok(!sameSubject("ks5", { subject: "Art and Design", qualificationType: "GCE A level" }, { subject: "Fine Art", qualificationType: "GCE AS level" }));
  // Entries add; points weight by entries, over the titles that publish points.
  assert.deepEqual(mergeFigures([{ entries: 10, points: 40 }, { entries: 30, points: 30 }, { entries: 3, points: null }]), { entries: 43, points: 32.5 });
});

test("R-SUBJECT-MATCH: The Chase's Post-16 Art and Design against its 10 nearest (Hanley Castle, Cleeve and Tewkesbury publish Fine Art)", () => {
  const m = chaseArt();
  assert.equal(m.focus?.matchLabel, ART_AND_DESIGN_ALL);
  const at = (name: RegExp) => m.nearest.find((n) => name.test(n.name))!;
  const last = m.nearest[0].points.length - 1;
  // Before: every nearby school "no figure" (they publish Fine Art, The Chase Art and Design).
  assert.equal(at(/Hanley Castle/).points[last], 32.5);
  assert.equal(at(/Tewkesbury/).points[last], 38.33);
  assert.ok(at(/Cleeve/).points[last] !== null);
  assert.deepEqual(at(/Hanley Castle/).titles, ["Fine Art"]);
  assert.ok(m.nearest.filter((n) => !n.isTarget && n.points[last] !== null).length >= 6);
  // 2020/21's "A level" rows are kept: 12 entries that year (D2).
  assert.equal(m.nearest[0].entries[0], 12);
  assert.equal(m.periods[0], 2020);
  // The school's own Results keep its own title's rows.
  const own = ownHeadlineRows("ks5", m.focus!, [], chaseInput().qualificationHeadline);
  assert.ok(own.every((h) => h.subject === "Art and Design"));
  assert.equal(matchedHeadlineRows("ks5", m.focus!, [], chaseInput().qualificationHeadline).length, own.length);
  const comp = walksFor("post16").find((w) => w.id === "post16-nearby")!;
  const answers = screensOf(m, comp).map((s) => s.answer).join(" ");
  assert.doesNotMatch(answers, /1st of 1\b/);
  assert.match(answers, /4th of 7 schools on average points in Art and Design \(all titles\)/);
});

test("R-SUBJECT-MATCH, Teacher 3: the 'nearby and nationally' chart bases on the school's first year and draws its comparators", () => {
  const m = chaseArt();
  const w = walksFor("post16").find((x) => x.screens.some((s) => s.answer === "entries-area"))!;
  const sc = teacherScreen(m, w, w.screens.findIndex((s) => s.answer === "entries-area"));
  assert.equal(sc.chart.kind, "lines");
  const c = sc.chart as Extract<Chart, { kind: "lines" }>;
  assert.deepEqual(c.series.map((x) => x.role), ["focus", "nearest", "la", "england"]);
  for (const s of c.series) assert.equal(s.values[0], 100, `${s.label} is 100 at the base year`);
  assert.equal(c.years[0], "2021/22");
  assert.match(sc.note, /starts at 100 in 2021\/22, the first year The Chase and the most comparators have entries/);
  // Empty only under two school years.
  const one = chaseArt();
  for (const n of one.nearest) if (n.isTarget) n.entries = n.entries.map((v, k) => (k === 4 ? v : null));
  const f = one.whole.rows.find((r) => r.focus)!;
  f.entries = f.entries.map((v, k) => (k === 4 ? v : null));
  assert.equal(teacherScreen(one, w, w.screens.findIndex((s) => s.answer === "entries-area")).chart.kind, "none");
});

test("A5, Teacher 4: an unpublished year gives its reason; the Results chart draws the area's other subjects", () => {
  assert.equal(unpublishedReason(3, true), "3 entries, too few to publish");
  assert.equal(unpublishedReason(null, true), "no entries");
  assert.equal(unpublishedReason(9, true), "not published");
  const m = chaseArt();
  const w = walksFor("post16").find((x) => x.screens.some((s) => s.answer === "points-trend"))!;
  const sc = teacherScreen(m, w, w.screens.findIndex((s) => s.answer === "points-trend"));
  const c = sc.chart as Extract<Chart, { kind: "lines" }>;
  assert.deepEqual(c.unpublishedWhy, ["3 entries, too few to publish"]);
  assert.ok(c.series.some((s) => s.label === "Film Studies"), "Film Studies has points in 2021/22 and 2024/25");
  assert.match(sc.answer, /2023\/24 \(3 entries, too few to publish\)/);
});

test(`R-RANK-MIN: a rank needs ${RANK_MIN} schools with a figure; never "1st of 1"`, () => {
  const m = chaseArt();
  // Only the school and one neighbour publish points: no ranking, no rank line, no home tile place.
  for (const n of m.nearest) if (!n.isTarget && !/Hanley/.test(n.name)) n.points = n.points.map(() => null);
  const comp = walksFor("post16").find((w) => w.id === "post16-nearby")!;
  const scs = screensOf(m, comp);
  for (const s of scs) assert.doesNotMatch(s.answer, /\b(1st|2nd) of [12]\b/, s.answer);
  const rank = scs[comp.screens.findIndex((s) => s.answer === "nearby-rank")];
  assert.equal(rank.chart.kind, "none");
  assert.match(rank.answer, /Not enough schools with a figure to rank/);
  const trend = scs[comp.screens.findIndex((s) => s.answer === "nearby-trend")];
  assert.equal(trend.chart.kind, "none");
  assert.equal(teacherTileFigures(m).nearby, null);
  // Every walk on every fixture: no place out of fewer than 3.
  for (const fx of [chaseArt(), old("teacher_137625_ks4_geography"), old("teacher_137625_ks4_small"), old("teacher_110110_ks5"), old("teacher_110110_ks5_small"), old("teacher_110110_ks5_physics")])
    for (const w of teacherWalks(fx))
      for (const s of screensOf(fx, w)) {
        if (s.chart.kind === "ranking") assert.ok(s.chart.rows.length >= RANK_MIN, `${w.id}: a ranking of ${s.chart.rows.length}`);
        assert.doesNotMatch(s.answer, /\b\d+(st|nd|rd|th) of [12] schools\b/, `${w.id}: ${s.answer}`);
      }
});

/** What a chart draws, without its words: two screens with the same signature draw the same picture. */
function drawn(c: Chart): string | null {
  switch (c.kind) {
    case "none":
    case "tiles":
      return null;
    case "lines":
      // A line with no figure draws nothing (Teacher 5: the area chart's empty nearest line hid the repeat).
      return JSON.stringify(["lines", c.years, c.series.filter((s) => s.values.some((v) => v !== null)).map((s) => [s.label === "England" ? "england" : s.role === "focus" ? "focus" : s.label, s.values])]);
    case "vbars":
    case "hbars":
      return JSON.stringify([c.kind, c.rows.map((r) => [r.label, r.value])]);
    case "ranking":
      return JSON.stringify(["rank", c.rows.map((r) => [r.label, r.value])]);
    case "map":
      return JSON.stringify(["map", c.points.map((p) => [p.label, p.value])]);
    case "dumbbell":
      return JSON.stringify(["db", c.rows.map((r) => [r.label, r.first, r.latest])]);
    case "grades":
      return JSON.stringify(["grades", c.rows.map((r) => [r.grade, r.count])]);
  }
}

test("R-WALK-NO-REPEAT: no two screens in a walk draw the same series (every Teacher walk on every fixture; every walk's views)", () => {
  for (const fx of [chaseArt(), old("teacher_137625_ks4_geography"), old("teacher_137625_ks4_small"), old("teacher_110110_ks5"), old("teacher_110110_ks5_small"), old("teacher_110110_ks5_physics")])
    for (const w of teacherWalks(fx)) {
      const seen = new Map<string, number>();
      screensOf(fx, w).forEach((s, i) => {
        const sig = drawn(s.chart);
        if (sig === null) return;
        assert.ok(!seen.has(sig), `${fx.school.name} ${fx.focus?.subject} ${w.id}: screen ${i + 1} draws what screen ${(seen.get(sig) ?? 0) + 1} drew`);
        seen.set(sig, i);
      });
    }
  // SMT, Admissions and head office walks draw the dashboard's own views: no view twice with the same options.
  for (const w of WALKS) {
    const keys = w.screens.map((s) => `${s.view}|${JSON.stringify(s.options ?? {})}`);
    assert.equal(new Set(keys).size, keys.length, `${w.id} repeats a view`);
  }
});
