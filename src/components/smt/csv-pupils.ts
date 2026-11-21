// Panel menu "Save as CSV" (21 Nov): SMT Pupils's rows, one builder per view (see csv.ts). Each builder
// reads the same object its view draws (views/Pupils.tsx, Lines.tsx, Tables.tsx) at the precision the
// view prints: pupils whole, shares whole percents (Pupils' pct()), percentage-point changes to one place.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { SMT_NOTES } from "@/catalogue/notes";
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import type { Pupils } from "@/lib/smt/pupils";
import type { SmtSchool } from "./api";
import { SHAPE_LABELS } from "@/components/dashboard/ShapeIcon";
import type { ShapeLabel } from "@/lib/shape-classifier";
import { marketCsv, rollCsv, smtNum } from "./csv";

type School = Pick<SmtSchool, "name" | "mixed" | "low" | "high">;

const yr = (p: number | null | undefined) => (p === null || p === undefined ? null : periodLabel(p));
const whole = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v));
const pp = (v: number | null | undefined) => smtNum(v, "pp");
const shapeName = (s: string | null | undefined) => (s ? (SHAPE_LABELS[s as ShapeLabel] ?? s) : null);
const phaseWord = (label: string) => (label === "Sixth Form" ? "16+" : label === "Secondary" ? "Senior" : label);

