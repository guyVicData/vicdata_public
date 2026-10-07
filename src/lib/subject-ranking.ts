// VicData 0.6.6 (Part 1): a national or regional RANKING on the measure in view -- the focused
// subject (the exact qualification at Post-16, R-POINTS-SAME-QUAL), on Average points,
// entries, Grade 4+ / A*-E, a grade band or a Grade counts selection, in the panel's year --
// across the WHOLE filtered population, never a sample (R-RANKING-SAMPLE). Server-side only.
//
// Two paths, one answer:
//   1. vicdata-production's academic_subject_rank_lookup (ingest repo migration,
//      docs/v0.6/v066_rankings_report_v1.md), one query per request: the real path.
//   2. Until that is applied (PostgREST 404 / PGRST202) or if it errors: the same ranking
//      here, from chunked reads of that one subject's rows for the population through the
//      lookups the rest of the app reads (subject headline, exact-qualification headline,
//      grade rollup), so the figures and their predecessor-URN rules are the app's own.
//      Kept an hour per key (subject-ranking route). Temporary, by design.
// Both run the same rules, in the same order -- rankFigures() below is the definition the SQL
// mirrors step for step, and scripts/subject-ranking-cases.ts compares the two.
//
// Rules (catalogue):
//   R-RANKING-SAMPLE   rank, total and average from the whole population.
//   R-MIN-ENTRIES      MINIMUM_SUBJECT_N (5) entries -- graded entries on a rate -- for a
//                      school to be ranked on points or a rate (Comparisons applies it to
//                      a counts selection; here to every measure but entries: 0.6.6 call).
//   R-POINTS-SAME-QUAL exact qualification at Post-16.
//   R-CURRENT-GRADES-FROM-2324  a rate's default year is the latest from 2023/24 on.
//   R-TREND-FROM-2223  the change list measures from 2022/23.
//   R-NUMBER-TYPE-HONESTY  entries change in %, points and rates in points / pp.
//   Ties share a rank; higher is better (entries: more entries rank higher).
import { callReferenceRpc, type AcademicSubjectHeadlineRow, type AcademicSubjectQualificationHeadlineRow } from "./vicdata-reference";
import { gradeRowsFromRollup, mapHistoricKs5Grade, starIsAStar, MODERN_GRADE_FROM, type GradeRollupRow } from "./grade-rows";
import { GRADE_SCALES, NON_GRADE_VALUES, BOTTOM_RANK, bandRate, inRange, thresholdRate, type GradeRange } from "./subject-grades";
import { MINIMUM_SUBJECT_N } from "./academic-data-view";
import { TREND_BASE_PERIOD } from "@/catalogue/notes";

export type RankMeasure =
  | { kind: "points" }
  | { kind: "entries" }
  | { kind: "threshold" }
  // A grade band from the top bar, or a Grade counts selection (the same band machinery).
  | { kind: "band"; scaleIndex: number; top: string; bottom: string };

export type SubjectRankingRequest = {
  urns: string[]; // the filtered population (the school may or may not be one of them)
  targetUrn: string;
  phase: "ks4" | "ks5";
  subject: string;
  familyId: string | null; // the subject's family (the headline lookups' filter)
  qualificationType: string | null; // Post-16: the exact one; GCSE rates: the focus's (GCSE (9-1) Full Course)
  measure: RankMeasure;
  period: number | null; // null = the latest with a figure
};

export type WindowRow = { urn: string; pos: number; rank: number; value: number; n: number | null };
export type SubjectRanking = {
  period: number | null;
  matched: number; // the population (the ranking's own schools)
  ranked: number; // schools with a figure in `period` (the school included where it has one)
  noFigure: number; // the ranking's schools with no figure that year
  belowMin: number; // ... with a figure from fewer than MINIMUM_SUBJECT_N entries
  inRanking: boolean;
  targetRank: number | null;
  target: { period: number; value: number; n: number | null } | null;
  targetSeries: { period: number; value: number }[];
  averageLatest: number | null;
  average: { period: number; value: number; schools: number }[];
  window: WindowRow[]; // top 10, 10 either side of the school, bottom 3 (positions in the order)
  windowSeries: Record<string, { period: number; value: number }[]>;
  change: {
    from: number;
    ranked: number;
    targetRank: number | null;
    target: number | null;
    average: number | null;
    window: WindowRow[];
  } | null;
  source: "function" | "fallback";
};

