// Panel menu "Save as CSV" (21 Nov): SMT's rows -- each view's table, built from the same object the
// view draws (Overview, Pupils, Context, Academic), at the precision the view shows (fmt's), with
// what the view withholds left withheld. Pure, so src/lib/panel-csv.test.ts checks each one against
// the view's own rows. ViewBody registers the one for the view on screen (usePanelCsv).
import type { CsvCell, CsvTable } from "@/lib/csv";
import { shown } from "@/lib/csv";
import { periodLabel } from "@/catalogue/years";
import type { Overview } from "@/lib/smt/overview";
import { figuresOf } from "@/components/admissions/views/Momentum";
import type { Unit } from "./ui";

/** A figure at fmt's precision: pupils whole, a % or share to 1 place, value added and grades to 2,
 * points to 1 (points per entry to 2). Null where fmt shows "—". */
export function smtNum(v: number | null | undefined, unit: Unit | "pp", key?: string): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  switch (unit) {
    case "pupils":
      return Math.round(v);
    case "pct":
    case "share":
    case "pp":
      return shown(v, 1);
    case "va":
    case "grade":
      return shown(v, 2);
    default:
      return shown(v, key && /aps_per_entry/.test(key) ? 2 : 1);
  }
}

/** The unit word a mixed-unit column's neighbour carries ("%", "points", "pupils", "value added"). */
export const unitWord = (u: Unit | "pp"): string => (u === "pct" || u === "share" ? "%" : u === "pp" ? "percentage points" : u === "va" ? "value added" : u === "grade" ? "grade" : u);

const yr = (p: number | null | undefined) => (p === null || p === undefined ? null : periodLabel(p));
const changeUnit = (u: "pct" | "points" | "pp" | "va") => (u === "pct" ? "%" : u === "pp" ? "percentage points" : u === "va" ? "value added" : "points");

// ------------------------------------------------------------------------------- Overview

/** Scorecard: one row per headline -- the figure, its rank in the set, region and England, its trend. */
export function scorecardCsv(o: Overview, regionName: string | null): CsvTable {
  const region = o.rows.find((r) => r.region)?.region?.name ?? regionName ?? "Region";
  return {
    about: { set: o.set.label, year: null },
    columns: ["Measure", "Year", "You", "Unit", `${o.set.short} rank`, `${o.set.short} schools ranked`, `${region} rank`, `${region} schools ranked`, "England rank", "England schools ranked", "Trend", "Trend unit", "Trend period"],
    rows: o.rows.map((r) => {
      const unit = r.unit === "share" ? "share" : r.unit;
      const na = r.key === "market11" ? "n/a" : null;
      return [
        r.label,
        yr(r.period),
        smtNum(r.value, unit, r.key),
        unitWord(unit),
        r.set?.rank ?? null,
        r.set?.of ?? null,
        r.region?.rank ?? na,
        r.region?.of ?? null,
        r.england?.rank ?? na,
        r.england?.of ?? null,
        r.since ? smtNum(r.since.change, r.since.unit === "pct" ? "pupils" : r.since.unit === "va" ? "va" : r.since.unit === "pp" ? "pp" : "points") : null,
        r.since ? changeUnit(r.since.unit) : null,
        r.since?.period ?? null,
      ];
    }),
  };
}

/** Current: the tiles the card shows -- the roll and its change, day and boarding or girls and boys,
 * the size of each phase against the set. */
export function schoolNowCsv(o: Overview): CsvTable {
  const n = o.now;
  const rows: CsvCell[][] = [["Roll", n.roll === null ? null : Math.round(n.roll), "pupils", null]];
  if (n.changePct !== null) rows.push([`Roll change since ${periodLabel(n.base.period)}`, Math.round(n.changePct), "%", null]);
  if (n.boarding) {
    rows.push(["Day pupils", Math.round(n.boarding.day), "pupils", null], ["Boarders", Math.round(n.boarding.boarders), "pupils", null]);
  } else if (n.girls !== null && n.boys !== null && n.roll) {
    const t = n.girls + n.boys;
    rows.push(["Girls", Math.round((n.girls / t) * 100), "%", null], ["Boys", Math.round((n.boys / t) * 100), "%", null]);
  }
  for (const t of n.entry ?? []) rows.push([`${t.label} (${periodLabel(t.year)})`, Math.round(t.value), "pupils", null]);
  for (const b of n.setSizes ?? []) rows.push([`${b.label}: pupils`, Math.round(b.total), "pupils", b.schools ? `${b.rank} largest of ${b.of} in ${o.set.short}; median ${b.median === null ? "—" : Math.round(b.median)}` : "no other school in the set has this phase"]);
  return { about: { set: o.set.label, year: yr(n.census) }, columns: ["Measure", "Value", "Unit", "Against the set"], rows };
}

