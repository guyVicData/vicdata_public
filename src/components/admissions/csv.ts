// Panel menu "Save as CSV" (21 Nov): Admissions' rows -- each view's table, built from the same route
// answer the view draws (the pipeline, market-share, rivals and shape answers), with the same looks
// (sort, columns, which rows) and at the precision the view shows: pupils whole, shares and percentages
// to 1 place unless the view shows fewer, indices whole, subject-area gaps to 2. What the view
// withholds stays withheld, in the view's own words: "IGCSE" and "none" for a rival with no ranked
// results, "Too few pupils to call" for an area trend, "too few to index" for a rival the full-screen
// roll lines don't draw, "No change worth flagging". Pure, so src/lib/panel-csv-admissions.test.ts checks
// each one against the view's own render. InstanceBody registers the one for the view on screen
// (usePanelCsv), dispatching on the dataview id as viewBody does.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { shown } from "@/lib/csv";
import { indexOwn, ROLL_INDEX_MIN } from "@/lib/index-base";
import { isMain, mainFirst, type Tiers } from "@/lib/sets/tiers";
import { POPULATION_TREND_LABELS, displayPopulationTrendPct } from "@/lib/population-trend";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import { TREND_BASE_PERIOD } from "@/catalogue/years";
import type { Filters, Load, MarketView, PipelineOk, PipelineView, RivalsView, ShapeView } from "./api";
import { yearLabel } from "./ui";
import { momentumResults } from "./views/Momentum";

const yr = yearLabel;
const n0 = (v: number | null | undefined) => shown(v, 0);
const n1 = (v: number | null | undefined) => shown(v, 1);
const n2 = (v: number | null | undefined) => shown(v, 2);
const shapeWord = (s: string | null | undefined) => (s ? (SHAPE_LABELS[s as ShapeLabel] ?? s) : "No census");

// ------------------------------------------------------------------------------- Pipelines

type Flag = { id: string; label: string; figures: Record<string, number | string | null> } | null;
/** The feeder flag as the table writes it ("Focus · rising", "Red flag"). */
export const feederFlagWords = (f: Flag) => (!f ? null : f.id === "feeder_focus" ? `Focus · ${f.label.toLowerCase()}` : "Red flag");
const SECTOR = { state: "State", independent: "Independent" } as const;

/** Entry point now: the tiles, then size by phase (XS-XL) and the shape line. */
export function entryNowCsv(p: PipelineOk, shape: ShapeView | null): CsvTable {
  const n = p.now;
  const year = yr(p.censusPeriod);
  if (p.fe) return { about: { set: null, year: null }, columns: ["Measure", "Year", "Value"], rows: p.fe.series.slice(-4).map((x) => [p.fe!.label, yr(x.year), n0(x.value)]) };
  const word = p.entry.age === 4 ? "Reception" : `Year ${p.entry.age - 4}`;
  const rows: CsvCell[][] = [
    [`${word} now (pupils aged ${p.entry.age})`, n0(n.cohort), "pupils", null],
    [`${word} cohort in ${yr(n.base.period)}`, n0(n.base.cohort), "pupils", null],
    [`Change since ${yr(n.base.period)}`, n0(n.changePct), "%", null],
    [`Girls in ${word}`, n0(n.girlsPct), "%", null],
    [`Boys in ${word}`, n.girlsPct === null ? null : n0(n.boysPct ?? 0), "%", null],
  ];
  if (p.school.boarding) rows.push(["Day (whole school)", n0(n.day), "pupils", null], ["Boarding (whole school)", n0(n.boarders), "pupils", null]);
  else rows.push(["Day (whole school)", n0(n.day ?? n.roll), "pupils", null]);
  for (const b of shape?.bands ?? []) rows.push([`${b.label}: pupils`, n0(b.total), "pupils", b.badge ?? "Not enough data yet to compare"]);
  return { about: { set: null, year }, columns: ["Measure", "Value", "Unit", "Size (XS–XL)"], rows };
}

const SOURCE_WORD: Record<string, string> = { counted: "counted", births: "from births (an estimate)", projection: "ONS projection (an estimate)" };

/** The pipeline chart: each entry year's pool, its range and where it comes from (past pools and the
 * projection only where the view draws them). */
export function pipelineCsv(p: PipelineOk, o: { pastPools?: boolean; projection?: boolean } = {}): CsvTable | null {
  const past = o.pastPools === false ? [] : p.ladder.past.filter((x) => x.pool !== null);
  const future = p.ladder.future.filter((x) => x.pool !== null);
  const proj = o.projection ? p.ladder.projection.filter((x) => x.pool !== null) : [];
  if (!past.length && !future.length) return null;
  // A range only where the chart draws one (the tooltip's rule): a counted year's low and high equal to its pool is no range.
  const ranged = (x: PipelineOk["ladder"]["past"][number]) => x.low !== null && x.high !== null && (x.low !== x.pool || x.high !== x.pool);
  const row = (x: PipelineOk["ladder"]["past"][number], when: string): CsvCell[] => [x.entryYear, when, n0(x.pool), ranged(x) ? n0(x.low) : null, ranged(x) ? n0(x.high) : null, SOURCE_WORD[x.source] ?? x.source, x.rungAge, x.birthYear];
  return {
    about: { year: null },
    columns: ["September entry", "When", "Pool (pupils)", "Range: low", "Range: high", "Source", "Counted at age", "Birth year"],
    rows: [...past.map((x) => row(x, "earlier year")), ...future.map((x) => row(x, "ahead")), ...proj.map((x) => row(x, "ahead (projection)"))],
  };
}

