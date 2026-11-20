// Speed plan 4.2 item 1: each school's figures (school-figures.ts) and how they are stored (smt-figures-store.ts).
// yearFigures must give exactly what the Academic builder worked out inline before it (the formulas are copied
// below as they were, 20 Nov), on random rows; the store must give back each school's rows in the read's order;
// a part left out of a read must throw, never read as none. The live parity harness is
// scripts/smt-academic-parity.ts.
// Run: npx -y tsx --test src/lib/smt/school-figures.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import type { AcademicSubjectFamilyRow } from "../vicdata-reference";
import type { QualRow, VaFact } from "./academic-data";
import { groupOfQualification, type RealGroup } from "./qual-groups";
import { areaEntries, areaRow, groupEntries, groupPoints, levelEntries, membersFromRaw, vaLine, VA_LINE_QUAL, type VaLine } from "./school-figures";
import { encodeSchool, membersFromStore, type Got } from "./smt-figures-store";

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rnd() * xs.length)];
const QUALS = ["GCE A level", "GCE AS level (All)", "Extended Project Diploma", "Core Maths", "International Baccalaureate", "IBO Higher Level", "BTEC Extended Certificate", "T Level", "Pre-U", "GCSE"];
const SUBJECTS = ["Biology", "Chemistry", "History", "Art and Design", "All subjects", "Mathematics"];
const FAMS = ["sciences_maths", "humanities_social", null];
const URNS = ["100001", "100002", "100003"];
const YEARS = [2021, 2022, 2023, 2024];

function data() {
  const rows: QualRow[] = [];
  const va: VaFact[] = [];
  const fam: AcademicSubjectFamilyRow[] = [];
  for (const urn of URNS) for (const period of YEARS) {
    for (let i = 0; i < 12; i++) rows.push({ urn, qualification: pick(QUALS), subject: pick(SUBJECTS), familyId: pick(FAMS), period, entries: 1 + Math.floor(rnd() * 40), avg: rnd() < 0.2 ? null : rnd() * 60 });
    for (let i = 0; i < 6; i++) va.push({ urn, qualification: pick(QUALS), subject: pick(SUBJECTS), size: pick(["", "Large"]), period, value: rnd() - 0.5, lo: rnd() < 0.3 ? null : -1, hi: 1, entries: Math.floor(rnd() * 50) });
    for (const f of ["sciences_maths", "humanities_social"]) for (const bucket of ["alevel", "all", "all"]) fam.push({ entity_id: urn, ks_stage: "ks4", family_id: f, family_label: f, period, entries_total: Math.floor(rnd() * 90), entries_share_percent: null, avg_point_score: rnd() < 0.2 ? null : rnd() * 9, points_coverage_percent: null, bucket });
  }
  return { rows, va, fam };
}

// The builder's own inline formulas before the move (academic.ts, 20 Nov).
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const old = (rows: QualRow[], va: VaFact[], fam: AcademicSubjectFamilyRow[]) => {
  const rowsOf = (u: string, y: number) => rows.filter((r) => r.urn === u && r.period === y);
  return {
    levelEntries: (u: string, y: number) => sum(rowsOf(u, y).map((r) => r.entries)),
    groupEntries: (u: string, y: number, g: RealGroup) => sum(rowsOf(u, y).filter((r) => groupOfQualification(r.qualification) === g).map((r) => r.entries)),
    computedPoints: (u: string, y: number, g: RealGroup) => {
      const rs = rowsOf(u, y).filter((r) => groupOfQualification(r.qualification) === g && r.avg !== null);
      const e = sum(rs.map((r) => r.entries));
      return e ? sum(rs.map((r) => r.avg! * r.entries)) / e : null;
    },
    vaRow: (u: string, y: number, q: RegExp) => va.filter((r) => r.urn === u && r.period === y).find((r) => q.test(r.qualification) && r.subject === "All subjects") ?? null,
    areaEntries: (u: string, y: number, id: string) => sum(rows.filter((x) => x.urn === u && x.period === y && x.familyId === id).map((x) => x.entries)),
    areaRow: (u: string, y: number, id: string) => fam.filter((x) => x.entity_id === u && Number(x.period) === y).find((x) => x.family_id === id && (x.bucket ?? "all") === "all"),
  };
};
const GROUPS: RealGroup[] = ["alevel", "as", "epq", "coremaths", "ib", "tlevel", "applied"];

