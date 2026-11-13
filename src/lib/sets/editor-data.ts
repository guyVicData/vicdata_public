// VicData 0.8 sets round 1 (C12-C16): what the set editor draws for a set, from public reference data.
// Server-only. For a focus school and a page (kind and entry point; Teacher's GCSE / Post-16 pages are
// 11+ / 16+), each school's row -- name, distance, sector, boarders, its pupils at the age that matters
// (rivals: the entry age; feeders: a year below it) and that count's trend -- and the suggestions: the
// nearest schools teaching that age, not in the set, narrowed by Independent / State / Both (and
// Boarding only), counted after the filter. Results cover GCSE (no IGCSE school) and Post-16, for
// "How close" (the client recomputes it live as schools are ticked: ./closeness.ts).
import { cachedCensus } from "../admissions/data";
import { feederFlags } from "../admissions/feeders";
import { nearbyCandidates } from "../admissions/rungs";
import { fetchSchoolTraits, type SchoolTraits } from "../admissions/traits";
import { loadThresholds, phaseForEntryAge } from "../admissions/thresholds";
import { cohortAt } from "../admissions/cohort";
import { headlinePopulation } from "../admissions/ranks";
import { latestResults } from "../admissions/rivals";
import { igcseAmong } from "../igcse";
import { CURRENT_CENSUS_PERIOD } from "../roll-data";
import type { EntryPoint } from "../admissions/entry-points";
import type { SetKind } from "./model";

export const SUGGESTIONS_SHOWN = 10;
export const SUGGESTIONS_STEP = 5;

export type EditorRow = {
  urn: string;
  name: string;
  km: number | null;
  sector: "state" | "independent";
  boarding: boolean;
  gender: "mixed" | "girls" | "boys";
  laName: string | null;
  laCode: string | null;
  town: string | null;
  /** Pupils at the age that matters, in the latest census. */
  pupils: number | null;
  /** That count's trend over two years, by the feeder flag rules: "falling" / "rising" / null. */
  trend: "falling" | "rising" | null;
  changePct: number | null;
  hasGcse: boolean;
  hasPost16: boolean;
  igcse: boolean;
  easting: number | null;
  northing: number | null;
  // 0.8 front door part 2 (D22, additive: the round-1 editor ignores them): what the guided editor's
  // chips and "This set now" read.
  /** Statutory age range (GIAS), for the feeder kinds (Primary, Junior, Prep) and "Has Year 6". */
  low: number | null;
  high: number | null;
  /** The whole-school roll in the latest census (full-time pupils 4+, nursery headcount), for "Similar size". */
  roll: number | null;
  /** The latest GCSE headline (Attainment 8), null for an IGCSE school or none published. */
  gcse: number | null;
  /** The latest post-16 headline (A-level points per entry), null if none published. */
  post16: number | null;
};

export type EditorData = {
  kind: SetKind;
  entry: string;
  age: number;
  period: number;
  focus: (EditorRow & { roll: null }) | null;
  rows: EditorRow[];
  suggestions: EditorRow[];
  /** How many fit the suggestion filter in all (before showing `n`). */
  suggestionsTotal: number;
};

/** The whole-school roll in a census year: every age's pupils (the cohort table's definition). */
function rollAt(table: Map<number, Map<number, { male: number; female: number }>> | undefined, period: number): number | null {
  const byAge = table?.get(period);
  if (!byAge) return null;
  let n = 0;
  for (const c of byAge.values()) n += c.male + c.female;
  return n > 0 ? n : null;
}

const holds = (t: { low: number | null; high: number | null }, age: number) => (t.low ?? 99) <= age && (t.high ?? -1) >= age;
const km = (a: SchoolTraits | undefined, b: SchoolTraits | undefined) => (a?.easting == null || a.northing == null || b?.easting == null || b.northing == null ? null : Math.round((Math.hypot(a.easting - b.easting, a.northing - b.northing) / 1000) * 10) / 10);

/** `wide` (the guided editor, D22): feeders are every school teaching any age from Reception to the
 * year before entry, so "Has Year 6" is a chip rather than a rule; compared-against sets are unchanged. */
export type SuggestionFilter = { sector: "all" | "state" | "independent"; boardingOnly: boolean; n: number; wide?: boolean };

