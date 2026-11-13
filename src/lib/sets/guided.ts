// VicData 0.8 front door, part 2 (D21-D22, R-GUIDED-SETS): the guided sets editor's model, pure.
// One screen that asks the set's question ("Who feeds us at 11+?", "Who do we compete with at 11+?",
// SMT's "Who do we measure ourselves against?"), with a map, "In your set", "Add schools" (search, filter
// chips with counts, suggestions nearest first) and "This set now", live as schools are ticked.
//
// Same model and permissions as round 1: a guided set is a stored set (public.sets, set_members), saved
// through the round-1 library (store.ts saveSet -> save_set), its Main feeders / Close rivals the
// round-1 `main` tier. This module only decides what the screen shows; it never reads or writes.
//
// Chips: within a group (sector, kind of school, entry year, day/boarding, gender, size) a school passes
// if it has ANY selected chip; across groups it must pass EVERY group with a selection; a group with
// nothing selected doesn't narrow. Each chip's count is the suggestions it would show with the other
// groups as they are (faceted), within the "Suggest within" distance. The map draws exactly the
// suggestions the list holds.
import { resultsMeasureFor, type ResultsMeasure } from "./results-coverage";
import { median } from "./closeness";
import type { SetKind, Tier } from "./model";

/** The three questions the editor asks. */
export type GuidedKind = "feeders" | "rivals" | "smt";

export const guidedKindOf = (kind: SetKind, product: "admissions" | "smt" | "teacher" | string): GuidedKind => (kind === "feeders" ? "feeders" : product === "smt" ? "smt" : "rivals");

/** The map's distance rings, and the "Suggest within" slider (km). */
export const RINGS_KM = [5, 10, 15] as const;
export const SUGGEST_KM = { min: 2, max: 30, start: 15 } as const;
/** "Similar size": a whole-school roll from two-thirds to one and a half times the school's own. */
export const SIMILAR_SIZE_BAND = { low: 2 / 3, high: 1.5 } as const;
/** "In your set" and the suggestions show this many before "n more…". */
export const LIST_SHOWN = 5;

/** The fields the guided editor reads from a row of the editor route (editor-data.ts EditorRow). */
export type GuidedRow = {
  urn: string;
  name: string;
  km: number | null;
  sector: "state" | "independent";
  boarding: boolean;
  gender: "mixed" | "girls" | "boys";
  low: number | null;
  high: number | null;
  roll: number | null;
  gcse: number | null;
  post16: number | null;
  igcse: boolean;
  hasGcse: boolean;
  hasPost16: boolean;
  easting: number | null;
  northing: number | null;
};

export type ChipId = "state" | "independent" | "primary" | "junior" | "prep" | "entry_year" | "day" | "boarding" | "mixed" | "girls" | "boys" | "similar_size";
type ChipGroup = "sector" | "type" | "entry" | "board" | "gender" | "size";
const GROUP_OF: Record<ChipId, ChipGroup> = { state: "sector", independent: "sector", primary: "type", junior: "type", prep: "type", entry_year: "entry", day: "board", boarding: "board", mixed: "gender", girls: "gender", boys: "gender", similar_size: "size" };

/** The age the editor looks at: a feeder's pupils a year below entry (Year 6 at 11+), a rival's at entry. */
export const feederAgeOf = (entryAge: number) => Math.max(3, entryAge - 1);

/** "Year 6" for age 10 (ages at 31 August): Reception is 4, Nursery below. */
export const yearWord = (age: number) => (age >= 5 ? `Year ${age - 4}` : age === 4 ? "Reception" : "Nursery");

/** A feeder's kind: an independent school is a prep; a state school starting at 7 or later a junior; else a primary. */
export function feederType(r: Pick<GuidedRow, "sector" | "low">): "primary" | "junior" | "prep" {
  if (r.sector === "independent") return "prep";
  return (r.low ?? 0) >= 7 ? "junior" : "primary";
}

export type GuidedFocus = { sector: "state" | "independent"; gender: "mixed" | "girls" | "boys"; boarding: boolean; roll: number | null; gcse: number | null; post16: number | null };

/** The chips in the order they're drawn. */
export function chipsFor(g: GuidedKind, entryAge: number): { id: ChipId; label: string }[] {
  if (g === "feeders")
    return [
      { id: "state", label: "State" },
      { id: "independent", label: "Independent" },
      { id: "primary", label: "Primary" },
      { id: "junior", label: "Junior" },
      { id: "prep", label: "Prep" },
      { id: "entry_year", label: `Has ${yearWord(feederAgeOf(entryAge))}` },
    ];
  return [
    { id: "independent", label: "Independent" },
    { id: "state", label: "State" },
    { id: "day", label: "Day" },
    { id: "boarding", label: "Boarding" },
    { id: "mixed", label: "Mixed" },
    { id: "girls", label: "Girls" },
    { id: "boys", label: "Boys" },
    { id: "similar_size", label: "Similar size" },
  ];
}

