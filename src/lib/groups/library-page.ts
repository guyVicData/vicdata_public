// VicData 0.8 group sets, M3: a group's page in the library, like an album page -- the header (its card),
// its schools as the tracklist with a map, and where it sits among groups of its own type
// (R-GROUP-RANK-SAME-TYPE: "9th of 16 MATs with 41+ schools", "12th of 74 foundation trusts"). Pure.
import type { GroupAggregate, SchoolYearRow } from "./aggregates";
import { displayName, HEADLINE, MEASURE_PHASE, ordinal, PEER_PLURAL, NOT_COUNTED_WORDS } from "./dash";
import { headlineWords, type IndexCard } from "./library";
import { cardFsmWords, cardRollWords, FAMILY_PEER_PLURAL, isNonMainstream, noResultsWords, schoolsByKindWords } from "./non-mainstream";

export type TrackRow = {
  urn: string;
  name: string;
  la: string | null;
  phases: string[];
  roll: number | null;
  headline: { measure: string; value: number; year: number } | null;
  /** "AP · not in group figures" in place of results (LF4), or the reason there's none. */
  note: string | null;
  likely: boolean;
  easting: number | null;
  northing: number | null;
};
export type LibraryGroupPage = {
  card: IndexCard & { displayName: string };
  rank: { text: string; measure: string; period: number } | null;
  schools: TrackRow[];
  isUs: boolean;
  /** Our own group's kind (R-NM-SETS: Add to set… refuses another family's group). */
  ourKind?: string | null;
  /** 0.8 non-mainstream groups: a special, AP or nursery group's page (no results; FSM and roll instead). */
  nm?: { family: "special_ap" | "nursery"; byKind: string; roll: string; fsm: string; noResults: string; places: string[] };
};

const PHASE_SHORT: Record<string, string> = { primary: "Primary", secondary: "Secondary", post16: "Sixth form" };

export function libraryGroupPage(card: IndexCard, agg: GroupAggregate | null, schools: SchoolYearRow[], us: IndexCard | null): LibraryGroupPage {
  // Its rank on the headline of its main phase, within its own peer set (same type).
  let rank: LibraryGroupPage["rank"] = null;
  const nm = isNonMainstream(card.kind);
  const ph = nm ? null : card.main_phase;
  if (agg && ph && card.peer) {
    const m = HEADLINE[ph];
    const rows = agg.rows.filter((r) => r.phase === MEASURE_PHASE[m] && r.figures.peer?.places?.[m]).sort((a, b) => b.period - a.period);
    const p = rows[0]?.figures.peer?.places?.[m];
    if (p && rows[0]) {
      const plural = PEER_PLURAL[card.peer.type] ?? "groups";
      const where = card.peer.band === "all" ? plural : `${plural} with ${card.peer.band.replace("-", "–")} schools`;
      rank = { text: `${ordinal(p.rank, p.tied)} of ${p.of} ${where}`, measure: m, period: rows[0].period };
    }
  }
  const head = nm ? { measure: null as string | null } : headlineWords(card, "all");
  const rowsOut: TrackRow[] = schools
    .filter((s) => s.role === "member" && s.years.some((y) => y.listed_now))
    .map((s) => {
      const withFig = [...s.years].reverse().find((y) => y.figures)?.figures ?? null;
      const latest = s.years.find((y) => y.period === card.census)?.figures ?? withFig;
      let headline: TrackRow["headline"] = null;
      const m = head.measure;
      if (m && withFig?.counted !== false) {
        const y = [...s.years].reverse().find((x) => x.figures?.results?.[m] !== undefined && !(m.startsWith("ks4") && x.figures?.igcse));
        if (y?.figures) headline = { measure: m, value: y.figures.results[m], year: y.period };
      }
      const kind = withFig?.kind;
      // A non-mainstream group counts its special, AP, PRU and nursery schools (production's `counted` is
      // "counts in a mainstream group"); its mainstream schools are its mainstream line.
      const note = nm ? (!withFig ? "not yet open" : kind === "mainstream" ? "Mainstream · in the mainstream line" : `${kind && NOT_COUNTED_WORDS[kind] ? NOT_COUNTED_WORDS[kind][0] : "School"}${withFig?.fsm?.pct !== null && withFig?.fsm?.pct !== undefined ? ` · FSM ${withFig.fsm.pct.toFixed(1)}%` : ""}`) : withFig?.counted === false && kind && NOT_COUNTED_WORDS[kind] ? `${NOT_COUNTED_WORDS[kind][0]} · not in group figures` : s.outside_england ? "Outside England" : headline ? null : m && withFig?.igcse && m.startsWith("ks4") ? "IGCSE: not ranked at GCSE" : null;
      return { urn: s.urn, name: s.name ?? s.urn, la: s.la_name, phases: (latest?.phases ?? []).map((p) => PHASE_SHORT[p] ?? p), roll: latest?.roll ?? null, headline, note, likely: s.confidence === "likely", easting: s.easting, northing: s.northing };
    })
    .sort((a, b) => (b.roll ?? -1) - (a.roll ?? -1) || a.name.localeCompare(b.name));
  let nmPart: LibraryGroupPage["nm"];
  if (nm) {
    const family = card.kind === "nursery" ? "nursery" : "special_ap";
    const census = agg ? Math.max(...agg.rows.filter((r) => r.phase === "all" && r.figures.roll > 0).map((r) => r.period)) : null;
    const places = agg?.rows.find((r) => r.period === census && r.phase === "all")?.figures.peer?.places ?? {};
    const where = card.peer?.band && card.peer.band !== "all" ? `${FAMILY_PEER_PLURAL[family]} with ${card.peer.band.replace("-", "–")} schools` : FAMILY_PEER_PLURAL[family];
    nmPart = {
      family,
      byKind: schoolsByKindWords(card.schools_by_kind, true),
      roll: cardRollWords(card),
      fsm: cardFsmWords(card),
      noResults: noResultsWords(family).title,
      places: [places.fsm ? `${ordinal(places.fsm.rank, places.fsm.tied)} highest FSM of ${places.fsm.of} ${where}` : null, places.roll_same_schools_1 ? `${ordinal(places.roll_same_schools_1.rank, places.roll_same_schools_1.tied)} fastest-growing (same schools, 1 year) of ${places.roll_same_schools_1.of}` : null].filter((x): x is string => !!x),
    };
  }
  return { card: { ...card, displayName: displayName(card.name) }, rank, schools: rowsOut, isUs: us?.group_id === card.group_id, ourKind: us?.kind ?? null, ...(nmPart ? { nm: nmPart } : {}) };
}