test("yearFigures: the builder's own figures, every school, year, group, line and area (Post-16 and GCSE)", () => {
  for (let run = 0; run < 20; run++) {
    const { rows, va, fam } = data();
    const o = old(rows, va, fam);
    const m5 = membersFromRaw("ks5", rows, va, fam);
    const m4 = membersFromRaw("ks4", rows, va, fam);
    for (const u of [...URNS, "999999"]) for (const y of [...YEARS, 2030]) {
      assert.equal(levelEntries(m5, u, y), o.levelEntries(u, y));
      assert.equal(levelEntries(m4, u, y), o.levelEntries(u, y));
      for (const g of GROUPS) {
        assert.equal(groupEntries(m5, u, y, g), o.groupEntries(u, y, g));
        assert.ok(Object.is(groupPoints(m5, u, y, g), o.computedPoints(u, y, g)), `${u} ${y} ${g}`);
      }
      for (const k of Object.keys(VA_LINE_QUAL) as VaLine[]) {
        const a = vaLine(m5, u, y, k);
        const b = o.vaRow(u, y, VA_LINE_QUAL[k]);
        assert.deepEqual(a && { ...a }, b && { urn: b.urn, period: b.period, qualification: b.qualification, subject: b.subject, size: b.size, value: b.value, lo: b.lo, hi: b.hi, entries: b.entries });
      }
      for (const id of ["sciences_maths", "humanities_social", "other"]) {
        assert.equal(areaEntries(m4, u, y, id), o.areaEntries(u, y, id));
        const r = o.areaRow(u, y, id);
        assert.deepEqual(areaRow(m4, u, y, id), r ? { avg_point_score: r.avg_point_score, entries_total: r.entries_total } : undefined);
      }
    }
  }
});

// What smt_school_figures_read answers, from encodeSchool's rows (period >= from; subjects for the school
// itself and the subject year), through a JSON round trip.
function stored(stage: "ks4" | "ks5", rows: QualRow[], va: VaFact[], fam: AcademicSubjectFamilyRow[], viewer: string, sp: number | null, drop: string[] = []) {
  const recs = new Map<string, Map<number, Got>>();
  for (const u of URNS) for (const r of encodeSchool(stage, u, rows, va, fam)) {
    const mine = u === viewer || r.period === sp;
    const f = { ...r.figures } as Record<string, unknown>;
    if (u !== viewer) for (const d of drop) delete f[d];
    const g = JSON.parse(JSON.stringify({ u, p: r.period, f, s: mine ? r.subjects : null, v: mine ? r.va : null })) as Got;
    (recs.get(u) ?? recs.set(u, new Map()).get(u)!).set(r.period, g);
  }
  return recs;
}

test("the store: the same figures, and each school's subject and value-added rows in the read's order", () => {
  for (let run = 0; run < 10; run++) {
    const { rows, va, fam } = data();
    for (const stage of ["ks4", "ks5"] as const) {
      const raw = membersFromRaw(stage, rows, va, fam);
      const st = membersFromStore(stored(stage, rows, va, fam, URNS[0], 2024), URNS[0], 2024, []);
      for (const u of URNS) for (const y of YEARS) {
        assert.deepEqual(st.year(u, y), raw.year(u, y));
        if (u === URNS[0] || y === 2024) {
          assert.deepEqual(st.subjectRows(u, y), raw.subjectRows(u, y));
          if (stage === "ks5") assert.deepEqual(st.vaRows(u, y), raw.vaRows(u, y));
        } else assert.throws(() => st.subjectRows(u, y), /were not read/);
      }
    }
  }
});

test("the store: a part left out of the read throws when read, for set schools only", () => {
  const { rows, va, fam } = data();
  const st = membersFromStore(stored("ks4", rows, va, fam, URNS[0], null, ["a", "f"]), URNS[0], null, ["a", "f"]);
  assert.throws(() => areaEntries(st, URNS[1], 2023, "sciences_maths"), /"a" for 100002 in 2023 was not read/);
  assert.throws(() => areaRow(st, URNS[1], 2023, "sciences_maths"), /"f"/);
  assert.equal(levelEntries(st, URNS[1], 2023), old(rows, va, fam).levelEntries(URNS[1], 2023));
  assert.equal(areaEntries(st, URNS[0], 2023, "sciences_maths"), old(rows, va, fam).areaEntries(URNS[0], 2023, "sciences_maths"));
  assert.throws(() => st.subjectRows(URNS[1], 2024), /were not read/);
});
