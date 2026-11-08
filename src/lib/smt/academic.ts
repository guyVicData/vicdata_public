// VicData 0.8 SMT Academic by qualification: Results · Entries · Value added (docs/v0.8/
// smt_value_added_plan_v1.md; prompt docs/v0.8/smt_academic_claude_code_prompt_v1.md; F-44, F-45).
// Server-only. One answer per state: the level (GCSE, Post-16), the mode, the Post-16 qualification
// group (and DfE's applied type) or the GCSE subject area, and the comparison set.
//
//   column 1      one line per qualification group at Post-16 (points with DfE's grade, entries and share,
//                 or value added with its range and band); at GCSE, GCSE lines only (R-SMT-COL1-LEVEL)
//   board         the chosen group's measure for the set's schools that offer it: the chart, the ranking
//                 table and the map read it
//   areas         subject areas, each area's subjects by qualification, each subject ranked only against
//                 the same subject in the same qualification
//   grades        the grade profile (Results mode)
//   trends        the group's measure over time against the set's middle half; every line's change;
//                 the entries mix by group; the biggest moves; where the mix differs from the set's
//
// Figures through existing reads (academic-data.ts lists them). Years from years.ts and the data only
// (R-SMT-YEARS): the latest per key stage from academic_current_periods, so 2025/26's sixth-form release
// extends every trend with no code change.
import { SUBJECT_AREA_MIN } from "@/catalogue/notes";
import { smtNote } from "@/catalogue/notes";
import { GRADING_2122_PERIOD, HISTORIC_GRADE_FROM, PROGRESS8_LAST_PERIOD, SIXTH_FORM_VA_FROM, TREND_BASE_PERIOD, periodLabel } from "@/catalogue/years";
import { cachedReference } from "../server-cache";
import { fetchSubjectLevelDataForSchools } from "../academic-data-view";
import { lookupAcademicSubjectFamily, lookupAcademicSubjectFamilyMap } from "../vicdata-reference";
import { englandSchools } from "../admissions/ranks";
import { percentile } from "../admissions/stats";
import { latestSubjectName } from "../subject-latest-names";
import { MIN_SUBJECT_ENTRIES_UI } from "./levels";
import { figure, num, population, SMT_MEASURES, type Population } from "./population";
import type { SmtSchool } from "./school";
import { igcseExcluded, setNames, type BandPt, type Pt, type Rank, type SmtSet } from "./overview";
import { englandQualVa, qualRows, subjectVa, vaMatch, type QualRow, type VaFact } from "./academic-data";
import { gcseDefaultSet, groupDefaultSet, offering, stateP8Set, type GroupSet } from "./academic-sets";
import { APPLIED_KEY, APPLIED_LABEL, GROUP_LABEL, GROUP_ORDER, dfeBandOf, groupChips, groupOfQualification, p8Band, rangeBand, shortQualification, type AcademicMode, type AcademicOffer, type AcademicPhase, type AcademicState, type AppliedType, type DfeBand, type QualGroup, type RangeBand, type RealGroup } from "./qual-groups";
import { VA_SUBJECT_MATCHES_STATUS } from "./va-subject-matches";

export const MIN_SUBJECT_ENTRIES = MIN_SUBJECT_ENTRIES_UI; // R-SMT-SMALL-ENTRIES: a subject needs this many to be ranked

export type Unit = "points" | "grade" | "pct" | "share" | "va" | "entries";
export type Band = DfeBand | RangeBand | null;
export type Place = { set: Rank | null; region: (Rank & { name: string }) | null; england: Rank | null };

/** One column-1 line (and one row-2 "every line" row). */
export type Line = {
  key: string;
  label: string;
  sub: string; // "195 entries", "OCR Ext. Certificate · 6 entries", "DfE headline type"
  unit: Unit;
  value: number | null;
  lo: number | null;
  hi: number | null;
  band: Band;
  grade: string | null;
  last: number | null; // the same figure last year
  lastPeriod: number | null;
  share: number | null; // Entries: the group's share of the level's entries
  typical: number | null; // Entries: the set's typical share
  series: { period: number; value: number | null }[]; // Entries: the three years' counts
  place: Rank | null;
  placeLabel: string; // "nearest offering it", "your set"
  why: string | null; // no figure: why (never a blank)
};

export type BoardRow = {
  urn: string;
  name: string;
  you: boolean;
  km: number | null;
  easting: number | null;
  northing: number | null;
  value: number | null;
  lo: number | null;
  hi: number | null;
  band: Band;
  grade: string | null;
  entries: number | null;
  share: number | null;
  last: number | null;
  change: number | null;
  england: Rank | null;
  quarter: "top" | "middle" | "bottom" | null;
  why: string | null; // the school's own row without a figure says why
};

export type Board = {
  title: string; // "A level, against the 10 nearest offering A level"
  subtitle: string; // "Points per entry, A level 2024/25 · the set, ranked"
  measure: string; // "Points per entry", "Value added", "Share of entries"
  unit: Unit;
  period: number | null;
  rows: BoardRow[]; // ranked, highest first; rows without a figure last
  median: number | null;
  england: { p25: number | null; p75: number | null; of: number } | null; // the faint England strip (value added)
  place: Place;
  counts: { above: number; below: number } | null;
  setNote: string | null; // "4 of 12 offer EPQ"
  empty: string | null; // nothing to rank: why, in the middle of the view
};

export type AreaSubject = {
  subject: string;
  qualification: string;
  vicdata: boolean; // † placed in its area by VicData (value added)
  entries: number;
  counts: (number | null)[]; // the three years' entries
  value: number | null; // points, share or value added
  lo: number | null;
  hi: number | null;
  band: Band;
  grade: string | null;
  setValues: number[]; // the set's schools teaching it (their dots)
  typical: number | null; // Entries: the set's typical share
  offering: { n: number; of: number } | null; // the set's schools offering it
  place: Rank | null;
  only: boolean; // the only school in the set teaching it
  size: "XS" | "S" | "M" | "L" | "XL" | null;
  ranked: boolean;
  why: string | null;
};
export type AreaBlock = { id: string; label: string; quals: { qualification: string; short: string; subjects: AreaSubject[] }[] };

export type GradeBlock = { qualification: string; short: string; entries: number; top: { label: string; pct: number } | null; bands: { label: string; entries: number; pct: number }[] };

export type Academic = {
  urn: string;
  state: AcademicState;
  offer: AcademicOffer;
  igcse: boolean;
  independent: boolean;
  period: number | null;
  provisional: boolean;
  // The set this view compares against, as the pill names it, and the schools in it that offer the group.
  set: { kind: string; label: string; size: number; offering: number; chosen: boolean; reachKm: number | null; urns: string[] };
  areaLabel: string | null;
  lines: Line[];
  col1: { title: string; sub: string; note: string | null; summary: { label: string; value: string }[] };
  board: Board;
  areas: { blocks: AreaBlock[]; outside: AreaSubject[]; none: string | null; period: number | null };
  grades: GradeBlock[];
  trends: {
    label: string;
    unit: Unit;
    school: Pt[];
    band: BandPt[];
    schoolLabel: string | null; // null: no line for the school (an independent's Progress 8)
    note: string;
    lines: { key: string; label: string; unit: Unit; from: number | null; to: number | null; fromPeriod: number | null; toPeriod: number | null }[];
    moves: { label: string; from: number | null; to: number | null; change: number; unit: Unit }[];
    movesKind: "subjects" | "schools" | null;
    mix: { keys: { key: string; label: string }[]; years: { year: number; shares: Record<string, number>; counts: Record<string, number>; total: number }[]; sentence: string | null };
    against: { label: string; mine: number; typical: number; gap: number }[];
  };
  notes: Record<string, string>;
};

// ------------------------------------------------------------------------------------------ helpers

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const median = (xs: number[]) => percentile(xs, 50);
const placeIn = (vals: Map<string, number | null>, urn: string): Rank | null => {
  const mine = vals.get(urn);
  if (mine === null || mine === undefined) return null;
  const all = Array.from(vals.values()).filter((v): v is number => v !== null);
  return { rank: 1 + all.filter((v) => v > mine).length, of: all.length };
};
const quarterOf = (v: number | null, p25: number | null, p75: number | null): BoardRow["quarter"] => (v === null || p25 === null || p75 === null ? null : v > p75 ? "top" : v < p25 ? "bottom" : "middle");
const km = (a: { easting: number | null; northing: number | null } | undefined, b: { easting: number | null; northing: number | null } | undefined) =>
  a && b && a.easting !== null && a.northing !== null && b.easting !== null && b.northing !== null ? Math.hypot(a.easting - b.easting, a.northing - b.northing) / 1000 : null;
