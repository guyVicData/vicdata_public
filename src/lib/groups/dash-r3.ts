// VicData 0.8 groups r3 (A, P): the Academic and Pupils dashboards' data, from the same three group
// lookups (aggregates.ts) as round 2. Pure: it selects and words what the database computed. The few
// orderings and summaries made here run over the lookups' own school figures: ranks within the group
// (ties shared, IGCSE out at GCSE), the group's lowest / median / highest school, how many schools
// improved, each school's main entry cohort and Year 12 against Year 11.
import { TREND_BASE_PERIOD } from "@/catalogue/years";
import type { ComparisonRow, Excluded, Figures, GroupAggregate, MeasureFig, Phase, Place, SchoolYearRow, SubjectArea } from "./aggregates";
import { buildOverview, chosenSets, fig, firstCensus, latestCensus, latestFor, MEASURE_LABEL, MEASURE_PHASE, rankWithin, reasonWords, setsFor, type CompareKey, type Focus, type GroupOverview } from "./dash";

type Pt = { year: number; value: number | null };
type Ph = Exclude<Phase, "all">;

// The measures each phase shows on Academic (the wireframe: Attainment 8 and grade 5+ at GCSE).
export const ACADEMIC_MEASURES: Record<Ph, string[]> = {
  secondary: ["ks4_a8", "ks4_em5", "ks4_em4"],
  post16: ["ks5_aps_alevel", "ks5_aps_all"],
  primary: ["ks2_rwm"],
};
export const VA_OF: Record<Ph, string | null> = { secondary: "ks4_p8", post16: "ks5_va_alevel", primary: null };
// "Improved / steady / fell" since 2022/23: a change smaller than this either way is steady.
export const STEADY: Record<string, number> = { ks4_a8: 1, ks4_em5: 2, ks4_em4: 2, ks5_aps_alevel: 1, ks5_aps_all: 1, ks2_rwm: 2 };