/** The feeder table, in its look's order and columns (Main feeders first), and the whole set's line. */
export function feederTableCsv(p: PipelineOk, look: { sort?: "listed" | "latest" | "change"; showKm?: boolean; showSector?: boolean; showGender?: boolean; showSize?: boolean } = {}): CsvTable | null {
  const t = p.feederTable;
  if (!t.rows.length) return null;
  const { sort = "listed", showKm = true, showSector = true, showGender = true, showSize = true } = look;
  const tiers = (p as PipelineOk & { tiers?: Tiers }).tiers;
  const sorted = sort === "latest" ? [...t.rows].sort((a, b) => (b.pupils ?? -1) - (a.pupils ?? -1)) : sort === "change" ? [...t.rows].sort((a, b) => (b.changePct ?? -1e9) - (a.changePct ?? -1e9)) : t.rows;
  const rows = mainFirst(sorted, tiers);
  const columns = ["School", "URN", "Main feeder", `Aged ${t.age}`, `Aged ${t.age} in ${yr(p.censusPeriod - 2)}`, "Trend (%)", "Flag", ...(showKm ? ["km"] : []), ...(showSector ? ["Sector"] : []), ...(showGender ? ["Gender"] : []), ...(showSize ? ["Size"] : [])];
  const out: CsvCell[][] = rows.map((r) => [
    r.name,
    r.urn,
    isMain(tiers, r.urn) ? "Main" : null,
    n0(r.pupils),
    n0(r.before),
    n0(r.changePct),
    feederFlagWords(r.flag),
    ...(showKm ? [n1(r.distanceKm)] : []),
    ...(showSector ? [r.sector ? SECTOR[r.sector] : null] : []),
    ...(showGender ? [r.gender ? r.gender[0].toUpperCase() + r.gender.slice(1) : null] : []),
    ...(showSize ? [r.size] : []),
  ]);
  out.push(["The whole set", null, null, n0(t.area.to), n0(t.area.from), n1(t.area.changePct)]);
  return { about: { year: yr(p.censusPeriod) }, columns, rows: out };
}

/** The feeder map: each located feeder (sized by pupils, coloured by its flag) and the school itself. */
export function feederMapCsv(p: PipelineOk): CsvTable | null {
  const rows = p.feederTable.rows.filter((r) => r.easting !== null && r.northing !== null);
  if (!rows.length) return null;
  const tiers = (p as PipelineOk & { tiers?: Tiers }).tiers;
  const word = p.entry.age === 4 ? "Reception" : `Year ${p.entry.age - 4}`;
  const out: CsvCell[][] = rows.map((r) => [r.name, r.urn, isMain(tiers, r.urn) ? "Main feeder" : "feeder", n0(r.pupils), `aged ${p.feederTable.age}`, n0(r.changePct), feederFlagWords(r.flag), r.easting, r.northing]);
  if (p.school.easting !== null && p.school.northing !== null) out.push([p.school.name, p.school.urn, "this school", n0(p.now.cohort), `in ${word} now`, null, null, p.school.easting, p.school.northing]);
  return { about: { year: yr(p.censusPeriod) }, columns: ["School", "URN", "Role", "Pupils", "Counted", "Change in two years (%)", "Flag", "Easting", "Northing"], rows: out };
}

/** "Why did our intake change?": the waterfall's columns, start to end. */
export function intakeCsv(p: PipelineOk): CsvTable | null {
  const v = p.intake;
  if (p.entry.age <= 4 || v.status !== "ok") return null;
  const word = v.entryAge <= 4 ? "Reception" : `Year ${v.entryAge - 4}`;
  const span = (ys: number[]) => (ys.length > 1 ? `${yr(ys[0])}–${yr(ys[ys.length - 1])}` : yr(ys[0]));
  const label: Record<string, string> = { cohort: "Cohort size", share: "Your share" };
  const rows: CsvCell[][] = [[`Your ${word}`, span(v.years.base), n0(v.split.start), null]];
  for (const part of v.split.parts) {
    rows.push([label[part.key] ?? part.key, null, null, n0(part.value)]);
    if (part.key === "cohort" && v.split.ofWhich) rows.push(["Families moving (of which, not a step)", null, null, n0(v.split.ofWhich.moved)]);
  }
  rows.push([`Your ${word}`, span(v.years.latest), n0(v.split.end), null]);
  return { about: { set: v.area.label, year: null }, columns: ["Step", "Years", "Pupils", "Change (pupils)"], rows };
}

/** Local births: the catchment's, the region's and England's births by year, and the index the lines draw. */
export function localBirthsCsv(p: PipelineOk): CsvTable | null {
  const v = p.localBirths;
  if (v.status !== "ok") return null;
  const ix = (s: { year: number; value: number | null }[], y: number) => n0(s.find((x) => x.year === y)?.value);
  const entry = v.entryAge === 4 ? "Reception" : `Year ${v.entryAge - 4}`;
  const region = v.regionName ?? "Region";
  return {
    about: { set: v.area.label, year: null },
    columns: ["Year (births)", `${entry} entry in`, "Catchment: births", `Catchment: index (${v.base} = 100)`, `${region}: births`, `${region}: index`, "England: births", "England: index"],
    rows: v.rows.map((r) => [r.year, yr(r.year + v.entryAge), n0(r.catchment), ix(v.indexed.catchment, r.year), n0(r.region), ix(v.indexed.region, r.year), n0(r.england), ix(v.indexed.england, r.year)]),
  };
}

