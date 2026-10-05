// VicData 0.6.2 S2/S3: four years of school grade rows (src/lib/grade-rows.ts).
//   - the two KS4 paths (the rollup RPC, the modern + historic facts) give identical rows, on
//     real rows for The Chase (137625) and Acland Burghley (100053), 8 subjects
//     (grade-rows.fixtures.json, docs/v0.6/audit_scripts/grade_rollup/s2_fixture.mts.txt)
//   - the modern facts parse exactly as before 0.6.2
//   - R-HISTORIC-GRADE-LABELS: historic KS5 labels by qualification; COVID result / Supp
//     are non-grades; KS4's historic total label is dropped
//   - the RPC's absence is detected once and remembered, and fetchSchoolGradeRows then reads
//     the facts with the same result (fetch mocked: no network)
// Run: npx -y tsx --test src/lib/grade-rows.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  gradeRowKey,
  gradeRowsFromFacts,
  gradeRowsFromRollup,
  historicLabelPolicy,
  mapHistoricKs5Grade,
  parseSubjectGradeDistribution,
  type GradeRollupRow,
  type SubjectGradeCount,
} from "./grade-rows";
import { NON_GRADE_VALUES, bandRate, bestScale, thresholdRate, GCSE_SCALE } from "./subject-grades";
import type { ReferenceFact } from "./vicdata-reference";

type Fixture = { subjects: string[]; rollup: GradeRollupRow[]; modern: ReferenceFact[]; historic: ReferenceFact[] };
const FX = JSON.parse(readFileSync(new URL("./grade-rows.fixtures.json", import.meta.url), "utf8")) as Fixture;

// One school's rows as "qual::subject::period::grade=entries", sizes summed, sorted.
const sig = (rows: SubjectGradeCount[]) => {
  const m = new Map<string, number>();
  for (const r of rows) m.set(gradeRowKey(r), (m.get(gradeRowKey(r)) ?? 0) + r.entries);
  return [...m].map(([k, v]) => `${k}=${v}`).sort();
};

test("KS4: the rollup and the modern + historic facts give identical rows, every key, four years (137625, 100053)", () => {
  const facts = gradeRowsFromFacts("ks4", FX.modern, FX.historic);
  const rollup = gradeRowsFromRollup(FX.rollup);
  for (const urn of ["137625", "100053"]) {
    const a = sig(facts.get(urn) ?? []);
    const b = sig(rollup.get(urn) ?? []);
    assert.ok(a.length > 100, `${urn}: ${a.length} keys`);
    assert.deepEqual(a, b, urn);
    assert.deepEqual([...new Set((facts.get(urn) ?? []).map((r) => r.period))].sort(), [2021, 2022, 2023, 2024], `${urn} years`);
  }
});

test("KS4: one subject, the same either way (comparator-grades' read)", () => {
  const facts = gradeRowsFromFacts("ks4", FX.modern, FX.historic, "History");
  const rollup = gradeRowsFromRollup(FX.rollup.filter((r) => r.subject === "History"));
  for (const urn of ["137625", "100053"]) assert.deepEqual(sig(facts.get(urn) ?? []), sig(rollup.get(urn) ?? []), urn);
  // The Chase GCSE History, grade by grade (S1 §3's table): totals 95, 91, 121 (120 graded), 132.
  const chase = facts.get("137625")!.filter((r) => r.qualificationType === "GCSE (9-1) Full Course");
  const total = (p: number) => chase.filter((r) => r.period === p).reduce((a, r) => a + r.entries, 0);
  assert.deepEqual([2021, 2022, 2023, 2024].map(total), [95, 91, 121, 132]);
  const graded = (p: number) => chase.filter((r) => r.period === p && !NON_GRADE_VALUES.has(r.grade)).reduce((a, r) => a + r.entries, 0);
  assert.equal(graded(2023), 120);
  // And its figures: Grade 4+ and 9-7 per year, identical on both paths.
  const rollupChase = rollup.get("137625")!;
  for (const p of [2021, 2022, 2023, 2024]) {
    const f = chase.filter((r) => r.period === p);
    const r = rollupChase.filter((x) => x.period === p && x.qualificationType === "GCSE (9-1) Full Course");
    assert.deepEqual(thresholdRate(f, "ks4"), thresholdRate(r, "ks4"), `Grade 4+ ${p}`);
    assert.deepEqual(bandRate(f, { scale: GCSE_SCALE, top: "9", bottom: "7" }), bandRate(r, { scale: GCSE_SCALE, top: "9", bottom: "7" }), `9-7 ${p}`);
  }
});