export const RANK_WINDOW = 10;
export const RANK_BOTTOM = 3;

// ----------------------------------------------------------------- the definition

type Fig = { value: number; n: number | null };
// One school's eligible figure per year (R-MIN-ENTRIES applied), and the raw counts behind it.
export type Figures = Map<string, Map<number, { value: number | null; n: number | null }>>;

/** The ranking, from every school's figures. The SQL function mirrors this, step for step. */
export function rankFigures(req: SubjectRankingRequest, figs: Figures): Omit<SubjectRanking, "source"> {
  const minN = req.measure.kind === "entries" ? 0 : MINIMUM_SUBJECT_N;
  const isRate = req.measure.kind === "threshold" || req.measure.kind === "band";
  const members = new Set(req.urns);
  const inRanking = members.has(req.targetUrn);
  const all = Array.from(new Set([...req.urns, req.targetUrn]));
  const eligible = (u: string, p: number): Fig | null => {
    const f = figs.get(u)?.get(p);
    if (!f || f.value === null) return null;
    if (minN > 0 && (f.n ?? 0) < minN) return null;
    return { value: f.value, n: f.n };
  };
  // The year: the asked-for one, else the latest any of the ranking's schools has a figure in
  // (a rate's latest from 2023/24 on, R-CURRENT-GRADES-FROM-2324).
  const periods = Array.from(new Set(all.flatMap((u) => Array.from(figs.get(u)?.keys() ?? [])))).sort((a, b) => a - b);
  const period =
    req.period ??
    [...periods].reverse().find((p) => (!isRate || p >= MODERN_GRADE_FROM) && req.urns.some((u) => eligible(u, p) !== null)) ??
    null;
  const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);

  let noFigure = 0;
  let belowMin = 0;
  for (const u of req.urns) {
    const f = period === null ? undefined : figs.get(u)?.get(period);
    if (!f || f.value === null) noFigure++;
    else if (minN > 0 && (f.n ?? 0) < minN) belowMin++;
  }

  // The order: highest first, ties by URN (the rank itself is shared).
  const ordered = (valueOf: (u: string) => number | null) =>
    all
      .map((u) => ({ u, v: valueOf(u) }))
      .filter((x): x is { u: string; v: number } => x.v !== null)
      .sort((a, b) => b.v - a.v || a.u.localeCompare(b.u));
  const rankOf = (list: { u: string; v: number }[]) => {
    const out = new Map<string, number>();
    let higher = 0;
    for (let i = 0; i < list.length; i++) {
      if (i > 0 && list[i].v < list[i - 1].v) higher = i;
      out.set(list[i].u, higher + 1);
    }
    return out;
  };
  const windowOf = (list: { u: string; v: number }[], ranks: Map<string, number>, nOf: (u: string) => number | null): WindowRow[] => {
    const idx = list.findIndex((x) => x.u === req.targetUrn);
    const keep = new Set<number>();
    for (let i = 0; i < Math.min(RANK_WINDOW, list.length); i++) keep.add(i);
    if (idx >= 0) for (let i = Math.max(0, idx - RANK_WINDOW); i <= Math.min(list.length - 1, idx + RANK_WINDOW); i++) keep.add(i);
    for (let i = Math.max(0, list.length - RANK_BOTTOM); i < list.length; i++) keep.add(i);
    return Array.from(keep)
      .sort((a, b) => a - b)
      .map((i) => ({ urn: list[i].u, pos: i + 1, rank: ranks.get(list[i].u)!, value: list[i].v, n: nOf(list[i].u) }));
  };

  const level = period === null ? [] : ordered((u) => eligible(u, period)?.value ?? null);
  const levelRanks = rankOf(level);
  const window = period === null ? [] : windowOf(level, levelRanks, (u) => eligible(u, period)?.n ?? null);
  const targetFig = period === null ? null : eligible(req.targetUrn, period);
  // The average and the per-year averages: the ranking's own schools only (the school counts
  // where it is one of them, not where it is only placed against them).
  const memberValues = (p: number) => req.urns.map((u) => eligible(u, p)?.value ?? null).filter((v): v is number => v !== null);
  const average = periods
    .map((p) => ({ period: p, vs: memberValues(p) }))
    .filter((x) => x.vs.length > 0)
    .map((x) => ({ period: x.period, value: mean(x.vs)!, schools: x.vs.length }));
  const seriesOf = (u: string) => periods.map((p) => ({ period: p, value: eligible(u, p)?.value ?? null })).filter((x): x is { period: number; value: number } => x.value !== null);

  // The change list: from 2022/23 (R-TREND-FROM-2223) to the year in view; entries in %,
  // points and rates as the difference (R-NUMBER-TYPE-HONESTY).
  const from = TREND_BASE_PERIOD;
  const changeOf = (u: string): number | null => {
    if (period === null || period <= from) return null;
    const a = eligible(u, from);
    const b = eligible(u, period);
    if (!a || !b) return null;
    if (req.measure.kind === "entries") return a.value === 0 ? null : ((b.value - a.value) / a.value) * 100;
    return b.value - a.value;
  };
  let change: SubjectRanking["change"] = null;
  if (period !== null && period > from) {
    const list = ordered(changeOf);
    const ranks = rankOf(list);
    const memberChanges = req.urns.map(changeOf).filter((v): v is number => v !== null);
    change = {
      from,
      ranked: list.length,
      targetRank: ranks.get(req.targetUrn) ?? null,
      target: changeOf(req.targetUrn),
      average: mean(memberChanges),
      window: windowOf(list, ranks, () => null),
    };
  }

  const windowUrns = new Set([...window.map((w) => w.urn), ...(change?.window ?? []).map((w) => w.urn), req.targetUrn]);
  return {
    period,
    matched: req.urns.length,
    ranked: level.length,
    noFigure,
    belowMin,
    inRanking,
    targetRank: levelRanks.get(req.targetUrn) ?? null,
    target: targetFig && period !== null ? { period, value: targetFig.value, n: targetFig.n } : null,
    targetSeries: seriesOf(req.targetUrn),
    averageLatest: period === null ? null : mean(memberValues(period)),
    average,
    window,
    windowSeries: Object.fromEntries(Array.from(windowUrns).map((u) => [u, seriesOf(u)])),
    change,
  };
}

