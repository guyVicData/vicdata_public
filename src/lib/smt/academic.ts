// VicData 0.8 SMT round 1: Academic, top-down (spec §2.3; wireframe Academic). Server-only.
// Whole school -> a phase -> a subject area -> its subjects, where the subject explorer (Teacher)
// takes over with the same set (?set=). Every figure comes from an existing read:
//   headlines and value added   the headline snapshot (population.ts), 0.6.6's ranks
//   subject areas               Admissions' strengths and weaknesses (buildRivals), against the set
//   subjects                    Teacher's own subject ranking (subjectRanking: points, set and England)
//   grade profile               the school's grade rows (fetchSubjectLevelDataForSchools, as Teacher)
//   entries mix                 the subject rows' entries, year by year
import { SUBJECT_AREA_MIN } from "@/catalogue/notes";
import { HISTORIC_GRADE_FROM, TREND_BASE_PERIOD, periodLabel } from "@/catalogue/years";
import { smtNote } from "@/catalogue/notes";
import { cachedReference } from "../server-cache";
import { fetchSubjectHeadlineForSchools, fetchSubjectLevelDataForSchools } from "../academic-data-view";
import { lookupAcademicSubjectFamily } from "../vicdata-reference";
import { subjectRanking } from "../subject-ranking";
import { cachedRankingPopulation } from "../chooser-sets";
import { defaultRankingFilters, matchesRanking, NATIONAL } from "../comparator-chooser";
import { buildRivals } from "../admissions/rivals";
import { familyLabels } from "../admissions/family-labels";
import { entryPoint } from "../admissions/entry-points";
import { percentile } from "../admissions/stats";
import { MIN_SUBJECT_ENTRIES_UI, type SmtLevel } from "./levels";
import { areaSetPlace, figure, placesOn, population, setPlace, SMT_MEASURES, VA_QUALS, type Population } from "./population";
import type { SmtSchool } from "./school";
import { igcseExcluded, middleHalf, p8Of, type BandPt, type P8, type Pt, type Rank, type SmtSet } from "./overview";
import { igcseFamilyOut } from "../igcse";

export const MIN_SUBJECT_ENTRIES = MIN_SUBJECT_ENTRIES_UI; // R-SMT-SMALL-ENTRIES: a subject needs this many to be ranked
export const MAX_SUBJECTS = 16;

export type Tile = { key: string; label: string; value: number | null; unit: "pupils" | "points" | "grade" | "pct" | "va" | "share" | "rank"; period: number | null; sub: string; set: (Rank & { label: string }) | null; england: Rank | null; note: "igcse" | "none" | null };

export type SubjectRow = {
  subject: string;
  qualification: string;
  familyId: string | null;
  entries: number;
  avg: number | null; // Teacher's average points for the subject (GCSE grade points; A-level points)
  set: Rank | null;
  england: Rank | null;
  since: number | null; // the change in avg since 2022/23
  ranked: boolean; // false below MIN_SUBJECT_ENTRIES or where the subject has no ranking
  // Why it isn't ranked: too few entries, or a grading scale with no points (an FSMQ, a BTEC).
  reason: "small" | "scale" | null;
};

export type VaRow = { qualification: string; period: number; value: number | null; lo: number | null; hi: number | null; banding: string | null };
export type SubjectVa = { subject: string; qualification: string; period: number; value: number | null; lo: number | null; hi: number | null; entries: number | null };
export type GradeBand = { label: string; entries: number; pct: number };

export type StagePart = {
  stage: "ks4" | "ks5";
  period: number | null;
  provisional: boolean;
  tiles: Tile[];
  areas: { familyId: string; label: string; mine: number; rank: number; of: number; gap: number; gapSince2223: number | null; flags: { id: string; label: string }[] }[];
  overall: string | null;
  subjects: SubjectRow[];
  grades: { period: number | null; bands: GradeBand[]; entries: number };
  trend: { label: string; school: Pt[]; band: BandPt[] };
  mix: { keys: { key: string; label: string }[]; years: { year: number; shares: Record<string, number>; total: number }[] };
};

