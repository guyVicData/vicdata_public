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

// ------------------------------------------------------------------------------------------------ B3

import { readdirSync } from "node:fs";
import { userTextFindings, type Finding } from "./build-notes";
import { sourceFindings } from "./build-notes-scan";
import { METHODS, methodText } from "@/catalogue/methods";
import { DATAVIEWS } from "@/catalogue/dataviews";
import { smtAnswer } from "./smt-answers";
import { admissionsAnswer } from "./admissions-answers";

/** Pages only platform admins open (Guy's own tools), not a teacher's: their words are for the builders. */
export const BUILD_NOTES_EXEMPT: { file: string; why: string }[] = [{ file: "src/components/chooser-v06/ChooserLab.tsx", why: "the platform admins' chooser lab (/platform/chooser-lab)" }];
/** The lib files whose strings are the walks' and homes' words. */
const WORDS_FILES = ["admissions-answers", "smt-answers", "group-answers", "teacher-screens", "teacher-model", "walk-titles", "words", "walks", "tile-figures"].map((f) => `src/lib/front-door/${f}.ts`).concat(["src/lib/smt/subjects-ranked.ts"]);
const show = (f: Finding[]) => f.map((x) => `${x.where} (${x.what}): ${x.text}`);

test("R-NO-BUILD-NOTES: no rule IDs, file names, 'empty state', 'harness' or rail notes in any page's words", () => {
  // Every component and page, strings and JSX text (the TypeScript parser: comments never count).
  const files = ["src/components", "src/app"].flatMap((d) => (readdirSync(d, { recursive: true }) as string[]).filter((f) => f.endsWith(".tsx")).map((f) => `${d}/${f}`));
  assert.ok(files.length > 200);
  const src = [...files.filter((f) => !BUILD_NOTES_EXEMPT.some((e) => e.file === f)), ...WORDS_FILES].flatMap((f) => sourceFindings(f, readFileSync(f, "utf8")));
  assert.deepEqual(show(src), []);
  // The catalogue's words a page shows: every view's name and title, every method (i), and the notes shown --
  // a role walk's screen note and the Admissions editor's tooltips.
  const roleViews = new Set(WALKS.filter((w) => !["gcse", "post16"].includes(w.product)).flatMap((w) => w.screens.map((s) => s.view)));
  const cat = [
    ...DATAVIEWS.flatMap((d) => [...userTextFindings(`${d.id} label`, d.label), ...userTextFindings(`${d.id} title`, d.titleTemplate)]),
    ...DATAVIEWS.filter((d) => roleViews.has(d.id) || d.id.startsWith("DV-ADM-")).flatMap((d) => userTextFindings(`${d.id} note`, d.note)),
    ...Object.entries(METHODS).flatMap(([id, m]) => userTextFindings(`method ${id}`, methodText(m))),
    ...WALKS.flatMap((w) => [w.question, ...w.screens.map((s) => s.question)].flatMap((q) => userTextFindings(w.id, q))),
  ];
  assert.deepEqual(show(cat), []);
});

test("R-NO-BUILD-NOTES: the walks' own words on real fixtures (Teacher, SMT, Admissions)", () => {
  const out: Finding[] = [];
  for (const name of TEACHER_FX) {
    const m = fx<TeacherModel>(name);
    for (const w of walksFor(m.phase === "ks5" ? "post16" : "gcse"))
      for (const s of teacherScreens(m, w)) for (const t of [s.question, s.answer, s.title, s.note, s.tag, "caption" in s.chart ? (s.chart as { caption?: string }).caption : null, ...s.chart.keys.map((k) => k.label)]) out.push(...userTextFindings(`${name} ${w.id}`, t));
  }
  for (const urn of ["110110", "137625"]) {
    const d = fx<Record<string, unknown> & { school: Parameters<typeof smtAnswer>[1] }>(`smt_${urn}`);
    for (const w of walksFor("smt"))
      for (const s of w.screens) out.push(...userTextFindings(`smt ${urn} ${s.view}`, smtAnswer(s.view, d.school, d[w.id.split("-").pop()!])));
  }
  for (const n of ["adm_110110_11", "adm_110110_16", "adm_137625_11"]) {
    const d = fx<{ p: Parameters<typeof admissionsAnswer>[1]["p"]; m: Parameters<typeof admissionsAnswer>[1]["m"]; r: Parameters<typeof admissionsAnswer>[1]["r"] }>(n);
    for (const w of walksFor("admissions")) for (const s of w.screens) out.push(...userTextFindings(`${n} ${s.view}`, admissionsAnswer(s.view, { label: "11+", p: d.p, m: d.m, r: d.r })));
  }
  assert.deepEqual(show(out), []);
  // The scan itself: a rule ID, a file name and the old rail note are caught; a comment is not.
  assert.equal(sourceFindings("x.tsx", 'const a = <p title="ranked (R-IGCSE-EXCL)">The same views, in the same order, as this panel&rsquo;s rail on the dashboard.</p>; // R-FOO-BAR in Foo.tsx').length, 3);
  assert.equal(sourceFindings("x.tsx", "/* an empty state, R-FOO-BAR */ const a = 1; {/* harness.tsx */}").length, 0);
});