/** Suggestions start pre-filtered to the school's own profile. Feeders: the entry year, and State (a
 * state school) or both sectors (an independent one, whose pupils come from both). Rivals and SMT: the
 * school's own sector and gender, and a similar size when its roll is known. */
export function defaultChips(g: GuidedKind, focus: GuidedFocus | null): ChipId[] {
  if (g === "feeders") return focus?.sector === "independent" ? ["state", "independent", "entry_year"] : ["state", "entry_year"];
  if (!focus) return [];
  return [focus.sector, focus.gender, ...(focus.roll ? (["similar_size"] as ChipId[]) : [])];
}

export type ChipContext = { focus: GuidedFocus | null; entryAge: number; maxKm: number };

function has(r: GuidedRow, chip: ChipId, ctx: ChipContext): boolean {
  switch (chip) {
    case "state":
    case "independent":
      return r.sector === chip;
    case "primary":
    case "junior":
    case "prep":
      return feederType(r) === chip;
    case "entry_year": {
      const a = feederAgeOf(ctx.entryAge);
      return (r.low ?? 99) <= a && (r.high ?? -1) >= a;
    }
    case "day":
      return !r.boarding;
    case "boarding":
      return r.boarding;
    case "mixed":
    case "girls":
    case "boys":
      return r.gender === chip;
    case "similar_size": {
      const mine = ctx.focus?.roll;
      return !!mine && r.roll !== null && r.roll >= mine * SIMILAR_SIZE_BAND.low && r.roll <= mine * SIMILAR_SIZE_BAND.high;
    }
  }
}

const within = (r: GuidedRow, maxKm: number) => r.km !== null && r.km <= maxKm;

function passes(r: GuidedRow, selected: readonly ChipId[], ctx: ChipContext): boolean {
  const groups = new Map<ChipGroup, ChipId[]>();
  for (const c of selected) groups.set(GROUP_OF[c], [...(groups.get(GROUP_OF[c]) ?? []), c]);
  for (const chips of groups.values()) if (!chips.some((c) => has(r, c, ctx))) return false;
  return true;
}

/** The suggestions the chips and the distance leave, nearest first. */
export function applyChips(rows: GuidedRow[], selected: readonly ChipId[], ctx: ChipContext): GuidedRow[] {
  return rows.filter((r) => within(r, ctx.maxKm) && passes(r, selected, ctx)).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9) || a.name.localeCompare(b.name));
}

/** Each chip's count: the suggestions it would show, its own group set to it alone, the others as they are. */
export function chipCounts(rows: GuidedRow[], selected: readonly ChipId[], ctx: ChipContext, chips: readonly ChipId[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const c of chips) {
    const others = selected.filter((s) => GROUP_OF[s] !== GROUP_OF[c]);
    out[c] = rows.filter((r) => within(r, ctx.maxKm) && passes(r, [...others, c], ctx)).length;
  }
  return out;
}

export const toggleChip = (selected: readonly ChipId[], c: ChipId): ChipId[] => (selected.includes(c) ? selected.filter((x) => x !== c) : [...selected, c]);

/** The title, the one line under it, and the main tier's words, for each question. */
export function guidedWords(g: GuidedKind, entry: string, o: { phaseWord?: string } = {}) {
  if (g === "feeders")
    return {
      title: `Who feeds us at ${entry}?`,
      explain: "Tick the schools that send you pupils. We’ve suggested schools nearby that teach the year before entry; dashed rings show distance.",
      mainWord: "Main",
      markMain: "Mark main feeders",
      mainLegend: "Main feeder",
      noun: "feeders",
    };
  if (g === "rivals")
    return {
      title: `Who do we compete with at ${entry}?`,
      explain: "Tick the schools families weigh you against. We’ve suggested nearby schools with a similar profile to yours.",
      mainWord: "Close",
      markMain: "Mark close rivals",
      mainLegend: "Close rival",
      noun: "rivals",
    };
  return {
    title: "Who do we measure ourselves against?",
    explain: `Tick the schools you compare your results and roll with${o.phaseWord ? ` at ${o.phaseWord}` : ""}. We’ve suggested nearby schools with a similar profile to yours.`,
    mainWord: "Close",
    markMain: "Mark close matches",
    mainLegend: "Close match",
    noun: "schools",
  };
}