/** Map: the school and the set's schools, each with its roll and roll direction (the map's dots). */
export function setMapCsv(o: Overview): CsvTable {
  const rows = Object.entries(o.schools)
    .filter(([, s]) => s.easting !== null && s.northing !== null)
    .map(([urn, s]) => {
      const r = o.rolls?.[urn];
      return [s.name, urn, urn === o.urn ? "this school" : "set", r?.roll ?? null, yr(r?.year), r?.trend?.word ?? null, r?.trend ? Math.round(r.trend.pct) : null] as CsvCell[];
    });
  return { about: { set: o.set.label, year: null }, columns: ["School", "URN", "Role", "Roll", "Census year", "Roll direction", "Roll change (%)"], rows };
}

/** Flags: each flag and the figures behind it; with none, the figures closest to one. */
export function flagsCsv(o: Overview): CsvTable {
  if (o.flags.length) return { about: { set: o.set.label, year: null }, columns: ["Flag", "Direction", "Figures"], rows: o.flags.map((f) => [f.label, f.tone === "up" ? "up" : "down", figuresOf(f as never)]) };
  const w = o.flagWatch;
  const rows: CsvCell[][] = [
    ...(w?.results ?? []).map((r) => [`Closest to a flag: ${r.what}`, smtNum(r.change, "points"), smtNum(r.setMiddle, "points"), smtNum(r.gap, "points"), r.threshold, `${periodLabel(r.fromYear)} to ${periodLabel(r.toYear)}`, r.schools] as CsvCell[]),
    ...(w?.roll ? [[`Closest to a flag: roll falls in the last 3 years`, w.roll.falls, null, null, 3, `${periodLabel(w.roll.fromYear)} to ${periodLabel(w.roll.toYear)}`, null] as CsvCell[]] : []),
  ];
  return { about: { set: o.set.label, year: null }, columns: ["Figure", "Change", "Set's middle change", "Gap", "A flag needs", "Years", "Set schools"], rows };
}

/** Roll trends (the indexed chart and its table): each line's pupils and index, year by year. */
export function rollCsv(lines: Overview["trends"]["roll"]["lines"], base: number | null): CsvTable | null {
  if (!lines.length) return null;
  const years = lines[0].pts.map((p) => p.year);
  const b = base !== null ? periodLabel(base) : "first year";
  return {
    about: { year: null },
    columns: ["Year", ...lines.flatMap((l) => [`${l.label}: pupils`, `${l.label}: index (${b} = 100)`])],
    rows: years.map((y, i) => [periodLabel(y), ...lines.flatMap((l) => [smtNum(l.actual?.[i]?.value, "pupils"), smtNum(l.pts[i]?.value, "pupils")])]),
  };
}

/** Results trends (BandChart, BandTable): the school's figure and the set's middle half, by year. */
export function bandCsv(school: { year: number; value: number | null }[], band: { year: number; p25: number | null; p75: number | null; n: number }[], unit: Unit, setLabel: string, measure: string, valueKey?: string): CsvTable | null {
  if (!school.length) return null;
  const u = unit === "pct" || unit === "share" ? " (%)" : "";
  return {
    about: { set: setLabel, year: null },
    columns: ["Year", "Measure", `You${u}`, `Set: lower quartile${u}`, `Set: upper quartile${u}`, "Set schools"],
    rows: school.map((p) => {
      const b = band.find((x) => x.year === p.year);
      const has = !!b && b.p25 !== null && b.p75 !== null;
      return [periodLabel(p.year), measure, smtNum(p.value, unit, valueKey), has ? smtNum(b!.p25, unit, valueKey) : null, has ? smtNum(b!.p75, unit, valueKey) : null, b?.n ?? 0];
    }),
  };
}