export async function editorData(urn: string, ep: EntryPoint, kind: SetKind, urns: string[], f: SuggestionFilter): Promise<EditorData> {
  const age = kind === "feeders" ? Math.max(4, ep.age - 1) : ep.age;
  const near = await nearbyCandidates(urn);
  const traits = await fetchSchoolTraits(Array.from(new Set([urn, ...urns, ...near.map((c) => c.urn)])));
  const me = traits.get(urn);
  const inSet = new Set(urns);
  // Wide feeders: some age from Reception to the year before entry, and not a secondary (a prep to 13 is in).
  const teachesUpTo = (t: SchoolTraits) => (t.low ?? 99) <= age && (t.high ?? -1) >= 4 && (t.high ?? 99) <= Math.max(age, 13);
  const teaching = (t: SchoolTraits) => t.urn !== urn && (f.wide && kind === "feeders" ? teachesUpTo(t) : holds(t, age) && (kind === "feeders" || holds(t, age + 1)));
  const pool = Array.from(traits.values())
    .filter((t) => !inSet.has(t.urn) && teaching(t))
    .filter((t) => (f.sector === "all" ? true : t.sector === f.sector))
    .filter((t) => (f.boardingOnly ? t.boarding : true))
    .map((t) => ({ t, d: km(me, t) }))
    .sort((a, b) => (a.d ?? 1e9) - (b.d ?? 1e9));
  const shown = pool.slice(0, Math.max(1, Math.min(f.wide ? 120 : 60, f.n)));
  const all = Array.from(new Set([urn, ...urns, ...shown.map((x) => x.t.urn)]));
  const [census, thresholds, k4, k5, ig] = await Promise.all([cachedCensus(all), loadThresholds(), latestResults("ks4"), latestResults("ks5"), igcseAmong(all)]);
  const [p4, p5] = await Promise.all([k4.period === null ? null : headlinePopulation("ks4", k4.period), k5.period === null ? null : headlinePopulation("ks5", k5.period)]);
  const P = CURRENT_CENSUS_PERIOD;
  const minCohort = thresholds?.get(phaseForEntryAge(ep.age), "entry_cohort")?.minCohort ?? 10;
  const flags = new Map(feederFlags(new Map(all.map((u) => [u, census.get(u)?.table ?? new Map()])), [age], P, minCohort).map((x) => [x.urn, x]));
  const rowOf = (u: string): EditorRow => {
    const t = traits.get(u);
    const fl = flags.get(u);
    const flag = fl?.flag ?? null;
    return {
      urn: u,
      name: t?.name ?? u,
      km: km(me, t),
      sector: t?.sector ?? "state",
      boarding: t?.boarding ?? false,
      gender: t?.gender ?? "mixed",
      laName: t?.laName ?? null,
      laCode: t?.laCode ?? null,
      town: t?.town ?? null,
      pupils: cohortAt(census.get(u)?.table ?? new Map(), age, P),
      // The existing feeder trend rule (flags.ts feederFlag): falling faster than the set's area, or rising.
      trend: flag?.id === "feeder_red" ? "falling" : flag?.id === "feeder_focus" && flag.label === "Rising" ? "rising" : null,
      changePct: fl?.from && fl.to !== null ? Math.round(((fl.to - fl.from) / fl.from) * 1000) / 10 : null,
      hasGcse: !ig.has(u) && k4.period !== null && p4?.get(u)?.get(k4.period) !== undefined,
      hasPost16: k5.period !== null && p5?.get(u)?.get(k5.period) !== undefined,
      igcse: ig.has(u),
      easting: t?.easting ?? null,
      northing: t?.northing ?? null,
      low: t?.low ?? null,
      high: t?.high ?? null,
      roll: rollAt(census.get(u)?.table, P),
      gcse: ig.has(u) || k4.period === null ? null : (p4?.get(u)?.get(k4.period) ?? null),
      post16: k5.period === null ? null : (p5?.get(u)?.get(k5.period) ?? null),
    };
  };
  return {
    kind,
    entry: ep.id,
    age,
    period: P,
    focus: me ? { ...rowOf(urn), roll: null } : null,
    rows: urns.filter((u) => traits.has(u)).map(rowOf),
    suggestions: shown.map((x) => rowOf(x.t.urn)),
    suggestionsTotal: pool.length,
  };
}
