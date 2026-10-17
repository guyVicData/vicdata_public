// VicData 0.8 groups r2 (C, D): the Overview and Schools dashboards' data, from the three group lookups
// (aggregates.ts). Pure: it selects and words what the database computed -- every figure, every n and
// every excluded school is the lookup's own, never recomputed here (R-GROUP-COUNTS). Rank WITHIN the
// group (the Schools table's "In group") is the one ordering made here, over the lookup's own school
// figures, ties sharing a place, IGCSE schools out at GCSE (the audit-fixes rules).
import { periodLabel, ROLL_DIRECTION_SPAN, rollDirection } from "@/catalogue/years";
import { shapeOf } from "../admissions/shape";
import { SHAPE_LABELS } from "../data-view-cards";
import type { AgeGenderCounts } from "../roll-data";
import type { ComparisonKind, ComparisonRow, Excluded, Figures, GroupAggregate, MeasureFig, Phase, Place, Reading, SchoolYearRow } from "./aggregates";
import { competitionRanks } from "../rank";

export type Focus = Phase;
export const FOCI: Focus[] = ["all", "primary", "secondary", "post16"];
export const FOCUS_LABEL: Record<Focus, string> = { all: "All phases", primary: "Primary", secondary: "Secondary", post16: "Post-16" };

export const REGION_NAMES: Record<string, string> = {
  E12000001: "North East",
  E12000002: "North West",
  E12000003: "Yorkshire and The Humber",
  E12000004: "East Midlands",
  E12000005: "West Midlands",
  E12000006: "East of England",
  E12000007: "London",
  E12000008: "South East",
  E12000009: "South West",
  outside_england: "Outside England",
};

export const GROUP_TYPE_LABEL: Record<string, string> = {
  mat: "multi-academy trust",
  sponsor: "academy sponsor",
  federation: "federation",
  independent_company: "independent group",
  independent_charity: "independent group (charity)",
  independent_other: "independent group",
  foundation_trust: "foundation trust",
  umbrella_trust: "umbrella trust",
};
export const PEER_PLURAL: Record<string, string> = { mat: "MATs", federation: "federations", independent_company: "independent groups", independent_charity: "independent charities" };

export const MEASURE_LABEL: Record<string, string> = {
  ks2_rwm: "KS2 reading, writing and maths",
  ks4_a8: "Attainment 8",
  ks4_em5: "Grade 5+ English and maths",
  ks4_em4: "Grade 4+ English and maths",
  ks5_aps_alevel: "A-level points",
  ks5_aps_all: "Post-16 points, all qualifications",
  ks4_p8: "Progress 8",
  ks5_va_alevel: "A-level value added",
};
export const MEASURE_SHORT: Record<string, string> = { ks2_rwm: "KS2", ks4_a8: "Att 8", ks4_em5: "Grade 5+ E&M", ks4_em4: "Grade 4+ E&M", ks5_aps_alevel: "A level", ks5_aps_all: "Post-16", ks4_p8: "P8", ks5_va_alevel: "A-level VA" };
export const MEASURE_UNIT: Record<string, "pct" | "points" | "va"> = { ks2_rwm: "pct", ks4_a8: "points", ks4_em5: "pct", ks4_em4: "pct", ks5_aps_alevel: "points", ks5_aps_all: "points", ks4_p8: "va", ks5_va_alevel: "va" };
export const MEASURE_PHASE: Record<string, Exclude<Phase, "all">> = { ks2_rwm: "primary", ks4_a8: "secondary", ks4_em5: "secondary", ks4_em4: "secondary", ks5_aps_alevel: "post16", ks5_aps_all: "post16", ks4_p8: "secondary", ks5_va_alevel: "post16" };
// The headline of each phase (the wireframes' columns): Attainment 8, A-level points, KS2.
export const HEADLINE: Record<Exclude<Phase, "all">, string> = { secondary: "ks4_a8", post16: "ks5_aps_alevel", primary: "ks2_rwm" };
export const PHASE_NOUN: Record<Exclude<Phase, "all">, [string, string]> = { primary: ["primary", "primaries"], secondary: ["secondary", "secondaries"], post16: ["sixth form", "sixth forms"] };

// "Growing" counts schools over three years: R-ROLL-WORDS-3YR (years.ts ROLL_DIRECTION_SPAN), the key
// of the database's 1/3/5-year changes. Every groups roll word and arrow reads it.
export const GROWING_SPAN = String(ROLL_DIRECTION_SPAN) as "3";