// ---------------------------------------------------------- the figures (fallback reads)

// One school's grade rows for one subject and qualification in one year -> its rate on the
// measure, scored exactly as Comparisons scores it (gradeRateScorer: thresholdRate /
// bandRate), with the graded entries behind it.
export function rateFigure(rows: { grade: string; entries: number }[], measure: RankMeasure, phase: "ks4" | "ks5"): { value: number | null; n: number | null } {
  const graded = rows.filter((r) => !NON_GRADE_VALUES.has(r.grade)).reduce((a, r) => a + r.entries, 0);
  if (measure.kind === "threshold") {
    const out = thresholdRate(rows.map((r) => ({ ...r, subject: "", qualificationType: "", period: 0, sizeWeight: null })), phase);
    return { value: out?.rate ?? null, n: graded || null };
  }
  if (measure.kind === "band") {
    const range: GradeRange = { scale: GRADE_SCALES[measure.scaleIndex], top: measure.top, bottom: measure.bottom };
    const out = bandRate(rows, range);
    return { value: out?.rate ?? null, n: graded || null };
  }
  return { value: null, n: null };
}

// At Post-16, the rollup's rows as the app reads the facts: the historic vocational short
// codes in their words (per set: school, qualification, subject, year), then "*" as A*
// (R-HISTORIC-GRADE-LABELS, R-ALEVEL-STAR). Zero-entry rows aren't in the rollup; a rate is
// a sum, so they don't change it (checked: 40 of 40 school-subjects equal, report).
export function normaliseKs5Rollup(rows: GradeRollupRow[]): GradeRollupRow[] {
  const labels = new Map<string, Set<string>>();
  const key = (r: GradeRollupRow) => `${r.entity_id}|${r.qualification_type}|${r.subject}|${r.period}`;
  for (const r of rows) (labels.get(key(r)) ?? labels.set(key(r), new Set()).get(key(r))!).add(r.grade);
  // The historic file's years only (2021/22-2022/23), as the facts path maps historic rows only.
  const mapped = rows.map((r) => ({ ...r, entries: Number(r.entries), grade: r.period < MODERN_GRADE_FROM ? mapHistoricKs5Grade(r.qualification_type, r.grade, labels.get(key(r))!) : r.grade }));
  return starIsAStar(mapped, key);
}