export type Academic = {
  urn: string;
  level: SmtLevel;
  areaLabel: string | null;
  set: { kind: string; label: string; size: number };
  igcse: boolean;
  parts: StagePart[];
  // KS2 (Primary, or Whole school with a primary phase): the reading, writing and maths headline.
  ks2: Tile[];
  va: { alevel: VaRow[]; subjects: SubjectVa[]; p8: P8; ks2: string | null };
  notes: { since: string; middleHalf: string; mix: string; band: string; smallEntries: string; vaAlevel: string; vaGcse: string };
};

const GCSE_BANDS = [
  { label: "9–7", grades: ["9", "8", "7"] },
  { label: "6–5", grades: ["6", "5"] },
  { label: "4", grades: ["4"] },
  { label: "3–1", grades: ["3", "2", "1", "U"] },
];
const ALEVEL_BANDS = [
  { label: "A*–A", grades: ["A*", "A"] },
  { label: "B", grades: ["B"] },
  { label: "C", grades: ["C"] },
  { label: "D–U", grades: ["D", "E", "U"] },
];
// The main qualification of each stage (the grade profile and the "grade 7+" tiles read it).
const MAIN_QUAL = { ks4: /^GCSE \(9-1\) Full Course$/, ks5: /^GCE A level$/ } as const;

async function nationPop(stage: "ks4" | "ks5"): Promise<string[]> {
  return (await cachedRankingPopulation(null, stage, null)).filter((r) => matchesRanking(r, defaultRankingFilters(NATIONAL))).map((r) => r[0]);
}

async function pool<T, R>(items: T[], n: number, f: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await f(items[i]);
    }
  }));
  return out;
}