const years = (from: number, to: number) => (to >= from ? Array.from({ length: to - from + 1 }, (_, i) => from + i) : []);
const entriesWord = (n: number) => `${n.toLocaleString("en-GB")} ${n === 1 ? "entry" : "entries"}`;
const word = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

// A Post-16 "line": one group or one of DfE's applied types.
type LineId = RealGroup | `applied:${AppliedType}`;
const lineLabel = (id: LineId) => (id.startsWith("applied:") ? APPLIED_LABEL[id.slice(8) as AppliedType] : GROUP_LABEL[id as RealGroup]);
const lineGroup = (id: LineId): RealGroup => (id.startsWith("applied:") ? "applied" : (id as RealGroup));

// The subject value-added file's qualification for each subject-file group's headline line.
const VA_FILE_QUAL: Partial<Record<RealGroup, RegExp>> = { epq: /^Extended Project/, coremaths: /^Core Maths/, as: /^GCE AS level \(All\)/, ib: /^International Baccalaureate$/ };
// Top grades by scale (the grade profile's top share).
const TOP: { test: RegExp; label: string; grades: string[]; order: string[]; bands: { label: string; grades: string[] }[] }[] = [
  { test: /^GCE A level$/, label: "A*–A", grades: ["A*", "A"], order: ["A*", "A", "B", "C", "D", "E", "U"], bands: [{ label: "A*–A", grades: ["A*", "A"] }, { label: "B", grades: ["B"] }, { label: "C", grades: ["C"] }, { label: "D–U", grades: ["D", "E", "U"] }] },
  { test: /^(GCE AS level|Core Maths)/, label: "A", grades: ["A"], order: ["A", "B", "C", "D", "E", "U"], bands: [{ label: "A", grades: ["A"] }, { label: "B", grades: ["B"] }, { label: "C", grades: ["C"] }, { label: "D–U", grades: ["D", "E", "U"] }] },
  { test: /^(BTEC|OCR)/, label: "Distinction*–Distinction", grades: ["D*", "Distinction*", "D", "Distinction", "D*D*", "D*D", "DD", "D*D*D*", "D*D*D", "D*DD", "DDD"], order: [], bands: [] },
  { test: /^IBO/, label: "6–7", grades: ["7", "6"], order: ["7", "6", "5", "4", "3", "2", "1"], bands: [{ label: "7–6", grades: ["7", "6"] }, { label: "5–4", grades: ["5", "4"] }, { label: "3–1", grades: ["3", "2", "1"] }] },
  { test: /^GCSE \(9-1\) Full Course$/, label: "9–7", grades: ["9", "8", "7"], order: [], bands: [{ label: "9–7", grades: ["9", "8", "7"] }, { label: "6–5", grades: ["6", "5"] }, { label: "4", grades: ["4"] }, { label: "3–1", grades: ["3", "2", "1", "U"] }] },
];

/** What Academic offers this school: its levels, main level, Post-16 groups and applied types, GCSE areas. */
export async function academicOffer(school: SmtSchool): Promise<AcademicOffer> {
  const gcse = !!school.phases.gcse && !!school.latest.ks4;
  const post16 = !!school.phases.post16 && !!school.latest.ks5;
  const main: AcademicPhase = gcse && !(school.phases.igcse && post16) ? "gcse" : post16 ? "post16" : "gcse";
  const L = school.latest.ks5?.period ?? null;
  let groups: RealGroup[] = [];
  let applied: AppliedType[] = [];
  if (post16 && L !== null) {
    const [rows, pop] = await Promise.all([qualRows([school.urn], "ks5", L), population("ks5")]);
    const g = new Set<RealGroup>();
    for (const r of rows) if (r.period === L) {
      const k = groupOfQualification(r.qualification);
      if (k) g.add(k);
    }
    if ((figure(pop, school.urn, L, "bucket:tlevel::entries") ?? 0) > 0) g.add("tlevel");
    applied = (["ag", "tl"] as const).filter((t) => figure(pop, school.urn, L, `${APPLIED_KEY[t]}::aps_per_entry`) !== null || figure(pop, school.urn, L, `${APPLIED_KEY[t]}::value_added`) !== null);
    if (applied.length) g.add("applied");
    groups = GROUP_ORDER.filter((x): x is RealGroup => x !== "all" && g.has(x as RealGroup));
  }
  return { phases: { gcse: !!school.phases.gcse, post16: !!school.phases.post16 }, main, groups, applied, areas: { gcse: school.areas.gcse.map((a) => a.id) } };
}

// ------------------------------------------------------------------------------------------ the build

type Ctx = {
  school: SmtSchool;
  urn: string;
  st: AcademicState;
  chosen: SmtSet | null; // null: Default (per group)
  pop: Population;
  names: Record<string, { name: string; easting: number | null; northing: number | null }>;
  regionOf: (u: string) => { code: string; name: string } | null;
};

export async function buildAcademic(school: SmtSchool, st: AcademicState, set: SmtSet): Promise<Academic> {
  const offer = await academicOffer(school);
  const chosen = set.kind === "nearest" ? null : { ...set, urns: set.urns.filter((u) => u !== school.urn) };
  const england = await englandSchools();
  const regionOf = (u: string) => {
    const e = england.get(u);
    return e ? { code: e.regionCode, name: e.regionName } : null;
  };
  if (st.phase === "post16") return post16(school, st, offer, chosen, regionOf);
  return gcse(school, st, offer, chosen, set, regionOf);
}

const noticeNotes = (): Record<string, string> => ({
  points: smtNote("acPoints"),
  vaPost16: smtNote("acVaPost16"),
  bandsDfe: smtNote("acBandsDfe"),
  bandsP8: smtNote("acBandsP8"),
  p8Gap: smtNote("acP8Gap", { p8Last: periodLabel(PROGRESS8_LAST_PERIOD) }),
  vaGap: smtNote("acVaGap", { years: `${periodLabel(SIXTH_FORM_VA_FROM - 2)} or ${periodLabel(SIXTH_FORM_VA_FROM - 1)}` }),
  applied: smtNote("acApplied"),
  epqNoPoints: smtNote("acEpqNoPoints"),
  tlevelNoVa: smtNote("acTlevelNoVa"),
  quarters: smtNote("acQuarters"),
  subjectsByQual: smtNote("acSubjectsByQual"),
  vicdataMatch: smtNote("acVicdataMatch", { status: VA_SUBJECT_MATCHES_STATUS === "draft" ? "VicData's draft list, being checked" : "VicData's list" }),
  outsideAreas: smtNote("acOutsideAreas"),
  size: smtNote("acSize"),
  sizePending: smtNote("acSizePending"),
  mix: smtNote("acMix"),
  setMoves: smtNote("acSetMoves"),
  lines: smtNote("acLines"),
  resultsFrom: smtNote("acResultsFrom", { base: periodLabel(TREND_BASE_PERIOD), grading: periodLabel(GRADING_2122_PERIOD) }),
  setHolds: smtNote("acSetHolds"),
  smallEntries: smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES }),
  middleHalf: "",
});

// ============================================================================================ Post-16

