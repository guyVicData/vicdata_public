// VicData 0.8 non-mainstream groups, M6 (NM2, NM4-NM7): a special and AP trust's or nursery federation's
// own dashboard parts -- its roll, same-schools change and FSM against its peer set and its kinds' pools,
// its mainstream line where it has one, and the "no results compared" state. Pure: every figure is
// production's (group_aggregate_lookup, group_comparison_lookup's peer_band, pools, kind_areas and
// mainstream_line kinds); R-MIN-SCHOOLS is applied as setsFor applies it to every pool. Called by
// buildOverview (dash.ts) for a non-mainstream group only; a mainstream group's page never reaches here.
import type { Figures, GroupAggregate, Place } from "./aggregates";
import { displayName, ordinal, POOL_MIN_SCHOOLS, tooFewWords, type PickerRow, type SetRef } from "./dash";
import { groupsWord } from "./group-sets";
import { FAMILY_PEER_PLURAL, NM_NOTES, noResultsWords, POOL_WORDS, schoolsByKindWords, smallGroupsWords, type PoolKind } from "./non-mainstream";

type Pt = { year: number; value: number | null };

/** One row of the non-mainstream Against table: roll, its same-schools change and FSM. */
export type NmRow = { key: string; label: string; kind: string; schools: number | null; pupils: number | null; change1: number | null; change3: number | null; fsm: number | null; fsmN: number | null; tooFew: boolean; ours: boolean };

export type NmParts = {
  family: "special_ap" | "nursery";
  familyPlural: string;
  /** Current schools by kind (the group's members), and the ones in its own figures. */
  byKind: string;
  countedByKind: string;
  mainKind: PoolKind;
  fsm: { pct: number | null; n: number };
  places: { key: string; text: string }[];
  against: NmRow[];
  line: { schools: number; pupils: number; rows: NmRow[]; note: string } | null;
  noResults: { title: string; reason: string[] };
  notes: { line: string; families: string; stateFunded: string; nurseryFsm: string | null; fsm: string; roll: string; small: string | null; line2: string | null };
  fsmTrend: { lines: { key: string; label: string; pts: Pt[] }[] };
};

/** The order of the non-mainstream sets in a table (after the mainstream ones' fixed order). */
export function nmSetRank(key: string): number {
  if (key === "kind_areas:region") return 1;
  if (key.startsWith("pools:england:")) return 2;
  if (key.startsWith("pools:region:")) return 3;
  if (key.startsWith("pools:la:")) return 4;
  if (key.startsWith("mainstream_line:")) return 5;
  return 9;
}

const at = (s: SetRef, p: number): Figures | null => s.rows.find((r) => r.period === p && r.phase === "all")?.figures ?? null;

function row(key: string, label: string, kind: string, f: Figures | null, ours = false): NmRow {
  const n = f?.n_schools ?? null;
  return {
    key,
    label,
    kind,
    schools: n,
    pupils: f?.roll ?? null,
    change1: f?.change?.["1"]?.same_schools_pct ?? null,
    change3: f?.change?.["3"]?.same_schools_pct ?? null,
    fsm: f?.fsm?.pct ?? null,
    fsmN: f?.fsm?.n_with_figure ?? null,
    tooFew: !ours && n !== null && n > 0 && n < POOL_MIN_SCHOOLS,
    ours,
  };
}

const PLACE_WORDS: Record<string, (p: Place) => string> = {
  // Production ranks every place highest first: rank 1 is the highest FSM, the fastest growth.
  fsm: (p) => `${ordinal(p.rank, p.tied)} highest FSM`,
  roll_same_schools_1: (p) => `${ordinal(p.rank, p.tied)} fastest-growing, same schools over 1 year`,
};