const figAt = (rows: { period: number; phase: Phase; figures: Figures }[], p: number | null, ph: Phase) => (p === null ? null : (rows.find((r) => r.period === p && r.phase === ph)?.figures ?? null));
const median = (v: number[]) => {
  if (!v.length) return null;
  const s = [...v].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const memberOf = (s: SchoolYearRow, p: number, reading: "at_time" | "listed_now") => {
  const y = s.years.find((x) => x.period === p);
  return !!y && (reading === "at_time" ? y.at_time : y.listed_now);
};

// ---------------------------------------------------------------------------------------- Academic

export type PhaseHeadline = {
  phase: Ph;
  year: number | null;
  measures: { measure: string; label: string; group: MeasureFig | null; set: MeasureFig | null; england: MeasureFig | null; place: Place | null }[];
  inPhase: number;
  withFigure: number;
  excluded: Excluded[];
  spread: { lowest: number | null; median: number | null; highest: number | null; n: number };
};
export type RankedRow = { urn: string; name: string; value: number | null; reason: string | null; inGroup: Place | null; national: Place | null; likely: boolean; year: number | null };
export type AreaRow = { familyId: string; label: string; group: SubjectArea | null; england: number | null; set: number | null; gap: number | null };
export type VaRow = { urn: string; name: string; measure: string; value: number | null; year: number | null; note: string | null };

export type GroupAcademic = {
  kind: "academic";
  overview: GroupOverview; // the group, the reading, the comparison choice and the trends, as round 2 builds them
  post16: GroupOverview["trends"]["results"] | null; // A-level points over the years, against the set
  focus: Focus;
  phases: Ph[];
  headlines: PhaseHeadline[];
  ranked: { phase: Ph; measure: string; year: number | null; rows: RankedRow[]; groupMedian: number | null; set: { label: string; value: number | null; n: number | null } | null; nonGroup: number | null; england: number | null };
  areas: { stage: "ks4" | "ks5" | null; year: number | null; rows: AreaRow[]; min: { schools: number; entries: number } | null; strengths: string[]; weaknesses: string[] };
  va: { alevel: { group: MeasureFig | null; england: number | null; year: number | null; rows: VaRow[] }; p8: { group: MeasureFig | null; year: number | null; rows: VaRow[]; notPublished: number } };
  improving: { phase: Ph; measure: string; from: number; to: number | null; improved: number; steady: number; fell: number; of: number; threshold: number };
};

/** The phases on show for a focus: the focus itself, or (All phases) every phase the group has. */
export function phasesFor(agg: GroupAggregate, focus: Focus): Ph[] {
  const census = latestCensus(agg);
  const by = agg.rows.find((r) => r.period === census && r.phase === "all")?.figures.schools_by_phase ?? { primary: 0, secondary: 0, post16: 0 };
  const all: Ph[] = (["secondary", "post16", "primary"] as Ph[]).filter((p) => (by[p] ?? 0) > 0);
  return focus === "all" ? all : [focus];
}

export function buildAcademic(input: { agg: GroupAggregate; comps: ComparisonRow[]; schools: SchoolYearRow[]; compare: CompareKey; focus: Focus; name?: string; namedLabels?: Record<string, string> }): GroupAcademic {
  const { agg, comps, schools, focus } = input;
  const reading = agg.reading;
  const overview = buildOverview({ agg, comps, compare: input.compare, focus, name: input.name, namedLabels: input.namedLabels });
  const sets = setsFor(agg, comps, reading, overview.group.name);
  const chosen = chosenSets(sets, input.compare)[0] ?? null;
  const england = sets.find((s) => s.key === "england:england") ?? null;
  const nonGroup = sets.find((s) => s.key === "non_group:england") ?? null;
  const phases = phasesFor(agg, focus);
  const members = schools.filter((s) => s.role === "member");
  const meta = agg.build?.meta;

  const headlines: PhaseHeadline[] = phases.map((ph) => {
    const ms = ACADEMIC_MEASURES[ph];
    const year = latestFor(agg, ms[0]);
    const g = figAt(agg.rows, year, ph);
    const values = members.map((s) => (memberOf(s, year ?? -1, reading) ? s.years.find((y) => y.period === year)?.figures : null)).map((f) => (f && !(ph === "secondary" && f.igcse) ? (f.results[ms[0]] ?? null) : null)).filter((v): v is number => v !== null);
    return {
      phase: ph,
      year,
      measures: ms.map((m) => ({
        measure: m,
        label: MEASURE_LABEL[m],
        group: fig(g, m),
        set: chosen ? fig(figAt(chosen.rows, year, ph), m) : null,
        england: england ? fig(figAt(england.rows, year, ph), m) : null,
        place: g?.peer?.places?.[m] ?? null,
      })),
      inPhase: g?.n_schools ?? 0,
      withFigure: fig(g, ms[0])?.n_with_figure ?? 0,
      excluded: g?.excluded?.[ms[0]] ?? [],
      spread: { lowest: values.length ? Math.min(...values) : null, median: median(values), highest: values.length ? Math.max(...values) : null, n: values.length },
    };
  });

  // Schools ranked: the first phase's headline, its own latest year.
  const rph = phases[0] ?? "secondary";
  const rm = ACADEMIC_MEASURES[rph][0];
  const ry = latestFor(agg, rm);
  const inPhase = members.filter((s) => s.years.some((y) => y.listed_now) && (s.years.find((y) => y.period === (ry ?? -1))?.figures?.phases.includes(rph) || !!s.years.find((y) => y.period === (ry ?? -1))?.figures?.results[rm] || s.outside_england));
  const within = rankWithin(inPhase.map((s) => {
    const f = s.years.find((y) => y.period === ry)?.figures;
    return { key: s.urn, value: f && !(rph === "secondary" && f.igcse) && memberOf(s, ry ?? -1, reading) ? (f.results[rm] ?? null) : null };
  }));
  const excludedNow = new Map((figAt(agg.rows, ry, rph)?.excluded?.[rm] ?? []).map((e) => [e.urn, e.reason]));
  const rankedRows: RankedRow[] = inPhase.map((s) => {
    const f = s.years.find((y) => y.period === ry)?.figures ?? null;
    const igcse = rph === "secondary" && !!f?.igcse;
    const member = memberOf(s, ry ?? -1, reading);
    const v = f && !igcse && member ? (f.results[rm] ?? null) : null;
    const reason = v !== null ? null : s.outside_england ? reasonWords("outside_england") : igcse ? reasonWords("igcse") : f && !member && f.results[rm] !== undefined ? `joined after ${ry !== null ? `${ry}/${String((ry + 1) % 100).padStart(2, "0")}` : "that year"}` : reasonWords(excludedNow.get(s.urn) ?? (!f ? "not_yet_open" : s.establishment_type_group === "Independent schools" && rph === "primary" ? "prep_no_ks2" : "no_results_published"), meta?.reasons);
    return { urn: s.urn, name: s.name ?? s.urn, value: v, reason, inGroup: within.get(s.urn) ?? null, national: v !== null ? (f?.national_rank[rm] ?? null) : null, likely: s.confidence === "likely", year: ry };
  });
  rankedRows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.name.localeCompare(b.name));
  const groupVals = rankedRows.map((r) => r.value).filter((v): v is number => v !== null);

  // Subject areas: GCSE (secondary or All phases) or post-16.
  const stage: "ks4" | "ks5" | null = rph === "post16" ? "ks5" : rph === "secondary" ? "ks4" : null;
  const sphase: Phase = stage === "ks5" ? "post16" : "secondary";
  const subjYears = stage ? agg.rows.filter((r) => r.phase === sphase && (r.figures.subject_areas?.[stage]?.length ?? 0) > 0).map((r) => r.period) : [];
  const sy = subjYears.length ? Math.max(...subjYears) : null;
  const ga = stage && sy !== null ? (figAt(agg.rows, sy, sphase)?.subject_areas?.[stage] ?? []) : [];
  const ppeOf = (rows: { period: number; phase: Phase; figures: Figures }[] | undefined, fam: string) => (stage && sy !== null && rows ? (figAt(rows, sy, sphase)?.subject_areas?.[stage]?.find((x) => x.family_id === fam)?.points_per_entry ?? null) : null);
  const famLabel = new Map((meta?.subject_families ?? []).map((f) => [f.family_id, f.label]));
  const famOrder = new Map((meta?.subject_families ?? []).map((f) => [f.family_id, f.sort]));
  const areaRows: AreaRow[] = ga
    .map((a) => {
      const e = ppeOf(england?.rows, a.family_id);
      return { familyId: a.family_id, label: famLabel.get(a.family_id) ?? a.family_id, group: a, england: e, set: ppeOf(chosen?.rows, a.family_id), gap: a.shown && a.points_per_entry !== null && e !== null ? Math.round((a.points_per_entry - e) * 100) / 100 : null };
    })
    .sort((a, b) => (famOrder.get(a.familyId) ?? 99) - (famOrder.get(b.familyId) ?? 99));
  const ranked = areaRows.filter((r) => r.gap !== null).sort((a, b) => b.gap! - a.gap!);
  const strengths = ranked.filter((r) => r.gap! > 0).slice(0, 2).map((r) => r.label);
  const weaknesses = ranked.filter((r) => r.gap! < 0).slice(-2).reverse().map((r) => r.label);

  // Value added, its own panel: A-level VA for every school where published; Progress 8 for state schools.
  const vaRows = (measure: string): { year: number | null; rows: VaRow[] } => {
    const y = latestFor(agg, measure);
    const ph = MEASURE_PHASE[measure];
    const rows = members
      .filter((s) => s.years.some((x) => x.listed_now) && (s.years.find((x) => x.period === y)?.figures?.phases.includes(ph) || s.years.find((x) => x.period === y)?.figures?.value_added[measure] !== undefined))
      .map((s) => {
        const v = s.years.find((x) => x.period === y)?.figures?.value_added[measure] ?? null;
        const ind = s.establishment_type_group === "Independent schools";
        return { urn: s.urn, name: s.name ?? s.urn, measure, value: v, year: y, note: v !== null ? null : measure === "ks4_p8" && ind ? "not published (independent)" : "not published" };
      })
      .sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity) || a.name.localeCompare(b.name));
    return { year: y, rows };
  };
  const al = vaRows("ks5_va_alevel");
  const p8 = vaRows("ks4_p8");

  // Improving and declining since 2022/23: each school's headline, the base year against its latest.
  const to = ry;
  let improved = 0, steady = 0, fell = 0;
  for (const s of members.filter((x) => x.years.some((y) => y.listed_now))) {
    const a = s.years.find((y) => y.period === TREND_BASE_PERIOD)?.figures;
    const b = s.years.find((y) => y.period === to)?.figures;
    if (!a || !b || (rph === "secondary" && (a.igcse || b.igcse))) continue;
    const va = a.results[rm];
    const vb = b.results[rm];
    if (va === undefined || vb === undefined) continue;
    const d = vb - va;
    if (d > STEADY[rm]) improved++;
    else if (d < -STEADY[rm]) fell++;
    else steady++;
  }

  const p16 = phasesFor(agg, "all").includes("post16") ? buildOverview({ agg, comps, compare: input.compare, focus: "post16", name: input.name, namedLabels: input.namedLabels }).trends.results : null;
  return {
    kind: "academic",
    overview,
    post16: p16 && p16.length ? p16 : null,
    focus,
    phases,
    headlines,
    ranked: {
      phase: rph,
      measure: rm,
      year: ry,
      rows: rankedRows,
      groupMedian: median(groupVals),
      set: chosen ? { label: chosen.label, value: fig(figAt(chosen.rows, ry, rph), rm)?.weighted ?? null, n: fig(figAt(chosen.rows, ry, rph), rm)?.n_with_figure ?? null } : null,
      nonGroup: nonGroup ? (fig(figAt(nonGroup.rows, ry, rph), rm)?.weighted ?? null) : null,
      england: england ? (fig(figAt(england.rows, ry, rph), rm)?.weighted ?? null) : null,
    },
    areas: { stage, year: sy, rows: areaRows, min: meta?.subject_min ?? null, strengths, weaknesses },
    va: {
      alevel: { group: fig(figAt(agg.rows, al.year, "post16"), "ks5_va_alevel"), england: england ? (fig(figAt(england.rows, al.year, "post16"), "ks5_va_alevel")?.weighted ?? null) : null, year: al.year, rows: al.rows },
      p8: { group: fig(figAt(agg.rows, p8.year, "secondary"), "ks4_p8"), year: p8.year, rows: p8.rows.filter((r) => r.note !== "not published (independent)"), notPublished: p8.rows.filter((r) => r.note === "not published (independent)").length },
    },
    improving: { phase: rph, measure: rm, from: TREND_BASE_PERIOD, to, improved, steady, fell, of: improved + steady + fell, threshold: STEADY[rm] },
  };
}