/** The entry cohort year by year (the line, the bars and the table draw the same rows). */
export function entryTrendCsv(p: PipelineOk, needTwo: boolean): CsvTable | null {
  const s = p.now.series;
  if (needTwo && s.filter((x) => x.cohort !== null).length < 2) return null;
  return { about: { set: null, year: null }, columns: ["Year", `Pupils aged ${p.entry.age}`, "Girls", "Boys"], rows: s.map((x) => [yr(x.period), n0(x.cohort), n0(x.female), n0(x.male)]) };
}

/** Girls and boys in the entry cohort, and the girls' share. */
export function entrySexCsv(p: PipelineOk): CsvTable | null {
  const s = p.now.series.filter((x) => x.cohort !== null);
  if (s.length < 2) return null;
  return { about: { set: null, year: null }, columns: ["Year", "Girls", "Boys", "Girls' share (%)"], rows: s.map((x) => [yr(x.period), n0(x.female), n0(x.male), x.cohort ? n1((100 * (x.female ?? 0)) / x.cohort) : null]) };
}

/** Pool trends, indexed (the chart) or as counts (the table), with the area lines the view draws. */
export function poolTrendsCsv(p: PipelineOk, o: { la: boolean; england: boolean; indexed: boolean }): CsvTable | null {
  const t = p.poolTrends;
  const la = t.laName ?? "LA";
  if (o.indexed) {
    const ix = t.indexed;
    if (ix.feeders.filter((x) => x.value !== null).length < 2) return null;
    const at = (s: { year: number; value: number | null }[], y: number) => s.find((x) => x.year === y)?.value ?? null;
    const years = Array.from(new Set([...ix.feeders, ...(o.la ? ix.la : []), ...(o.england ? ix.england : [])].map((x) => x.year))).sort((a, b) => a - b);
    return {
      about: { year: null },
      columns: ["Year", "Feeders: index", `Feeders: pupils aged ${t.age}`, ...(o.la ? [`${la}: index`] : []), ...(o.england ? ["England: index"] : [])],
      rows: years.map((y) => [yr(y), n0(at(ix.feeders, y)), n0(at(t.feeders, y)), ...(o.la ? [n0(at(ix.la, y))] : []), ...(o.england ? [n0(at(ix.england, y))] : [])]),
    };
  }
  const years = Array.from(new Set([...t.feeders, ...t.la, ...t.england].map((x) => x.year))).sort((a, b) => a - b);
  const at = (s: { year: number; value: number | null }[], y: number) => n0(s.find((x) => x.year === y)?.value ?? null);
  return {
    about: { year: null },
    columns: ["Year", `Feeders: pupils aged ${t.age}`, ...(o.la ? [`${la}: pupils aged ${t.age}`] : []), ...(o.england ? [`England: pupils aged ${t.age}`] : [])],
    rows: years.map((y) => [yr(y), at(t.feeders, y), ...(o.la ? [at(t.la, y)] : []), ...(o.england ? [at(t.england, y)] : [])]),
  };
}

/** The area's population, ages 15 to 5, and each area's trend word ("Too few pupils to call" kept). */
export function areaPopulationCsv(p: PipelineOk, o: { la: boolean; region: boolean }): CsvTable | null {
  const a = p.areaPopulation;
  if (!a || (!a.laSeries && !a.regionSeries)) return null;
  const cols = [
    { name: a.laName, series: o.la ? a.laSeries : null, trend: a.laTrend },
    { name: a.region, series: o.region ? a.regionSeries : null, trend: a.regionTrend },
  ].filter((c) => c.series && c.name);
  const rows: CsvCell[][] = cols.flatMap((c) =>
    c.series!.map((s) => [c.name, c.trend ? POPULATION_TREND_LABELS[c.trend.tier] : "Too few pupils to call", c.trend ? n1(displayPopulationTrendPct(c.trend.pct)) : null, s.age, n0(s.total)] as CsvCell[]),
  );
  return rows.length ? { about: { set: null }, columns: ["Area", "Trend", "Trend (%)", "Age", "Pupils"], rows } : null;
}

/** Share needed to hold numbers steady: now, then each September's share, its range and its source. */
export function shareNeededCsv(p: PipelineOk): CsvTable | null {
  const h = p.hold;
  const needed = h.needed.filter((x) => x.share !== null);
  if (!h.current || !needed.length) return null;
  return {
    about: { year: null },
    columns: ["September", "Share needed (%)", "Range: low (%)", "Range: high (%)", "Source", "Your cohort", "Pool"],
    rows: [
      [`${h.current.entryYear} (now)`, n1(h.current.share), null, null, "counted", n0(h.current.cohort), n0(h.current.pool)],
      ...needed.map((x) => [String(x.entryYear), n1(x.share), x.low !== null && x.high !== null ? n1(x.low) : null, x.low !== null && x.high !== null ? n1(x.high) : null, x.source, null, null] as CsvCell[]),
    ],
  };
}

/** Shape and size: Pipelines' local shape and the feeders' shapes; Market share's school and rivals'.
 * A column per age, over the ages the view draws; never ranked (the set's own order). */