async function post16(school: SmtSchool, st: AcademicState, offer: AcademicOffer, chosen: SmtSet | null, regionOf: Ctx["regionOf"]): Promise<Academic> {
  const urn = school.urn;
  const L = school.latest.ks5!.period;
  const pop = await population("ks5");
  const me = (await setNames([urn]))[urn];
  const lineIds: LineId[] = offer.groups.flatMap((g): LineId[] => (g === "applied" ? offer.applied.map((t) => `applied:${t}` as LineId) : [g]));

  // Each line's set: the chosen set (it holds across groups), else the line's default (each of DfE's
  // applied types its own).
  const setCache = new Map<string, Promise<GroupSet>>();
  const setOf = (id: LineId): Promise<GroupSet> => {
    if (!setCache.has(id)) setCache.set(id, chosen ? Promise.resolve({ kind: chosen.kind, label: chosen.label, urns: chosen.urns, chosen: true, reachKm: null }) : groupDefaultSet(urn, lineGroup(id), L, me ?? null, id.startsWith("applied:") ? (id.slice(8) as AppliedType) : undefined));
    return setCache.get(id)!;
  };
  const offeringOf = (id: LineId, urns: string[]) => offering(lineGroup(id), urns, L, pop, id.startsWith("applied:") ? (id.slice(8) as AppliedType) : undefined);
  const setIds: LineId[] = [...lineIds, ...(offer.groups.includes("applied") ? ["applied" as LineId] : [])];
  const sets = new Map<string, GroupSet>(await Promise.all(setIds.map(async (id) => [id, await setOf(id)] as const)));
  const everyone = Array.from(new Set([urn, ...Array.from(sets.values()).flatMap((s) => s.urns)]));
  const from = Math.min(HISTORIC_GRADE_FROM, L - 2);
  const [rows, va, names, mine, famMap] = await Promise.all([
    qualRows(everyone, "ks5", from),
    subjectVa(everyone),
    setNames(everyone),
    cachedReference(`smt:subjects:${urn}:ks5`, () => fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" })),
    cachedReference("smt:family-map:ks5", () => lookupAcademicSubjectFamilyMap({ ksStage: "ks5" })),
  ]);
  const familyOf = new Map(famMap.map((r) => [r.raw_subject, r.family_id]));
  const famOf = (s: string) => familyOf.get(s) ?? familyOf.get(latestSubjectName(s)) ?? null;
  const areaLabels = new Map(school.areas.post16.map((a) => [a.id, a.label]));
  const famLabel = new Map<string, string>(famMap.map((r) => [r.family_id, areaLabels.get(r.family_id) ?? r.family_id]));
  const rowsOf = (u: string, y: number) => rows.filter((r) => r.urn === u && r.period === y);
  const levelEntries = (u: string, y: number) => sum(rowsOf(u, y).map((r) => r.entries));
  const groupEntries = (u: string, y: number, g: RealGroup) => sum(rowsOf(u, y).filter((r) => groupOfQualification(r.qualification) === g).map((r) => r.entries));

  // ---------------------------------------------------------------- one line's figure for any school, any year
  type Fig = { value: number | null; lo: number | null; hi: number | null; band: Band; grade: string | null; entries: number | null; size?: string | null };
  const NONE: Fig = { value: null, lo: null, hi: null, band: null, grade: null, entries: null };
  const vaRow = (u: string, y: number, q: RegExp) => va.find((r) => r.urn === u && r.period === y && q.test(r.qualification) && r.subject === "All subjects") ?? null;
  const computedPoints = (u: string, y: number, g: RealGroup) => {
    const rs = rowsOf(u, y).filter((r) => groupOfQualification(r.qualification) === g && r.avg !== null);
    const e = sum(rs.map((r) => r.entries));
    return e ? sum(rs.map((r) => r.avg! * r.entries)) / e : null;
  };
  const headType = (id: LineId): string | null => (id === "alevel" ? "A level" : id.startsWith("applied:") ? APPLIED_KEY[id.slice(8) as AppliedType] : null);
  const fig = (id: LineId, mode: AcademicMode, u: string, y: number): Fig => {
    const g = lineGroup(id);
    const t = headType(id);
    if (mode === "entries") {
      // Entries are by VicData's group (DfE's applied types can't be told apart in the entries).
      const total = levelEntries(u, y);
      const e = groupEntries(u, y, g);
      return { ...NONE, value: total && e ? (e / total) * 100 : null, entries: e || null };
    }
    if (mode === "results") {
      if (t) return { ...NONE, value: figure(pop, u, y, `${t}::aps_per_entry`), grade: (pop.get(u)?.get(y)?.[`${t}::aps_per_entry_grade`] as string | undefined) ?? null, entries: t === "A level" ? groupEntries(u, y, "alevel") || null : null };
      if (g === "ib") return { ...NONE, value: figure(pop, u, y, "bucket:ib::aps_per_entry"), entries: groupEntries(u, y, "ib") || null };
      if (g === "tlevel") return { ...NONE, value: figure(pop, u, y, "bucket:tlevel::aps_per_entry"), entries: figure(pop, u, y, "bucket:tlevel::entries") };
      if (g === "epq") return { ...NONE, entries: groupEntries(u, y, "epq") || null };
      return { ...NONE, value: computedPoints(u, y, g), entries: groupEntries(u, y, g) || null };
    }
    // Value added
    if (t) {
      const v = figure(pop, u, y, `${t}::value_added`);
      const lo = figure(pop, u, y, `${t}::value_added_lower_ci`);
      const hi = figure(pop, u, y, `${t}::value_added_upper_ci`);
      const band = dfeBandOf(pop.get(u)?.get(y)?.[`${t}::progress_banding`]);
      const e = t === "A level" ? (vaRow(u, y, /^GCE A level$/)?.entries ?? null) : null;
      return { value: v, lo, hi, band: band ?? (v !== null ? rangeBand(lo, hi) : null), grade: null, entries: e };
    }
    const q = VA_FILE_QUAL[g];
    if (!q) return NONE; // T level: no value added
    const r = vaRow(u, y, q);
    return r ? { value: r.value, lo: r.lo, hi: r.hi, band: rangeBand(r.lo, r.hi), grade: null, entries: r.entries } : NONE;
  };
  const noFigureWhy = (id: LineId, mode: AcademicMode): string | null => {
    const g = lineGroup(id);
    if (mode === "results" && g === "epq") return smtNote("acEpqNoPoints");
    if (mode === "va" && g === "tlevel") return smtNote("acTlevelNoVa");
    if (mode === "entries" && id.startsWith("applied:")) return null;
    return null;
  };
  // England's values for a line (the place and the faint strip); null where VicData has no national read.
  const englandVals = async (id: LineId, mode: AcademicMode, y: number): Promise<Map<string, number> | null> => {
    const t = headType(id);
    const key = mode === "results" ? (t ? `${t}::aps_per_entry` : lineGroup(id) === "ib" ? "bucket:ib::aps_per_entry" : lineGroup(id) === "tlevel" ? "bucket:tlevel::aps_per_entry" : null) : mode === "va" && t ? `${t}::value_added` : null;
    if (key) {
      const out = new Map<string, number>();
      for (const [u, by] of pop) {
        const v = num(by.get(y)?.[key]);
        if (v !== null) out.set(u, v);
      }
      return out;
    }
    if (mode === "va") {
      const q = VA_FILE_QUAL[lineGroup(id)];
      const own = q ? va.find((r) => r.urn === urn && q.test(r.qualification) && r.subject === "All subjects") : null;
      if (!own) return null;
      const nat = await englandQualVa(`${own.qualification}::All subjects::${own.size}`, y);
      return new Map(nat.filter((r) => r.value !== null).map((r) => [r.urn, r.value!]));
    }
    return null;
  };
  const placesFrom = (vals: Map<string, number> | null, u: string): { england: Rank | null; region: (Rank & { name: string }) | null } => {
    const v = vals?.get(u);
    if (!vals || v === undefined) return { england: null, region: null };
    const all = Array.from(vals.values());
    const r = regionOf(u);
    const inRegion = r ? Array.from(vals.entries()).filter(([x]) => regionOf(x)?.code === r.code).map(([, x]) => x) : [];
    return { england: { rank: 1 + all.filter((x) => x > v).length, of: all.length }, region: r ? { rank: 1 + inRegion.filter((x) => x > v).length, of: inRegion.length, name: r.name } : null };
  };

  // ---------------------------------------------------------------- column 1
  const mode = st.mode;
  const lines: Line[] = [];
  for (const id of lineIds) {
    const g = lineGroup(id);
    if (mode === "entries" && id.startsWith("applied:")) {
      if (id !== "applied:" + offer.applied[0]) continue; // entries: one Applied line (the group's), not one per DfE type
    }
    const lineId: LineId = mode === "entries" && id.startsWith("applied:") ? "applied" : id;
    const s = sets.get(lineId)!;
    const now = fig(lineId, mode, urn, L);
    const prev = fig(lineId, mode, urn, L - 1);
    const offeringSet = await offeringOf(lineId, s.urns);
    const vals = new Map<string, number | null>([[urn, now.value], ...s.urns.filter((u) => offeringSet.has(u)).map((u) => [u, fig(lineId, mode, u, L).value] as [string, number | null])]);
    const shares = s.urns.filter((u) => offeringSet.has(u)).map((u) => fig(lineId, "entries", u, L).value).filter((v): v is number => v !== null);
    const qualsOf = (t: AppliedType) => {
      // The school's qualifications DfE files under this type can't be told from the files; name its applied qualifications.
      void t;
      const qs = Array.from(new Set(rowsOf(urn, L).filter((r) => groupOfQualification(r.qualification) === "applied").map((r) => shortQualification(r.qualification))));
      return qs.length === 1 ? qs[0] : "DfE headline type";
    };
    const sub = id.startsWith("applied:") && mode !== "entries" ? qualsOf(id.slice(8) as AppliedType) : now.entries !== null ? entriesWord(now.entries) : "";
    lines.push({
      key: lineId,
      label: mode === "entries" && g === "applied" ? "Applied (BTEC, OCR, VRQ)" : lineLabel(lineId),
      sub: mode === "entries" ? entriesWord(now.entries ?? 0) : sub,
      unit: mode === "va" ? "va" : mode === "entries" ? "share" : "points",
      value: now.value,
      lo: now.lo,
      hi: now.hi,
      band: now.band,
      grade: now.grade,
      last: prev.value,
      lastPeriod: L - 1,
      share: mode === "entries" ? now.value : null,
      typical: mode === "entries" ? median(shares) : null,
      series: mode === "entries" ? [L - 2, L - 1, L].map((y) => ({ period: y, value: groupEntries(urn, y, g) })) : [],
      place: placeIn(vals, urn),
      placeLabel: s.chosen ? "your set" : "nearest offering it",
      why: now.value === null ? (noFigureWhy(lineId, mode) ?? smtNote("acNoFigure", { what: word(mode === "va" ? "value-added" : mode === "results" ? "points" : "entries") })) : null,
    });
  }

  // ---------------------------------------------------------------- the chosen group (All: the group with most entries)
  const mainGroup: RealGroup = st.group !== "all" && offer.groups.includes(st.group as RealGroup) ? (st.group as RealGroup) : ([...offer.groups].sort((a, b) => groupEntries(urn, L, b) - groupEntries(urn, L, a))[0] ?? "alevel");
  const boardLine: LineId = mainGroup === "applied" && mode !== "entries" ? (`applied:${offer.applied.includes(st.applied) ? st.applied : (offer.applied[0] ?? "ag")}` as LineId) : mainGroup;
  const gset = sets.get(boardLine) ?? (await setOf(boardLine));
  const offeringNow = await offeringOf(boardLine, gset.urns);
  const boardUrns = [urn, ...gset.urns.filter((u) => offeringNow.has(u))];
  const engNow = await englandVals(boardLine, mode, L);
  const engPrev = await englandVals(boardLine, mode, L - 1);
  const boardRows: BoardRow[] = boardUrns.map((u) => {
    const f = fig(boardLine, mode, u, L);
    const p = fig(boardLine, mode, u, L - 1);
    const n = names[u];
    return {
      urn: u,
      name: n?.name ?? u,
      you: u === urn,
      km: u === urn ? null : km(n, me),
      easting: n?.easting ?? null,
      northing: n?.northing ?? null,
      value: f.value,
      lo: f.lo,
      hi: f.hi,
      band: f.band,
      grade: f.grade,
      entries: f.entries,
      share: mode === "entries" ? f.value : null,
      last: p.value,
      change: f.value !== null && p.value !== null ? f.value - p.value : null,
      england: placesFrom(engNow, u).england,
      quarter: null,
      why: f.value === null && u === urn ? (noFigureWhy(boardLine, mode) ?? smtNote("acNoFigure", { what: word(mode === "va" ? "value-added" : mode === "results" ? "points" : "entries") })) : null,
    };
  });
  void engPrev;
  const ranked = boardRows.filter((r) => r.value !== null).map((r) => r.value!);
  const p25 = percentile(ranked, 25);
  const p75 = percentile(ranked, 75);
  for (const r of boardRows) r.quarter = mode === "va" ? null : quarterOf(r.value, p25, p75);
  boardRows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.name.localeCompare(b.name));
  const ownPlaces = placesFrom(engNow, urn);
  const engVals = engNow ? Array.from(engNow.values()) : [];
  const measureWord = mode === "va" ? "Value added" : mode === "entries" ? "Share of Post-16 entries" : "Points per entry";
  const boardLabel = lineLabel(boardLine);
  const noVa = mode === "va" && lineGroup(boardLine) === "tlevel";
  const board: Board = {
    title: `${boardLabel}, against ${gset.chosen ? gset.label : `the ${gset.label}`}`,
    subtitle: `${measureWord}, ${boardLabel} ${periodLabel(L)} · the set, ranked`,
    measure: measureWord,
    unit: mode === "va" ? "va" : mode === "entries" ? "share" : "points",
    period: L,
    rows: boardRows,
    median: mode === "va" ? null : median(ranked),
    england: mode === "va" && engVals.length ? { p25: percentile(engVals, 25), p75: percentile(engVals, 75), of: engVals.length } : null,
    place: { set: placeIn(new Map(boardRows.map((r) => [r.urn, r.value])), urn), region: ownPlaces.region, england: ownPlaces.england },
    counts: mode === "va" ? { above: boardRows.filter((r) => !r.you && r.lo !== null && r.lo > 0).length, below: boardRows.filter((r) => !r.you && r.hi !== null && r.hi < 0).length } : null,
    setNote: gset.chosen ? smtNote("acOffering", { n: boardUrns.length - 1, of: gset.urns.length, what: GROUP_LABEL[mainGroup] }) : null,
    empty: noVa ? smtNote("acTlevelNoVa") : ranked.length === 0 ? smtNote("acNoFigure", { what: word(measureWord) }) : null,
  };

  // ---------------------------------------------------------------- subject areas, by qualification
  const areaGroups: RealGroup[] = st.group === "all" ? offer.groups : [mainGroup];
  const subjectsNow = rowsOf(urn, L).filter((r) => {
    const g = groupOfQualification(r.qualification);
    return st.group === "all" ? true : g === mainGroup;
  });
  type Item = { subject: string; qualification: string; familyId: string | null; vicdata: boolean; outside: boolean; entries: number; vaRow: VaFact | null; row: QualRow | null };
  const items: Item[] = [];
  if (mode === "va") {
    for (const r of va.filter((x) => x.urn === urn && x.period === L && x.subject !== "All subjects")) {
      const g = groupOfQualification(r.qualification);
      if (st.group !== "all" && g !== mainGroup) continue;
      const m = vaMatch(r.qualification, r.subject, famOf);
      items.push({ subject: m.subject, qualification: r.qualification, familyId: m.familyId, vicdata: m.vicdata, outside: m.outside || g === "epq", entries: r.entries ?? 0, vaRow: r, row: null });
    }
  } else {
    for (const r of subjectsNow) items.push({ subject: r.subject, qualification: r.qualification, familyId: r.familyId ?? famOf(r.subject), vicdata: false, outside: groupOfQualification(r.qualification) === "epq", entries: r.entries, vaRow: null, row: r });
  }
  const setForQual = async (q: string) => {
    const g = groupOfQualification(q);
    const s = g ? (sets.get(g) ?? (await setOf(g))) : gset;
    return s.urns;
  };
  const subject = async (it: Item): Promise<AreaSubject> => {
    const peers = await setForQual(it.qualification);
    const base = { subject: it.subject, qualification: it.qualification, vicdata: it.vicdata, entries: it.entries, size: null, typical: null, offering: null, grade: null } as const;
    const counts = [L - 2, L - 1, L].map((y) => rows.find((r) => r.urn === urn && r.period === y && r.qualification === it.qualification && r.subject === it.subject)?.entries ?? null);
    if (mode === "va") {
      const r = it.vaRow!;
      const peerVals = peers
        .map((u) => va.find((x) => x.urn === u && x.period === L && x.qualification === it.qualification && vaMatch(x.qualification, x.subject, famOf).subject === it.subject)?.value ?? null)
        .filter((v): v is number => v !== null);
      const all = new Map<string, number | null>([[urn, r.value], ...peerVals.map((v, i) => [`p${i}`, v] as [string, number])]);
      return { ...base, counts, value: r.value, lo: r.lo, hi: r.hi, band: rangeBand(r.lo, r.hi), setValues: peerVals, place: placeIn(all, urn), only: peerVals.length === 0, ranked: true, why: null };
    }
    if (mode === "entries") {
      const share = (u: string) => {
        const t = levelEntries(u, L);
        const e = rows.find((x) => x.urn === u && x.period === L && x.qualification === it.qualification && x.subject === it.subject)?.entries ?? 0;
        return t && e ? (e / t) * 100 : null;
      };
      const peerShares = peers.map(share).filter((v): v is number => v !== null);
      const mineShare = share(urn);
      return { ...base, counts, value: mineShare, lo: null, hi: null, band: null, setValues: peerShares, typical: median(peerShares), offering: { n: peerShares.length, of: peers.length }, place: placeIn(new Map<string, number | null>([[urn, mineShare], ...peerShares.map((v, i) => [`p${i}`, v] as [string, number])]), urn), only: peerShares.length === 0, ranked: true, why: null };
    }
    const r = it.row!;
    const small = r.entries < MIN_SUBJECT_ENTRIES;
    const peerVals = peers.map((u) => rows.find((x) => x.urn === u && x.period === L && x.qualification === it.qualification && x.subject === it.subject && x.entries >= MIN_SUBJECT_ENTRIES)?.avg ?? null).filter((v): v is number => v !== null);
    const value = small ? null : r.avg;
    return { ...base, counts, value, lo: null, hi: null, band: null, setValues: peerVals, place: value === null ? null : placeIn(new Map<string, number | null>([[urn, value], ...peerVals.map((v, i) => [`p${i}`, v] as [string, number])]), urn), only: value !== null && peerVals.length === 0, ranked: value !== null, why: small ? smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES }) : r.avg === null ? smtNote("differentScale") : null };
  };
  const built = await Promise.all(items.map(async (it) => ({ it, s: await subject(it) })));
  const blocks: AreaBlock[] = [];
  for (const { it, s } of built) {
    if (it.outside) continue;
    const id = it.familyId ?? "other";
    let b = blocks.find((x) => x.id === id);
    if (!b) blocks.push((b = { id, label: famLabel.get(id) ?? (id === "other" ? "Other" : id), quals: [] }));
    let q = b.quals.find((x) => x.qualification === it.qualification);
    if (!q) b.quals.push((q = { qualification: it.qualification, short: shortQualification(it.qualification), subjects: [] }));
    q.subjects.push(s);
  }
  const qOrder = (q: string) => {
    const g = groupOfQualification(q);
    return g ? GROUP_ORDER.indexOf(g) : 99;
  };
  for (const b of blocks) {
    b.quals.sort((a, c) => qOrder(a.qualification) - qOrder(c.qualification) || a.short.localeCompare(c.short));
    for (const q of b.quals) q.subjects.sort((a, c) => c.entries - a.entries || a.subject.localeCompare(c.subject));
  }
  const areaEntries = (b: AreaBlock) => sum(b.quals.flatMap((q) => q.subjects.map((s) => s.entries)));
  blocks.sort((a, b) => areaEntries(b) - areaEntries(a));
  const outside = built.filter(({ it }) => it.outside).map(({ s }) => s);
  void areaGroups;

  // ---------------------------------------------------------------- grade profile (Results)
  const grades: GradeBlock[] = [];
  if (mode === "results") {
    const gRows = (mine.byUrn.get(urn)?.gradeDistribution ?? []).filter((r) => r.period === L && (st.group === "all" || groupOfQualification(r.qualificationType) === mainGroup));
    const byQual = new Map<string, { grade: string; entries: number }[]>();
    for (const r of gRows) {
      const arr = byQual.get(r.qualificationType) ?? byQual.set(r.qualificationType, []).get(r.qualificationType)!;
      const at = arr.find((x) => x.grade === r.grade);
      if (at) at.entries += r.entries;
      else arr.push({ grade: r.grade, entries: r.entries });
    }
    for (const [q, all] of byQual) {
      const scale = TOP.find((t) => t.test.test(q));
      // Graded entries in the scale's bands only (an absent or pending grade isn't graded).
      const inBands = scale?.bands.length ? new Set(scale.bands.flatMap((x) => x.grades)) : null;
      const gs = inBands ? all.filter((x) => inBands.has(x.grade)) : all;
      const total = sum(gs.map((x) => x.entries));
      if (!total) continue;
      const top = scale ? sum(gs.filter((x) => scale.grades.includes(x.grade)).map((x) => x.entries)) : 0;
      const bands = scale?.bands.length
        ? scale.bands.map((b) => {
            const e = sum(gs.filter((x) => b.grades.includes(x.grade)).map((x) => x.entries));
            return { label: b.label, entries: e, pct: (e / total) * 100 };
          })
        : gs.sort((a, b) => b.entries - a.entries).map((x) => ({ label: x.grade, entries: x.entries, pct: (x.entries / total) * 100 }));
      grades.push({ qualification: q, short: shortQualification(q), entries: total, top: scale ? { label: scale.label, pct: (top / total) * 100 } : null, bands });
    }
    grades.sort((a, b) => qOrder(a.qualification) - qOrder(b.qualification) || b.entries - a.entries);
  }

  // ---------------------------------------------------------------- trends
  const trendFrom = mode === "va" ? SIXTH_FORM_VA_FROM : mode === "results" ? TREND_BASE_PERIOD : Math.max(from, L - 2);
  const ys = years(trendFrom, L);
  const schoolPts = ys.map((y) => ({ year: y, value: fig(boardLine, mode, urn, y).value }));
  const band = ys.map((y) => {
    const vals = gset.urns.filter((u) => offeringNow.has(u)).map((u) => fig(boardLine, mode, u, y).value).filter((v): v is number => v !== null);
    return { year: y, p25: percentile(vals, 25), p75: percentile(vals, 75), n: vals.length };
  });
  const trendNote = [st.group === "all" ? smtNote("acAllFollows", { group: lineLabel(boardLine) }) : null, mode === "va" ? smtNote("acVaGap", { years: `${periodLabel(SIXTH_FORM_VA_FROM - 2)} or ${periodLabel(SIXTH_FORM_VA_FROM - 1)}` }) : mode === "results" ? smtNote("acResultsFrom", { base: periodLabel(TREND_BASE_PERIOD), grading: periodLabel(GRADING_2122_PERIOD) }) : null].filter(Boolean).join(" ");
  const everyLine = lines.map((l) => ({ key: l.key, label: l.label, unit: l.unit, from: l.last, to: l.value, fromPeriod: L - 1, toPeriod: L }));

  // Moves: Entries -- the subjects' biggest changes since the first of three years; otherwise the set's schools.
  let moves: Academic["trends"]["moves"] = [];
  let movesKind: Academic["trends"]["movesKind"] = null;
  if (mode === "entries") {
    const subj = new Map<string, { from: number; to: number; label: string }>();
    for (const r of rows.filter((x) => x.urn === urn && (x.period === L || x.period === L - 2))) {
      const k = `${r.qualification}::${r.subject}`;
      const lbl = groupOfQualification(r.qualification) === "alevel" ? r.subject : `${r.subject} (${shortQualification(r.qualification)})`;
      const cur = subj.get(k) ?? { from: 0, to: 0, label: lbl };
      if (r.period === L) cur.to = r.entries;
      else cur.from = r.entries;
      subj.set(k, cur);
    }
    const all = Array.from(subj.values()).map((x) => ({ label: x.label, from: x.from, to: x.to, change: x.to - x.from, unit: "entries" as Unit }));
    moves = [...all.filter((x) => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 5), ...all.filter((x) => x.change < 0).sort((a, b) => a.change - b.change).slice(0, 5)];
    movesKind = "subjects";
  } else {
    const ch = boardRows.filter((r) => r.change !== null && !r.you).map((r) => ({ label: r.name, from: r.last, to: r.value, change: r.change!, unit: board.unit }));
    moves = [...ch.filter((x) => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 3), ...ch.filter((x) => x.change < 0).sort((a, b) => a.change - b.change).slice(0, 3)];
    movesKind = "schools";
  }

  // The entries mix by VicData's groups (bucket:*::entries), every year with entries.
  const MIX: { key: string; label: string }[] = [
    { key: "alevel", label: "A level (and AS)" },
    { key: "btec_ocr", label: "BTEC, OCR & VRQ" },
    { key: "ib", label: "IB" },
    { key: "tlevel", label: "T level" },
    { key: "other", label: "Other (EPQ, Core Maths, …)" },
  ];
  const mixYears = years(HISTORIC_GRADE_FROM, L)
    .map((y) => {
      const counts: Record<string, number> = {};
      for (const m of MIX) {
        const v = figure(pop, urn, y, `bucket:${m.key}::entries`);
        if (v) counts[m.key] = v;
      }
      const total = sum(Object.values(counts));
      const shares: Record<string, number> = {};
      for (const k of Object.keys(counts)) shares[k] = total ? (counts[k] / total) * 100 : 0;
      return { year: y, shares, counts, total };
    })
    .filter((y) => y.total > 0);
  const mixKeys = MIX.filter((m) => mixYears.some((y) => y.counts[m.key]));
  // A group that started or stopped within the years shown is worth a sentence (Leighton Park's IB).
  let sentence: string | null = null;
  for (const m of mixKeys) {
    const has = mixYears.map((y) => y.counts[m.key] ?? 0);
    const last = has.at(-1) ?? 0;
    if (last === 0 && has.some((x) => x > 0)) {
      const when = mixYears.filter((y) => y.counts[m.key]).map((y) => `${periodLabel(y.year)} (${y.counts[m.key]})`);
      sentence = `${names[urn]?.name ?? "The school"} entered ${m.label === "IB" ? "the IB" : m.label} in ${when.length > 1 ? `${when.slice(0, -1).join(", ")} and ${when.at(-1)}` : when[0]}, and none in ${periodLabel(L)}.`;
    }
  }

  // Where the mix differs most from the set's typical school (Entries).
  let against: Academic["trends"]["against"] = [];
  if (mode === "entries") {
    const all = built.filter(({ s }) => s.value !== null && s.typical !== null).map(({ it, s }) => ({ label: groupOfQualification(it.qualification) === "alevel" ? it.subject : `${it.subject} (${shortQualification(it.qualification)})`, mine: s.value!, typical: s.typical!, gap: s.value! - s.typical! }));
    against = all.sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 9);
  }

  const notes = noticeNotes();
  notes.middleHalf = smtNote("middleHalf", { setLabel: gset.label });
  notes.eachLine = smtNote("acEachLineSet", { how: chosen ? `${chosen.label}, its schools offering each qualification` : "the 10 nearest schools offering it" });
  notes.entries = smtNote("acEntries", { level: "Post-16" });
  notes.share = smtNote("acShare", { level: "Post-16" });
  notes.moves = smtNote("acMoves", { base: periodLabel(L - 2) });
  notes.against = smtNote("acAgainst", { level: "Post-16" });

  return {
    urn,
    state: { ...st, group: st.group === "all" || offer.groups.includes(st.group as RealGroup) ? st.group : mainGroup },
    offer,
    igcse: !!school.phases.igcse,
    independent: school.independent,
    period: L,
    provisional: school.latest.ks5?.provisional ?? false,
    set: { kind: gset.kind, label: gset.label, size: gset.urns.length, offering: boardUrns.length - 1, chosen: gset.chosen, reachKm: gset.reachKm, urns: gset.urns },
    areaLabel: null,
    lines,
    col1: { title: mode === "va" ? "Value added now" : mode === "entries" ? "Entries now" : "Results now", sub: `Post-16 · ${periodLabel(L)}${mode === "results" ? " · points per entry" : mode === "entries" ? ` · ${levelEntries(urn, L).toLocaleString("en-GB")} entries` : ""}`, note: null, summary: [] },
    board,
    areas: { blocks, outside, none: blocks.length || outside.length ? null : smtNote("acNoFigure", { what: "subject" }), period: L },
    grades,
    trends: { label: `${boardLabel} ${word(measureWord)}`, unit: board.unit, school: schoolPts, band, schoolLabel: names[urn]?.name ?? null, note: trendNote, lines: everyLine, moves, movesKind, mix: { keys: mixKeys, years: mixYears, sentence }, against },
    notes,
  };
}

