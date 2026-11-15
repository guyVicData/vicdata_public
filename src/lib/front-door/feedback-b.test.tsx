// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/feedback-b.test.tsx
// VicData 0.8 feedback 15 Nov, build B: the subject families added to R-SUBJECT-MATCH (Guy's grouping
// decision, 15 Nov), and the walks and homes (B1-B6). No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { familyOf, groupEnglandValues, isGrouped, matchedTitles, readQualifications, sameSubject, subjectMatchKey } from "@/lib/subject-match";

const A = "GCE A level";
const AS = "GCE AS level";
const IB_HL = "IBO Higher level component";
const IB_SL = "IBO Standard level component";
const GCSE = "GCSE (9-1) Full Course";
const same = (phase: "ks4" | "ks5", a: [string, string], b: [string, string]) => sameSubject(phase, { subject: a[0], qualificationType: a[1] }, { subject: b[0], qualificationType: b[1] });

test("R-SUBJECT-MATCH (family): Religious Studies with Religious Education", () => {
  assert.equal(subjectMatchKey("ks5", "Religious Studies", A), "Religious Studies (all titles)");
  // DfE publishes Religious Education at Post-16 only as an IB component: it counts as the A level.
  assert.ok(same("ks5", ["Religious Studies", A], ["Religious Education", IB_SL]));
  assert.ok(same("ks5", ["Religious Studies", A], ["Religious Studies", "A level"]));
  assert.ok(!same("ks5", ["Religious Studies", A], ["Religious Education", AS]));
  assert.ok(same("ks4", ["Religious Studies", GCSE], ["Religious Education", GCSE]));
  assert.deepEqual(readQualifications("ks5", "Religious Studies", A), [A, "A level", IB_HL, IB_SL]);
  assert.deepEqual(readQualifications("ks5", "Religious Studies", A, { aliases: false }), [A, IB_HL, IB_SL]);
  // The AS reads no IB component.
  assert.deepEqual(readQualifications("ks5", "Religious Studies", AS), [AS, "AS level"]);
});

test("R-SUBJECT-MATCH (family): the Design and Technology A level titles", () => {
  const titles = ["Design and Technology (Product Design)", "Design and Technology (Engineering)", "Design and Technology (Textiles Technology)", "Three Dimensional Design (3D Design)"];
  for (const t of titles) assert.equal(subjectMatchKey("ks5", t, A), "Design and Technology (all titles)", t);
  // The stored pre-2024/25 label reads as its latest name.
  assert.equal(subjectMatchKey("ks5", "D & T Product Design", A), "Design and Technology (all titles)");
  assert.deepEqual(matchedTitles("ks5", "Design and Technology (Engineering)", A), titles);
  // A BTEC 3D Design and the IB's Design and Technology stay apart.
  assert.equal(isGrouped("ks5", "Three Dimensional Design (3D Design)", "BTEC National Diploma L3 - Band J - PP-D*D*"), false);
  assert.ok(!same("ks5", ["Design and Technology (Product Design)", A], ["Design and Technology", IB_HL]));
  assert.ok(!same("ks5", ["Design and Technology (Product Design)", A], ["Design and Technology (Engineering)", AS]));
});

test("R-SUBJECT-MATCH (family): Drama and Theatre Studies with the IB's Theatre Studies", () => {
  assert.ok(same("ks5", ["Drama and Theatre Studies", A], ["Theatre Studies", IB_HL]));
  assert.equal(subjectMatchKey("ks5", "Theatre Studies", IB_HL), "Drama and Theatre (all titles)");
  // An IB school's comparison reads the A level too.
  assert.deepEqual(readQualifications("ks5", "Theatre Studies", IB_HL), [IB_HL, A, "A level", IB_SL]);
  // Speech and Drama (BTEC, OCR) is a different subject.
  assert.ok(!same("ks5", ["Drama and Theatre Studies", A], ["Speech and Drama", "BTEC National Extended Certificate L3 - Band F - P-D*"]));
  // England's family figure: A level and IB merged under the A level, weighted by entries.
  const eng = groupEnglandValues(
    [
      { subject: "Drama and Theatre Studies", qualification_type: A, period: 2024, avg_value: 40, entries_total: 90 },
      { subject: "Theatre Studies", qualification_type: IB_HL, period: 2024, avg_value: 30, entries_total: 10 },
    ],
    "ks5",
  );
  assert.deepEqual(eng, [{ key: "Drama and Theatre (all titles)::GCE A level", period: 2024, value: 39 }]);
});