export function shapeCsv(s: ShapeView, entryAge: number, showLocal: boolean): CsvTable | null {
  const own = s.profile.filter((r) => r.female + r.male > 0);
  if (!own.length) return null;
  let ages: [number, number] = [own[0].age, own[own.length - 1].age];
  if (showLocal) {
    const local = s.localProfile.filter((r) => r.female + r.male > 0);
    ages = s.localShape.ages ?? (local.length ? [Math.max(4, local[0].age), Math.max(4, Math.min(local[local.length - 1].age, Math.max(entryAge - 1, 4)))] : [4, Math.max(4, entryAge - 1)]);
  }
  const list = Array.from({ length: ages[1] - ages[0] + 1 }, (_, i) => ages[1] - i);
  const at = (profile: { age: number; female: number; male: number }[]) => list.map((a) => n0(profile.filter((r) => r.age === a).reduce((t, r) => t + r.female + r.male, 0)));
  const rows: CsvCell[][] = showLocal
    ? [["Local shape", `${s.localShape.schools} feeder schools together`, shapeWord(s.localShape.shape), null, ...at(s.localProfile)], ...s.feeders.schools.map((r) => ["Feeder", r.name, shapeWord(r.shape), r.size, ...at(r.profile)] as CsvCell[])]
    : [["Your school", null, shapeWord(s.shapeByYear.at(-1)?.shape ?? null), s.bands.map((b) => `${b.label} ${b.badge ?? "—"}`).join(" · "), ...at(s.profile)], ...s.rivals.map((r) => ["Rival", r.name, shapeWord(r.shape), r.size, ...at(r.profile)] as CsvCell[])];
  return { about: { year: null }, columns: ["Group", "School", "Shape", "Size", ...list.map((a) => `Age ${a}`)], rows };
}

// ------------------------------------------------------------------------------- Market share

const nameOf = (m: MarketView, urn: string) => m.schools[urn]?.name ?? urn;
/** A momentum flag as the list writes it ("Shape changed: Pyramid → Tube"). */
const flagText = (f: RivalsView["rows"][number]["momentum"][number]) => (f.id === "shape_changed" ? `Shape changed: ${shapeWord(String(f.figures.from))} → ${shapeWord(String(f.figures.to))}` : f.label);
const resultsWord = (row: RivalsView["rows"][number] | undefined) => (row?.results.note === "igcse_not_ranked" ? "IGCSE" : row?.results.note === "no_published_results" ? "none" : null);

/** Your place among the rivals: the tiles and "this group" in figures. */
export function marketNowCsv(m: MarketView): CsvTable | null {
  if (m.fe) return null;
  const f = m.summary;
  const age = m.entry.age;
  return {
    about: { year: yr(f.latest) },
    columns: ["Measure", "Value", "Of", "Unit"],
    rows: [
      [`Rank at age ${age} (by Year ${age - 4} size)`, f.rank, f.rank ? f.of : null, "rank"],
      [`Market share (of ${age}-year-olds in this group)`, n1(f.share), null, "%"],
      [`Share change since ${yr(f.first)}`, n1(f.changePts), null, "percentage points"],
      ["Whole school rank (by total roll)", f.rollRank, f.rollRank ? f.rollOf : null, "rank"],
      [`Pupils aged ${age} in this group`, n0(f.total), null, "pupils"],
      ["Rivals", f.rivals, null, "schools"],
      ["Independent", f.independent, null, "schools"],
      ["State", f.state, null, "schools"],
      ["With boarding", f.boarding, null, "schools"],
    ],
  };
}

/** The share donut: one share, of the group's total. */
export function donutCsv(m: MarketView): CsvTable {
  return { about: { year: yr(m.summary.latest) }, columns: ["Measure", "Value"], rows: [[`Your share of ${m.entry.age}-year-olds (%)`, n1(m.summary.share)], [`Pupils aged ${m.entry.age} in this group`, n0(m.summary.total)]] };
}

const sectorWords = (e: MarketView["extras"][number] | undefined) =>
  [e?.traits?.sector === "independent" ? "Independent" : e?.traits?.sector === "state" ? "State" : null, e?.traits?.boarding ? "boarding" : null, e?.traits?.gender === "girls" ? "girls" : e?.traits?.gender === "boys" ? "boys" : null].filter(Boolean).join(" · ") || null;

/** Ranked bars: the schools the look shows, ranked by pupils at the entry age, with their results places. */
export function rankedBarsCsv(m: MarketView, r: RivalsView | null, show: "all" | "top5" | "around" = "all"): CsvTable | null {
  const y = m.summary.latest;
  const ranked = m.entryAge.rows.filter((x) => x.period === y).sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  const at = ranked.findIndex((x) => x.urn === m.urn);
  const rows = show === "top5" ? ranked.filter((x, i) => i < 5 || x.urn === m.urn) : show === "around" && at >= 0 ? ranked.slice(Math.max(0, at - 2), at + 3) : ranked;
  if (!rows.length) return null;
  const age = m.entry.age;
  return {
    about: { year: yr(y) },
    columns: ["Rank", "School", "Sector", `Pupils aged ${age}`, "Share (%)", `Trend since ${yr(y - 1)} (%)`, "Results: region rank", "Results: region schools ranked", "Results: England rank", "Results: England schools ranked"],
    rows: rows.map((row) => {
      const rr = r?.rows.find((x) => x.urn === row.urn);
      const word = resultsWord(rr);
      return [row.rank, nameOf(m, row.urn), sectorWords(m.extras.find((x) => x.urn === row.urn)), n0(row.count), n0(row.share), n1(m.summary.trend[row.urn]), word ?? rr?.results.regional?.rank ?? null, word ? null : (rr?.results.regional?.of ?? null), word ? null : (rr?.results.national?.rank ?? null), word ? null : (rr?.results.national?.of ?? null)];
    }),
  };
}