async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    }),
  );
  return out;
}
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// One lookup page at a time per chunk, PostgREST's 1000-row cap respected; chunks small
// enough for the anon role's 3 s statement timeout; a few at once.
async function pagedRpc<T>(path: string, body: Record<string, unknown>): Promise<T[]> {
  const rows: T[] = [];
  for (let page = 0; page < 50; page++) {
    const batch = (await callReferenceRpc(path, { ...body, p_limit: 1000, p_offset: page * 1000 })) as T[];
    rows.push(...batch);
    if (batch.length < 1000) break;
  }
  return rows;
}
const FALLBACK_CHUNK = { headline: 60, grades: 150 };
const FALLBACK_CONCURRENCY = 6;

/** Every school's figures on the measure, through the lookups the rest of the app reads. */
export async function fallbackFigures(req: SubjectRankingRequest): Promise<Figures> {
  return figuresFor(Array.from(new Set([...req.urns, req.targetUrn])), req);
}

async function figuresFor(urns: string[], req: SubjectRankingRequest): Promise<Figures> {
  const figs: Figures = new Map();
  const put = (u: string, p: number, f: { value: number | null; n: number | null }) => (figs.get(u) ?? figs.set(u, new Map()).get(u)!).set(p, f);
  if (req.measure.kind === "points" || req.measure.kind === "entries") {
    const wantPoints = req.measure.kind === "points";
    if (req.phase === "ks4") {
      const parts = await pool(chunks(urns, FALLBACK_CHUNK.headline), FALLBACK_CONCURRENCY, (c) =>
        pagedRpc<AcademicSubjectHeadlineRow>("academic_subject_headline_lookup", { p_entity_ids: c, p_ks_stage: "ks4", p_family_id: req.familyId, p_period_min: null, p_period_max: null, p_bucket: "all" }),
      );
      for (const r of parts.flat()) {
        if (r.subject !== req.subject) continue;
        const entries = r.entries_total === null ? null : Number(r.entries_total);
        put(r.entity_id, r.period, { value: wantPoints ? (r.avg_point_score === null ? null : Number(r.avg_point_score)) : entries, n: entries });
      }
    } else {
      const parts = await pool(chunks(urns, FALLBACK_CHUNK.headline), FALLBACK_CONCURRENCY, (c) =>
        pagedRpc<AcademicSubjectQualificationHeadlineRow>("academic_subject_qualification_headline_lookup", { p_entity_ids: c, p_ks_stage: "ks5", p_family_id: req.familyId, p_period_min: null, p_period_max: null, p_qualification_type: req.qualificationType }),
      );
      for (const r of parts.flat()) {
        if (r.subject !== req.subject || r.qualification_type !== req.qualificationType) continue;
        const entries = r.entries_total === null ? null : Number(r.entries_total);
        put(r.entity_id, r.period, { value: wantPoints ? (r.avg_point_score === null ? null : Number(r.avg_point_score)) : entries, n: entries });
      }
    }
    return figs;
  }
  // Rates: the grade rollup's rows for the one subject and qualification, 2021/22 on.
  const parts = await pool(chunks(urns, FALLBACK_CHUNK.grades), FALLBACK_CONCURRENCY, (c) =>
    pagedRpc<GradeRollupRow>("academic_subject_grade_rollup_lookup", { p_entity_ids: c, p_ks_stage: req.phase, p_subject: req.subject, p_qualification_type: req.qualificationType, p_period_min: 2021, p_period_max: null }),
  );
  let rows = parts.flat();
  if (req.phase === "ks5") rows = normaliseKs5Rollup(rows);
  const byUrn = gradeRowsFromRollup(rows);
  for (const [u, list] of byUrn) {
    const mine = list.filter((g) => g.subject === req.subject && (!req.qualificationType || g.qualificationType === req.qualificationType));
    for (const p of new Set(mine.map((g) => g.period))) put(u, p, rateFigure(mine.filter((g) => g.period === p), req.measure, req.phase));
  }
  return figs;
}

// ----------------------------------------------------------------- the function (real path)

// "absent" is re-checked every ABSENT_RECHECK_MS, so a running server starts using the
// function within minutes of it being applied, with no restart.
let rankRpc: "unknown" | "present" | "absent" = "unknown";
let absentSince = 0;
const ABSENT_RECHECK_MS = 10 * 60 * 1000;
export function rankRpcState() {
  return rankRpc;
}
const isMissingFunction = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e);
  return /HTTP 404\b/.test(msg) || msg.includes("PGRST202");
};

/** The SQL function's arguments for this request (the app's own scale tables and band
 * grades, so the database applies exactly the app's definitions). */
