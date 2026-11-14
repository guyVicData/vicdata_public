// VicData 0.8 non-mainstream groups (Guy's NM1-NM12, 13 Nov; production build 7): special and AP trusts
// and nursery federations, compared like for like. Pure and client-safe: the line and the families, the
// words for kinds of school, the (i)s, the set rule (R-NM-SETS) and a school's placing against its
// region's pool of its own kind (NM11, R-NM-OWN-SCHOOLS). Every figure is production's; this module only
// picks and words them.
//
//   the line      more than half of a group's current schools special, AP, PRU or nursery (NM1, R-NM-LINE);
//                 production decides it (group.kind / card.kind) and the app never recomputes it.
//   families      special_ap (special and AP trusts) and nursery (nursery federations), each with its own
//                 pools and peer sets (NM3, NM4); the one tie (The Orchards) is special_ap.
//   measures      roll, its same-schools change and FSM; no results (NM5, NM7, R-NM-NO-RESULTS).
//   nursery FSM   only ever against nursery figures (R-NM-FSM-NURSERY).
import type { ComparisonRow, Figures, GroupKind, SchoolKind, SchoolYearFigures } from "./aggregates";

export type Family = "mainstream" | "special_ap" | "nursery";
export type PoolKind = "special" | "ap" | "nursery";

export const isNonMainstream = (kind: string | null | undefined): kind is "special_ap" | "nursery" => kind === "special_ap" || kind === "nursery";
/** A group's family (mainstream when production says nothing: builds before 7 had only mainstream cards). */
export const familyOf = (kind: string | null | undefined): Family => (isNonMainstream(kind) ? kind : "mainstream");

export const FAMILY_PLURAL: Record<Family, string> = { mainstream: "Mainstream groups", special_ap: "Special and AP trusts", nursery: "Nursery federations" };
export const FAMILY_ONE: Record<Family, string> = { mainstream: "mainstream group", special_ap: "special and AP trust", nursery: "nursery federation" };
/** The peer sets' plural, as production labels them ("Special and AP trusts with 2-5 schools", "All nursery federations"). */
export const FAMILY_PEER_PLURAL: Record<"special_ap" | "nursery", string> = { special_ap: "special and AP trusts", nursery: "nursery federations" };

/** The kinds of school, in the order a group's schools are listed: [tag, one, many]. */
export const SCHOOL_KIND_WORDS: Record<SchoolKind, [string, string, string]> = {
  special: ["Special", "special school", "special schools"],
  ap: ["AP", "alternative provision", "alternative provision"],
  pru: ["PRU", "pupil referral unit", "pupil referral units"],
  nursery: ["Nursery", "nursery school", "nursery schools"],
  mainstream: ["Mainstream", "mainstream school", "mainstream schools"],
};
const KIND_ORDER: SchoolKind[] = ["special", "ap", "pru", "nursery", "mainstream"];

/** "21 special · 1 AP · 1 mainstream" (a card's line), or the long form "21 special schools, 1 alternative
 * provision and 1 mainstream school". */