async function stagePart(school: SmtSchool, stage: "ks4" | "ks5", area: string | null, set: SmtSet, igcse: Set<string>, pops: Record<"ks4" | "ks5", Population>): Promise<StagePart> {
  const urn = school.urn;
  const latest = school.latest[stage] ?? null;
  const period = latest?.period ?? null;
  const setUrns = set.urns.filter((u) => u !== urn);
  const all = [urn, ...setUrns];
  const stageWord = stage === "ks4" ? "GCSE" : "Post-16";
  const exclude = stage === "ks4" ? igcse : new Set<string>();
  const empty: StagePart = { stage, period, provisional: latest?.provisional ?? false, tiles: [], areas: [], overall: null, subjects: [], grades: { period, bands: [], entries: 0 }, trend: { label: "", school: [], band: [] }, mix: { keys: [], years: [] } };
  if (period === null) return empty;
  // 0.8 IGCSE subjects (R-IGCSE-SUBJECT): an IGCSE school at GCSE keeps its subject rows (each ranked like
  // any other school's), its complete subject areas and its own entries and grades. Only the whole-school
  // tiles (Attainment 8, English and maths) stay out, as the IGCSE tile; an incomplete area isn't ranked.
  const igcseSchool = stage === "ks4" && !!school.phases.igcse;
  const areaOut = area && stage === "ks4" ? await igcseFamilyOut(area, period) : new Set<string>();

  // ------------------------------------------------------------ the school's subject rows
  const { byUrn, subjectFamilyMap } = await cachedReference(`smt:subjects:${urn}:${stage}`, () => fetchSubjectLevelDataForSchools([urn], stage, { gradeYears: "four" }));
  const mine = byUrn.get(urn) ?? { entries: [], valueAdded: [], gradeDistribution: [] };
  const famOf = (s: string) => subjectFamilyMap[s] ?? null;
  const inArea = (s: string) => !area || famOf(s) === area;

  // ------------------------------------------------------------ the family (area) figures, school + set
  const famRows = await cachedReference(`smt:family:${stage}:${all.slice().sort().join(",")}`, () => lookupAcademicSubjectFamily({ entityIds: all, ksStage: stage, periodMin: HISTORIC_GRADE_FROM }));
  const famVal = (u: string, y: number) => {
    const r = famRows.filter((x) => x.entity_id === u && x.period === y && (!area || x.family_id === area) && (x.bucket ?? "all") === "all");
    if (!r.length) return null;
    if (area) return r[0].avg_point_score === null ? null : Number(r[0].avg_point_score);
    return null;
  };
  const famEntries = (u: string, y: number) => famRows.filter((x) => x.entity_id === u && x.period === y && (!area || x.family_id === area) && (x.bucket ?? "all") === "all").reduce((a, x) => a + Number(x.entries_total), 0);

  // ------------------------------------------------------------ tiles
  const tiles: Tile[] = [];
  const headKey = stage === "ks4" ? SMT_MEASURES.ks4.a8 : SMT_MEASURES.ks5.aps;
  const pop = pops[stage];
  const values = (key: string, y: number) => new Map(all.map((u) => [u, figure(pop, u, y, key)]));
  const withLabel = (r: Rank | null) => (r ? { ...r, label: `${set.label} with ${stageWord} results` } : null);
  const entriesNow = area ? famEntries(urn, period) : mine.entries.filter((e) => e.period === period).reduce((a, e) => a + e.entries, 0);
  const allEntries = mine.entries.filter((e) => e.period === period).reduce((a, e) => a + e.entries, 0);
  tiles.push({ key: "entries", label: "Entries", value: entriesNow, unit: "pupils", period, sub: area && allEntries ? `${Math.round((entriesNow / allEntries) * 100)}% of all ${stageWord} entries` : `${stageWord} entries, ${periodLabel(period)}`, set: null, england: null, note: null });
  if (area) {
    const v = famVal(urn, period);
    const setVals = new Map(all.map((u) => [u, { value: famVal(u, period), entries: famEntries(u, period) }]));
    tiles.push({ key: "area_avg", label: stage === "ks4" ? "Average grade" : "Points per entry", value: v, unit: stage === "ks4" ? "grade" : "points", period, sub: `the area's subjects, ${periodLabel(period)}`, set: null, england: null, note: v === null ? "none" : null });
    // S4 (the Academic board): the rank in the set is its own tile, the fourth.
    // 0.8 audit fixes (7): the same minimum as the rows (SUBJECT_AREA_MIN): 10+ entries, 2+ set schools.
    const r = areaOut.has(urn) ? null : areaSetPlace(setVals, urn, areaOut);
    const areaName = school.areas[stage === "ks4" ? "gcse" : "post16"].find((a) => a.id === area)?.label ?? "this area";
    const why = areaOut.has(urn) ? smtNote("igcseAreaNotRanked", { area: areaName }) : setVals.get(urn)!.value === null ? `no ${areaName} figure to rank` : smtNote("areaRankNone", { schools: SUBJECT_AREA_MIN.schools, entries: SUBJECT_AREA_MIN.entries, area: areaName });
    tiles.push({ key: "area_rank", label: `Rank in ${set.label}`, value: r?.rank ?? null, unit: "rank", period, sub: r ? `of ${r.of}, schools with ${SUBJECT_AREA_MIN.entries}+ ${areaName} entries` : why, set: r ? { ...r, label: `${set.label} with ${areaName} results` } : null, england: null, note: r ? null : "none" });
  } else if (igcseSchool) {
    tiles.push({ key: "igcse", label: "GCSE", value: null, unit: "points", period, sub: smtNote("igcseChip"), set: null, england: null, note: "igcse" });
  } else {
    const places = await placesOn(pop, period, headKey, [urn], exclude);
    const p = places.get(urn)!;
    tiles.push({ key: headKey, label: stage === "ks4" ? "Attainment 8" : "A level: points per entry", value: p.value, unit: "points", period, sub: `${periodLabel(period)}`, set: withLabel(setPlace(values(headKey, period), urn, exclude)), england: p.national, note: p.value === null ? "none" : null });
    if (stage === "ks4") {
      const k = SMT_MEASURES.ks4.em5;
      const q = (await placesOn(pop, period, k, [urn], exclude)).get(urn)!;
      tiles.push({ key: k, label: "Grade 5+ in English and maths", value: q.value, unit: "pct", period, sub: periodLabel(period), set: withLabel(setPlace(values(k, period), urn, exclude)), england: q.national, note: q.value === null ? "none" : null });
    } else {
      const k = SMT_MEASURES.ks5.va;
      const vp = [period, period - 1].find((y) => figure(pop, urn, y, k) !== null) ?? period;
      const q = (await placesOn(pop, vp, k, [urn])).get(urn)!;
      tiles.push({ key: k, label: "A-level value added", value: q.value, unit: "va", period: vp, sub: `DfE, ${periodLabel(vp)}`, set: withLabel(setPlace(values(k, vp), urn)), england: q.national, note: q.value === null ? "none" : null });
    }
  }
  // Grade 7+ (GCSE) or A*-A (A level) across the main qualification's subjects in view.
  const gradeRows = mine.gradeDistribution.filter((g) => g.period === period && MAIN_QUAL[stage].test(g.qualificationType) && inArea(g.subject));
  const bandsDef = stage === "ks4" ? GCSE_BANDS : ALEVEL_BANDS;
  const graded = gradeRows.filter((g) => bandsDef.some((b) => b.grades.includes(g.grade)));
  const gradedTotal = graded.reduce((a, g) => a + g.entries, 0);
  const top = graded.filter((g) => bandsDef[0].grades.includes(g.grade)).reduce((a, g) => a + g.entries, 0);
  tiles.push({ key: "top", label: stage === "ks4" ? "Grade 7 and above" : "A*–A", value: gradedTotal ? (top / gradedTotal) * 100 : null, unit: "pct", period, sub: stage === "ks4" ? "GCSE (9-1) entries" : "A-level entries", set: null, england: null, note: gradedTotal ? null : "none" });

  // The wireframe's order with an area: Entries, Average grade, Grade 7 and above (A*-A), Rank.
  const rankAt = tiles.findIndex((t) => t.key === "area_rank");
  if (rankAt >= 0) tiles.push(...tiles.splice(rankAt, 1));

  // ------------------------------------------------------------ grade profile
  const grades = { period, entries: gradedTotal, bands: bandsDef.map((b) => { const n = graded.filter((g) => b.grades.includes(g.grade)).reduce((a, g) => a + g.entries, 0); return { label: b.label, entries: n, pct: gradedTotal ? (n / gradedTotal) * 100 : 0 }; }) };

  // ------------------------------------------------------------ subject areas against the set (Admissions' strengths)
  let areas: StagePart["areas"] = [];
  let overall: string | null = null;
  if (setUrns.length) {
    const ep = entryPoint(stage === "ks4" ? "11+" : "16+")!;
    const r = await cachedReference(`smt:strengths:${urn}:${stage}:${setUrns.slice().sort().join(",")}`, () => buildRivals(urn, ep, { rivals: setUrns }));
    const labels = r.resultsPeriod !== null ? await familyLabels(urn, stage, r.resultsPeriod) : {};
    // 0.8 audit fixes (7): a row needs SUBJECT_AREA_MIN.schools set schools with enough entries (Admissions'
    // builder counts every set school with 10+; `of` includes the school).
    areas = r.areas.filter((a) => a.of - 1 >= SUBJECT_AREA_MIN.schools).map((a) => ({ familyId: a.familyId, label: labels[a.familyId] ?? a.familyId, mine: a.mine, rank: a.rank, of: a.of, gap: a.gap, gapSince2223: a.gapSince2223, flags: a.flags.map((f) => ({ id: f.id, label: f.label })) }));
    const me = r.rows.find((x) => x.isSchool);
    const ranked = r.rows.filter((x) => x.results.value !== null && x.results.note === null);
    if (me && me.results.value !== null && me.results.note === null) overall = `${ranked.filter((x) => (x.results.value ?? 0) > me.results.value!).length + 1} of ${ranked.length}`;
  }

  // ------------------------------------------------------------ subjects in the area, ranked as Teacher ranks them
  const latestRows = mine.entries.filter((e) => e.period === period && inArea(e.subject)).sort((a, b) => b.entries - a.entries).slice(0, MAX_SUBJECTS);
  const nation = await nationPop(stage);
  const setKey = setUrns.slice().sort().join(",");
  const subjects = await pool(latestRows, 4, async (e): Promise<SubjectRow> => {
    const base = { targetUrn: urn, phase: stage, subject: e.subject, familyId: famOf(e.subject), qualificationType: e.qualificationType, measure: { kind: "points" as const }, period: null };
    if (e.entries < MIN_SUBJECT_ENTRIES) return { subject: e.subject, qualification: e.qualificationType, familyId: famOf(e.subject), entries: e.entries, avg: null, set: null, england: null, since: null, ranked: false, reason: "small" };
    const [s, n] = await cachedReference(`smt:subject:${urn}:${stage}:${e.subject}:${e.qualificationType}:${setKey}`, () => Promise.all([subjectRanking({ ...base, urns: all }, `smt:set:${urn}:${setKey}`), subjectRanking({ ...base, urns: nation }, `smt:nation:${stage}`)]));
    const series = s.targetSeries.length ? s.targetSeries : n.targetSeries;
    const now = s.target?.value ?? n.target?.value ?? null;
    const then = series.find((p) => p.period === TREND_BASE_PERIOD)?.value ?? null;
    return {
      subject: e.subject,
      qualification: e.qualificationType,
      familyId: famOf(e.subject),
      entries: e.entries,
      avg: now,
      set: s.targetRank !== null ? { rank: s.targetRank, of: s.ranked } : null,
      england: n.targetRank !== null ? { rank: n.targetRank, of: n.ranked } : null,
      since: now !== null && then !== null && period > TREND_BASE_PERIOD ? now - then : null,
      ranked: s.targetRank !== null || n.targetRank !== null,
      reason: now === null ? "scale" : null,
    };
  });

  // ------------------------------------------------------------ trends: results against the set, entries mix
  const years = Array.from({ length: period - HISTORIC_GRADE_FROM + 1 }, (_, i) => HISTORIC_GRADE_FROM + i);
  let trend: StagePart["trend"];
  if (area) {
    const sch = years.map((y) => ({ year: y, value: famVal(urn, y) }));
    const band = years.map((y) => {
      const vals = setUrns.filter((u) => !areaOut.has(u)).map((u) => famVal(u, y)).filter((v): v is number => v !== null);
      return { year: y, p25: percentile(vals, 25), p75: percentile(vals, 75), n: vals.length };
    });
    trend = { label: stage === "ks4" ? "Average grade" : "Points per entry", school: sch, band };
  } else {
    trend = { label: stage === "ks4" ? "Attainment 8" : "A level: points per entry", school: years.map((y) => ({ year: y, value: figure(pop, urn, y, headKey) })), band: middleHalf(pop, setUrns, headKey, years, exclude) };
  }
  // Entries mix: each area's share of the stage's entries (all areas), or each subject's share of
  // the area's (an area chosen), year by year. From the subject rollup, which holds every year
  // from 2021/22 (the modern subject sources start in 2023/24): change in entries counts from the
  // first year with data (the year rules; R-SMT-VIEW-MIX).
  const head = (await cachedReference(`smt:subject-headline:${urn}:${stage}`, () => fetchSubjectHeadlineForSchools([urn], stage))).get(urn) ?? [];
  const mixRows = head.filter((e) => e.period >= HISTORIC_GRADE_FROM && e.period <= period && (!area || e.familyId === area) && e.entriesTotal > 0);
  const keyOf = (e: { subject: string; familyId: string | null }) => (area ? e.subject : (e.familyId ?? "other"));
  const totals = new Map<string, number>();
  for (const e of mixRows) totals.set(keyOf(e), (totals.get(keyOf(e)) ?? 0) + e.entriesTotal);
  const keys = Array.from(totals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k]) => k);
  const labelOf = (k: string) => (area ? k : (school.areas[stage === "ks4" ? "gcse" : "post16"].find((a) => a.id === k)?.label ?? head.find((e) => e.familyId === k)?.familyLabel ?? (k === "other" ? "Other" : k)));
  const mixYears = Array.from(new Set(mixRows.map((e) => e.period))).sort((a, b) => a - b);
  const mix = {
    keys: [...keys.map((k) => ({ key: k, label: labelOf(k) })), ...(totals.size > keys.length ? [{ key: "rest", label: "The rest" }] : [])],
    years: mixYears.map((y) => {
      const rows = mixRows.filter((e) => e.period === y);
      const total = rows.reduce((a, e) => a + e.entriesTotal, 0);
      const shares: Record<string, number> = {};
      for (const e of rows) {
        const k = keys.includes(keyOf(e)) ? keyOf(e) : "rest";
        shares[k] = (shares[k] ?? 0) + (total ? (e.entriesTotal / total) * 100 : 0);
      }
      return { year: y, shares, total };
    }),
  };

  return { stage, period, provisional: latest?.provisional ?? false, tiles, areas, overall, subjects, grades, trend, mix };
}

