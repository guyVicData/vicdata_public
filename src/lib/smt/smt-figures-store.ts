// VicData speed plan §4.2 item 1: SMT Academic's set schools read from figures built ahead, not from raw rows.
// Server-only.
//
// smt_school_figures (migration 20261125090000) holds, for every school and year at a key stage, that
// school's figures (school-figures.ts yearFigures) and that year's subject and value-added rows, all from
// the same reads Academic makes today (qualRows, subjectVa, the GCSE area rollup), built by
// scripts/build-smt-figures.ts after new data arrives. A page asks for its set's schools' figures in one
// call and Academic draws from them exactly as from today's reads (academic.ts reads every set school
// through Members).
//
// The switch: SMT_FIGURES=on. Off (the default), or whenever the figures can't answer -- no complete build
// for the data as it is now, a set school the build didn't cover, a year before the build's first, any
// failure -- Academic makes today's reads instead. Never a mix: every row read carries the one data
// version, and the version is what the data is now:
//   - the stamps of the sources the figures come from (production's reference_source_stamps: a promote or
//     retraction moves them), and the last school sync (lineage);
//   - the subject maps the reads apply (latest subject names, qualification aliases) and the ingest's
//     subject family map and label crosswalk (a migration that changes them changes the rollups);
//   - FORMAT, bumped by hand whenever what is stored, or how it is worked out, changes.
import { createHash } from "node:crypto";
import { cachedReference } from "../server-cache";
import { createServiceRoleSupabaseClient } from "../supabase";
import { schoolSyncStamp } from "../school-sync-stamp";
import { callReferenceRpc, lookupAcademicSubjectFamily, lookupAcademicSubjectFamilyMap, referenceSourceStamp, type AcademicSubjectFamilyRow } from "../vicdata-reference";
import { CONSTRUCTION_VRQ, SUBJECT_LATEST_NAMES } from "../subject-latest-names";
import { QUAL_ALIASES } from "../subject-match";
import { HISTORIC_GRADE_FROM } from "@/catalogue/years";
import { qualRows, subjectVa, type QualRow, type VaFact } from "./academic-data";
import { membersFromRaw, NO_FIGURES, yearFigures, type Members, type YearFigures } from "./school-figures";

export type Stage = "ks4" | "ks5";

/** Bump whenever what is stored, or how any stored figure is worked out (school-figures.ts, qualRows,
 * subjectVa's parse, qual-groups.ts groupOfQualification), changes: the old build then stops answering. */
export const FORMAT = "smt-figures-1";
/** The first year built. Academic asks from 2020/21 (HISTORIC_GRADE_FROM) unless a school's latest
 * Post-16 year is older; those fall back to today's reads. */
export const BUILD_FROM = HISTORIC_GRADE_FROM;

export const SOURCES: Record<Stage, string[]> = {
  ks4: ["dfe_ks4_subject_entries", "dfe_ks4_subject_entries_historic", "gias", "gias_links"],
  ks5: ["dfe_ks5_subject_results", "dfe_ks5_subject_results_historic", "dfe_ks5_subject_value_added", "gias", "gias_links"],
};

export const figuresOn = () => process.env.SMT_FIGURES === "on";

// ------------------------------------------------------------------------------------------ the version

const hashOf = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex");
const familyMap = (stage: Stage) => cachedReference(`smt:family-map:${stage}`, () => lookupAcademicSubjectFamilyMap({ ksStage: stage }));
const labelMap = () => cachedReference("smt:label-map:all", async () => (await callReferenceRpc("academic_subject_label_map_lookup", {})) as unknown[]);
const mapHashes = new WeakMap<object, string>();
const hashOnce = (x: object) => mapHashes.get(x) ?? (mapHashes.set(x, hashOf(x)), mapHashes.get(x)!);

/** The data version figures for this key stage must carry to be read now. */
export async function figuresVersion(stage: Stage): Promise<string> {
  const [stamps, sync, fam, labels] = await Promise.all([Promise.all(SOURCES[stage].map(async (s) => [s, await referenceSourceStamp(s)])), schoolSyncStamp(), familyMap(stage), labelMap()]);
  return `${stage}-${hashOf({ FORMAT, BUILD_FROM, stage, stamps, sync, names: [SUBJECT_LATEST_NAMES, CONSTRUCTION_VRQ, QUAL_ALIASES], fam: hashOnce(fam), labels: hashOnce(labels) }).slice(0, 24)}`;
}

// ------------------------------------------------------------------------------------------ the rows

// One stored subject row: [qualification, subject, familyId, entries, avg, i]; one value-added row:
// [qualification, subject, size, value, lo, hi, entries, i]. `i` is the row's place in the school's own
// read, so the school's whole list comes back in the read's order.
type SubjectCell = [string, string, string | null, number, number | null, number];
type VaCell = [string, string, string, number | null, number | null, number | null, number | null, number];
/** One row of smt_school_figures as the build writes it (period 0: the school was built, whatever it has). */
export type FiguresRow = { urn: string; period: number; figures: YearFigures; subjects: SubjectCell[] | null; va: VaCell[] | null };