// parseSubjectGradeDistribution as it stood before 0.6.2 (academic-data-view.ts), verbatim.
function legacyParse(facts: ReferenceFact[]): SubjectGradeCount[] {
  const TOTALS = new Set(["Total exam entries", "Total"]);
  const rows: SubjectGradeCount[] = [];
  for (const f of facts) {
    if (f.value_numeric === null) continue;
    const parts = f.breakdown.split("::");
    const grade = parts[parts.length - 1];
    if (TOTALS.has(grade)) continue;
    const [qualificationType, subject] = parts;
    if (subject === "All subjects") continue;
    const rawSize = parts.length >= 4 ? Number.parseFloat(parts[2]) : Number.NaN;
    const sizeWeight = Number.isFinite(rawSize) ? rawSize : null;
    rows.push({ qualificationType, subject, period: f.period, grade, entries: f.value_numeric, sizeWeight });
  }
  return rows;
}

test("modern facts parse exactly as before 0.6.2 (the Data View drawer's rows)", () => {
  assert.deepEqual(parseSubjectGradeDistribution(FX.modern), legacyParse(FX.modern));
  const ks5 = ks5Facts([["GCE A level", "Mathematics", "1", ["*", "A", "B", "Total exam entries", "No result / X"]]], 2023, false);
  assert.deepEqual(parseSubjectGradeDistribution(ks5), legacyParse(ks5));
});

test("historic KS4: 'Total number entered' is not a grade, and 2020/21 (totals only) is left out", () => {
  const raw = legacyParse(FX.historic);
  assert.ok(raw.some((r) => r.grade === "Total number entered"), "the raw read would make it a grade");
  const rows = parseSubjectGradeDistribution(FX.historic, "ks4");
  assert.equal(rows.filter((r) => r.grade === "Total number entered").length, 0);
  assert.ok(rows.every((r) => r.period === 2021 || r.period === 2022));
});

// ------------------------------------------------------------- R-HISTORIC-GRADE-LABELS

let n = 0;
function ks5Facts(sets: [string, string, string, string[]][], period = 2021, withValues = true): ReferenceFact[] {
  const out: ReferenceFact[] = [];
  for (const [qual, subject, size, grades] of sets)
    for (const g of grades)
      out.push({ entity_id: "X", period, period_basis: "academic_year", breakdown: `${qual}::${subject}::${size}::${g}`, value_numeric: withValues ? ++n % 7 : 0, value_text: null, value_category: null });
  return out;
}
const gradesOf = (rows: SubjectGradeCount[], subject: string, qual?: string) => rows.filter((r) => r.subject === subject && (!qual || r.qualificationType === qual)).map((r) => r.grade);