/** A row's second line: "1.8 km · Independent prep", "2.0 km · Independent, day", "· girls" when not mixed. */
export function describe(r: Pick<GuidedRow, "km" | "sector" | "boarding" | "gender" | "low">, g: GuidedKind): string {
  const km = r.km === null ? "distance unknown" : `${r.km.toFixed(1)} km`;
  const sector = r.sector === "independent" ? "Independent" : "State";
  const gender = r.gender === "mixed" ? "" : `, ${r.gender}`;
  if (g === "feeders") return `${km} · ${sector} ${feederType(r)}${gender}`;
  return `${km} · ${sector}, ${r.boarding ? "boarding" : "day"}${gender}`;
}

export type SetNow = {
  schools: number;
  /** Range and median of the located schools' distances (km). */
  km: { min: number; max: number; median: number; located: number } | null;
  /** Feeders: state · independent. Rivals and SMT: day · boarding. */
  mix: { a: number; b: number; aWord: string; bWord: string };
  /** Main feeders / close rivals. */
  main: number;
  /** Rivals and SMT: the set's average headline against the school's, on the measure the shared IGCSE
   * rule picks (results-coverage.ts, IGCSE_SWITCH_SHARE), and how many sit IGCSE. */
  results: { measure: ResultsMeasure["measure"]; switched: boolean; avg: number | null; withFigure: number; you: number | null; igcse: number } | null;
};

/** "This set now", exact for the ticked schools. */
export function setNow(g: GuidedKind, rows: GuidedRow[], tiers: Record<string, Tier | null>, focus: GuidedFocus | null, entryAge: number): SetNow {
  const kms = rows.map((r) => r.km).filter((k): k is number => k !== null);
  const feeders = g === "feeders";
  const mix = feeders
    ? { a: rows.filter((r) => r.sector === "state").length, b: rows.filter((r) => r.sector === "independent").length, aWord: "state", bWord: "independent" }
    : { a: rows.filter((r) => !r.boarding).length, b: rows.filter((r) => r.boarding).length, aWord: "day", bWord: "boarding" };
  let results: SetNow["results"] = null;
  if (!feeders) {
    const rm = resultsMeasureFor(entryAge, rows.map((r) => ({ urn: r.urn, hasGcse: r.hasGcse, hasPost16: r.hasPost16, igcse: r.igcse })));
    const measure = rm.measure === "ks2" ? "gcse" : rm.measure;
    const vals = rows.map((r) => (measure === "post16" ? r.post16 : r.gcse)).filter((v): v is number => v !== null);
    results = {
      measure,
      switched: rm.switched,
      avg: vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null,
      withFigure: vals.length,
      you: focus ? (measure === "post16" ? focus.post16 : focus.gcse) : null,
      igcse: rows.filter((r) => r.igcse).length,
    };
  }
  return {
    schools: rows.length,
    km: kms.length ? { min: Math.min(...kms), max: Math.max(...kms), median: Math.round(median(kms)! * 10) / 10, located: kms.length } : null,
    mix,
    main: rows.filter((r) => tiers[r.urn] === "main").length,
    results,
  };
}

/** The results words under "This set now": "48.2 avg Attainment 8 (you 51.0) · 3 sit IGCSE". */
export function resultsWords(r: NonNullable<SetNow["results"]>): { figure: string; words: string } {
  const what = r.measure === "post16" ? "avg A-level points per entry" : "avg Attainment 8";
  const you = r.you === null ? "" : ` (you ${r.you.toFixed(1)})`;
  const ig = r.igcse ? ` · ${r.igcse} sit IGCSE` : "";
  const sw = r.switched ? " · most have no GCSE results, so post-16" : "";
  return { figure: r.avg === null ? "—" : r.avg.toFixed(1), words: `${what}${you}${ig}${sw}` };
}

/** The default name of a new set for each question. */
export const newSetName = (g: GuidedKind) => (g === "feeders" ? "Our feeders" : g === "rivals" ? "Our rivals" : "Our comparison set");

/** The guided editor's address (the homes' sets cards, the library's links). */
export function guidedHref(o: { urn: string; kind: SetKind; product: "admissions" | "smt"; entry?: string | null; phase?: "ks4" | "ks5" | null; set?: string | null; fromHome?: boolean }): string {
  const q = new URLSearchParams({ urn: o.urn, kind: o.kind, product: o.product });
  if (o.product === "smt") q.set("phase", o.phase ?? "ks4");
  else q.set("entry", o.entry ?? "11+");
  if (o.set) q.set("set", o.set);
  if (o.fromHome) q.set("from", "home");
  return `/sets/guided?${q}`;
}