/** A school's roll change over the longest span it has (fewer than 4 census years), ending at `census`. */
function shorterSpan(rolls: { year: number; value: number | null }[], census: number): number | null {
  const d = rollDirection(rolls.filter((r) => r.year <= census), 1);
  return d && d.to === census ? Math.round(d.pct * 10) / 10 : null;
}

/** GIAS writes trust names in capitals ("HARRIS FEDERATION"): shown in title case, short words lower,
 * known acronyms kept. A name already in mixed case is left as it is. */
export function displayName(name: string): string {
  if (name !== name.toUpperCase()) return name;
  const small = new Set(["and", "of", "the", "for", "in", "on", "at", "to", "&"]);
  return name
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((w, i) => {
      const up = w.toUpperCase();
      if (["CE", "RC", "GLF", "TKAT", "STEM", "UK"].includes(up)) return up;
      if (up === "ARK") return "Ark";
      if (i > 0 && small.has(w)) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join("")
    .replace(/\bReach2\b/i, "REAch2")
    .replace(/\((uk)\)/i, "(UK)")
    .replace(/\bMulti-academy\b/, "Multi-Academy");
}

// ----------------------------------------------------------------------------- the comparison choice

export type CompareKey = ComparisonKind | `peer_named:${string}`;
export const DEFAULT_COMPARE: CompareKey = "peer_band";

/** "peer_named:3317,4072" (up to three) or a kind; anything else is the default. */
export function parseCompare(raw: string | null | undefined): CompareKey {
  if (!raw) return DEFAULT_COMPARE;
  if (raw.startsWith("peer_named:")) {
    const ids = raw.slice(11).split(",").map((s) => s.trim()).filter((s) => /^[\w:.-]{1,80}$/.test(s)).slice(0, 3);
    return ids.length ? (`peer_named:${ids.join(",")}` as CompareKey) : DEFAULT_COMPARE;
  }
  return (["peer_band", "non_group", "areas", "england", "mix_matched"] as const).includes(raw as ComparisonKind) ? (raw as ComparisonKind) : DEFAULT_COMPARE;
}
export const namedIds = (k: CompareKey): string[] => (k.startsWith("peer_named:") ? k.slice(11).split(",") : []);

/** The lookup kinds a page asks for: every standard kind (the Against others table shows them all),
 * plus the named groups picked. */
export function kindsFor(k: CompareKey): string[] {
  return ["peer_band", "non_group", "areas", "england", "mix_matched", ...namedIds(k).map((id) => `peer_named:${id}`)];
}

// ----------------------------------------------------------------------------------------- helpers

type Pt = { year: number; value: number | null };

const rowsOf = (agg: GroupAggregate, phase: Phase) => agg.rows.filter((r) => r.phase === phase).sort((a, b) => a.period - b.period);
const figOf = (agg: GroupAggregate, period: number, phase: Phase): Figures | null => agg.rows.find((r) => r.period === period && r.phase === phase)?.figures ?? null;

/** The latest census year the group has a roll for. */
export function latestCensus(agg: GroupAggregate): number {
  const ys = agg.rows.filter((r) => r.phase === "all" && r.figures.roll > 0).map((r) => r.period);
  return ys.length ? Math.max(...ys) : Math.max(...agg.rows.map((r) => r.period));
}
export function firstCensus(agg: GroupAggregate): number {
  const ys = agg.rows.filter((r) => r.phase === "all" && r.figures.roll > 0).map((r) => r.period);
  return ys.length ? Math.min(...ys) : Math.min(...agg.rows.map((r) => r.period));
}

/** A measure's latest year with a figure for the group (the measure's own year; never a blank year). */
export function latestFor(agg: GroupAggregate, measure: string): number | null {
  const phase = MEASURE_PHASE[measure];
  const ys = agg.rows.filter((r) => r.phase === phase && fig(r.figures, measure)?.n_with_figure).map((r) => r.period);
  return ys.length ? Math.max(...ys) : null;
}

export const fig = (f: Figures | null | undefined, measure: string): MeasureFig | null => (f ? (f.results[measure] ?? f.value_added[measure] ?? null) : null);

/** "4th", "=3rd" */
export function ordinal(n: number, tied = false): string {
  const v = n % 100;
  const s = v >= 11 && v <= 13 ? "th" : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th");
  return `${tied ? "=" : ""}${n}${s}`;
}

/** Standard competition ranking, highest first: two tied at 3rd, then 5th (the audit-fixes rule). */
export function rankWithin(values: { key: string; value: number | null }[]): Map<string, Place> {
  return competitionRanks(values);
}

/** Chain-linked like-for-like index: each year moves by that year's same-schools change (schools with
 * a roll in both years), starting at 100. A set that schools join or leave isn't moved by the joining. */
export function chainedIndex(rows: { period: number; figures: Figures }[]): Pt[] {
  const out: Pt[] = [];
  let v: number | null = null;
  for (const r of rows) {
    const c = r.figures.change?.["1"]?.same_schools_pct;
    if (v === null) v = r.figures.roll > 0 ? 100 : null;
    else if (c !== null && c !== undefined) v = v * (1 + c / 100);
    else v = null;
    out.push({ year: r.period, value: v === null ? null : Math.round(v * 10) / 10 });
  }
  return out;
}

// ------------------------------------------------------------------------------------ the sets

export type SetRef = { key: string; label: string; kind: ComparisonKind | "peer_named" | "group"; variant: string; rows: { period: number; phase: Phase; figures: Figures }[] };

/** Mix-matched means non-group schools only (Guy, 16 Oct): the ingest's `mix_matched:england` weights
 * the same region cells by the same weights as `areas:region`, so it duplicates that set and is never offered. */
export const NOT_OFFERED = new Set(["mix_matched:england"]);
export const mixMatchedLabel = (group: string) => `Non-group schools, same regions and phases as ${group}`;

/** The comparison sets as rows of one reading: the group itself first, then each kind's variants. */
export function setsFor(agg: GroupAggregate, comps: ComparisonRow[], reading: Reading, groupLabel: string): SetRef[] {
  const out: SetRef[] = [{ key: "group", label: groupLabel, kind: "group", variant: "group", rows: agg.rows }];
  const by = new Map<string, SetRef>();
  for (const r of comps) {
    if (r.reading !== reading) continue;
    const key = r.kind === "peer_named" ? `peer_named:${r.variant}` : `${r.kind}:${r.variant}`;
    if (NOT_OFFERED.has(key)) continue;
    const label = r.kind === "peer_named" ? displayName(r.label) : key === "mix_matched:non_group" ? mixMatchedLabel(groupLabel) : r.label;
    const s = by.get(key) ?? { key, label, kind: r.kind, variant: r.variant, rows: [] };
    s.rows.push({ period: r.period, phase: r.phase, figures: r.figures });
    by.set(key, s);
  }
  const order = ["peer_band:band", "non_group:england", "non_group:areas", "areas:la", "areas:region", "england:england", "mix_matched:non_group"];
  const sorted = Array.from(by.values()).sort((a, b) => {
    const ia = order.indexOf(a.key);
    const ib = order.indexOf(b.key);
    return (ia < 0 ? 100 : ia) - (ib < 0 ? 100 : ib) || a.label.localeCompare(b.label) || a.key.localeCompare(b.key);
  });
  return [...out, ...sorted];
}

/** The set the trends compare against, for a choice. */
export function chosenSets(sets: SetRef[], k: CompareKey): SetRef[] {
  if (k.startsWith("peer_named:")) return namedIds(k).map((id) => sets.find((s) => s.key === `peer_named:${id}`)).filter((s): s is SetRef => !!s);
  const key = { peer_band: "peer_band:band", non_group: "non_group:england", areas: "areas:la", england: "england:england", mix_matched: "mix_matched:non_group" }[k as ComparisonKind];
  const s = sets.find((x) => x.key === key);
  return s ? [s] : [];
}

// --------------------------------------------------------------------------------- the overview

export type AgainstCell = { value: number | null; n: number | null; average: number | null };
export type AgainstRow = { key: string; label: string; kind: SetRef["kind"]; schools: number | null; roll: { pct: number | null; years: number }; growing: { pct: number | null; n: number; of: number }; cells: Record<string, AgainstCell> };

export type GroupOverview = {
  kind: "overview";
  group: { id: string; name: string; typeLabel: string; type: string; sources: string[]; asOf: string | null; confirmed: number; likely: number; outsideEngland: number };
  reading: Reading;
  focus: Focus;
  compare: { key: CompareKey; label: string; n: number | null; options: { key: CompareKey; label: string; n: number | null; info: string }[] };
  years: { census: number; first: number; results: Record<string, number | null> };
  now: {
    schools: number;
    byPhase: Record<"primary" | "secondary" | "post16", number>;
    roll: number;
    change: Record<"1" | "3" | "5", { combined: number | null; sameSchools: number | null; from: number; growing: number; shrinking: number; of: number }>;
    sinceFirst: number | null;
    sizeBands: Record<string, number>;
    regions: { code: string; name: string; n: number }[];
    las: { code: string; name: string; n: number }[];
    boarders: number;
    outside: Excluded[];
    rollExcluded: Excluded[];
  };
  against: { columns: string[]; rows: AgainstRow[]; counts: string; place: string | null; mixAvailable: boolean };
  peerPlaces: Record<string, Place>;
  trends: {
    roll: { lines: { key: string; label: string; pts: Pt[] }[] };
    results: { measure: string; label: string; unit: "pct" | "points" | "va"; lines: { key: string; label: string; pts: Pt[]; average: Pt[]; n: (number | null)[] }[] }[];
    share: { sector: "all" | "independent"; phase: Focus; pct: number | null; las: { code: string; name: string; pct: number | null; group: number; total: number | null }[]; regions: { code: string; name: string; pct: number | null }[]; series: Pt[] };
  };
};

/** Every set's headline cells in the focus phase, each measure in its own latest year. */
function againstRows(sets: SetRef[], focus: Focus, measures: string[], latest: Record<string, number | null>, census: number): AgainstRow[] {
  return sets.map((s) => {
    const at = (p: number, ph: Phase) => s.rows.find((r) => r.period === p && r.phase === ph)?.figures ?? null;
    const now = at(census, focus) ?? at(census, "all");
    const ch5 = now?.change?.["5"];
    const ch3 = now?.change?.[GROWING_SPAN];
    const cells: Record<string, AgainstCell> = {};
    for (const m of measures) {
      const y = latest[m];
      const f = y !== null ? fig(at(y, focus === "all" ? MEASURE_PHASE[m] : focus), m) : null;
      cells[m] = { value: f?.weighted ?? null, n: f ? f.n_with_figure : null, average: f?.average_school ?? null };
    }
    const of = ch3?.same_schools ?? (ch3 ? ch3.growing + ch3.shrinking : 0);
    return {
      key: s.key,
      label: s.label,
      kind: s.kind,
      schools: now?.n_schools ?? null,
      roll: { pct: ch5?.same_schools_pct ?? null, years: 5 },
      growing: { pct: ch3 && of ? Math.round((1000 * ch3.growing) / of) / 10 : null, n: ch3?.growing ?? 0, of },
      cells,
    };
  });
}

export function buildOverview(input: { agg: GroupAggregate; comps: ComparisonRow[]; compare: CompareKey; focus: Focus; namedLabels?: Record<string, string>; name?: string }): GroupOverview {
  const { agg, comps, focus } = input;
  const reading = agg.reading;
  const name = input.name ?? displayName(agg.group.name);
  const census = latestCensus(agg);
  const first = firstCensus(agg);
  const all = figOf(agg, census, "all");
  if (!all) throw new Error("no figures for the latest census year");
  const sets = setsFor(agg, comps, reading, name);
  const measures = focus === "all" ? ["ks4_a8", "ks5_aps_alevel", "ks5_va_alevel"] : focus === "secondary" ? ["ks4_a8", "ks4_em5", "ks4_p8"] : focus === "post16" ? ["ks5_aps_alevel", "ks5_aps_all", "ks5_va_alevel"] : ["ks2_rwm"];
  const latest: Record<string, number | null> = {};
  for (const m of [...new Set([...measures, "ks4_a8", "ks4_em5", "ks4_em4", "ks4_p8", "ks5_aps_alevel", "ks5_aps_all", "ks5_va_alevel", "ks2_rwm"])]) latest[m] = latestFor(agg, m);
  const ph = focus === "all" ? all : (figOf(agg, census, focus) ?? all);
  const firstAll = figOf(agg, first, focus) ?? figOf(agg, first, "all");
  const changes = {} as GroupOverview["now"]["change"];
  for (const k of ["1", "3", "5"] as const) {
    const c = ph.change?.[k];
    changes[k] = { combined: c?.combined_pct ?? null, sameSchools: c?.same_schools_pct ?? null, from: census - Number(k), growing: c?.growing ?? 0, shrinking: c?.shrinking ?? 0, of: c?.same_schools ?? 0 };
  }
  const excludedRoll = all.excluded?.roll ?? [];
  const regionsList = Object.entries(all.regions ?? {}).map(([code, n]) => ({ code, name: REGION_NAMES[code] ?? code, n })).sort((a, b) => b.n - a.n);
  const lasList = Object.entries(all.las ?? {}).map(([k, n]) => ({ code: k.split("|")[0], name: k.split("|")[1] || k, n })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));

  // Against others: every set, plus the named groups picked.
  const rows = againstRows(sets, focus, measures, latest, census);
  const peer = agg.peer;
  const peerLabel = peer ? `${PEER_PLURAL[peer.type] ?? "groups"} with ${peer.band.replace("-", "–")} schools` : null;
  const headline = focus === "all" ? (all.schools_by_phase?.secondary ? "ks4_a8" : all.schools_by_phase?.post16 ? "ks5_aps_alevel" : "ks2_rwm") : HEADLINE[focus];
  const hy = latest[headline];
  const places = (hy !== null ? figOf(agg, hy, MEASURE_PHASE[headline])?.peer?.places : undefined) ?? {};
  const place = places[headline] && peerLabel ? `${ordinal(places[headline].rank, places[headline].tied)} of ${places[headline].of} ${peerLabel} on ${MEASURE_LABEL[headline]} (${periodLabel(hy!)})` : null;
  const hf = hy !== null ? fig(figOf(agg, hy, MEASURE_PHASE[headline]), headline) : null;
  const ng = sets.find((s) => s.key === "non_group:england");
  const ngf = hy !== null && ng ? fig(ng.rows.find((r) => r.period === hy && r.phase === MEASURE_PHASE[headline])?.figures, headline) : null;
  const noun = PHASE_NOUN[MEASURE_PHASE[headline]];
  const countWord = (n: number) => n.toLocaleString("en-GB");
  const counts = hf ? `${name}: ${countWord(hf.n_with_figure)} ${hf.n_with_figure === 1 ? noun[0] : noun[1]} with ${headline.startsWith("ks4") ? "GCSE" : headline.startsWith("ks5") ? "A-level" : "KS2"} results${ngf ? `; non-group: ${countWord(ngf.n_with_figure)}` : ""}` : "";

  // Compare options (§3.6), each with its set and n.
  const nOf = (key: string) => {
    const s = sets.find((x) => x.key === key);
    return s?.rows.find((r) => r.period === census && r.phase === focus)?.figures.n_schools ?? s?.rows.find((r) => r.period === census && r.phase === "all")?.figures.n_schools ?? null;
  };
  const opt = (key: CompareKey, setKey: string, label: string, info: string) => ({ key, label, n: nOf(setKey), info });
  const sector = agg.group.type.startsWith("independent") ? "independent" : "state";
  const options = [
    ...(peer ? [opt("peer_band", "peer_band:band", `Peer ${PEER_PLURAL[peer.type] ?? "groups"}`, `${peer.n_groups} ${PEER_PLURAL[peer.type] ?? "groups"} of the same type with ${peer.band.replace("-", "–")} schools, ${name} included; their schools pupil-weighted, each counted once.`)] : []),
    opt("non_group", "non_group:england", "Non-group schools", sector === "independent" ? "Standalone independent schools in England (in no independent group)." : "LA-maintained schools and single-academy trusts in England (in no MAT or federation)."),
    opt("areas", "areas:la", `All schools in ${name}’s areas`, `Every school in the LAs where ${name}’s schools sit, weighted to ${name}’s pupils in each.`),
    opt("england", "england:england", "England", "Every school in England with the figure."),
    opt("mix_matched", "mix_matched:non_group", mixMatchedLabel(name), `Non-group schools in ${name}’s regions, reweighted to its mix of phases and regions, so the gap isn’t geography.`),
    ...namedIds(input.compare).map((id) => opt(`peer_named:${id}` as CompareKey, `peer_named:${id}`, input.namedLabels?.[id] ?? sets.find((s) => s.key === `peer_named:${id}`)?.label ?? id, "A named group of the same type, its own figures.")),
  ];
  const chosen = chosenSets(sets, input.compare);
  const cmpLabel = input.compare.startsWith("peer_named:") ? chosen.map((s) => s.label).join(", ") || "named groups" : (options.find((o) => o.key === input.compare)?.label ?? "Peer groups");

  // Trends: like-for-like roll index, the group against the chosen set(s); results by phase; share.
  const lineOf = (s: SetRef, phase: Phase) => chainedIndex(s.rows.filter((r) => r.phase === phase).sort((a, b) => a.period - b.period));
  const rollLines = [sets[0], ...chosen].map((s) => ({ key: s.key, label: s.label, pts: lineOf(s, focus) }));
  const resMeasures = focus === "all" ? ["ks4_a8", "ks5_aps_alevel", "ks2_rwm"] : [HEADLINE[focus]];
  const results = resMeasures
    .filter((m) => latest[m] !== null)
    .map((m) => ({
      measure: m,
      label: MEASURE_LABEL[m],
      unit: MEASURE_UNIT[m],
      lines: [sets[0], ...chosen].map((s) => {
        const rs = s.rows.filter((r) => r.phase === MEASURE_PHASE[m]).sort((a, b) => a.period - b.period);
        const ys = agg.rows.filter((r) => r.phase === MEASURE_PHASE[m] && fig(r.figures, m)?.n_with_figure).map((r) => r.period);
        const years = [...new Set(ys)].sort((a, b) => a - b);
        const pick = (y: number) => fig(rs.find((r) => r.period === y)?.figures, m);
        return { key: s.key, label: s.label, pts: years.map((y) => ({ year: y, value: pick(y)?.weighted ?? null })), average: years.map((y) => ({ year: y, value: pick(y)?.average_school ?? null })), n: years.map((y) => pick(y)?.n_with_figure ?? null) };
      }),
    }));
  const sh = ph.share;
  const shareSeries = rowsOf(agg, focus).map((r) => ({ year: r.period, value: r.figures.share?.pct ?? null }));

  return {
    kind: "overview",
    group: { id: agg.group.group_id, name, typeLabel: GROUP_TYPE_LABEL[agg.group.type] ?? agg.group.type, type: agg.group.type, sources: agg.membership.sources, asOf: agg.membership.as_of, confirmed: agg.membership.confirmed, likely: agg.membership.likely, outsideEngland: agg.membership.outside_england },
    reading,
    focus,
    compare: { key: input.compare, label: cmpLabel, n: chosen[0] ? nOf(chosen[0].key) : null, options },
    years: { census, first, results: latest },
    now: {
      schools: ph.n_schools,
      byPhase: all.schools_by_phase ?? { primary: 0, secondary: 0, post16: 0 },
      roll: ph.roll,
      change: changes,
      sinceFirst: firstAll && firstAll.roll > 0 ? Math.round((1000 * (ph.roll - firstAll.roll)) / firstAll.roll) / 10 : null,
      sizeBands: all.size_bands ?? {},
      regions: regionsList,
      las: lasList,
      boarders: all.boarders ?? 0,
      outside: excludedRoll.filter((e) => e.reason === "outside_england"),
      rollExcluded: excludedRoll,
    },
    against: { columns: measures, rows, counts, place, mixAvailable: sets.some((s) => s.kind === "mix_matched") },
    peerPlaces: places,
    trends: {
      roll: { lines: rollLines },
      results,
      share: {
        sector: sh?.sector ?? "all",
        phase: focus,
        pct: sh?.pct ?? null,
        las: (sh?.las ?? []).map((l) => ({ code: l.la_code, name: l.la_name, pct: l.pct, group: l.group_pupils, total: l.la_pupils })),
        regions: (sh?.regions ?? []).map((r) => ({ code: r.region_code, name: REGION_NAMES[r.region_code] ?? r.region_code, pct: r.pct })),
        series: shareSeries,
      },
    },
  };
}

// ---------------------------------------------------------------------------------- the schools

export type SchoolRow = {
  urn: string;
  name: string;
  confidence: "confirmed" | "likely";
  current: boolean;
  outsideEngland: boolean;
  phases: ("primary" | "secondary" | "post16")[];
  ages: string | null;
  roll: number | null;
  size: string | null;
  shape: string | null;
  headline: { measure: string; label: string; value: number; year: number } | null;
  reason: string | null;
  inGroup: Place | null;
  national: Place | null;
  va: { measure: string; value: number; year: number } | null;
  vaNote: string | null;
  trend: number | null;
  rollsByYear: Pt[];
  rollByAge: number[];
  basis: string;
  joined: string | null;
  lastSeen: string | null;
  link: { kind: "smt" | "public"; href: string };
};

export type GroupSchools = {
  kind: "schools";
  group: GroupOverview["group"];
  reading: Reading;
  focus: Focus;
  years: { census: number; first: number; results: Record<string, number | null> };
  rows: SchoolRow[];
  counts: { listed: number; shown: number; withHeadline: number; withoutHeadline: number };
};

const REASON_WORDS: Record<string, string> = {
  outside_england: "outside England: no DfE data",
  igcse: "IGCSE: not ranked at GCSE",
  prep_no_ks2: "prep: no KS2 published",
  not_yet_open: "not yet open",
  no_census: "no census return",
  closed: "closed",
  not_published: "not published (independent)",
  no_results_published: "no results published",
};
export const reasonWords = (r: string, meta?: Record<string, string>): string => REASON_WORDS[r] ?? meta?.[r] ?? r;

function agesOf(byAge: number[]): string | null {
  const ages = byAge.map((n, a) => (n >= 3 ? a : -1)).filter((a) => a >= 0);
  if (!ages.length) return null;
  return `${ages[0]}–${ages[ages.length - 1] + 1}`;
}

function shapeLabel(byAge: number[]): string | null {
  const counts: AgeGenderCounts = new Map();
  byAge.forEach((n, a) => {
    if (n > 0) counts.set(a, { male: n, female: 0 });
  });
  try {
    const l = shapeOf(counts);
    return l ? SHAPE_LABELS[l] : null;
  } catch {
    return null;
  }
}

/** The headline a school shows in a focus: the phase's own; on All phases, the headline it has (GCSE,
 * then A level, then KS2), else its main phase's (the phase with most pupils), so a prep reads "prep: no
 * KS2 published" rather than a missing GCSE. */
function headlineMeasure(focus: Focus, byPhase: Record<string, number> | null, has: (m: string) => boolean): string | null {
  if (focus !== "all") return HEADLINE[focus];
  for (const m of ["ks4_a8", "ks5_aps_alevel", "ks2_rwm"]) if (has(m)) return m;
  if (!byPhase) return null;
  const main = (["primary", "secondary", "post16"] as const).reduce((a, b) => ((byPhase[b] ?? 0) > (byPhase[a] ?? 0) ? b : a));
  return (byPhase[main] ?? 0) > 0 ? HEADLINE[main] : null;
}

export function buildSchools(input: {
  agg: GroupAggregate;
  schools: SchoolYearRow[];
  focus: Focus;
  members?: { urn: string; joined: string | null; lastSeen: string | null }[];
  vicdata?: Set<string>;
  // Head office (and View as) opens a member school's SMT read-only (round 1's rule); a member school's
  // SMT opens the public page of every other school.
  headOffice?: boolean;
  name?: string;
}): GroupSchools {
  const { agg, focus } = input;
  const reading = agg.reading;
  const census = latestCensus(agg);
  const first = firstCensus(agg);
  const latest: Record<string, number | null> = {};
  for (const m of Object.keys(MEASURE_PHASE)) latest[m] = latestFor(agg, m);
  const excludedBy = (measure: string, urn: string): string | null => {
    const y = latest[measure];
    const f = y !== null ? figOf(agg, y, MEASURE_PHASE[measure]) : null;
    return f?.excluded?.[measure]?.find((e) => e.urn === urn)?.reason ?? null;
  };
  const members = input.schools.filter((s) => s.role === "member");
  const mem = new Map((input.members ?? []).map((m) => [m.urn, m]));

  // In-group ranks: each headline, its own latest year, over the member schools with a figure (IGCSE
  // schools out at GCSE), ties sharing a place.
  const inGroup = new Map<string, Map<string, Place>>();
  for (const m of ["ks4_a8", "ks5_aps_alevel", "ks2_rwm"]) {
    const y = latest[m];
    if (y === null) continue;
    inGroup.set(
      m,
      rankWithin(
        members.map((s) => {
          const yr = s.years.find((x) => x.period === y);
          const f = yr && (reading === "at_time" ? yr.at_time : yr.listed_now) ? yr.figures : null;
          const v = f && !(m.startsWith("ks4") && f.igcse) ? (f.results[m] ?? null) : null;
          return { key: s.urn, value: v };
        }),
      ),
    );
  }

  const rows: SchoolRow[] = members.map((s) => {
    const now = s.years.find((y) => y.period === census);
    const f = now?.figures ?? null;
    const lastWith = [...s.years].reverse().find((y) => y.figures)?.figures ?? null;
    const phases = (f ?? lastWith)?.phases ?? [];
    const byAge = (f ?? lastWith)?.roll_by_age ?? [];
    const has = (m: string) => {
      const y = latest[m];
      const yf = y !== null ? s.years.find((x) => x.period === y)?.figures : null;
      return !!yf?.results[m] && !(m.startsWith("ks4") && yf.igcse);
    };
    const hm = headlineMeasure(focus, (f ?? lastWith)?.roll_by_phase ?? null, has);
    let headline: SchoolRow["headline"] = null;
    let reason: string | null = null;
    let national: Place | null = null;
    if (hm) {
      const y = latest[hm];
      const yf = y !== null ? s.years.find((x) => x.period === y)?.figures : null;
      const v = yf?.results[hm];
      if (s.outside_england) reason = reasonWords("outside_england");
      else if (yf?.igcse && hm.startsWith("ks4")) reason = reasonWords("igcse");
      else if (v !== undefined && v !== null && y !== null) {
        headline = { measure: hm, label: MEASURE_SHORT[hm], value: v, year: y };
        national = yf?.national_rank[hm] ?? null;
      } else reason = reasonWords(excludedBy(hm, s.urn) ?? (s.establishment_type_group === "Independent schools" && hm === "ks2_rwm" ? "prep_no_ks2" : !f ? "not_yet_open" : "no_results_published"), agg.build?.meta.reasons);
    } else if (s.outside_england) reason = reasonWords("outside_england");
    else reason = f ? reasonWords("no_results_published") : reasonWords("not_yet_open");
    const vaM = phases.includes("post16") ? "ks5_va_alevel" : phases.includes("secondary") ? "ks4_p8" : null;
    const vy = vaM ? latest[vaM] : null;
    const vv = vaM && vy !== null ? s.years.find((x) => x.period === vy)?.figures?.value_added[vaM] : undefined;
    const independent = s.establishment_type_group === "Independent schools";
    const m = mem.get(s.urn);
    const link = input.headOffice && input.vicdata?.has(s.urn) ? { kind: "smt" as const, href: `/teacher/smt?headOffice=${s.urn}` } : { kind: "public" as const, href: `/schools/${s.urn}` };
    return {
      urn: s.urn,
      name: s.name ?? s.urn,
      confidence: s.confidence,
      current: s.years.some((y) => y.listed_now),
      outsideEngland: s.outside_england,
      phases,
      ages: agesOf(byAge),
      roll: f ? f.roll : null,
      size: f?.size_band ?? null,
      shape: byAge.length ? shapeLabel(byAge) : null,
      headline,
      reason,
      inGroup: headline ? (inGroup.get(headline.measure)?.get(s.urn) ?? null) : null,
      national,
      va: vaM && vv !== undefined && vv !== null && vy !== null ? { measure: vaM, value: vv, year: vy } : null,
      vaNote: vaM && (vv === undefined || vv === null) ? (independent && vaM === "ks4_p8" ? "not published (independent)" : "not published") : null,
      // R-ROLL-WORDS-3YR: the 3-year roll change; a school without a census three years back (no
      // database figure) uses the longest span it has, from its own yearly rolls to this census.
      trend: f?.trend[GROWING_SPAN] ?? shorterSpan(s.years.map((y) => ({ year: y.period, value: y.figures ? y.figures.roll : null })), census),
      rollsByYear: s.years.map((y) => ({ year: y.period, value: y.figures ? y.figures.roll : null })),
      rollByAge: byAge,
      basis: s.basis,
      joined: m?.joined ?? null,
      lastSeen: m?.lastSeen ?? null,
      link,
    };
  });
  const shown = rows.filter((r) => r.current && (focus === "all" || r.phases.includes(focus as never) || (r.outsideEngland && focus === "post16")));
  shown.sort((a, b) => (b.roll ?? -1) - (a.roll ?? -1) || a.name.localeCompare(b.name));
  return {
    kind: "schools",
    group: { id: agg.group.group_id, name: input.name ?? displayName(agg.group.name), typeLabel: GROUP_TYPE_LABEL[agg.group.type] ?? agg.group.type, type: agg.group.type, sources: agg.membership.sources, asOf: agg.membership.as_of, confirmed: agg.membership.confirmed, likely: agg.membership.likely, outsideEngland: agg.membership.outside_england },
    reading,
    focus,
    years: { census, first, results: latest },
    rows: shown,
    counts: { listed: rows.filter((r) => r.current).length, shown: shown.length, withHeadline: shown.filter((r) => r.headline).length, withoutHeadline: shown.filter((r) => !r.headline).length },
  };
}