test("R-SUBJECT-MATCH (family): GCSE Art and Design with GCSE Photography", () => {
  assert.ok(same("ks4", ["Art and Design", GCSE], ["Photography", GCSE]));
  assert.equal(familyOf("ks4", "Photography", GCSE)?.phase, "ks4");
  // The A level family is a different one (the GCSE family has no Fine Art), and a non-GCSE stays itself.
  assert.ok(!same("ks4", ["Art and Design", GCSE], ["Fine Art", GCSE]));
  assert.equal(isGrouped("ks4", "Photography", "BTEC First Award"), false);
  // England at GCSE is keyed by subject alone.
  const eng = groupEnglandValues(
    [
      { subject: "Art and Design", period: 2024, avg_value: 5, entries_total: 300 },
      { subject: "Photography", period: 2024, avg_value: 6, entries_total: 100 },
      { subject: "Music", period: 2024, avg_value: 5, entries_total: 100 },
    ],
    "ks4",
  );
  assert.deepEqual(eng, [{ key: "Art and Design (all titles)", period: 2024, value: 5.25 }]);
});

test("R-SUBJECT-MATCH (family): English, Mathematics, Music, Classics and Computing stay separate", () => {
  for (const [a, b] of [
    ["English Language", "English Literature"],
    ["English Language", "English Language and Literature"],
    ["Mathematics", "Mathematics (Further)"],
    ["Music", "Music Technology"],
    ["Classical Civilisation", "Latin"],
    ["Computer Science", "Information and Communications Technology"],
  ])
    assert.ok(!same("ks5", [a, A], [b, A]), `${a} / ${b}`);
  for (const t of ["English Language", "Mathematics", "Music", "Latin", "Computer Science"]) {
    assert.equal(isGrouped("ks5", t, A), false, t);
    assert.equal(isGrouped("ks4", t, GCSE), false, t);
  }
});

// ------------------------------------------------------------------------------------------------ B1, B2

import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { answerStep, SMT_SUBJECTS_RANKED, WALKS, walkById, walkRailLabels, walksFor, screenMeta } from "./walks";
import { teacherAnswerStep, teacherScreens } from "./teacher-screens";
import type { TeacherModel } from "./teacher-model";
import { subjectsRanked, subjectsRankedAnswer } from "@/lib/smt/subjects-ranked";
import type { Academic } from "@/lib/smt/academic";
import { dataviewById } from "@/catalogue/dataviews";

const FX = "docs/v0.8/review_14nov/fixtures";
const fx = <T,>(name: string): T => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as T;
const TEACHER_FX = ["teacher_137625_ks4_geography", "teacher_137625_ks4_small", "teacher_110110_ks5", "teacher_110110_ks5_small", "teacher_110110_ks5_physics"];

test("R-WALK-ENDS-ON-ANSWER: every walk names a ranking, chart or table that answers its question -- never a 'now' summary", () => {
  for (const w of WALKS) {
    if (!w.screens.length) {
      assert.equal(w.answer, undefined, `${w.id}: no screens, no answer`);
      continue;
    }
    assert.ok(w.answer, `${w.id} has an answer`);
    assert.ok(["ranking", "chart", "table"].includes(w.answer!.kind), w.id);
    const i = answerStep(w);
    if (w.answer!.view === SMT_SUBJECTS_RANKED) {
      assert.equal(w.id, "smt-academic");
      continue;
    }
    assert.ok(i >= 0, `${w.id}: its answer view is one of its screens`);
    const v = w.answer!.view;
    const dv = dataviewById(v);
    // A "now" view (tiles, the school this year) only summarises; it never answers the walk.
    assert.ok(!/-NOW$|TILES$/.test(v), `${w.id}: ${v} is a summary`);
    if (dv) assert.notEqual(dv.supports.viewType, "numerical", `${w.id}: ${v} is numbers, not a data view`);
    assert.ok(screenMeta(v), v);
  }
  // SMT 7: SMT Academic's last window ranks its subjects.
  assert.deepEqual(walkById("smt-academic")!.answer, { kind: "ranking", view: SMT_SUBJECTS_RANKED });
});