test("R-HISTORIC-GRADE-LABELS: vocational short codes take their 2023/24 words, by qualification", () => {
  const BTEC = "BTEC National Extended Certificate L3 - Band F - P-D*";
  const rows = parseSubjectGradeDistribution(
    ks5Facts([
      [BTEC, "Business Studies", "1", ["*", "D", "M", "P", "Fail", "COVID result", "Supp", "Total"]],
      ["BTEC National Extended Diploma L3 - Band N - PPP-D*D*D*", "Sport", "3", ["***", "**D", "*DD", "DDD", "DDM", "DMM", "MMM", "MMP", "MPP", "PPP"]],
      ["OCR Cambridge Technical Diploma at Level 3", "IT", "2", ["**", "*D", "DD", "DM", "MM", "MP", "PP"]],
      ["Advanced Extension Award", "Mathematics", "0.5", ["D", "M", "Fail"]],
      ["GCE A level", "Mathematics", "1", ["*", "A", "B", "C", "D", "E", "COVID result", "Supp", "Total"]],
      ["GCE AS level", "Mathematics", "0.5", ["A", "B", "C", "D", "E"]],
      ["Extended Project (Diploma)", "Extended Project", "0.5", ["*", "A", "D", "E"]],
      ["Pre-U Principal Subject", "History", "1", ["D1", "D2", "M1", "P1"]],
      ["VRQ Level 3", "Applied Science", "0.5", ["*", "A", "B", "C", "D", "E"]],
      ["VRQ Level 3", "Health", "1", ["*", "D", "M", "P"]],
      ["VRQ Level 3", "Media", "2", ["**", "*D", "DD", "DM"]],
      ["VRQ Level 3", "Music", "0.5", ["D", "HM", "M", "HP", "P"]],
    ]),
    "ks5",
  );
  assert.deepEqual(gradesOf(rows, "Business Studies"), ["Distinction*", "Distinction", "Merit", "Pass", "Fail", "COVID result", "Supp"]);
  assert.deepEqual(gradesOf(rows, "Sport"), ["Distinction*-Distinction*-Distinction*", "Distinction*-Distinction*-Distinction", "Distinction*-Distinction-Distinction", "Distinction-Distinction-Distinction", "Distinction-Distinction-Merit", "Distinction-Merit-Merit", "Merit-Merit-Merit", "Merit-Merit-Pass", "Merit-Pass-Pass", "Pass-Pass-Pass"]);
  assert.deepEqual(gradesOf(rows, "IT"), ["Distinction*-Distinction*", "Distinction*-Distinction", "Distinction-Distinction", "Distinction-Merit", "Merit-Merit", "Merit-Pass", "Pass-Pass"]);
  assert.deepEqual(gradesOf(rows, "Mathematics", "Advanced Extension Award"), ["Distinction", "Merit", "Fail"]);
  // Never on the A-level family, EPQ or Pre-U: "*" is A* and "D" is D there.
  assert.deepEqual(gradesOf(rows, "Mathematics", "GCE A level"), ["*", "A", "B", "C", "D", "E", "COVID result", "Supp"]);
  assert.deepEqual(gradesOf(rows, "Mathematics", "GCE AS level"), ["A", "B", "C", "D", "E"]);
  assert.deepEqual(gradesOf(rows, "Extended Project"), ["*", "A", "D", "E"]);
  assert.deepEqual(gradesOf(rows, "History"), ["D1", "D2", "M1", "P1"]);
  // VRQ: per set. A*-E sets keep their letters; Distinction-Pass sets are mapped.
  assert.deepEqual(gradesOf(rows, "Applied Science"), ["*", "A", "B", "C", "D", "E"]);
  assert.deepEqual(gradesOf(rows, "Health"), ["Distinction*", "Distinction", "Merit", "Pass"]);
  assert.deepEqual(gradesOf(rows, "Media"), ["Distinction*-Distinction*", "Distinction*-Distinction", "Distinction-Distinction", "Distinction-Merit"]);
  assert.deepEqual(gradesOf(rows, "Music"), ["Distinction", "High merit", "Merit", "High pass", "Pass"]);
  // The mapped BTEC lands on the vocational scale, not the A-level one.
  assert.equal(bestScale(gradesOf(rows, "Business Studies"))[0], "Distinction*");
  assert.ok(bestScale(gradesOf(rows, "Mathematics", "GCE A level")).includes("A*"));
  // Modern facts are never mapped.
  const modern = parseSubjectGradeDistribution(ks5Facts([[BTEC, "Business Studies", "1", ["D", "M"]]], 2023));
  assert.deepEqual(gradesOf(modern, "Business Studies"), ["D", "M"]);
  assert.equal(historicLabelPolicy("GCE A level"), "never");
  assert.equal(mapHistoricKs5Grade("VRQ Level 3", "*", new Set(["*", "A"])), "*");
});