/** Market share at 11+ (the line and the table): you, the largest rival, the rivals' middle. */
export function marketCsv(m: Overview["trends"]["market"], schoolName: string): CsvTable | null {
  if (m.status === "empty") return null;
  const rival = m.rivalName ?? "Largest rival";
  const middle = m.middle?.some((p) => p.value !== null);
  const band = (m.band ?? []).filter((b) => b.p25 !== null && b.p75 !== null && b.n >= 3);
  const against = m.setRivals ?? (m.defaultRivals ? "the 10 nearest schools (default rivals)" : "your rivals");
  return {
    about: { set: against, year: null },
    columns: ["Year", `${schoolName} (%)`, `${rival} (%)`, ...(middle ? ["Rivals' middle (%)"] : []), ...(band.length > 1 ? ["Rivals: lower quartile (%)", "Rivals: upper quartile (%)"] : [])],
    rows: m.school.map((p) => {
      const b = band.find((x) => x.year === p.year);
      return [
        periodLabel(p.year),
        smtNum(p.value, "share"),
        smtNum(m.rival.find((r) => r.year === p.year)?.value, "share"),
        ...(middle ? [smtNum(m.middle!.find((r) => r.year === p.year)?.value, "share")] : []),
        ...(band.length > 1 ? [smtNum(b?.p25, "share"), smtNum(b?.p75, "share")] : []),
      ];
    }),
  };
}

/** A set of lines on one year axis (indexed lines, plain lines): a column per line. */
export function linesCsv(lines: { label: string; pts: { year: number; value: number | null }[] }[], unit: Unit | "index", xLabel: (y: number) => string = periodLabel, extra?: { label: string; pts: { year: number; value: number | null }[] }[]): CsvTable | null {
  const all = [...lines, ...(extra ?? [])];
  if (!all.length) return null;
  const years = Array.from(new Set(all.flatMap((l) => l.pts.map((p) => p.year)))).sort((a, b) => a - b);
  const u = unit === "pct" || unit === "share" ? " (%)" : "";
  const num = (v: number | null | undefined) => (unit === "index" ? smtNum(v, "pupils") : smtNum(v, unit));
  return {
    about: { year: null },
    columns: ["Year", ...all.map((l) => `${l.label}${u}`)],
    rows: years.map((y) => [xLabel(y), ...all.map((l) => num(l.pts.find((p) => p.year === y)?.value))]),
  };
}

// ------------------------------------------------------------------------------- one view

type ViewCtx = { dash: string; school: { name: string; regionName?: string | null }; overview: { status: string; data?: Overview } };

/** The rows for one Overview view, as ViewBody draws it (`stage`: the results chip picked). Null
 * where the view draws nothing tabular or nothing at all. */
export function overviewCsv(dv: string, o: Overview, school: ViewCtx["school"], stage: number): CsvTable | null {
  switch (dv) {
    case "DV-SMT-O-NOW":
      return schoolNowCsv(o);
    case "DV-SMT-O-SCORECARD":
      return scorecardCsv(o, school.regionName ?? null);
    case "DV-SMT-O-MAP":
      return setMapCsv(o);
    case "DV-SMT-O-FLAGS":
      return flagsCsv(o);
    case "DV-SMT-O-ROLL-LINE":
    case "DV-SMT-O-ROLL-TABLE":
      return rollCsv(o.trends.roll.lines, o.trends.roll.base);
    case "DV-SMT-O-RESULTS-LINE":
    case "DV-SMT-O-RESULTS-TABLE": {
      const ts = o.trends.results;
      if (!ts.length) return null;
      const t = ts[Math.min(stage, ts.length - 1)];
      return bandCsv(t.school, t.band, "points", o.set.label, t.label, t.stage === "ks5" ? "aps_per_entry" : undefined);
    }
    case "DV-SMT-O-MARKET-LINE":
    case "DV-SMT-O-MARKET-TABLE":
      return marketCsv(o.trends.market, o.schools[o.urn]?.name ?? school.name);
  }
  return null;
}
