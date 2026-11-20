// Run: npx tsx --env-file=.env --env-file=.env.local --test --test-force-exit src/lib/front-door/walk-words.test.tsx
// VicData 0.8 review fixes (14 Nov, M3): R-WALK-WORDS on real output. Every Teacher, SMT and Admissions walk
// run on the fixtures (docs/v0.8/review_14nov/fixtures: Leighton Park, The Chase, their small subjects) --
// head office's in group-walks.test.tsx on the group fixtures. Every question ends in "?", no answer is
// empty or has doubled spaces or punctuation, and the general rules hold. No database.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { WALKS, fillTemplate, type Walk } from "./walks";
import { teacherScreen } from "./teacher-screens";
import type { TeacherModel } from "./teacher-model";
import { lastOf } from "./teacher-model";
import { admissionsAnswer } from "./admissions-answers";
import { smtAnswer } from "./smt-answers";
import { gradingCaveat, listJoin, ordinal, placeOf, plural, possessive, sentenceProblems } from "./words";
import { entryPoint } from "@/lib/admissions/entry-points";

const FX = "docs/v0.8/review_14nov/fixtures";
const fx = <T,>(name: string): T => JSON.parse(readFileSync(`${FX}/${name}.json`, "utf8")) as T;
const TEACHER = ["teacher_137625_ks4_geography", "teacher_137625_ks4_small", "teacher_110110_ks5", "teacher_110110_ks5_physics", "teacher_110110_ks5_small"];

type Said = { where: string; question: string; answer: string; phase: string; walk: Walk };
function everything(): Said[] {
  const out: Said[] = [];
  for (const name of TEACHER) {
    const m = fx<TeacherModel>(name);
    for (const w of WALKS.filter((x) => x.product === (m.phase === "ks4" ? "gcse" : "post16")))
      w.screens.forEach((_, i) => {
        const sc = teacherScreen(m, w, i);
        out.push({ where: `${name} ${w.id} ${i + 1}`, question: sc.question, answer: sc.answer, phase: m.phase, walk: w });
      });
  }
  for (const urn of ["110110", "137625"]) {
    const d = fx<Record<string, unknown> & { school: { name: string } }>(`smt_${urn}`);
    for (const w of WALKS.filter((x) => x.product === "smt" || x.product === "smt_primary"))
      for (const s of w.screens) {
        // A screen borrowed from Admissions (SMT Pupils' Share needed) answers from the Admissions fixture at 11+.
        if (s.from === "admissions") {
          const label = entryPoint("11+")!.label;
          out.push({ where: `smt ${urn} ${w.id} ${s.view}`, question: fillTemplate(s.question, { entry: label }), answer: admissionsAnswer(s.view, { ...fx<Parameters<typeof admissionsAnswer>[1]>(`adm_${urn}_11`), label }), phase: "smt", walk: w });
          continue;
        }
        out.push({ where: `smt ${urn} ${w.id} ${s.view}`, question: s.question, answer: smtAnswer(s.view, d.school, d[w.id.split("-")[1]]), phase: "smt", walk: w });
      }
  }
  for (const [name, entry] of [["adm_110110_11", "11+"], ["adm_110110_16", "16+"], ["adm_137625_11", "11+"]] as const) {
    const d = fx<Parameters<typeof admissionsAnswer>[1]>(name);
    const label = entryPoint(entry)!.label;
    for (const w of WALKS.filter((x) => x.product === "admissions"))
      for (const s of w.screens) out.push({ where: `${name} ${s.view}`, question: fillTemplate(s.question, { entry: label }), answer: admissionsAnswer(s.view, { ...d, label }), phase: "adm", walk: w });
  }
  return out;
}

test("R-WALK-WORDS: every question ends in '?', no answer is empty or has doubled spaces or punctuation (every walk, the fixtures)", () => {
  const all = everything();
  assert.ok(all.length > 180, `${all.length} screens`);
  const bad: string[] = [];
  for (const s of all) {
    for (const p of sentenceProblems(s.question, "question")) bad.push(`${s.where} Q: ${p}: "${s.question}"`);
    for (const p of sentenceProblems(s.answer, "answer")) bad.push(`${s.where} A: ${p}: "${s.answer}"`);
  }
  // The walks' own questions (the tiles and headers) too.
  for (const w of WALKS) for (const q of [w.question, ...w.screens.map((x) => x.question)]) for (const p of sentenceProblems(fillTemplate(q, { subject: "Physics", category: "Sciences", entry: "11+" }), "question")) bad.push(`${w.id}: ${p}: "${q}"`);
  assert.deepEqual(bad, []);
});