export function buildNmParts(input: { agg: GroupAggregate; sets: SetRef[]; census: number; name: string; nearest: { id: string }[]; nmCounts: { two: number; of: number } | null; chosen: SetRef[] }): { defaults: PickerRow[]; parts: NmParts } {
  const { agg, sets, census, name } = input;
  const family = agg.group.kind === "nursery" ? "nursery" : "special_ap";
  const all = agg.rows.find((r) => r.period === census && r.phase === "all")?.figures ?? null;
  const counted = all?.schools_by_kind ?? {};
  const k = counted as Record<string, number>;
  const mainKind: PoolKind = family === "nursery" ? "nursery" : (k.ap ?? 0) + (k.pru ?? 0) > (k.special ?? 0) ? "ap" : "special";
  const peerPlural = FAMILY_PEER_PLURAL[family];
  const peer = agg.peer;
  const peerName = peer ? (peer.band === "all" ? `All ${peerPlural}` : `${peerPlural.charAt(0).toUpperCase()}${peerPlural.slice(1)} with ${peer.band.replace("-", "–")} schools`) : null;
  const nOf = (s: SetRef) => at(s, census)?.n_schools ?? null;
  const schoolsText = (n: number | null) => (n === null ? "…" : n < POOL_MIN_SCHOOLS ? tooFewWords(n) : `${n.toLocaleString("en-GB")} school${n === 1 ? "" : "s"}`);

  // The Default block: our peer set, the same kinds in our regions, then each pool (England, region, LA).
  const defaults: PickerRow[] = [];
  if (peer) defaults.push({ key: peer.set_id, name: peerName!, countText: groupsWord(peer.n_groups), title: `${peer.n_groups} ${peerPlural}${peer.band === "all" ? "" : ` with ${peer.band.replace("-", "–")} schools`}, ${name} included; their special, AP and nursery schools pupil-weighted, each counted once.` });
  const ka = sets.find((s) => s.key === "kind_areas:region");
  if (ka) defaults.push({ key: "kind_areas:region", name: "Same kinds of school in its regions", countText: schoolsText(nOf(ka)), title: `State-funded schools of the same kinds as ${name}'s in its regions, weighted to its mix of kinds and regions.` });
  const pools = sets.filter((s) => s.kind === "pools").sort((a, b) => nmSetRank(a.key) - nmSetRank(b.key) || a.label.localeCompare(b.label));
  for (const s of pools) defaults.push({ key: s.key, name: s.label, countText: schoolsText(nOf(s)), title: NM_NOTES.stateFunded });
  if (input.nearest.length) defaults.push({ key: "nearest", name: `Nearest in size, ${peerPlural}`, countText: groupsWord(input.nearest.length), title: `The ${input.nearest.length} ${peerPlural} nearest ${name} in size, side by side, with their median.` });

  // Against others: the group, its peer set, the same kinds in its regions, its pools.
  const against: NmRow[] = [row("group", name, "group", all, true)];
  const peerSet = sets.find((s) => s.key === "peer_band:band");
  if (peerSet && peerName) against.push(row(peerSet.key, peerName, "peer_band", at(peerSet, census)));
  if (ka) against.push(row(ka.key, "Same kinds of school in its regions", "kind_areas", at(ka, census)));
  for (const s of pools) against.push(row(s.key, s.label, "pools", at(s, census)));

  // The mainstream line (NM2): its mainstream schools, against mainstream pools only.
  const ml = all?.mainstream_line ?? null;
  let line: NmParts["line"] = null;
  if (ml && ml.n_schools > 0) {
    const rows: NmRow[] = [row("mainstream_line", `${name}: mainstream schools`, "group", ml, true)];
    const order = ["mainstream_line:areas_la", "mainstream_line:areas_region", "mainstream_line:non_group_areas", "mainstream_line:mix_matched", "england:england", "non_group:england", "sat:england"];
    for (const key of order) {
      const s = sets.find((x) => x.key === key);
      if (s) rows.push(row(key, s.label, s.kind, at(s, census)));
    }
    line = { schools: ml.n_schools, pupils: ml.roll, rows, note: NM_NOTES.line2 };
  }

  const places = Object.entries(all?.peer?.places ?? {})
    .filter(([key]) => PLACE_WORDS[key])
    .map(([key, p]) => ({ key, text: `${PLACE_WORDS[key](p)} of ${p.of} ${peer?.band === "all" ? peerPlural : `${peerPlural} with ${peer?.band.replace("-", "–")} schools`}` }));

  // FSM over the years: the group, the set compared against, and England's pool of its main kind
  // (R-NM-FSM-NURSERY: a nursery federation's lines are all nursery figures).
  const fsmLine = (s: SetRef) => s.rows.filter((r) => r.phase === "all").sort((a, b) => a.period - b.period).map((r) => ({ year: r.period, value: r.figures.fsm?.pct ?? null }));
  const eng = sets.find((s) => s.key === `pools:england:${mainKind}`);
  const lines = [sets[0], ...input.chosen.filter((c) => c.key !== eng?.key), ...(eng ? [eng] : [])].filter((s) => s.kind === "group" || s.kind === "peer_band" || s.kind === "pools" || s.kind === "kind_areas" || s.kind === "peer_named");
  const fsmTrend = { lines: lines.map((s) => ({ key: s.key, label: s.kind === "peer_band" && peerName ? peerName : s.kind === "peer_named" ? displayName(s.label) : s.label, pts: fsmLine(s) })) };

  return {
    defaults,
    parts: {
      family,
      familyPlural: family === "nursery" ? "Nursery federations" : "Special and AP trusts",
      byKind: schoolsByKindWords(agg.group.schools_by_kind ?? counted),
      countedByKind: schoolsByKindWords({ ...counted, mainstream: 0 }, true),
      mainKind,
      fsm: { pct: all?.fsm?.pct ?? null, n: all?.fsm?.n_with_figure ?? 0 },
      places,
      against,
      line,
      noResults: noResultsWords(family),
      notes: {
        line: NM_NOTES.line,
        families: NM_NOTES.families,
        stateFunded: NM_NOTES.stateFunded,
        nurseryFsm: family === "nursery" || (k.nursery ?? 0) > 0 ? NM_NOTES.nurseryFsm : null,
        fsm: NM_NOTES.fsm,
        roll: NM_NOTES.roll,
        small: input.nmCounts ? smallGroupsWords(input.nmCounts.two, input.nmCounts.of) : null,
        line2: line ? NM_NOTES.line2 : null,
      },
      fsmTrend,
    },
  };
}

export const POOL_LABEL_OF = (kind: PoolKind) => POOL_WORDS[kind].plural;
