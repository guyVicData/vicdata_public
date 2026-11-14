// VicData 0.8 group sets, M3: the groups library -- every listed group as a card, for a head office to
// find the groups it could compare with (brief v2 §4; Guy's D5, D7, LF3, N2). Pure and client-safe: the
// cards come from production's group_index_lookup (src/lib/groups/aggregates.ts groupIndex), and this
// module words them, filters them and puts them in order. R-GROUP-LIBRARY.
//
//   listed      production lists MATs, federations, foundation trusts and independent groups with 2+
//               current schools, each body once; our own group is never a card.
//   section     0.8 non-mainstream groups (NM10): groups more than half special, AP, PRU or nursery are
//               a separate section, "Special, AP and nursery groups" (production's non_mainstream list),
//               filtered by family (special and AP trusts, nursery federations) and their own size bands;
//               their cards show schools by kind, roll and same-schools change, and FSM against their
//               kind's England figure, never a result. R-GROUP-LIBRARY, R-NM-LINE.
//   groups like us   (the default) same type, our own peer set first, then nearest in size.
//   region      "Most schools in" by default (a tie counts in each tied region); "Has a school in" as a
//               toggle. Cards name the main region first: "London · also South East, East".
//   headline    roll and its 3-year change, and one results headline for the phase in view against
//               England (the group's sector's England); on All phases the group's main phase, labelled.
//               An independent group with none published reads "Results not published".
import { displayName, PEER_PLURAL, REGION_NAMES, type Focus } from "./dash";
import { familyOf, NM_BANDS, nmBandOf } from "./non-mainstream";

export type IndexHeadline = { measure: string; period: number | null; weighted: number | null; average_school?: number | null; n_with_figure: number; england: number | null };
export type IndexCard = {
  group_id: string;
  name: string;
  type: string;
  source: string;
  schools: number;
  likely: number;
  census: number;
  regions: Record<string, number>;
  schools_by_phase: Record<"primary" | "secondary" | "post16", number>;
  roll_by_phase: Record<"primary" | "secondary" | "post16", number>;
  main_phase: "primary" | "secondary" | "post16" | null;
  roll: number;
  change_3: { from_period: number | null; combined_pct: number | null; same_schools_pct: number | null; same_schools: number | null };
  headline: Partial<Record<"primary" | "secondary" | "post16", IndexHeadline>>;
  peer: { set_id: string; type: string; band: string; n_groups: number } | null;
  /** 0.8 non-mainstream groups (build 7). A mainstream card's fsm.england is one number; a non-mainstream
   * card's is by kind, for each kind it has (a nursery federation's only ever the nursery figure). */
  kind?: "mainstream" | "special_ap" | "nursery";
  schools_by_kind?: Partial<Record<"mainstream" | "special" | "ap" | "pru" | "nursery", number>>;
  fsm?: { pct: number | null; n_with_figure: number; main_kind?: "special" | "ap" | "nursery"; england: number | Partial<Record<"special" | "ap" | "nursery", number>> | null } | null;
  has_mainstream_line?: boolean;
};
/** groups: the mainstream cards, as before; non_mainstream: the special, AP and nursery groups (build 7). */
export type GroupIndex = { build: { build_id: number; computed_at: string } | null; groups: IndexCard[]; non_mainstream?: IndexCard[] };

export const LIBRARY_TYPES = ["mat", "federation", "foundation_trust", "independent_company", "independent_charity", "independent_other"] as const;
export const TYPE_WORD: Record<string, string> = {
  mat: "MAT",
  federation: "Federation",
  foundation_trust: "Foundation trust",
  independent_company: "Independent company",
  independent_charity: "Independent charity",
  independent_other: "Other independent group",
};
export const TYPE_PLURAL_WORD: Record<string, string> = { mat: "MATs", federation: "Federations", foundation_trust: "Foundation trusts", independent_company: "Independent companies", independent_charity: "Independent charities", independent_other: "Other independent groups" };
const PHASE_WORD = { primary: "Primary", secondary: "Secondary", post16: "Post-16" } as const;
const MEASURE_WORD: Record<string, string> = { ks4_a8: "A8", ks5_aps_alevel: "A-level points", ks2_rwm: "KS2 RWM" };
const SIZE_BANDS: [number, number, string][] = [[2, 5, "2–5"], [6, 10, "6–10"], [11, 20, "11–20"], [21, 40, "21–40"], [41, Infinity, "41+"]];
export const SIZE_BAND_WORDS = SIZE_BANDS.map((b) => b[2]);

export const isIndependent = (type: string) => type.startsWith("independent");
export const sizeBandOf = (schools: number) => SIZE_BANDS.find(([lo, hi]) => schools >= lo && schools <= hi)?.[2] ?? null;

/** "MAT · 41 schools", "+2 likely" kept apart so the card can set it in muted type. */
export function typeAndSize(c: Pick<IndexCard, "type" | "schools" | "likely">): { line: string; likely: string | null } {
  return { line: `${TYPE_WORD[c.type] ?? c.type} · ${c.schools.toLocaleString("en-GB")} school${c.schools === 1 ? "" : "s"}`, likely: c.likely ? `+${c.likely} likely` : null };
}