/** A school's rows to store, from its own reads (rows from BUILD_FROM, value added, area rows). */
export function encodeSchool(stage: Stage, urn: string, rows: readonly QualRow[], va: readonly VaFact[], fam: readonly AcademicSubjectFamilyRow[]): FiguresRow[] {
  const mine = rows.filter((r) => r.urn === urn);
  const myVa = va.filter((r) => r.urn === urn);
  const myFam = fam.filter((r) => r.entity_id === urn);
  const periods = Array.from(new Set([...mine.map((r) => r.period), ...myVa.map((r) => r.period), ...myFam.map((r) => Number(r.period))])).sort((a, b) => a - b);
  const out: FiguresRow[] = [{ urn, period: 0, figures: NO_FIGURES, subjects: null, va: null }];
  for (const p of periods) {
    const rs = mine.filter((r) => r.period === p);
    const vs = myVa.filter((r) => r.period === p);
    out.push({
      urn,
      period: p,
      figures: yearFigures(stage, rs, vs, myFam.filter((r) => Number(r.period) === p)),
      subjects: rs.map((r) => [r.qualification, r.subject, r.familyId, r.entries, r.avg, mine.indexOf(r)]),
      va: stage === "ks5" ? vs.map((r) => [r.qualification, r.subject, r.size, r.value, r.lo, r.hi, r.entries, myVa.indexOf(r)]) : null,
    });
  }
  return out;
}

const rowOf = (urn: string, period: number, c: SubjectCell): QualRow => ({ urn, qualification: c[0], subject: c[1], familyId: c[2], period, entries: c[3], avg: c[4] });
const vaOf = (urn: string, period: number, c: VaCell): VaFact => ({ urn, qualification: c[0], subject: c[1], size: c[2], period, value: c[3], lo: c[4], hi: c[5], entries: c[6] });

// ------------------------------------------------------------------------------------------ the read

export type Got = { u: string; p: number; f: YearFigures; s: SubjectCell[] | null; v: VaCell[] | null };
export type FiguresRpc = (fn: string, args: Record<string, unknown>) => Promise<unknown>;
let rpc: FiguresRpc = async (fn, args) => {
  const { data, error } = await createServiceRoleSupabaseClient().rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};
/** Scripts and tests: read the figures from somewhere else (a local PGlite holding the same migration). */
export const setFiguresRpc = (f: FiguresRpc) => {
  rpc = f;
};

const key = (urns: string[]) => Array.from(new Set(urns)).sort().join(",");

// null: no complete build carries this version.
async function read(stage: Stage, version: string, urns: string[], periodMin: number, subjectPeriod: number | null, full: string | null, drop: FigureKey[]): Promise<Map<string, Map<number, Got>> | null> {
  return cachedReference(`smt:figures:${version}:${periodMin}:${subjectPeriod}:${full}:${drop.join("")}:${key(urns)}`, async () => {
    const got = (await rpc("smt_school_figures_read", { p_stage: stage, p_version: version, p_urns: Array.from(new Set(urns)), p_period_min: periodMin, p_subject_period: subjectPeriod, p_full_urn: full, p_drop: drop.length ? drop : null })) as Got[] | null;
    if (!got) return null;
    const out = new Map<string, Map<number, Got>>();
    for (const g of got) (out.get(g.u) ?? out.set(g.u, new Map()).get(g.u)!).set(g.p, g);
    return out;
  });
}

type FigureKey = Exclude<keyof YearFigures, "e">;

/** Exported for tests. */
export function membersFromStore(recs: Map<string, Map<number, Got>>, viewer: string, subjectPeriod: number | null, drop: FigureKey[]): Members {
  // A part left out of the read throws when read, so a view can never draw a missing part as "none".
  const guarded = new Map<string, YearFigures>();
  const guard = (u: string, y: number, f: YearFigures): YearFigures => {
    if (!drop.length || u === viewer) return f;
    const k = `${u}|${y}`;
    let g = guarded.get(k);
    if (!g) {
      g = { ...f };
      for (const d of drop) Object.defineProperty(g, d, { get: () => { throw new Error(`smt figures: "${d}" for ${u} in ${y} was not read`); } });
      guarded.set(k, g);
    }
    return g;
  };
  const rowsMemo = new Map<string, QualRow[]>();
  const vaMemo = new Map<string, VaFact[]>();
  const loaded = (u: string, y: number, what: string) => {
    if (u !== viewer && y !== subjectPeriod) throw new Error(`smt figures: ${what} for ${u} in ${y} were not read (only ${subjectPeriod})`);
  };
  return {
    year: (u, y) => guard(u, y, recs.get(u)?.get(y)?.f ?? NO_FIGURES),
    subjectRows(u, y) {
      loaded(u, y, "subject rows");
      const k = `${u}|${y}`;
      let r = rowsMemo.get(k);
      if (!r) rowsMemo.set(k, (r = (recs.get(u)?.get(y)?.s ?? []).map((c) => rowOf(u, y, c))));
      return r;
    },
    vaRows(u, y) {
      loaded(u, y, "value-added rows");
      const k = `${u}|${y}`;
      let r = vaMemo.get(k);
      if (!r) vaMemo.set(k, (r = (recs.get(u)?.get(y)?.v ?? []).map((c) => vaOf(u, y, c))));
      return r;
    },
  };
}