export function rankRpcArgs(req: SubjectRankingRequest) {
  const m = req.measure;
  const met = m.kind === "band" ? GRADE_SCALES[m.scaleIndex].filter((g) => inRange({ scale: GRADE_SCALES[m.scaleIndex], top: m.top, bottom: m.bottom }, g)) : null;
  return {
    p_entity_ids: req.urns,
    p_target: req.targetUrn,
    p_ks_stage: req.phase,
    p_subject: req.subject,
    p_family_id: req.familyId,
    p_qualification_type: req.qualificationType,
    p_measure: m.kind,
    p_band_scale: m.kind === "band" ? m.scaleIndex : null,
    p_band_ends: m.kind === "band" ? [m.top, m.bottom] : null,
    p_band_met: met,
    p_scales: GRADE_SCALES,
    p_non_grades: Array.from(NON_GRADE_VALUES),
    p_bottom_grades: Object.keys(BOTTOM_RANK),
    p_period: req.period,
    p_min_entries: m.kind === "entries" ? 0 : MINIMUM_SUBJECT_N,
    p_modern_from: MODERN_GRADE_FROM,
    p_trend_base: TREND_BASE_PERIOD,
    p_window: RANK_WINDOW,
    p_bottom: RANK_BOTTOM,
  };
}

/** The function's answer, or null if it isn't applied yet (remembered for this process). */
export async function rankByFunction(req: SubjectRankingRequest): Promise<SubjectRanking | null> {
  if (rankRpc === "absent" && Date.now() - absentSince < ABSENT_RECHECK_MS) return null;
  try {
    const out = (await callReferenceRpc("academic_subject_rank_lookup", rankRpcArgs(req))) as unknown;
    rankRpc = "present";
    const doc = (Array.isArray(out) ? out[0] : out) as Omit<SubjectRanking, "source">;
    return { ...doc, source: "function" };
  } catch (e) {
    if (isMissingFunction(e)) {
      if (rankRpc !== "absent") console.info("[academic_subject_rank_lookup] not applied yet: rankings come from the app-side fallback (re-checked every 10 minutes)");
      rankRpc = "absent";
      absentSince = Date.now();
      return null;
    }
    console.error("[academic_subject_rank_lookup] failed; using the app-side fallback", e instanceof Error ? e.message : e);
    return null;
  }
}

// The fallback's figures for a population, kept an hour per (population, subject, exact
// qualification, measure) and shared by every school asking -- only the target differs between
// them, and a school outside the population has its own few rows read beside them. Public
// data only (no user, no membership). At most FIGURES_MAX keys: one is a few thousand
// schools' yearly figures. Errors are never kept.
const FIGURES_TTL_MS = 60 * 60_000;
const FIGURES_MAX = 40;
const figureCache = new Map<string, { at: number; promise: Promise<Figures> }>();
const measureKey = (m: RankMeasure) => (m.kind === "band" ? `band:${m.scaleIndex}:${m.top}:${m.bottom}` : m.kind);
function populationFigures(popKey: string, req: SubjectRankingRequest): Promise<Figures> {
  const key = [popKey, req.phase, req.subject, req.familyId ?? "", req.qualificationType ?? "", measureKey(req.measure)].join("|");
  const hit = figureCache.get(key);
  if (hit && Date.now() - hit.at < FIGURES_TTL_MS) return hit.promise;
  const entry = { at: Date.now(), promise: figuresFor(req.urns, req) };
  figureCache.delete(key);
  figureCache.set(key, entry);
  if (figureCache.size > FIGURES_MAX) figureCache.delete(figureCache.keys().next().value as string);
  entry.promise.catch(() => {
    if (figureCache.get(key) === entry) figureCache.delete(key);
  });
  return entry.promise;
}

/** The ranking: the function first, else the fallback. `popKey` names the population
 * (scope and filters), so the fallback's figures are shared between schools. */
export async function subjectRanking(req: SubjectRankingRequest, popKey: string): Promise<SubjectRanking> {
  const viaFunction = await rankByFunction(req);
  if (viaFunction) return viaFunction;
  let figs = await populationFigures(popKey, req);
  if (!req.urns.includes(req.targetUrn)) {
    figs = new Map(figs);
    for (const [u, byPeriod] of await figuresFor([req.targetUrn], req)) figs.set(u, byPeriod);
  }
  return { ...rankFigures(req, figs), source: "fallback" };
}