// ----------------------------------------------------------------------------------------- Pupils

export type EntryCohort = { urn: string; name: string; age: number; pts: Pt[] };
export type LeavingRow = { urn: string; name: string; y11: number | null; y12: number | null; pct: number | null; year: number };
export type MarketRow = { urn: string; name: string; la: string | null; phase: Ph; pupils: number; laPupils: number | null; pct: number | null };

export type GroupPupils = {
  kind: "pupils";
  overview: GroupOverview;
  focus: Focus;
  shape: { year: number; first: number; ages: number[]; firstAges: number[] };
  rollByPhase: Record<"primary" | "secondary" | "post16", number>;
  stayingOn: { year: number; y12: number; y11: number; pct: number | null; schools: number };
  boarding: { boarders: number; day: number; schools: number };
  entries: EntryCohort[];
  leaving: LeavingRow[];
  market: { label: string; rows: MarketRow[] };
  growing: { growing: number; shrinking: number; of: number; from: number };
};

/** A school's main entry age: the age with the largest rise in pupils over the age below (Reception
 * at 4, Year 7 at 11, Year 12 at 16 ...); its first age with pupils where nothing rises. */
export function entryAge(byAge: number[]): number | null {
  let best: number | null = null;
  let rise = 0;
  for (let a = 1; a < byAge.length; a++) {
    const d = (byAge[a] ?? 0) - (byAge[a - 1] ?? 0);
    if (d > rise && (byAge[a] ?? 0) >= 10) {
      rise = d;
      best = a;
    }
  }
  if (best !== null) return best;
  const first = byAge.findIndex((n) => n >= 10);
  return first >= 0 ? first : null;
}