test("R-HISTORIC-GRADE-LABELS / R-NON-GRADES-EXCL: COVID result and Supp are non-grades, so a 2021/22 A level keeps its A*-E figure", () => {
  assert.ok(NON_GRADE_VALUES.has("COVID result") && NON_GRADE_VALUES.has("Supp"));
  const rows: SubjectGradeCount[] = [
    { qualificationType: "GCE A level", subject: "Maths", period: 2021, grade: "*", entries: 10, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Maths", period: 2021, grade: "A", entries: 20, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Maths", period: 2021, grade: "U", entries: 10, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Maths", period: 2021, grade: "COVID result", entries: 44, sizeWeight: 1 },
    { qualificationType: "GCE A level", subject: "Maths", period: 2021, grade: "Supp", entries: 3, sizeWeight: 1 },
  ];
  assert.deepEqual(thresholdRate(rows, "ks5"), { rate: 75, entries: 40 });
});

// ------------------------------------------------------------- the RPC's absence

function mockFetch(handler: (rpc: string, body: Record<string, unknown>) => { status: number; json: unknown }) {
  const calls: string[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL, init?: RequestInit) => {
    const rpc = String(url).split("/rpc/")[1];
    calls.push(rpc);
    const { status, json } = handler(rpc, JSON.parse(String(init?.body ?? "{}")));
    return new Response(JSON.stringify(json), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return { calls, restore: () => (globalThis.fetch = original) };
}

const factsFor = (body: Record<string, unknown>) => {
  const src = body.p_source_id === "dfe_ks4_subject_entries" ? FX.modern : body.p_source_id === "dfe_ks4_subject_entries_historic" ? FX.historic : [];
  const ids = body.p_entity_ids as string[];
  const off = Number(body.p_offset ?? 0);
  return src.filter((f) => ids.includes(f.entity_id)).slice(off, off + Number(body.p_limit ?? 1000));
};

test("the rollup RPC's absence (PGRST202) is detected once, and comparator-grades' read then gives the rollup's rows from the facts", async () => {
  process.env.VICDATA_API_URL ??= "http://localhost:0";
  process.env.VICDATA_ANON_KEY ??= "test";
  const ref = await import("./vicdata-reference");
  const adv = await import("./academic-data-view");
  ref.resetGradeRollupRpcState();

  // Applied: the rollup's rows, one subject.
  let m = mockFetch((rpc, body) =>
    rpc === "academic_subject_grade_rollup_lookup"
      ? { status: 200, json: FX.rollup.filter((r) => (body.p_entity_ids as string[]).includes(r.entity_id) && r.subject === body.p_subject).slice(Number(body.p_offset), Number(body.p_offset) + 1000) }
      : { status: 500, json: { message: "facts must not be read when the RPC is there" } },
  );
  const viaRollup = await adv.fetchSchoolGradeRows(["137625", "100053", "999999"], "ks4", "History");
  m.restore();
  assert.equal(viaRollup.source, "rollup");
  assert.deepEqual(m.calls, ["academic_subject_grade_rollup_lookup"]);
  assert.deepEqual(viaRollup.byUrn.get("999999"), []);

  // Not applied: one 404, remembered; the facts give the same rows.
  ref.resetGradeRollupRpcState();
  m = mockFetch((rpc, body) =>
    rpc === "academic_subject_grade_rollup_lookup"
      ? { status: 404, json: { code: "PGRST202", message: "Could not find the function public.academic_subject_grade_rollup_lookup" } }
      : { status: 200, json: factsFor(body) },
  );
  const viaFacts = await adv.fetchSchoolGradeRows(["137625", "100053", "999999"], "ks4", "History");
  const again = await adv.fetchSchoolGradeRows(["137625"], "ks4", "History");
  m.restore();
  assert.equal(viaFacts.source, "facts");
  assert.equal(ref.gradeRollupRpcState(), "absent");
  assert.equal(m.calls.filter((c) => c === "academic_subject_grade_rollup_lookup").length, 1, "asked once per process, never again");
  for (const urn of ["137625", "100053"]) assert.deepEqual(sig(viaFacts.byUrn.get(urn)!), sig(viaRollup.byUrn.get(urn)!), urn);
  assert.deepEqual(sig(again.byUrn.get("137625")!), sig(viaRollup.byUrn.get("137625")!));
  assert.deepEqual(viaFacts.byUrn.get("999999"), []);

  // Any other failure is an error, not "absent".
  ref.resetGradeRollupRpcState();
  m = mockFetch(() => ({ status: 500, json: { message: "boom" } }));
  await assert.rejects(() => ref.lookupAcademicSubjectGradeRollup({ entityIds: ["137625"], ksStage: "ks4" }));
  m.restore();
  assert.equal(ref.gradeRollupRpcState(), "unknown");
});