/** Column 1, "Your pupils now": the tiles, then size by phase (XS to XL). */
export function pupilsNowCsv(p: Pupils, school: School): CsvTable {
  const n = p.now;
  const rows: CsvCell[][] = [["Roll", whole(n.roll), "pupils", school.low !== null && school.high !== null ? `ages ${school.low}–${school.high}` : "whole school"]];
  rows.push([`Roll change since ${periodLabel(CENSUS_FIRST_PERIOD)}`, whole(n.changePct), "%", "whole school"]);
  if (school.mixed) {
    const t = n.girls !== null && n.boys !== null ? n.girls + n.boys : 0;
    rows.push(["Girls", t ? Math.round((n.girls! / t) * 100) : null, "%", "in whole school"], ["Boys", t ? Math.round((n.boys! / t) * 100) : null, "%", "in whole school"]);
  }
  if (n.boarding) rows.push(["Day", whole(n.boarding.day), "pupils", "in whole school"], ["Boarding", whole(n.boarding.boarders), "pupils", "in whole school"]);
  if (n.stayingOn) rows.push([SMT_NOTES.y12Label, Math.round(n.stayingOn.pct), "%", SMT_NOTES.y12AgainstY11]);
  for (const b of n.sizes) rows.push([`${phaseWord(b.label)}: pupils`, whole(b.total), "pupils", b.badge ? `size ${b.badge} (XS to XL)` : null]);
  return { about: { set: null, year: yr(n.census) }, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** Shape and size: pupils in each year group -- the school, the set's nearest school, the set's middle --
 * then each one's shape. */
export function shapeCsv(p: Pupils, school: School): CsvTable | null {
  const s = p.shape;
  if (!s.yearGroups.length) return null;
  const near = s.around.nearest ?? null;
  const mid = s.around.setMiddle ?? null;
  const ages = Array.from(new Set([...s.yearGroups, ...(near?.yearGroups ?? []), ...(mid?.yearGroups ?? [])].map((y) => y.age))).sort((a, b) => a - b);
  const label = (age: number) => [...s.yearGroups, ...(near?.yearGroups ?? []), ...(mid?.yearGroups ?? [])].find((y) => y.age === age)!.label;
  const at = (gs: { age: number; total: number }[] | undefined, age: number) => whole(gs?.find((y) => y.age === age)?.total);
  const columns = ["Year group", `${school.name}: pupils`, ...(near ? [`Nearest, ${near.name}: pupils`] : []), ...(mid ? [`${p.set.label}, middle school at each year group (${mid.schools} schools): pupils`] : [])];
  const rows: CsvCell[][] = ages.map((age) => [label(age), at(s.yearGroups, age), ...(near ? [at(near.yearGroups, age)] : []), ...(mid ? [at(mid.yearGroups, age)] : [])]);
  rows.push(["Shape", shapeName(s.label), ...(near ? [shapeName(near.shape)] : []), ...(mid ? [shapeName(mid.shape)] : [])]);
  return { about: { set: p.set.label, year: null }, columns, rows };
}

const PARTS = ["Part", "Row", "Girls", "Boys", "Value", "Unit", "Set middle", "Set schools"];

/** Girls and boys: each year group, the whole school year by year, the change and where it shifts. */
export function girlsBoysCsv(p: Pupils): CsvTable | null {
  const g = p.girlsBoys;
  if (!g || !g.years.length) return null;
  const rows: CsvCell[][] = g.years.map((y) => ["Girls' share by year group", y.label, y.girls, y.boys, whole(y.share), "%", whole(y.set.median), y.set.schools]);
  if (g.trend.school.length > 1) for (const x of g.trend.school) rows.push(["Girls' share, whole school, year by year", yr(x.year), null, null, whole(x.value), "%", whole(g.trend.set.find((t) => t.year === x.year)?.value), g.trend.set.length ? g.trend.setSchools : null]);
  if (g.whole.baseYear !== null) rows.push(["Whole school", yr(g.whole.baseYear), null, null, whole(g.whole.base), "%", null, null]);
  rows.push(["Whole school", `Now (${yr(g.year)})`, null, null, whole(g.whole.share), "%", whole(g.whole.set.share.median), g.whole.set.share.schools]);
  if (g.whole.baseYear !== null) rows.push(["Whole school", `Change since ${yr(g.whole.baseYear)}`, null, null, pp(g.whole.change), "percentage points", pp(g.whole.set.change.median), g.whole.set.change.schools]);
  for (const x of g.shifts) rows.push(["Where it shifts", `${x.label} against ${x.against}`, null, null, pp(x.shift), "percentage points", pp(x.set.median), x.set.schools]);
  return { about: { set: p.set.label, year: null }, columns: PARTS, rows };
}

/** Day and boarding: census by census (newest first, as the table), now against the set, the change. */
export function dayBoardingCsv(p: Pupils): CsvTable | null {
  const d = p.dayBoarding;
  if (!d) return null;
  const trend = d.set.trend.length > 0;
  const rows: CsvCell[][] = [...d.years].reverse().map((r) => ["Census", yr(r.year), whole(r.boarders), whole(r.day), whole(r.share), "%", trend ? whole(d.set.trend.find((t) => t.year === r.year)?.value) : null, trend ? d.set.trendSchools : null]);
  rows.push([`Now (${yr(d.year)})`, "Boarders' share", whole(d.now.boarders), whole(d.now.day), whole(d.now.share), "%", whole(d.set.share.median), d.set.share.schools]);
  rows.push([`Now (${yr(d.year)})`, `Boarding schools in ${p.set.label} (of ${d.set.of})`, null, null, d.set.boardingSchools, "schools", null, null]);
  if (d.baseYear !== null) rows.push([`Since ${yr(d.baseYear)}`, "Boarders' share", null, null, pp(d.change), "percentage points", pp(d.set.change.median), d.set.change.schools]);
  return { about: { set: p.set.label, year: null }, columns: ["Part", "Row", "Boarders", "Day", "Value", "Unit", "Set middle", "Set schools"], rows };
}

/** Entry points at a glance (Admissions', read-only). */
export function entriesCsv(p: Pupils): CsvTable | null {
  const e = p.entries;
  if (e.status === "empty" || !e.rows.length) return null;
  return {
    about: { set: null, year: null },
    columns: ["Entry point", "Cohort now", "The pool, next entry", "Pool entry year", "Pool from"],
    rows: e.rows.map((r) => [r.label, whole(r.cohort), whole(r.pool), r.poolYear, r.poolSource === "births" ? "births" : r.poolSource ? "counted" : null]),
  };
}

/** Leaving at 16: the chart and the table draw the same years; the CSV carries both's figures. */
export function leavingCsv(p: Pupils): CsvTable | null {
  if (!p.leaving.length) return null;
  const ref = p.shape.around.stayingOnSet.pct;
  return {
    about: { set: p.set.label, year: null },
    columns: ["Year 12 in", "Year 11 the year before", "Year 12", `${SMT_NOTES.y12Label} (%)`, "Joined (+) or left (−)", ...(ref !== null ? [`At the middle of ${p.set.label} (${Math.round(ref)}% stayed on)`] : [])],
    rows: p.leaving.map((r) => [yr(r.year), whole(r.year11), whole(r.year12), whole(r.stayingPct), r.leaving === null ? null : -Math.round(r.leaving), ...(ref !== null ? [r.year11 !== null ? Math.round(r.year11 * (ref / 100)) - r.year11 : null] : [])]),
  };
}

/** Admissions' pool for the main entry point: counted, then from births. */
export function poolCsv(p: Pupils): CsvTable | null {
  const pool = p.trends.pool;
  if (pool.status === "empty") return null;
  const rows: CsvCell[][] = [...pool.counted.map((x) => [x.year, whole(x.value), "counted"]), ...pool.births.map((x) => [x.year, whole(x.value), "from births"])];
  if (!rows.length) return null;
  return { about: { set: null, year: null }, columns: ["Entry year", `The pool for ${pool.entry}: pupils`, "Counted or from births"], rows };
}

/** The area's school-age residents (ONS), then the projection where the view draws one. */
export function areaCsv(p: Pupils, laName: string | null): CsvTable | null {
  const a = p.trends.area;
  if (a.pts.filter((x) => x.value !== null).length < 2) return null;
  const f = a.forward && a.forward.pts.length > 1 ? a.forward : null;
  const rows: CsvCell[][] = a.pts.map((x) => [`mid-${x.year}`, whole(x.value), "estimate"]);
  for (const x of f?.pts ?? []) rows.push([`mid-${x.year}`, whole(x.value), f!.unbornFrom !== null && x.year >= f!.unbornFrom ? `projection (${SMT_NOTES.includesUnborn})` : "projection"]);
  return { about: { set: null, year: null }, columns: ["Year", `${laName ?? a.laName ?? "The LA"}, residents aged ${a.agesWord}`, "Estimate or projection"], rows };
}

/** The rows for one Pupils view as ViewBody draws it; null where it draws nothing tabular. */
export function pupilsCsv(dv: string, d: Pupils, school: School & { laName?: string | null }): CsvTable | null {
  switch (dv) {
    case "DV-SMT-P-NOW":
      return pupilsNowCsv(d, school);
    case "DV-SMT-P-SHAPE":
      return shapeCsv(d, school);
    case "DV-SMT-P-GIRLS-BOYS":
      return girlsBoysCsv(d);
    case "DV-SMT-P-DAY-BOARDING":
      return dayBoardingCsv(d);
    case "DV-SMT-P-ENTRIES":
      return entriesCsv(d);
    case "DV-SMT-P-LEAVING":
      return leavingCsv(d);
    case "DV-SMT-P-MARKET":
      return marketCsv(d.market, school.name);
    case "DV-SMT-P-PHASES":
      // IndexedLines draws nothing under two census years.
      if (!d.trends.phases.length || d.trends.phases[0].pts.filter((x) => x.value !== null).length < 2) return null;
      return rollCsv(d.trends.phases, d.trends.base);
    case "DV-SMT-P-PHASES-TABLE":
      return rollCsv(d.trends.phases, d.trends.base);
    case "DV-SMT-P-POOL":
      return poolCsv(d);
    case "DV-SMT-P-AREA":
      return areaCsv(d, school.laName ?? null);
  }
  return null;
}