// ============================================================================================ GCSE

async function gcse(school: SmtSchool, st: AcademicState, offer: AcademicOffer, chosen: SmtSet | null, passed: SmtSet, regionOf: Ctx["regionOf"]): Promise<Academic> {
  const urn = school.urn;
  const L4 = school.latest.ks4?.period ?? null;
  const [pop, igcse] = await Promise.all([population("ks4"), igcseExcluded()]);
  if (school.phases.igcse) igcse.add(urn);
  const me = (await setNames([urn]))[urn];
  const notes = noticeNotes();
  const mode = st.mode;
  const noP8 = school.independent || !!school.phases.igcse;

  // The set: Value added at an independent or IGCSE school -> the 10 nearest state schools with
  // Progress 8 (a chosen set keeps its state schools); otherwise the dashboard's set.
  let gset: GroupSet;
  if (mode === "va" && noP8) gset = chosen ? { kind: chosen.kind, label: chosen.label, urns: chosen.urns, chosen: true, reachKm: null } : await stateP8Set(urn, me ?? null);
  else gset = chosen ? { kind: chosen.kind, label: chosen.label, urns: chosen.urns, chosen: true, reachKm: null } : await gcseDefaultSet(urn);
  void passed;
  const everyone = [urn, ...gset.urns];
  const names = await setNames(everyone);
  const areaLabel = st.area ? (school.areas.gcse.find((a) => a.id === st.area)?.label ?? st.area) : null;
  let L = mode === "va" ? PROGRESS8_LAST_PERIOD : L4;
  const empty = (why: string): Academic => ({
    urn, state: st, offer, igcse: !!school.phases.igcse, independent: school.independent, period: L, provisional: false,
    set: { kind: gset.kind, label: gset.label, size: gset.urns.length, offering: 0, chosen: gset.chosen, reachKm: gset.reachKm, urns: gset.urns }, areaLabel,
    lines: [], col1: { title: "GCSE", sub: "", note: why, summary: [] },
    board: { title: "", subtitle: "", measure: "", unit: "points", period: L, rows: [], median: null, england: null, place: { set: null, region: null, england: null }, counts: null, setNote: null, empty: why },
    areas: { blocks: [], outside: [], none: why, period: null }, grades: [],
    trends: { label: "", unit: "points", school: [], band: [], schoolLabel: null, note: "", lines: [], moves: [], movesKind: null, mix: { keys: [], years: [], sentence: null }, against: [] },
    notes,
  });
  if (L === null) return empty("No GCSE results are published for this school.");

  // ---------------------------------------------------------------- measures
  const from = HISTORIC_GRADE_FROM;
  const [rows, fam] = await Promise.all([
    qualRows(everyone, "ks4", from),
    st.area && mode !== "va" ? cachedReference(`smt:family:ks4:${everyone.slice().sort().join(",")}`, () => lookupAcademicSubjectFamily({ entityIds: everyone, ksStage: "ks4", periodMin: from })) : Promise.resolve([]),
  ]);
  const levelEntries = (u: string, y: number) => sum(rows.filter((r) => r.urn === u && r.period === y).map((r) => r.entries));
  // The subject rollup can trail the headline by a release (GCSE 2025/26's headline lands first): subjects,
  // entries and areas read the rollup's own latest year, and say it.
  const LS = Math.max(...rows.filter((r) => r.urn === urn).map((r) => r.period), -Infinity);
  const subjYear = Number.isFinite(LS) ? Math.min(LS, L) : L;
  if (mode === "entries") L = subjYear;
  const areaRow = (u: string, y: number) => fam.find((x) => x.entity_id === u && Number(x.period) === y && x.family_id === st.area && (x.bucket ?? "all") === "all");
  type Fig = { value: number | null; lo: number | null; hi: number | null; band: Band; entries: number | null };
  const key = mode === "va" ? SMT_MEASURES.ks4.p8 : st.area ? null : SMT_MEASURES.ks4.a8;
  const fig = (u: string, y: number): Fig => {
    if (mode === "va") {
      const v = figure(pop, u, y, SMT_MEASURES.ks4.p8);
      const lo = figure(pop, u, y, SMT_MEASURES.ks4.p8lo);
      const hi = figure(pop, u, y, SMT_MEASURES.ks4.p8hi);
      return { value: igcse.has(u) ? null : v, lo, hi, band: p8Band(v, lo, hi), entries: null };
    }
    if (mode === "entries") {
      const t = levelEntries(u, y);
      if (!st.area) return { value: t || null, lo: null, hi: null, band: null, entries: t || null };
      const e = Number(areaRow(u, y)?.entries_total ?? 0);
      return { value: t && e ? (e / t) * 100 : null, lo: null, hi: null, band: null, entries: e || null };
    }
    if (st.area) {
      const r = areaRow(u, y);
      return { value: r && r.avg_point_score !== null && Number(r.entries_total) >= SUBJECT_AREA_MIN.entries ? Number(r.avg_point_score) : null, lo: null, hi: null, band: null, entries: r ? Number(r.entries_total) : null };
    }
    return { value: igcse.has(u) ? null : figure(pop, u, y, SMT_MEASURES.ks4.a8), lo: null, hi: null, band: null, entries: levelEntries(u, y) || null };
  };
  const englandOf = (y: number): Map<string, number> | null => {
    if (!key) return null;
    const out = new Map<string, number>();
    for (const [u, by] of pop) {
      if (igcse.has(u)) continue;
      const v = num(by.get(y)?.[key]);
      if (v !== null) out.set(u, v);
    }
    return out;
  };
  const eng = englandOf(L);
  const placesFrom = (u: string) => {
    const v = eng?.get(u);
    if (!eng || v === undefined) return { england: null, region: null };
    const all = Array.from(eng.values());
    const r = regionOf(u);
    const inRegion = r ? Array.from(eng.entries()).filter(([x]) => regionOf(x)?.code === r.code).map(([, x]) => x) : [];
    return { england: { rank: 1 + all.filter((x) => x > v).length, of: all.length }, region: r ? { rank: 1 + inRegion.filter((x) => x > v).length, of: inRegion.length, name: r.name } : null };
  };

  // ---------------------------------------------------------------- board
  const why = (u: string): string | null => (u !== urn ? null : mode === "va" ? (school.independent ? smtNote("acIndependentP8") : school.phases.igcse ? smtNote("acIgcseP8") : smtNote("p8NoBaseline", { years: periodLabel(L) })) : school.phases.igcse && !st.area && mode === "results" ? smtNote("igcseView", { school: school.name }) : smtNote("acNoFigure", { what: mode === "entries" ? "entries" : "results" }));
  const unit: Unit = mode === "va" ? "va" : mode === "entries" ? (st.area ? "share" : "entries") : st.area ? "grade" : "points";
  const boardRows: BoardRow[] = everyone.map((u) => {
    const f = fig(u, L);
    const p = fig(u, L - 1);
    const n = names[u];
    return { urn: u, name: n?.name ?? u, you: u === urn, km: u === urn ? null : km(n, me), easting: n?.easting ?? null, northing: n?.northing ?? null, value: f.value, lo: f.lo, hi: f.hi, band: f.band, grade: null, entries: f.entries, share: mode === "entries" && st.area ? f.value : null, last: p.value, change: f.value !== null && p.value !== null ? f.value - p.value : null, england: placesFrom(u).england, quarter: null, why: f.value === null ? why(u) : null };
  });
  const vals = boardRows.filter((r) => r.value !== null).map((r) => r.value!);
  const p25 = percentile(vals, 25);
  const p75 = percentile(vals, 75);
  for (const r of boardRows) r.quarter = mode === "va" ? null : quarterOf(r.value, p25, p75);
  boardRows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.name.localeCompare(b.name));
  const stateSchools = gset.urns.filter((u) => fig(u, L).value !== null);
  const measureWord = mode === "va" ? "Progress 8" : mode === "entries" ? (st.area ? `Share of GCSE entries in ${areaLabel}` : "GCSE entries") : st.area ? `Average grade in ${areaLabel}` : "Attainment 8";
  const own = placesFrom(urn);
  const engVals = eng ? Array.from(eng.values()) : [];
  const noState = mode === "va" && noP8 && stateSchools.length === 0;
  const board: Board = {
    title: `${measureWord}, ${gset.chosen ? gset.label : `the ${gset.label}`}`,
    subtitle: `${measureWord} ${periodLabel(L)} · ${mode === "va" && noP8 ? "the set's state schools, ranked" : "the set, ranked"}`,
    measure: measureWord,
    unit,
    period: L,
    rows: boardRows,
    median: mode === "va" ? null : median(vals),
    england: mode === "va" && engVals.length ? { p25: percentile(engVals, 25), p75: percentile(engVals, 75), of: engVals.length } : null,
    place: { set: placeIn(new Map(boardRows.map((r) => [r.urn, r.value])), urn), region: own.region, england: own.england },
    counts: mode === "va" ? { above: boardRows.filter((r) => !r.you && r.lo !== null && r.lo > 0).length, below: boardRows.filter((r) => !r.you && r.hi !== null && r.hi < 0).length } : null,
    setNote: null,
    empty: noState ? smtNote("acNoStateSchools") : vals.length === 0 ? smtNote("acNoFigure", { what: word(measureWord) }) : null,
  };

  // ---------------------------------------------------------------- column 1 (GCSE only: R-SMT-COL1-LEVEL)
  const lines: Line[] = [];
  const summary: { label: string; value: string }[] = [];
  let col1Note: string | null = null;
  const setLabel = gset.chosen ? "your set" : "the set";
  if (mode === "va") {
    if (noP8) {
      col1Note = school.independent ? smtNote("acIndependentP8") : smtNote("acIgcseP8");
      const sv = boardRows.filter((r) => !r.you && r.value !== null);
      const reach = Math.max(0, ...sv.map((r) => r.km ?? 0));
      summary.push({ label: "State schools in the set", value: `${sv.length}${sv.length ? `, within ${reach.toFixed(1)} km` : ""}` });
      if (sv.length) {
        summary.push({ label: `Their middle half, ${periodLabel(L)}`, value: `${fmtVa(p25)} to ${fmtVa(p75)}` });
        summary.push({ label: "Clearly above average", value: String(board.counts!.above) });
        summary.push({ label: "Clearly below average", value: String(board.counts!.below) });
        summary.push({ label: "Highest", value: `${sv[0].name}, ${fmtVa(sv[0].value)}` });
        summary.push({ label: "Lowest", value: `${sv.at(-1)!.name}, ${fmtVa(sv.at(-1)!.value)}` });
      }
    } else {
      const f = fig(urn, L);
      const p = fig(urn, L - 1);
      lines.push({ key: "p8", label: "Progress 8", sub: `${periodLabel(L)} · England ${own.england ? `${own.england.rank.toLocaleString("en-GB")} of ${own.england.of.toLocaleString("en-GB")}` : "—"}`, unit: "va", value: f.value, lo: f.lo, hi: f.hi, band: f.band, grade: null, last: p.value, lastPeriod: L - 1, share: null, typical: null, series: years(Math.max(HISTORIC_GRADE_FROM, L - 2), L).map((y) => ({ period: y, value: fig(urn, y).value })), place: board.place.set, placeLabel: setLabel, why: f.value === null ? why(urn) : null });
      summary.push({ label: `The set's middle half, ${periodLabel(L)}`, value: `${fmtVa(percentile(vals.filter((_, i) => !boardRows[i]?.you), 25))} to ${fmtVa(percentile(vals, 75))}` });
    }
  } else if (mode === "results") {
    if (st.area) {
      const f = fig(urn, L);
      lines.push({ key: "area_avg", label: `Average grade · ${areaLabel}`, sub: f.entries ? `${f.entries.toLocaleString("en-GB")} entries` : "", unit: "grade", value: f.value, lo: null, hi: null, band: null, grade: null, last: fig(urn, L - 1).value, lastPeriod: L - 1, share: null, typical: null, series: [], place: board.place.set, placeLabel: setLabel, why: f.value === null ? smtNote("areaRankNone", { schools: SUBJECT_AREA_MIN.schools, entries: SUBJECT_AREA_MIN.entries, area: areaLabel ?? "" }) : null });
    } else if (school.phases.igcse) {
      col1Note = smtNote("igcseView", { school: school.name });
    } else {
      for (const [k, label, u] of [[SMT_MEASURES.ks4.a8, "Attainment 8", "points"], [SMT_MEASURES.ks4.em5, "Grade 5+ in English and maths", "pct"]] as const) {
        const v = figure(pop, urn, L, k);
        const sv = new Map<string, number | null>(everyone.map((x) => [x, igcse.has(x) ? null : figure(pop, x, L, k)]));
        lines.push({ key: k, label, sub: periodLabel(L), unit: u, value: v, lo: null, hi: null, band: null, grade: null, last: figure(pop, urn, L - 1, k), lastPeriod: L - 1, share: null, typical: null, series: [], place: placeIn(sv, urn), placeLabel: setLabel, why: v === null ? smtNote("acNoFigure", { what: label }) : null });
      }
    }
  } else {
    const t = levelEntries(urn, L);
    const areaIds = school.areas.gcse.map((a) => a.id);
    const famRows = await cachedReference(`smt:family:ks4:${everyone.slice().sort().join(",")}`, () => lookupAcademicSubjectFamily({ entityIds: everyone, ksStage: "ks4", periodMin: from }));
    const shareOf = (u: string, id: string) => {
      const tt = levelEntries(u, L);
      const e = Number(famRows.find((x) => x.entity_id === u && Number(x.period) === L && x.family_id === id && (x.bucket ?? "all") === "all")?.entries_total ?? 0);
      return tt && e ? (e / tt) * 100 : null;
    };
    for (const id of areaIds) {
      const mineShare = shareOf(urn, id);
      if (mineShare === null) continue;
      const peers = gset.urns.map((u) => shareOf(u, id)).filter((v): v is number => v !== null);
      const e = Number(famRows.find((x) => x.entity_id === urn && Number(x.period) === L && x.family_id === id && (x.bucket ?? "all") === "all")?.entries_total ?? 0);
      lines.push({ key: id, label: school.areas.gcse.find((a) => a.id === id)?.label ?? id, sub: `${e.toLocaleString("en-GB")} entries`, unit: "share", value: mineShare, lo: null, hi: null, band: null, grade: null, last: null, lastPeriod: null, share: mineShare, typical: median(peers), series: [], place: null, placeLabel: setLabel, why: null });
    }
    lines.sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
    void t;
  }

  // ---------------------------------------------------------------- subject areas (Results and Entries; none in Value added)
  const blocks: AreaBlock[] = [];
  let grades: GradeBlock[] = [];
  if (mode !== "va") {
    const famMap = await cachedReference("smt:family-map:ks4", () => lookupAcademicSubjectFamilyMap({ ksStage: "ks4" }));
    const familyOf = new Map(famMap.map((r) => [r.raw_subject, r.family_id]));
    const labels = new Map(school.areas.gcse.map((a) => [a.id, a.label]));
    const mineNow = rows.filter((r) => r.urn === urn && r.period === subjYear && (!st.area || (r.familyId ?? familyOf.get(r.subject)) === st.area));
    for (const r of mineNow) {
      const id = r.familyId ?? familyOf.get(r.subject) ?? "other";
      let b = blocks.find((x) => x.id === id);
      if (!b) blocks.push((b = { id, label: labels.get(id) ?? id, quals: [] }));
      let q = b.quals.find((x) => x.qualification === r.qualification);
      if (!q) b.quals.push((q = { qualification: r.qualification, short: "GCSE", subjects: [] }));
      const counts = [subjYear - 2, subjYear - 1, subjYear].map((y) => rows.find((x) => x.urn === urn && x.period === y && x.qualification === r.qualification && x.subject === r.subject)?.entries ?? null);
      if (mode === "entries") {
        const share = (u: string) => {
          const tt = levelEntries(u, subjYear);
          const e = rows.find((x) => x.urn === u && x.period === subjYear && x.qualification === r.qualification && x.subject === r.subject)?.entries ?? 0;
          return tt && e ? (e / tt) * 100 : null;
        };
        const peers = gset.urns.map(share).filter((v): v is number => v !== null);
        const m = share(urn);
        q.subjects.push({ subject: r.subject, qualification: r.qualification, vicdata: false, entries: r.entries, counts, value: m, lo: null, hi: null, band: null, grade: null, setValues: peers, typical: median(peers), offering: { n: peers.length, of: gset.urns.length }, place: placeIn(new Map<string, number | null>([[urn, m], ...peers.map((v, i) => [`p${i}`, v] as [string, number])]), urn), only: peers.length === 0, size: null, ranked: true, why: null });
      } else {
        const small = r.entries < MIN_SUBJECT_ENTRIES;
        const peers = gset.urns.map((u) => rows.find((x) => x.urn === u && x.period === subjYear && x.qualification === r.qualification && x.subject === r.subject && x.entries >= MIN_SUBJECT_ENTRIES)?.avg ?? null).filter((v): v is number => v !== null);
        const value = small ? null : r.avg;
        q.subjects.push({ subject: r.subject, qualification: r.qualification, vicdata: false, entries: r.entries, counts, value, lo: null, hi: null, band: null, grade: null, setValues: peers, typical: null, offering: null, place: value === null ? null : placeIn(new Map<string, number | null>([[urn, value], ...peers.map((v, i) => [`p${i}`, v] as [string, number])]), urn), only: value !== null && peers.length === 0, size: null, ranked: value !== null, why: small ? smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES }) : r.avg === null ? smtNote("differentScale") : null });
      }
    }
    for (const b of blocks) for (const q of b.quals) q.subjects.sort((a, c) => c.entries - a.entries);
    blocks.sort((a, b) => sum(b.quals.flatMap((q) => q.subjects.map((s) => s.entries))) - sum(a.quals.flatMap((q) => q.subjects.map((s) => s.entries))));
    if (mode === "results") {
      const mine = await cachedReference(`smt:subjects:${urn}:ks4`, () => fetchSubjectLevelDataForSchools([urn], "ks4", { gradeYears: "four" }));
      let g = (mine.byUrn.get(urn)?.gradeDistribution ?? []).filter((r) => r.period === subjYear && /^GCSE \(9-1\) Full Course$/.test(r.qualificationType) && (!st.area || familyOf.get(r.subject) === st.area));
      const scale = TOP.find((t) => t.test.test("GCSE (9-1) Full Course"))!;
      const graded = new Set(scale.bands.flatMap((x) => x.grades));
      g = g.filter((x) => graded.has(x.grade));
      const total = sum(g.map((x) => x.entries));
      if (total) grades = [{ qualification: "GCSE (9-1) Full Course", short: "GCSE", entries: total, top: { label: scale.label, pct: (sum(g.filter((x) => scale.grades.includes(x.grade)).map((x) => x.entries)) / total) * 100 }, bands: scale.bands.map((b) => { const e = sum(g.filter((x) => b.grades.includes(x.grade)).map((x) => x.entries)); return { label: b.label, entries: e, pct: (e / total) * 100 }; }) }];
    }
  }

  // ---------------------------------------------------------------- trends
  const ys = years(mode === "va" ? HISTORIC_GRADE_FROM : mode === "results" ? HISTORIC_GRADE_FROM : Math.max(from, L - 2), L);
  const schoolPts = ys.map((y) => ({ year: y, value: fig(urn, y).value }));
  const bandPts = ys.map((y) => {
    const v = gset.urns.map((u) => fig(u, y).value).filter((x): x is number => x !== null);
    return { year: y, p25: percentile(v, 25), p75: percentile(v, 75), n: v.length };
  });
  const ch = boardRows.filter((r) => r.change !== null && !r.you).map((r) => ({ label: r.name, from: r.last, to: r.value, change: r.change!, unit }));
  const moves = [...ch.filter((x) => x.change > 0).sort((a, b) => b.change - a.change).slice(0, 3), ...ch.filter((x) => x.change < 0).sort((a, b) => a.change - b.change).slice(0, 3)];
  notes.middleHalf = smtNote("middleHalf", { setLabel: gset.label });
  notes.entries = smtNote("acEntries", { level: "GCSE" });
  notes.share = smtNote("acShare", { level: "GCSE" });
  notes.noGcseVa = smtNote("acNoGcseVaSubjects");
  notes.against = smtNote("acAgainst", { level: "GCSE" });

  return {
    urn,
    state: st,
    offer,
    igcse: !!school.phases.igcse,
    independent: school.independent,
    period: L,
    provisional: mode === "va" ? false : (school.latest.ks4?.provisional ?? false),
    set: { kind: gset.kind, label: gset.label, size: gset.urns.length, offering: stateSchools.length, chosen: gset.chosen, reachKm: gset.reachKm, urns: gset.urns },
    areaLabel,
    lines,
    col1: { title: mode === "va" ? "Value added now" : mode === "entries" ? "Entries now" : "Results now", sub: mode === "va" ? "GCSE · Progress 8" : `GCSE · ${periodLabel(L)}${mode === "entries" ? ` · ${levelEntries(urn, L).toLocaleString("en-GB")} entries` : ""}`, note: col1Note, summary },
    board,
    areas: { blocks, outside: [], none: mode === "va" ? smtNote("acNoGcseVaSubjects") : blocks.length ? null : smtNote("acNoFigure", { what: "subject" }), period: subjYear },
    grades,
    trends: {
      label: measureWord,
      unit,
      school: noP8 && mode === "va" ? [] : schoolPts,
      band: bandPts,
      schoolLabel: noP8 && mode === "va" ? null : (names[urn]?.name ?? null),
      note: mode === "va" ? smtNote("acP8Gap", { p8Last: periodLabel(PROGRESS8_LAST_PERIOD) }) : mode === "results" ? smtNote("acResultsFrom", { base: periodLabel(TREND_BASE_PERIOD), grading: periodLabel(GRADING_2122_PERIOD) }) : "",
      lines: lines.map((l) => ({ key: l.key, label: l.label, unit: l.unit, from: l.last, to: l.value, fromPeriod: l.lastPeriod, toPeriod: L })),
      moves,
      movesKind: "schools",
      mix: { keys: [], years: [], sentence: null },
      against: [],
    },
    notes,
  };
}

const fmtVa = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`);

/** For the page: the Post-16 chips this school sees (re-exported for the route's answer). */
export const chipsFor = (o: AcademicOffer): QualGroup[] => groupChips(o.groups);