export function schoolsByKindWords(by: Partial<Record<SchoolKind, number>> | null | undefined, long = false): string {
  const parts = KIND_ORDER.filter((k) => (by?.[k] ?? 0) > 0).map((k) => {
    const n = by![k]!;
    const [tag, one, many] = SCHOOL_KIND_WORDS[k];
    return long ? `${n} ${n === 1 ? one : many}` : `${n} ${k === "special" || k === "mainstream" || k === "nursery" ? tag.toLowerCase() : tag}`;
  });
  if (!parts.length) return long ? "No schools" : "—";
  if (!long) return parts.join(" · ");
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}` : parts[0];
}

/** The pools' words (production's pool_kinds), for the (i) and the tables' labels. */
export const POOL_WORDS: Record<PoolKind, { plural: string; england: string }> = {
  special: { plural: "state-funded special schools", england: "England's state-funded special schools" },
  ap: { plural: "state-funded alternative provision and PRUs", england: "England's state-funded alternative provision and PRUs" },
  nursery: { plural: "state-funded nursery schools", england: "England's state-funded nursery schools" },
};
/** A school's kind to the pool it is placed in (AP and PRUs share one pool). */
export const poolKindOf = (k: SchoolKind | null | undefined): PoolKind | null => (k === "special" ? "special" : k === "ap" || k === "pru" ? "ap" : k === "nursery" ? "nursery" : null);

// ------------------------------------------------------------------------------------- the (i)s

export const NM_NOTES = {
  line: "A group is listed here when more than half of its current schools are special schools, alternative provision, pupil referral units or nursery schools. It is compared only with groups of its own kind (special and AP trusts, or nursery federations) and with pools of state-funded schools of the same kinds, never with mainstream schools. A group at exactly half stays with the mainstream groups.",
  families: "Two families: special and AP trusts (special schools, alternative provision and PRUs; peer sets of 2–5, 6–10 and 11+ schools) and nursery federations (one peer set). A group with as many nursery schools as special and AP schools is a special and AP trust.",
  stateFunded: "Pools are state-funded schools only: special schools (not non-maintained or independent special schools, or special post-16 institutions), alternative provision academies and free schools and PRUs, and LA nursery schools. Pools by LA exist for special schools only.",
  nurseryFsm: "Nursery FSM is compared only with nurseries: an under-5 qualifies for free school meals only on a full-day place, so a nursery school's share (about 10% in England) measures something different from a school's (about 50% in special schools).",
  fsm: "FSM is pupil-weighted: pupils eligible for free school meals over the pupils counted, across the schools (DfE's school census). Peer places rank the highest FSM first.",
  roll: "Roll change is like for like: only schools with a roll in both years. Special and AP rolls follow the places LAs commission, so growth means places commissioned, not parents' choice.",
  line2: "Its mainstream schools are in their own mainstream line, compared with mainstream schools as any mainstream group is; the group's own figures are over its special, AP and nursery schools.",
} as const;

/** "57 of these 140 groups have two schools: …" (the small-groups (i)). */
export function smallGroupsWords(two: number, of: number): string {
  return `${two} of these ${of} groups have two schools: a group's figure is then close to one school's.`;
}

/** R-NM-NO-RESULTS: the state shown in place of every results tile and trend. */
export function noResultsWords(family: "special_ap" | "nursery"): { title: string; reason: string[] } {
  if (family === "nursery") {
    return { title: "Results aren't compared for nursery schools", reason: ["Nursery schools take no key stage tests, so there are no results to compare.", "Roll, its change and FSM (against nursery figures only) are compared instead."] };
  }
  return {
    title: "Results aren't compared for special and AP schools",
    reason: [
      "KS2 reading, writing and maths is 0% at 630 of the 652 special schools with a figure: most pupils work below the test standard, so 0% is the expected result, not a measure.",
      "DfE publishes no school-level KS4 results for alternative provision or PRUs, only figures by LA.",
      "Progress 8 ends with 2023/24 (no KS2 baseline after it).",
      "Later: Attainment 8 school by school within the same need type, once primary need is in VicData.",
    ],
  };
}

// ----------------------------------------------------------------------------- the set rule

/** R-NM-SETS: a set of groups holds groups of one family, and our own group's: a non-mainstream group is
 * never in a set with a mainstream group, by any route (the picker, the editor's Add groups, Add to set…).
 * The two non-mainstream families don't mix either (nursery FSM is never set beside school FSM). */
export function setRefusal(ours: string | null | undefined, candidate: string | null | undefined, candidateName = "This group"): string | null {
  const a = familyOf(ours);
  const b = familyOf(candidate);
  if (a === b) return null;
  const plural = { mainstream: "mainstream groups", special_ap: "special and AP trusts", nursery: "nursery federations" }[a];
  return `${candidateName} is ${b === "mainstream" ? "a mainstream group" : `a ${FAMILY_ONE[b]}`}: ${plural} are compared only with ${plural}.`;
}
/** The groups of a list a set may hold beside ours (the rest refused). */
export const sameFamily = <T extends { kind?: string | null }>(ours: string | null | undefined, cards: T[]): T[] => cards.filter((c) => familyOf(c.kind) === familyOf(ours));

// ------------------------------------------------------------------------------- the library card

const pct1 = (v: number) => `${v.toFixed(1)}%`;
const signed1 = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1)}%`;

/** "FSM 53.4% · state-funded special schools, England 50.9%" (the card's kind: its main kind's England). */
export function cardFsmWords(c: { fsm?: { pct: number | null; main_kind?: PoolKind; england: number | Partial<Record<PoolKind, number>> | null } | null }): string {
  const f = c.fsm;
  if (!f || f.pct === null || f.pct === undefined) return "FSM not published";
  const k = f.main_kind;
  const eng = typeof f.england === "object" && f.england && k ? f.england[k] : null;
  return `FSM ${pct1(f.pct)}${k && eng !== null && eng !== undefined ? ` · ${POOL_WORDS[k].plural}, England ${pct1(eng)}` : ""}`;
}