test("R-WALK-WORDS: every place reads 'Nth of N'", () => {
  const bad = everything().filter((s) => {
    const places = s.answer.match(/\b\d+(st|nd|rd|th)\b(?! (largest|smallest|highest|lowest))/g) ?? [];
    return places.length && !(s.answer.match(/\b\d+(st|nd|rd|th) of [\d,]+/g)?.length === places.length);
  });
  assert.deepEqual(bad.map((s) => `${s.where}: "${s.answer}"`), []);
  assert.equal(placeOf(2, 11, "schools by share"), "2nd of 11 schools by share");
  assert.equal(ordinal(11), "11th");
  assert.equal(ordinal(22), "22nd");
});

test("R-WALK-WORDS: plurals and zero; possessives on names ending in s; lists end in 'and'", () => {
  assert.equal(plural(1, "school"), "1 school");
  assert.equal(plural(0, "school"), "no schools");
  assert.equal(plural(3, "feeder school"), "3 feeder schools");
  assert.equal(possessive("Physics"), "Physics'");
  assert.equal(possessive("Ark Schools"), "Ark Schools'");
  assert.equal(possessive("Geography"), "Geography's");
  assert.equal(listJoin(["2019/20", "2020/21", "2021/22"]), "2019/20, 2020/21 and 2021/22");
  const all = everything();
  assert.deepEqual(all.filter((s) => /s's\b/.test(s.answer)).map((s) => s.where), [], "no s's");
  assert.deepEqual(all.filter((s) => /\b(the )?1 nearest schools|\b1 (schools|subjects|headlines|entries|feeder schools)\b|\b0 (of|held|schools)\b/.test(s.answer)).map((s) => `${s.where}: ${s.answer}`), []);
});

test("R-WALK-WORDS: Post-16 screens say 'students', never 'pupils'", () => {
  const bad = everything().filter((s) => s.phase === "ks5" && /\bpupils?\b/.test(s.answer));
  assert.deepEqual(bad.map((s) => `${s.where}: ${s.answer}`), []);
});

test("R-WALK-WORDS: a figure resting on fewer than 10 says 'only N'; averages are 'highest', never 'the most'", () => {
  for (const name of TEACHER) {
    const m = fx<TeacherModel>(name);
    const f = m.whole.rows.find((r) => r.focus) ?? m.category.rows.find((r) => r.focus);
    const n = f ? lastOf(f.entries) : null;
    const w = WALKS.find((x) => x.id === `${m.phase === "ks4" ? "gcse" : "post16"}-well`)!;
    const tiles = teacherScreen(m, w, 0).answer;
    if (n !== null && n < 10 && f && lastOf(f.points) !== null) assert.match(tiles, new RegExp(`\\(only ${n} (pupil|student)s?\\)`), `${name}: ${tiles}`);
    if (n !== null && n >= 10) assert.doesNotMatch(tiles, /\(only /, name);
  }
  assert.deepEqual(everything().filter((s) => /the most\b/.test(s.answer) && /\baverage\b|points per entry/.test(s.answer)).map((s) => s.where), []);
});

test("R-WALK-WORDS: 'has grown since'; the grading caveat where a results trend measures from 2020/21 or 2021/22", () => {
  const m = fx<TeacherModel>("teacher_137625_ks4_geography");
  const many = WALKS.find((x) => x.id === "gcse-many")!;
  const dumb = teacherScreen(m, many, many.screens.findIndex((s) => s.answer === "entries-dumbbell")).answer;
  assert.match(dumb, /has (grown|fallen|been level)/);
  const well = WALKS.find((x) => x.id === "gcse-well")!;
  const tr = teacherScreen(m, well, well.screens.findIndex((s) => s.answer === "points-trend")).answer;
  assert.match(tr, /since 2021\/22/);
  assert.match(tr, /awarded more generously/);
  assert.equal(gradingCaveat(2022), "");
  assert.match(gradingCaveat(2021), /^ 2021\/22's grades were awarded more generously/);
  // SMT's results trends from 2021/22 carry it too.
  for (const s of everything().filter((x) => /from [\d.]+ in 2021\/22/.test(x.answer) && /Attainment|points/.test(x.answer))) assert.match(s.answer, /generously/, s.where);
});

test("R-WALK-WORDS: every screen answers its own question with a figure, or says plainly there isn't one", () => {
  const bad = everything().filter((s) => !/\d/.test(s.answer) && !/^(No|Not|There|The school has no|None)\b/.test(s.answer) && !/\bno\b|\bnone\b|isn't|aren't|hasn't|doesn't/.test(s.answer));
  assert.deepEqual(bad.map((s) => `${s.where}: "${s.answer}"`), []);
  // The fixed captions the review found, gone.
  const answers = everything().map((s) => s.answer);
  for (const caption of ["Last year to this, every line of the school's results.", "The grade profile in bands, latest year.", "The pool against the LA and England, indexed to 100.", "Your rivals, where they are.", "How your results compare with your rivals'."])
    assert.ok(!answers.includes(caption), caption);
});
