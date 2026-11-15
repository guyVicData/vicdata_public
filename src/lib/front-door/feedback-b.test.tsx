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