export async function buildAcademic(school: SmtSchool, level: SmtLevel, set: SmtSet): Promise<Academic> {
  const urn = school.urn;
  const setUrns = Array.from(new Set(set.urns.filter((u) => u !== urn)));
  const wantsKs2 = (level.phase === "primary" || level.phase === "whole") && school.phases.primary && school.results.ks2;
  const [ks2pop, ks4, ks5, igcse] = await Promise.all([wantsKs2 ? population("ks2") : Promise.resolve(new Map() as Population), population("ks4"), population("ks5"), igcseExcluded()]);
  if (school.phases.igcse) igcse.add(urn);
  const stages: ("ks4" | "ks5")[] = level.phase === "gcse" ? ["ks4"] : level.phase === "post16" ? ["ks5"] : level.phase === "whole" ? ([school.phases.gcse ? "ks4" : null, school.phases.post16 ? "ks5" : null].filter(Boolean) as ("ks4" | "ks5")[]) : [];
  const area = level.phase === "gcse" || level.phase === "post16" ? level.area : null;
  const parts = await Promise.all(stages.map((s) => stagePart(school, s, area, { ...set, urns: setUrns }, igcse, { ks4, ks5 })));
  const areaLabel = area ? (school.areas[level.phase === "gcse" ? "gcse" : "post16"].find((a) => a.id === area)?.label ?? area) : null;

  const ks2: Tile[] = [];
  const l2 = school.latest.ks2?.period;
  if ((level.phase === "primary" || (level.phase === "whole" && school.phases.primary)) && l2 !== undefined) {
    const k = SMT_MEASURES.ks2.rwm;
    const p = (await placesOn(ks2pop, l2, k, [urn])).get(urn)!;
    const sr = setPlace(new Map([urn, ...setUrns].map((u) => [u, figure(ks2pop, u, l2, k)])), urn);
    ks2.push({ key: k, label: "Reading, writing and maths", value: p.value, unit: "pct", period: l2, sub: `meeting the expected standard, ${periodLabel(l2)}`, set: sr ? { ...sr, label: `${set.label} with KS2 results` } : null, england: p.national, note: p.value === null ? "none" : null });
  }

  // ------------------------------------------------------------ value added
  const alevel: VaRow[] = [];
  const l5 = school.latest.ks5?.period;
  if (school.phases.post16 && l5 !== undefined) {
    for (const p of [l5 - 1, l5]) for (const q of VA_QUALS) {
      const v = figure(ks5, urn, p, `${q}::value_added`);
      if (v === null) continue;
      alevel.push({ qualification: q, period: p, value: v, lo: figure(ks5, urn, p, `${q}::value_added_lower_ci`), hi: figure(ks5, urn, p, `${q}::value_added_upper_ci`), banding: (ks5.get(urn)?.get(p)?.[`${q}::progress_banding`] as string | undefined) ?? null });
    }
  }
  let subjectVa: SubjectVa[] = [];
  if (school.phases.post16) {
    const { byUrn, subjectFamilyMap } = await cachedReference(`smt:subjects:${urn}:ks5`, () => fetchSubjectLevelDataForSchools([urn], "ks5", { gradeYears: "four" }));
    const rows = byUrn.get(urn)?.valueAdded ?? [];
    const latestVa = rows.length ? Math.max(...rows.map((r) => r.period)) : null;
    subjectVa = rows
      .filter((r) => r.period === latestVa && (!area || level.phase !== "post16" || subjectFamilyMap[r.subject] === area))
      .map((r) => ({ subject: r.subject, qualification: r.qualificationType, period: r.period, value: r.valueAdded, lo: r.valueAddedLowerCi, hi: r.valueAddedUpperCi, entries: r.entriesCount }))
      .sort((a, b) => (b.entries ?? 0) - (a.entries ?? 0));
  }

  return {
    urn,
    level,
    areaLabel,
    set: { kind: set.kind, label: set.label, size: setUrns.length },
    igcse: !!school.phases.igcse,
    parts,
    ks2,
    va: { alevel, subjects: subjectVa, p8: p8Of(school, ks4, urn, !!school.phases.igcse), ks2: level.phase === "primary" ? smtNote("vaNotKs2") : null },
    notes: {
      since: smtNote("sinceBase", { base: periodLabel(TREND_BASE_PERIOD) }),
      middleHalf: smtNote("middleHalf", { setLabel: set.label }),
      mix: smtNote("entriesMix"),
      band: smtNote("bandReserved"),
      smallEntries: smtNote("smallEntries", { min: MIN_SUBJECT_ENTRIES }),
      vaAlevel: smtNote("alevelVa"),
      vaGcse: smtNote("vaNoGcseSubjects"),
    },
  };
}