/** The rivals map: each located school, sized by pupils at the entry age, with its share and trend. */
export function rivalsMapCsv(m: MarketView): CsvTable | null {
  const located = m.extras.filter((e) => e.traits?.easting != null && e.traits?.northing != null);
  if (!located.length) return null;
  return {
    about: { year: yr(m.summary.latest) },
    columns: ["School", "URN", "Role", "Sector", `Pupils aged ${m.entry.age}`, "Share of this group (%)", `Trend since ${yr(m.summary.latest - 1)} (%)`, "Easting", "Northing"],
    rows: located.map((e) => {
      const row = m.entryAge.rows.find((x) => x.urn === e.urn && x.period === m.summary.latest);
      return [nameOf(m, e.urn), e.urn, e.urn === m.urn ? "this school" : "rival", e.traits?.sector === "independent" ? "Independent" : e.traits?.sector === "state" ? "State" : null, n0(row?.count ?? e.entryNow), row?.share != null ? n1(row.share) : "no share", n1(m.summary.trend[e.urn]), e.traits!.easting!, e.traits!.northing!];
    }),
  };
}

/** The rivals table, in its look's order. */
export function rivalsTableCsv(m: MarketView, r: RivalsView | null, sort: "latest" | "listed" = "latest"): CsvTable | null {
  const y = m.summary.latest;
  const km = (urn: string) => (urn === m.urn ? -1 : (m.extras.find((x) => x.urn === urn)?.distanceKm ?? 1e9));
  const rows = m.entryAge.rows.filter((x) => x.period === y).sort(sort === "listed" ? (a, b) => km(a.urn) - km(b.urn) : (a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  if (!rows.length) return null;
  const age = m.entry.age;
  const measure = r?.overall?.measure ?? (age >= 16 ? "A-level points per entry" : age >= 11 ? "Attainment 8" : "KS2");
  const results = `Results: England rank, ${measure.replace("A-level points per entry", "A-level points")}${r?.resultsPeriod != null ? ` ${yr(r.resultsPeriod)}` : ""}`;
  return {
    about: { year: yr(y) },
    columns: [`Rank by aged ${age}`, "School", `Aged ${age}, ${yr(y)}`, `Share of all aged ${age} (%)`, "Roll", "Size", "km", results, "England schools ranked"],
    rows: rows.map((row) => {
      const e = m.extras.find((x) => x.urn === row.urn);
      const rr = r?.rows.find((x) => x.urn === row.urn);
      const word = resultsWord(rr);
      return [row.rank, nameOf(m, row.urn), n0(row.count), n1(row.share), n0(e?.roll), rr?.size?.badge ?? null, row.urn === m.urn ? null : n1(e?.distanceKm), word ?? rr?.results.national?.rank ?? null, word ? null : (rr?.results.national?.of ?? null)];
    }),
  };
}

/** Rivals' momentum: each school's pupils change (x) and results change (y), whether it is plotted, its flags. */
export function momentumCsv(m: MarketView, r: RivalsView): CsvTable {
  const res = momentumResults(r);
  const results = res.stage === "ks4" ? "Attainment 8" : res.stage === "ks5" ? "A-level points per entry" : "KS2 expected standard (%)";
  return {
    about: { year: null },
    columns: ["School", `Pupils aged ${m.entry.age}: change over 3 years (%)`, `Results change since ${yr(TREND_BASE_PERIOD)} (${results}, points)`, "On the scatter", "Flags"],
    rows: r.rows.map((x) => {
      const e = m.extras.find((q) => q.urn === x.urn);
      const rc = res.change[x.urn];
      const plotted = e?.entryChangePctAll != null && rc?.points != null;
      const igcse = !res.switched && x.results.note === "igcse_not_ranked";
      return [x.isSchool ? `${x.name} (you)` : x.name, n1(e?.entryChangePctAll), igcse ? "IGCSE" : n1(rc?.points), plotted ? "yes" : "no change to plot", x.momentum.map(flagText).join("; ") || null];
    }),
  };
}

/** The flag list: each rival (the flagged ones, or all), its flags and figures. */
export function flagsCsv(m: MarketView, r: RivalsView, show: "flagged" | "all" = "flagged"): CsvTable | null {
  const flaggedOnly = show === "flagged" && r.thresholds !== "not_loaded";
  const rows = [...r.rows.filter((x) => !x.isSchool && (!flaggedOnly || x.momentum.length > 0))].sort((a, b) => b.momentum.length - a.momentum.length);
  if (!rows.length) return null;
  return {
    about: { year: null },
    columns: ["Rival", "Flags", "Pupils (%)", "Results (points)"],
    rows: rows.map((x) => {
      const e = m.extras.find((q) => q.urn === x.urn);
      const flags = r.thresholds === "not_loaded" && x.momentum.length === 0 ? "flags not available yet" : x.momentum.length === 0 ? "No change worth flagging" : x.momentum.map(flagText).join("; ");
      return [x.name, flags, n0(e?.entryChangePctAll), x.results.note === "igcse_not_ranked" ? "IGCSE" : n1(r.resultsChange[x.urn]?.points)];
    }),
  };
}

const FLAG_WORD: Record<string, string> = { strength: "Strength", strength_growing: "Strength, growing", weakness: "Weakness", weakness_widening: "Weakness, widening" };

/** Strengths and weaknesses: each subject area, your rank among the rivals with it, the gap and its direction. */
export function strengthsCsv(r: RivalsView, o: { order?: "gap" | "az"; showFlags?: boolean } = {}): CsvTable | null {
  if (r.stage === "ks2" || !r.areas.length) return null;
  const label = (id: string) => r.areaLabels[id] ?? id;
  const areas = o.order === "az" ? [...r.areas].sort((a, b) => label(a.familyId).localeCompare(label(b.familyId))) : [...r.areas].sort((a, b) => b.gap - a.gap);
  const showFlags = o.showFlags !== false;
  return {
    about: { year: r.resultsPeriod === null ? null : yr(r.resultsPeriod) },
    columns: ["Subject area", "Your rank", "Of", "You (points)", "Rivals' average (points)", "Gap (points)", `Gap change since ${yr(TREND_BASE_PERIOD)} (points)`, ...(showFlags ? ["Flag"] : [])],
    rows: areas.map((a) => [
      label(a.familyId),
      a.rank,
      a.of,
      n2(a.mine),
      n2(a.mine - a.gap),
      n2(a.gap),
      n2(a.gapSince2223),
      ...(showFlags
        ? [a.flags.filter((f) => !(f.id === "strength" && a.flags.some((g) => g.id === "strength_growing")) && !(f.id === "weakness" && a.flags.some((g) => g.id === "weakness_widening"))).map((f) => FLAG_WORD[f.id] ?? f.label).join("; ") || null]
        : []),
    ]),
  };
}

/** One school's indexed line beside the others: a rival too small to index is named, not drawn. */
function eachRival(m: MarketView, rivals: { urn: string; values: { year: number; value: number | null }[]; small: boolean }[], years: number[]) {
  return {
    columns: rivals.map((x) => `${nameOf(m, x.urn)}: index`),
    cells: (y: number) => rivals.map((x) => (x.small ? `too few to index (under ${ROLL_INDEX_MIN} at the start)` : n0(x.values.find((v) => v.year === y)?.value))),
    years,
  };
}

/** You against the rivals' average at the entry age: indexed (the line; in full screen each rival too) or counts (the bars). */
export function vsRivalsCsv(m: MarketView, as: "line" | "bars", fullscreen: boolean): CsvTable | null {
  const v = m.summary.vsIndexed;
  if (v.mine.filter((x) => x.value !== null).length < 2) return null;
  const count = (urn: string, y: number) => m.entryAge.rows.find((r) => r.urn === urn && r.period === y)?.count ?? null;
  const avg = (y: number) => m.summary.rivalsAverage.find((x) => x.year === y)?.value ?? null;
  if (as === "bars") return { about: { year: null }, columns: ["Year", `You: pupils aged ${m.entry.age}`, "Rivals' average: pupils"], rows: m.entryAge.periods.map((y) => [yr(y), n0(count(m.urn, y)), n0(avg(y))]) };
  const years = v.mine.map((x) => x.year);
  const at = (s: { year: number; value: number | null }[], y: number) => n0(s.find((x) => x.year === y)?.value);
  const each = fullscreen ? eachRival(m, m.rivals.filter((u) => u !== m.urn).map((u) => ({ urn: u, ...indexOwn(years.map((y) => ({ year: y, value: count(u, y) })), v.base) })), years) : null;
  return {
    about: { year: null },
    columns: ["Year", "You: index", `You: pupils aged ${m.entry.age}`, "Rivals' average: index", "Rivals' average: pupils", ...(each?.columns ?? [])],
    rows: years.map((y) => [yr(y), at(v.mine, y), n0(count(m.urn, y)), at(v.rivals, y), n0(avg(y)), ...(each?.cells(y) ?? [])]),
  };
}

/** Your market share at the entry age, year by year (the line). */
export function shareTrendCsv(m: MarketView): CsvTable | null {
  const mine = m.entryAge.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  if (mine.filter((r) => r.share !== null).length < 2) return null;
  return { about: { year: null }, columns: ["Year", "Your share (%)", "You", "You and your rivals"], rows: mine.map((r) => [yr(r.period), n1(r.share), n0(r.count), n0(m.entryAge.totals[r.period])]) };
}

/** Share numbers and ranks: the share and the rank by share, year by year. */
export function shareTableCsv(m: MarketView): CsvTable | null {
  const mine = m.entryAge.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  if (!mine.length) return null;
  return {
    about: { year: null },
    columns: ["Year", "You", "You and your rivals", "Share (%)", "Rank by share", "Schools ranked"],
    rows: mine.map((r) => [yr(r.period), n0(r.count), n0(m.entryAge.totals[r.period]), n1(r.share), r.rank ?? null, r.rank ? m.entryAge.rows.filter((x) => x.period === r.period && x.count !== null).length : null]),
  };
}

/** Change bars: each school's change in share since the first year, biggest rise first. */
export function shareChangeCsv(m: MarketView): CsvTable | null {
  const first = m.summary.first;
  const rows = m.extras
    .map((e) => ({ urn: e.urn, change: m.summary.shareChange[e.urn] ?? null, from: m.entryAge.rows.find((r) => r.urn === e.urn && r.period === first)?.share ?? null, to: m.entryAge.rows.find((r) => r.urn === e.urn && r.period === m.summary.latest)?.share ?? null }))
    .sort((a, b) => (b.change ?? -1e9) - (a.change ?? -1e9));
  if (!rows.length) return null;
  return { about: { year: null }, columns: ["School", `Share ${yr(first)} (%)`, `Share ${yr(m.summary.latest)} (%)`, "Change (percentage points)"], rows: rows.map((r) => [nameOf(m, r.urn), n1(r.from), n1(r.to), n1(r.change)]) };
}

/** The age band's roll, indexed: you and the rivals' average (in full screen, each rival too). */
export function rollTrendCsv(m: MarketView, fullscreen: boolean): CsvTable | null {
  const r = m.summary.rollIndexed;
  if (r.mine.filter((x) => x.value !== null).length < 2) return null;
  const years = r.mine.map((x) => x.year);
  const raw = (urn: string, y: number) => n0(m.ageBand.rows.find((x) => x.urn === urn && x.period === y)?.count ?? null);
  const at = (s: { year: number; value: number | null }[], y: number) => n0(s.find((x) => x.year === y)?.value);
  const each = fullscreen ? eachRival(m, r.rivals, years) : null;
  const band = `${m.band.from}–${m.band.to}`;
  return {
    about: { year: null },
    columns: ["Year", "You: index", `You: pupils aged ${band}`, "Rivals' average: index", ...(each?.columns ?? [])],
    rows: years.map((y) => [yr(y), at(r.mine, y), raw(m.urn, y), at(r.average, y), ...(each?.cells(y) ?? [])]),
  };
}

/** Your share of the whole age band's roll, year by year. */
export function bandShareCsv(m: MarketView): CsvTable | null {
  const mine = m.ageBand.rows.filter((r) => r.urn === m.urn).sort((a, b) => a.period - b.period);
  if (mine.filter((r) => r.share !== null).length < 2) return null;
  const band = `${m.band.from}–${m.band.to}`;
  return { about: { year: null }, columns: ["Year", `Your share of pupils aged ${band} (%)`, "You", "You and your rivals"], rows: mine.map((r) => [yr(r.period), n1(r.share), n0(r.count), n0(m.ageBand.totals[r.period])]) };
}

// ------------------------------------------------------------------------------- Academic

/** Ranking: the overall place, then where you lead and trail (the areas the panel lists). */
export function academicRankingCsv(r: RivalsView): CsvTable | null {
  if (!r.overall && !r.rows.some((x) => x.results.value !== null)) return null;
  const rows: CsvCell[][] = [];
  if (r.overall) rows.push(["Overall", r.overall.measure, r.overall.rank, r.overall.of, null, null, r.overall.national?.rank ?? "Not ranked in England", r.overall.national?.of ?? null, n1(r.overall.change)]);
  else rows.push(["Overall", "No ranked headline for this school", null, null, null, null, "Not ranked in England", null, null]);
  if (r.stage !== "ks2") {
    const label = (id: string) => r.areaLabels[id] ?? id;
    for (const a of r.areas.filter((x) => x.gap > 0).sort((x, y) => y.gap - x.gap).slice(0, 3)) rows.push(["Where you lead", label(a.familyId), a.rank, a.of, n2(a.gap), n2(a.gapSince2223), null, null, null]);
    for (const a of r.areas.filter((x) => x.gap < 0).sort((x, y) => x.gap - y.gap).slice(0, 2)) rows.push(["Where you trail", label(a.familyId), a.rank, a.of, n2(a.gap), n2(a.gapSince2223), null, null, null]);
  }
  for (const x of r.rows.filter((q) => q.results.note !== null)) rows.push(["Not ranked", x.name, x.results.note === "igcse_not_ranked" ? "IGCSE school" : "no published results", null, null, null, null, null, null]);
  return {
    about: { year: r.resultsPeriod === null ? null : yr(r.resultsPeriod) },
    columns: ["Row", "Measure or subject area", "Rank among rivals", "Of", "Gap to the rivals' average (points)", `Gap change since ${yr(TREND_BASE_PERIOD)} (points)`, "England rank", "England schools ranked", `Change since ${yr(TREND_BASE_PERIOD)} (points)`],
    rows,
  };
}

/** Numbers: each school's headline (or "IGCSE") and its England place, highest first. */
export function academicNumbersCsv(r: RivalsView): CsvTable | null {
  if (!r.rows.length) return null;
  const rows = [...r.rows].sort((a, b) => (b.results.value ?? -1e9) - (a.results.value ?? -1e9));
  const measure = r.overall?.measure ?? ({ ks2: "KS2", ks4: "GCSE", ks5: "Post-16" } as const)[r.stage];
  return {
    about: { year: r.resultsPeriod === null ? null : yr(r.resultsPeriod) },
    columns: ["School", measure, "England rank", "England schools ranked"],
    rows: rows.map((x) => [x.isSchool ? `${x.name} (you)` : x.name, x.results.note === "igcse_not_ranked" ? "IGCSE" : n1(x.results.value), x.results.national?.rank ?? null, x.results.national?.of ?? null]),
  };
}

/** % change: each school's headline change since 2022/23, in points, biggest rise first. */
export function academicChangeCsv(r: RivalsView): CsvTable | null {
  if (!r.rows.length) return null;
  const rows = r.rows.map((x) => ({ x, c: r.resultsChange[x.urn]?.points ?? null })).sort((a, b) => (b.c ?? -1e9) - (a.c ?? -1e9));
  return { about: { year: null }, columns: ["School", `Change since ${yr(TREND_BASE_PERIOD)} (points)`], rows: rows.map(({ x, c }) => [x.isSchool ? `${x.name} (you)` : x.name, x.results.note === "igcse_not_ranked" ? "IGCSE" : n1(c)]) };
}

// ------------------------------------------------------------------------------- one view

export type AdmCsvCtx = { entry: string | null; entryAge: number | null; filters: Filters; projection: boolean; pipeline: Load<PipelineView>; market: Load<MarketView>; rivals: Load<RivalsView>; shape: Load<ShapeView> };
export type AdmCsvOpts = { fullscreen: boolean; look: Record<string, unknown>; lines: Set<string>; set: string | null };

const pipeOf = (l: Load<PipelineView>): PipelineOk | null => (l.status === "ready" && !("empty" in l.data) ? (l.data as PipelineOk) : null);
const readyOf = <T>(l: Load<T>): T | null => (l.status === "ready" ? l.data : null);

/** The rows for one Admissions view, as viewBody draws it, with the set it rests on. Null where the
 * view draws nothing (still loading, an error, an empty state). */
export function admissionsViewCsv(dv: string, c: AdmCsvCtx, o: AdmCsvOpts): CsvTable | null {
  const t = viewTable(dv, c, o);
  if (!t) return null;
  // The set the view names in its header (null for the area and own-entry views), unless the table names its own (the funnel's area).
  return { ...t, about: { set: t.about?.set !== undefined ? t.about.set : o.set, year: t.about?.year ?? null } };
}

function viewTable(dv: string, c: AdmCsvCtx, o: AdmCsvOpts): CsvTable | null {
  const L = o.look;
  const p = pipeOf(c.pipeline);
  const m = readyOf(c.market);
  const r = readyOf(c.rivals);
  const sexAll = c.filters.sex === "all";
  if (dv.startsWith("DV-ADM-P-") && dv !== "DV-ADM-P-SHAPE" && !p) return null;
  switch (dv) {
    case "DV-ADM-P-NOW":
      return entryNowCsv(p!, readyOf(c.shape));
    case "DV-ADM-P-PIPELINE":
      return pipelineCsv(p!, { pastPools: L.pastPools !== false, projection: L.projection !== "off" && c.projection });
    case "DV-ADM-P-FUNNEL":
      return intakeCsv(p!);
    case "DV-ADM-P-BIRTHS":
      return localBirthsCsv(p!);
    case "DV-ADM-P-MAP":
      return feederMapCsv(p!);
    case "DV-ADM-P-TABLE":
      return feederTableCsv(p!, L as Parameters<typeof feederTableCsv>[1]);
    case "DV-ADM-P-SHAPE":
    case "DV-ADM-M-SHAPE": {
      const s = readyOf(c.shape);
      return s && c.entryAge !== null ? shapeCsv(s, c.entryAge, dv === "DV-ADM-P-SHAPE") : null;
    }
    case "DV-ADM-P-ENTRY-LINE":
    case "DV-ADM-P-ENTRY-BARS":
      return entryTrendCsv(p!, true);
    case "DV-ADM-P-ENTRY-TABLE":
      return entryTrendCsv(p!, false);
    case "DV-ADM-P-ENTRY-SEX":
      return entrySexCsv(p!);
    case "DV-ADM-P-POOL-INDEXED":
      return poolTrendsCsv(p!, { la: o.lines.has("la") && sexAll, england: o.lines.has("england") && sexAll, indexed: true });
    case "DV-ADM-P-POOL-TABLE":
      return poolTrendsCsv(p!, { la: o.lines.has("la") && sexAll, england: o.lines.has("england") && sexAll, indexed: false });
    case "DV-ADM-P-AREA-POP":
      return areaPopulationCsv(p!, { la: o.lines.has("la"), region: o.lines.has("region") });
    case "DV-ADM-P-HOLD-LINE":
    case "DV-ADM-P-HOLD-TABLE":
      return shareNeededCsv(p!);
  }
  if (dv.startsWith("DV-ADM-M-ACAD") || dv === "DV-ADM-M-STRENGTHS") {
    if (!r) return null;
    if (dv === "DV-ADM-M-STRENGTHS") return strengthsCsv(r, { order: L.order as "gap" | "az", showFlags: L.showFlags as boolean | undefined });
    if (dv === "DV-ADM-M-ACAD-RANK") return academicRankingCsv(r);
    if (dv === "DV-ADM-M-ACAD-NUM") return academicNumbersCsv(r);
    if (dv === "DV-ADM-M-ACAD-CHANGE") return academicChangeCsv(r);
    return null;
  }
  if (!m) return null;
  switch (dv) {
    case "DV-ADM-M-NOW":
      return marketNowCsv(m);
    case "DV-ADM-M-DONUT":
      return donutCsv(m);
    case "DV-ADM-M-BARS":
      return rankedBarsCsv(m, r, L.show as "all" | "top5" | "around");
    case "DV-ADM-M-MAP":
      return rivalsMapCsv(m);
    case "DV-ADM-M-TABLE":
      return rivalsTableCsv(m, r, L.sort as "latest" | "listed");
    case "DV-ADM-M-MOMENTUM":
      return r ? momentumCsv(m, r) : null;
    case "DV-ADM-M-FLAGS":
      return r ? flagsCsv(m, r, L.show as "flagged" | "all") : null;
    case "DV-ADM-M-VS-LINE":
      return vsRivalsCsv(m, "line", o.fullscreen);
    case "DV-ADM-M-VS-BARS":
      return vsRivalsCsv(m, "bars", o.fullscreen);
    case "DV-ADM-M-SHARE-LINE":
      return shareTrendCsv(m);
    case "DV-ADM-M-SHARE-NUM":
    case "DV-ADM-M-SHARE-RANKS":
      return shareTableCsv(m);
    case "DV-ADM-M-SHARE-CHANGE":
      return shareChangeCsv(m);
    case "DV-ADM-M-ROLL-LINE":
      return rollTrendCsv(m, o.fullscreen);
    case "DV-ADM-M-SHARE-BAND":
      return bandShareCsv(m);
  }
  return null;
}