// ------------------------------------------------------------------------------------------------ B4, B5, B6

import type { Overview } from "@/lib/smt/overview";
import type { Pupils } from "@/lib/smt/pupils";

test("B4 (Admissions 1, 4, 5): the sets lead the Admissions home; every home's dashboard button is a tint of its colour", async () => {
  const { AdmissionsSection } = await import("@/components/front-door/sections");
  const html = renderToStaticMarkup(createElement(AdmissionsSection, { urn: "110110" }));
  const sets = html.indexOf("data-sets-card");
  assert.ok(sets > 0, "the sets card is drawn");
  assert.ok(sets < html.indexOf("data-home-tile"), "above the questions");
  const button = /<a[^>]*data-home-dashboard=""[^>]*>/.exec(html)?.[0] ?? "";
  assert.match(button, /bg-\[var\(--tile-tint\)\]/);
  assert.match(button, /text-\[var\(--tile-accent-text\)\]/);
  assert.doesNotMatch(button, /field-chip-bg/);
});

test("B5 (SMT 1): a view waiting on its figures shows the loading graphic, not a bare box", async () => {
  const { Skeleton } = await import("@/components/admissions/ui");
  const html = renderToStaticMarkup(createElement(Skeleton));
  assert.match(html, /role="status"/);
  assert.match(html, /data-spinner=""/);
  assert.match(html, /Loading the figures…/);
});

test("B5 (SMT 2, 14): the phase pills re-scope the tiles and walks as the dashboards' level does", async () => {
  const { smtFigures, smtWalkHref } = await import("@/components/front-door/sections");
  const lp = fx<{ overview: Overview; pupils: Pupils }>("smt_110110");
  const whole = smtFigures(lp.overview, false, "whole", lp.pupils);
  const p16 = smtFigures(lp.overview, false, "post16", lp.pupils);
  // Leighton Park sits IGCSEs: no ranked GCSE headline, so Academic at GCSE has no figure; Post-16 has A level points.
  assert.equal(p16["smt-academic"]?.unit, "A level: points per entry");
  assert.equal(smtFigures(lp.overview, false, "gcse", lp.pupils)["smt-academic"], undefined);
  // Overview is the whole school at any level; Pupils follows the level's own phase line.
  assert.deepEqual(p16["smt-overview"], whole["smt-overview"]);
  assert.match(p16["smt-pupils"]?.unit ?? "", /^Post-16 pupils on last year$/);
  assert.match(smtFigures(lp.overview, false, "gcse", lp.pupils)["smt-pupils"]?.unit ?? "", /^GCSE pupils on last year$/);
  const w = (id: string) => walkById(id)!;
  assert.equal(smtWalkHref(w("smt-overview"), "post16"), "/teacher/walk/smt-overview");
  assert.equal(smtWalkHref(w("smt-academic"), "post16"), "/teacher/walk/smt-academic?level=post16");
  assert.equal(smtWalkHref(w("smt-pupils"), "whole"), "/teacher/walk/smt-pupils");
});

test("B5 (SMT 15): Our subjects draws a block per phase, each subject opening its three Teacher walks and its dashboard", async () => {
  const { OurSubjects } = await import("@/components/front-door/sections");
  const html = renderToStaticMarkup(createElement(OurSubjects, { urn: "110110", phases: ["ks4", "ks5"] }));
  assert.match(html, /Our subjects/);
  assert.match(html, /data-our-subjects-phase="ks4"/);
  assert.match(html, /data-our-subjects-phase="ks5"/);
  assert.match(html, /Loading the subjects…/);
  // The dashboard honours the subject it is opened on (shown, not saved) and skips Teacher setup for SMT.
  const dash = readFileSync("src/components/dashboard-config/TeacherDashboard.tsx", "utf8");
  assert.match(dash, /search\.get\("from"\) === "smt"\) setOnboarded\(true\)/);
});

test("B6 (Teacher 1): a Teacher tile always starts its walk -- never 'Coming' -- and the home asks for a subject when none is set", async () => {
  const { TeacherPhaseSection } = await import("@/components/front-door/sections");
  const { QuestionTile } = await import("@/components/front-door/home");
  // While the figures load, the tiles already start their walks.
  const html = renderToStaticMarkup(createElement(TeacherPhaseSection, { urn: "137625", phase: "ks4" }));
  assert.equal((html.match(/data-tile-action=""/g) ?? []).length, 3);
  assert.doesNotMatch(html, />Coming</);
  assert.match(html, /Loading your subjects…/);
  // No link, no "Coming" either.
  const tile = renderToStaticMarkup(createElement(QuestionTile, { walk: walkById("gcse-many")!, figure: null, ctx: {}, href: null }));
  assert.doesNotMatch(tile, /Coming/);
  const src = readFileSync("src/components/front-door/sections.tsx", "utf8");
  assert.match(src, /Which subject do you teach\?/);
  assert.match(src, /didn&rsquo;t load\{current\?\.code \? ` \(error \$\{current\.code\}\)` : ""\}/);
});