export function buildPupils(input: { agg: GroupAggregate; comps: ComparisonRow[]; schools: SchoolYearRow[]; compare: CompareKey; focus: Focus; name?: string; namedLabels?: Record<string, string> }): GroupPupils {
  const { agg, schools, focus } = input;
  const reading = agg.reading;
  const overview = buildOverview({ agg, comps: input.comps, compare: input.compare, focus, name: input.name, namedLabels: input.namedLabels });
  const census = latestCensus(agg);
  const first = firstCensus(agg);
  const all = agg.rows.find((r) => r.period === census && r.phase === "all")!.figures;
  const firstAll = agg.rows.find((r) => r.period === first && r.phase === "all")?.figures;
  const members = schools.filter((s) => s.role === "member" && s.years.some((y) => y.listed_now));
  const f = (s: SchoolYearRow, p: number) => (memberOf(s, p, reading) ? (s.years.find((y) => y.period === p)?.figures ?? null) : null);

  // Year 12 against Year 11 (SMT round 2's wording): pupils aged 16 this year against those aged 15 last
  // year, over the group's schools with a sixth form both years.
  let y12 = 0, y11 = 0, n6 = 0;
  for (const s of members) {
    const a = f(s, census);
    const b = f(s, census - 1);
    if (!a || !b || !a.phases.includes("post16")) continue;
    y12 += a.roll_by_age[16] ?? 0;
    y11 += b.roll_by_age[15] ?? 0;
    n6++;
  }
  const leaving: LeavingRow[] = [];
  for (const s of members) {
    const a = f(s, census);
    const b = f(s, census - 1);
    if (!a || !b || !a.phases.includes("post16") || !(b.roll_by_age[15] > 0)) continue;
    leaving.push({ urn: s.urn, name: s.name ?? s.urn, y11: b.roll_by_age[15], y12: a.roll_by_age[16], pct: Math.round((1000 * a.roll_by_age[16]) / b.roll_by_age[15]) / 10, year: census });
  }
  leaving.sort((x, y) => (y.pct ?? 0) - (x.pct ?? 0));

  // Entry cohorts: each school's main entry point, its cohort each year.
  const entries: EntryCohort[] = members
    .map((s) => {
      const now = f(s, census) ?? [...s.years].reverse().find((y) => y.figures)?.figures ?? null;
      const age = now ? entryAge(now.roll_by_age) : null;
      if (age === null) return null;
      return { urn: s.urn, name: s.name ?? s.urn, age, pts: s.years.map((y) => ({ year: y.period, value: y.figures && (reading === "at_time" ? y.at_time : y.listed_now) ? (y.figures.roll_by_age[age] ?? null) : null })) };
    })
    .filter((x): x is EntryCohort => !!x)
    .sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));

  // Market share: each school's share of its own LA's places in its main phase (the ingest's LA
  // totals). Admissions' rivals-based share is per school and isn't held for the group (logged).
  const laTotals = new Map<string, Map<Ph, number | null>>();
  for (const ph of ["primary", "secondary", "post16"] as Ph[]) {
    const g = agg.rows.find((r) => r.period === census && r.phase === ph)?.figures;
    for (const l of g?.share?.las ?? []) (laTotals.get(l.la_name) ?? laTotals.set(l.la_name, new Map()).get(l.la_name)!).set(ph, l.la_pupils);
  }
  const market: MarketRow[] = members
    .map((s) => {
      const now = f(s, census);
      if (!now || s.outside_england) return null;
      const ph = (["secondary", "primary", "post16"] as Ph[]).reduce((a, b) => ((now.roll_by_phase[b] ?? 0) > (now.roll_by_phase[a] ?? 0) ? b : a));
      const total = s.la_name ? (laTotals.get(s.la_name)?.get(ph) ?? null) : null;
      const pupils = now.roll_by_phase[ph] ?? 0;
      return { urn: s.urn, name: s.name ?? s.urn, la: s.la_name, phase: ph, pupils, laPupils: total, pct: total ? Math.round((1000 * pupils) / total) / 10 : null };
    })
    .filter((x): x is MarketRow => !!x)
    .sort((a, b) => (b.pct ?? 0) - (a.pct ?? 0));

  const ch = (focus === "all" ? all : (agg.rows.find((r) => r.period === census && r.phase === focus)?.figures ?? all)).change?.["1"];
  return {
    kind: "pupils",
    overview,
    focus,
    shape: { year: census, first, ages: all.roll_by_age ?? [], firstAges: firstAll?.roll_by_age ?? [] },
    rollByPhase: all.roll_by_phase ?? { primary: 0, secondary: 0, post16: 0 },
    stayingOn: { year: census, y12, y11, pct: y11 ? Math.round((1000 * y12) / y11) / 10 : null, schools: n6 },
    boarding: { boarders: all.boarders ?? 0, day: all.roll - (all.boarders ?? 0), schools: members.filter((s) => (f(s, census)?.boarders ?? 0) > 0).length },
    entries,
    leaving,
    market: { label: "Share of its LA's places in its main phase", rows: market },
    growing: { growing: ch?.growing ?? 0, shrinking: ch?.shrinking ?? 0, of: ch?.same_schools ?? 0, from: census - 1 },
  };
}