/** "2,808 pupils · +38.6% over 3 years, same schools" (NM5: the same-schools change). */
export function cardRollWords(c: { roll: number; change_3?: { same_schools_pct: number | null } | null }): string {
  const ch = c.change_3?.same_schools_pct;
  return `${c.roll.toLocaleString("en-GB")} pupils${ch !== null && ch !== undefined ? ` · ${signed1(ch)} over 3 years, same schools` : ""}`;
}

/** The size bands of each family (production's non_mainstream.size_bands; nursery federations have none). */
export const NM_BANDS = ["2–5", "6–10", "11+"] as const;
export const nmBandOf = (schools: number): string => (schools <= 5 ? "2–5" : schools <= 10 ? "6–10" : "11+");

// ----------------------------------------------------------------------- a school's placing (NM11)

export type Placing = {
  kind: PoolKind;
  tag: string;
  pool: { label: string; n: number; tooFew: boolean } | null;
  fsm: { school: number | null; pool: number | null };
  change: { school: number | null; pool: number | null; years: 3 };
};

/** The pool rows of one kind and area at the latest period (production's `pools` kind, phase "all"). */
export function poolAt(comps: ComparisonRow[], setId: string, period: number, reading: "at_time" | "listed_now"): Figures | null {
  const rows = comps.filter((r) => r.kind === "pools" && r.set_id === setId && r.phase === "all" && r.reading === reading);
  return (rows.find((r) => r.period === period) ?? null)?.figures ?? null;
}

/** A special, AP, PRU or nursery school placed against its region's state-funded pool of its kind: its
 * FSM (DfE's own %) and its 3-year roll change, beside the pool's (pupil-weighted FSM; like-for-like
 * change). R-MIN-SCHOOLS: a pool under 5 schools is withheld. Null for a mainstream school. */
export function placeSchool(f: SchoolYearFigures | null, regionCode: string | null, comps: ComparisonRow[], period: number, reading: "at_time" | "listed_now"): Placing | null {
  const kind = f ? (f.pool_kind ?? poolKindOf(f.kind)) : null;
  if (!f || !kind) return null;
  const pool = regionCode ? poolAt(comps, `region:${kind}:${regionCode}`, period, reading) : null;
  const label = pool ? (comps.find((r) => r.kind === "pools" && r.set_id === `region:${kind}:${regionCode}`)?.label ?? null) : null;
  const n = pool?.n_schools ?? 0;
  const tooFew = !!pool && n < 5;
  return {
    kind,
    tag: SCHOOL_KIND_WORDS[f.kind ?? (kind === "ap" ? "ap" : kind)][0],
    pool: pool && label ? { label, n, tooFew } : null,
    fsm: { school: f.fsm?.pct ?? null, pool: pool && !tooFew ? (pool.fsm?.pct ?? null) : null },
    change: { school: f.trend?.["3"] ?? null, pool: pool && !tooFew ? (pool.change?.["3"]?.same_schools_pct ?? null) : null, years: 3 },
  };
}

/** "Special · FSM 47.5% (region 53.8%) · roll +16.8% (region +14.9%) over 3 years" for the Schools table. */
export function placingWords(p: Placing): string {
  const f = p.fsm.school === null ? "FSM not published" : `FSM ${pct1(p.fsm.school)}${p.fsm.pool !== null ? ` (region ${pct1(p.fsm.pool)})` : ""}`;
  const c = p.change.school === null ? null : `roll ${signed1(p.change.school)}${p.change.pool !== null ? ` (region ${signed1(p.change.pool)})` : ""} over 3 years`;
  return [p.tag, f, c].filter(Boolean).join(" · ");
}

/** The kind lines a mainstream group has (production writes one only at 5+ current schools of a kind). */
export const KIND_LINE_MIN = 5;
export function kindLinesOf(f: Figures | null | undefined): { kind: PoolKind; figures: Figures }[] {
  const k = f?.kind_lines;
  if (!k) return [];
  return (["special", "ap", "nursery"] as PoolKind[]).filter((x) => k[x] && (k[x]!.n_schools ?? 0) >= KIND_LINE_MIN).map((x) => ({ kind: x, figures: k[x]! }));
}

export type { GroupKind };