/** Regions by school count, most first (names; outside England and unknown left off). */
export function regionsOf(c: Pick<IndexCard, "regions">): { code: string; name: string; n: number }[] {
  return Object.entries(c.regions ?? {})
    .filter(([code]) => code !== "outside_england" && code !== "unknown" && REGION_NAMES[code])
    .map(([code, n]) => ({ code, name: REGION_NAMES[code], n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}

/** The region(s) with the most schools: a tie counts in each (D5). */
export function mainRegions(c: Pick<IndexCard, "regions">): string[] {
  const r = regionsOf(c);
  if (!r.length) return [];
  return r.filter((x) => x.n === r[0].n).map((x) => x.code);
}

/** "London · also South East, East" (main first; tied mains joined with "and"). */
export function regionWords(c: Pick<IndexCard, "regions">): string {
  const r = regionsOf(c);
  if (!r.length) return "Region not known";
  const main = r.filter((x) => x.n === r[0].n);
  const rest = r.slice(main.length);
  const head = main.length > 1 ? `${main.slice(0, -1).map((x) => x.name).join(", ")} and ${main.at(-1)!.name}` : main[0].name;
  return rest.length ? `${head} · also ${rest.map((x) => x.name).join(", ")}` : head;
}

export function phaseWords(c: Pick<IndexCard, "schools_by_phase">): string {
  const p = c.schools_by_phase ?? { primary: 0, secondary: 0, post16: 0 };
  return [p.primary ? `${p.primary} primary` : null, p.secondary ? `${p.secondary} secondary` : null, p.post16 ? `${p.post16} with sixth forms` : null].filter(Boolean).join(" · ") || "Phases not known";
}

const signed = (x: number) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(1)}%`;

/** "48,960 pupils · +6.2% over 3 years" (combined: schools that joined add to it). */
export function rollWords(c: Pick<IndexCard, "roll" | "change_3">): string {
  const ch = c.change_3?.combined_pct;
  return `${c.roll.toLocaleString("en-GB")} pupils${ch !== null && ch !== undefined ? ` · ${signed(ch)} over 3 years` : ""}`;
}

const fmtMeasure = (m: string, v: number) => (m === "ks2_rwm" ? `${v.toFixed(0)}%` : m === "ks5_aps_alevel" ? v.toFixed(2) : v.toFixed(1));

/** The one results headline for the phase in view (D7): "Secondary · A8 46.2, England 45.9". On All
 * phases, the group's main phase. "Results not published" for an independent group with none. */
export function headlineWords(c: Pick<IndexCard, "type" | "headline" | "main_phase" | "schools_by_phase">, focus: Focus): { text: string; value: number | null; england: number | null; measure: string | null; phase: string | null } {
  const ph = focus === "all" ? c.main_phase : focus;
  const none = { text: isIndependent(c.type) ? "Results not published" : "No results published", value: null, england: null, measure: null, phase: ph };
  if (!ph) return none;
  if (focus !== "all" && !(c.schools_by_phase?.[ph] > 0)) return { ...none, text: `No ${PHASE_WORD[ph].toLowerCase()} schools` };
  const h = c.headline?.[ph];
  if (!h || h.weighted === null) return none;
  const eng = h.england !== null ? `, England ${fmtMeasure(h.measure, h.england)}` : "";
  return { text: `${PHASE_WORD[ph]} · ${MEASURE_WORD[h.measure] ?? h.measure} ${fmtMeasure(h.measure, h.weighted)}${eng}`, value: h.weighted, england: h.england, measure: h.measure, phase: ph };
}

// ---------------------------------------------------------------------------------- the filters

export type LibrarySort = "like_us" | "size" | "name" | "headline";
export type LibrarySection = "mainstream" | "nm";
export type LibraryFilter = {
  /** 0.8 non-mainstream groups: which section is in view (mainstream groups, or special, AP and nursery). */
  section: LibrarySection;
  /** The non-mainstream section's family filter (special_ap, nursery). */
  families: ("special_ap" | "nursery")[];
  likeUs: boolean;
  types: string[];
  bands: string[];
  regions: string[];
  regionMode: "most" | "has";
  phases: ("primary" | "secondary" | "post16")[];
  search: string;
  sort: LibrarySort;
  focus: Focus;
};
export const DEFAULT_FILTER: LibraryFilter = { section: "mainstream", families: [], likeUs: true, types: [], bands: [], regions: [], regionMode: "most", phases: [], search: "", sort: "like_us", focus: "all" };

const fold = (s: string) => s.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/** The cards a filter leaves, in its order. `us`: our own group's card (never listed; it sets "like us"). */
export function libraryCards(all: IndexCard[], us: IndexCard | null, f: LibraryFilter): IndexCard[] {
  const q = fold(f.search);
  let out = all.filter((c) => c.group_id !== us?.group_id);
  const nm = f.section === "nm";
  // "Like us" is our type among mainstream groups, our family among special, AP and nursery groups; it
  // applies only in our own section.
  const usHere = !!us && (familyOf(us.kind) === "mainstream") === !nm;
  if (f.likeUs && us && usHere) out = out.filter((c) => (nm ? familyOf(c.kind) === familyOf(us.kind) : c.type === us.type));
  if (nm && f.families.length) out = out.filter((c) => f.families.includes(familyOf(c.kind) as "special_ap" | "nursery"));
  if (f.types.length) out = out.filter((c) => f.types.includes(c.type));
  if (f.bands.length) out = out.filter((c) => f.bands.includes((nm ? nmBandOf(c.schools) : sizeBandOf(c.schools)) ?? ""));
  if (f.regions.length) out = out.filter((c) => (f.regionMode === "most" ? mainRegions(c) : regionsOf(c).map((r) => r.code)).some((r) => f.regions.includes(r)));
  if (f.phases.length) out = out.filter((c) => f.phases.every((p) => (c.schools_by_phase?.[p] ?? 0) > 0));
  if (q) out = out.filter((c) => fold(displayName(c.name)).includes(q) || fold(c.name).includes(q));
  const near = (c: IndexCard) => (us && (usHere || !nm) ? Math.abs(c.schools - us.schools) : 0);
  const samePeer = (c: IndexCard) => (us?.peer && c.peer?.set_id === us.peer.set_id ? 0 : 1);
  const head = (c: IndexCard) => headlineWords(c, f.focus).value;
  const byName = (a: IndexCard, b: IndexCard) => displayName(a.name).localeCompare(displayName(b.name));
  const sorters: Record<LibrarySort, (a: IndexCard, b: IndexCard) => number> = {
    like_us: (a, b) => samePeer(a) - samePeer(b) || near(a) - near(b) || b.schools - a.schools || byName(a, b),
    size: (a, b) => b.schools - a.schools || byName(a, b),
    name: byName,
    headline: (a, b) => (head(b) ?? -Infinity) - (head(a) ?? -Infinity) || byName(a, b),
  };
  return [...out].sort(sorters[f.sort]);
}

/** The filter's state in the address (shareable, and the way back from a group's page). */
export function filterToQuery(f: LibraryFilter): URLSearchParams {
  const q = new URLSearchParams();
  if (f.section === "nm") q.set("section", "nm");
  if (f.section === "nm" && f.families.length) q.set("fam", f.families.join(","));
  if (!f.likeUs) q.set("all", "1");
  if (f.types.length) q.set("type", f.types.join(","));
  if (f.bands.length) q.set("band", f.bands.join(","));
  if (f.regions.length) q.set("region", f.regions.join(","));
  if (f.regionMode === "has") q.set("rmode", "has");
  if (f.phases.length) q.set("phase", f.phases.join(","));
  if (f.search) q.set("q", f.search);
  if (f.sort !== "like_us") q.set("sort", f.sort);
  if (f.focus !== "all") q.set("focus", f.focus);
  return q;
}
export function filterFromQuery(q: URLSearchParams): LibraryFilter {
  const list = (k: string) => (q.get(k) ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const sorts: LibrarySort[] = ["like_us", "size", "name", "headline"];
  const foci: Focus[] = ["all", "primary", "secondary", "post16"];
  const section: LibrarySection = q.get("section") === "nm" ? "nm" : "mainstream";
  return {
    section,
    families: list("fam").filter((x): x is "special_ap" | "nursery" => x === "special_ap" || x === "nursery"),
    likeUs: q.get("all") !== "1",
    types: list("type").filter((t) => (LIBRARY_TYPES as readonly string[]).includes(t)),
    bands: list("band").filter((b) => (section === "nm" ? (NM_BANDS as readonly string[]) : SIZE_BAND_WORDS).includes(b)),
    regions: list("region").filter((r) => !!REGION_NAMES[r]),
    regionMode: q.get("rmode") === "has" ? "has" : "most",
    phases: list("phase").filter((p): p is "primary" | "secondary" | "post16" => p === "primary" || p === "secondary" || p === "post16"),
    search: (q.get("q") ?? "").slice(0, 80),
    sort: sorts.includes(q.get("sort") as LibrarySort) ? (q.get("sort") as LibrarySort) : "like_us",
    focus: foci.includes(q.get("focus") as Focus) ? (q.get("focus") as Focus) : "all",
  };
}

/** Our group's peer set, in words, for the "like us" line: "MATs with 41+ schools", "All foundation trusts". */
export function likeUsWords(us: IndexCard | null): string | null {
  if (!us) return null;
  if (familyOf(us.kind) !== "mainstream") {
    const fam = familyOf(us.kind) === "nursery" ? "Nursery federations" : "Special and AP trusts";
    return !us.peer || us.peer.band === "all" ? `${fam} like us: nearest in size first` : `${fam} like us: those with ${us.peer.band.replace("-", "–")} schools first, then nearest in size`;
  }
  const plural = TYPE_PLURAL_WORD[us.type] ?? "groups";
  if (!us.peer || us.peer.band === "all") return `${plural} like us: nearest in size first`;
  return `${plural} like us: ${PEER_PLURAL[us.type] ?? "groups"} with ${us.peer.band.replace("-", "–")} schools first, then nearest in size`;
}