/** GCSE's area rollup rows for these schools, a few hundred schools a call: the rollup pages at 1,000 rows and
 * stops at 50 pages, so one call for a national set (3,497 state schools, ~250,000 rows) silently lost every
 * school after the first ~1,500 (found by the parity run, 20 Nov). Each school's rows as one call gives them. */
export async function areaRowsFor(urns: string[], from: number): Promise<AcademicSubjectFamilyRow[]> {
  const CHUNK = 200;
  const parts: string[][] = [];
  for (let i = 0; i < urns.length; i += CHUNK) parts.push(urns.slice(i, i + CHUNK));
  const out: AcademicSubjectFamilyRow[][] = new Array(parts.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(4, parts.length) }, async () => {
    while (next < parts.length) {
      const i = next++;
      out[i] = await lookupAcademicSubjectFamily({ entityIds: parts[i], ksStage: "ks4", periodMin: from });
    }
  }));
  return out.flat();
}

/** What Academic reads for a school and its set: the school's own rows and value added (its whole lists,
 * in the reads' order), and every school's figures as Members. */
export type AcademicInputs = { rows: QualRow[]; va: VaFact[]; members: Members; source: "store" | "live" };
/** How many Academic builds read each way since the process started (scripts and the parity harness). */
export const figuresReads = { store: 0, live: 0 };

/** `subjectPeriod`: the year Academic compares subjects in, from the school's own rows (the set schools'
 * subject rows are read for that year only; null: none). `fam` (GCSE): today's reads include the area
 * rollup (a subject-area state); the figures always carry it. `drop`: parts of the set schools' figures the
 * view doesn't read, left out of the read (reading one throws). */
export async function academicInputs(stage: Stage, viewer: string, everyone: string[], from: number, opts: { fam?: boolean; subjectPeriod: (own: QualRow[]) => number | null; drop?: FigureKey[] }): Promise<AcademicInputs> {
  const live = async (): Promise<AcademicInputs> => {
    const [rows, va, fam] = await Promise.all([
      qualRows(everyone, stage, from),
      stage === "ks5" ? subjectVa(everyone) : Promise.resolve([] as VaFact[]),
      stage === "ks4" && opts.fam ? cachedReference(`smt:family:ks4:${everyone.slice().sort().join(",")}`, () => areaRowsFor(everyone, from)) : Promise.resolve([] as AcademicSubjectFamilyRow[]),
    ]);
    figuresReads.live++;
    return { rows, va, members: membersFromRaw(stage, rows, va, fam), source: "live" };
  };
  if (!figuresOn() || from < BUILD_FROM) return live();
  try {
    const version = await figuresVersion(stage);
    const drop = opts.drop ?? [];
    const own = await read(stage, version, [viewer], from, null, viewer, []);
    const mine = own?.get(viewer);
    if (!own || !mine) return live();
    const byPlace = <T,>(cells: [number, T][]) => cells.sort((a, b) => a[0] - b[0]).map((x) => x[1]);
    const rows = byPlace(Array.from(mine.values()).filter((g) => g.p >= from).flatMap((g) => (g.s ?? []).map((c) => [c[5], rowOf(viewer, g.p, c)] as [number, QualRow])));
    const va = byPlace(Array.from(mine.values()).flatMap((g) => (g.v ?? []).map((c) => [c[7], vaOf(viewer, g.p, c)] as [number, VaFact])));
    const sp = opts.subjectPeriod(rows);
    const others = Array.from(new Set(everyone)).filter((u) => u !== viewer);
    const recs = others.length ? await read(stage, version, others, from, sp, null, drop) : new Map<string, Map<number, Got>>();
    if (!recs) return live();
    const missing = others.filter((u) => !recs.has(u));
    if (missing.length) {
      console.info(`[smt figures] ${stage}: ${missing.length} set school(s) not built (${missing.slice(0, 3).join(", ")}…): today's reads`);
      return live();
    }
    const all = new Map(recs);
    all.set(viewer, mine);
    figuresReads.store++;
    return { rows, va, members: membersFromStore(all, viewer, sp, drop), source: "store" };
  } catch (e) {
    console.warn(`[smt figures] ${stage}: today's reads instead:`, e instanceof Error ? e.message : e);
    return live();
  }
}