test("R-WALK-ENDS-ON-ANSWER: every Teacher walk on every fixture ends on a drawn chart with its sentence", () => {
  for (const name of TEACHER_FX) {
    const m = fx<TeacherModel>(name);
    for (const w of walksFor(m.phase === "ks5" ? "post16" : "gcse")) {
      const sc = teacherScreens(m, w);
      const i = teacherAnswerStep(w, sc);
      assert.ok(i >= 0, `${name} ${w.id}: an answer`);
      assert.ok(!["none", "tiles"].includes(sc[i].chart.kind), `${name} ${w.id}: ${sc[i].chart.kind}`);
      assert.ok(sc[i].answer.length > 10, `${name} ${w.id}: a sentence`);
    }
  }
});

test("R-WALK-ENDS-ON-ANSWER: SMT Academic ranks every subject strongest to weakest, marking those needing attention (SMT 7)", async () => {
  const { SubjectsRankedView } = await import("@/components/smt/views/Academic");
  for (const urn of ["110110", "137625"]) {
    const a = fx<{ academic: Academic }>(`smt_${urn}`).academic;
    const r = subjectsRanked(a);
    assert.ok(r.rows.length >= 3, `${urn}: subjects ranked`);
    for (let i = 1; i < r.rows.length; i++) assert.ok(r.rows[i - 1].standing >= r.rows[i].standing, `${urn}: strongest first`);
    for (const x of r.rows) {
      assert.ok(x.of >= 2 && x.rank >= 1 && x.rank <= x.of);
      assert.equal(x.mark, x.standing >= 0.75 ? "strong" : x.standing <= 0.25 ? "attention" : null);
    }
    const sentence = subjectsRankedAnswer(r);
    assert.match(sentence, /Strongest|strongest is/);
    assert.match(sentence, /Needs attention|bottom quarter/);
    const html = renderToStaticMarkup(createElement(SubjectsRankedView, { a }));
    assert.equal((html.match(/data-ac-ranked-row=/g) ?? []).length, r.rows.length);
    if (r.rows.some((x) => x.mark === "attention")) assert.match(html, /Needs attention/);
    assert.match(html, /strongest to weakest/);
  }
});

test("R-WALK-RAIL: the walk's rail lists the walk's own views, steps along the walk, and ends on 'More on the dashboard'", async () => {
  const { WalkRail, Found } = await import("@/components/front-door/WalkPage");
  for (const w of WALKS.filter((x) => x.screens.length)) {
    const labels = walkRailLabels(w);
    assert.equal(labels.length, w.screens.length, w.id);
    assert.equal(new Set(labels).size, labels.length, `${w.id}: every rail name is its own (${labels.join(", ")})`);
    const html = renderToStaticMarkup(createElement(WalkRail, { walk: w, step: 1, onStep: () => {}, dashboard: w.dashboard }));
    assert.equal((html.match(/data-walk-rail-step=/g) ?? []).length, w.screens.length, w.id);
    assert.match(html, /aria-current="step"/);
    // One link only: the dashboard, at the foot.
    assert.equal((html.match(/<a /g) ?? []).length, 1, `${w.id}: no rail view opens the dashboard`);
    assert.match(html, /data-walk-rail-more=""[^>]*>More on the dashboard/);
    assert.doesNotMatch(html, /same views, in the same order/);
    // The last window: the way home (Admissions 12), and the answer first.
    const found = renderToStaticMarkup(createElement(Found, { walk: w, screens: w.screens.map((s) => ({ question: s.question, answer: "x" })), params: {}, ctx: {}, onBack: () => {}, answer: { sentence: "The answer.", body: createElement("svg", { "data-answer-chart": "" }) } }));
    assert.match(found, /data-walk-home=""[^>]*>.*Back to your home/);
    assert.ok(found.indexOf("data-answer-chart") < found.indexOf("How you got there"), `${w.id}: the answer comes first`);
  }
});

test("Admissions 8: the Pipeline walk starts with the school -- its own cohort second", () => {
  const w = walkById("admissions-pipeline")!;
  assert.deepEqual(w.screens.slice(0, 2).map((s) => s.view), ["DV-ADM-P-NOW", "DV-ADM-P-ENTRY-LINE"]);
});

test("D6 (SMT 9): Entry points are off the SMT walk, kept on the dashboard and the primary walk", () => {
  assert.ok(!walkById("smt-pupils")!.screens.some((s) => s.view === "DV-SMT-P-ENTRIES"));
  assert.ok(walkById("smt_primary-pupils")!.screens.some((s) => s.view === "DV-SMT-P-ENTRIES"));
});
