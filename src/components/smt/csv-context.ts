// Panel menu "Save as CSV" (21 Nov): SMT Context's rows, one builder per view (see csv.ts). Each builder
// reads the same object its view draws (views/Context.tsx) at the precision the view prints: residents
// and births whole, indexes whole, percentages to the view's own places.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { shown } from "@/lib/csv";
import { SMT_NOTES, smtNote } from "@/catalogue/notes";
import { periodLabel } from "@/catalogue/years";
import { indexBaseWords } from "@/lib/index-base";
import type { Context } from "@/lib/smt/context";
import type { ContextMap } from "@/lib/smt/context-map";
import type { Load } from "./api";
import type { ShadeBy } from "./views/Context";

type Pt = { year: number; value: number | null };

const whole = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v));
const yr = (p: number | null | undefined) => (p === null || p === undefined ? null : periodLabel(p));
const at = (pts: Pt[] | undefined, y: number) => pts?.find((p) => p.year === y)?.value;
const NONE = { set: null, year: null } as const;

/** The year births peaked and the school's first age (views/Context.tsx birthsPeak, the same rule). */
function peakOf(c: Context): { peak: number; lag: number; reaches: number } | null {
  const b = c.births.la.filter((p) => p.value !== null);
  if (b.length < 3) return null;
  const top = b.reduce((m, p) => (p.value! > m.value! ? p : m));
  const lag = Number(/^(\d+)/.exec(c.agesWord)?.[1] ?? NaN);
  if (!Number.isFinite(lag) || top.year === b.at(-1)!.year) return null;
  return { peak: top.year, lag, reaches: top.year + lag };
}

/** Column 1, "The area now": the four tiles, the census count beside them, then the social context. */
export function contextNowCsv(c: Context): CsvTable {
  const n = c.now;
  const s = c.social;
  const rows: CsvCell[][] = [[`Children aged ${c.agesWord}`, whole(n.children.value), "residents", n.children.scope]];
  if (n.children.since) rows.push([`Children aged ${c.agesWord}: change since ${n.children.since.from}`, whole(n.children.since.changePct), "%", n.children.scope]);
  rows.push(["Births, last year", n.births ? whole(n.births.value) : null, "births", c.place.la]);
  if (n.births?.since) rows.push([`Births: change since ${n.births.since.from}`, whole(n.births.since.changePct), "%", c.place.la]);
  if (n.projection) {
    const pr = n.projection;
    rows.push([`${pr.agesWord} by ${pr.to}`, shown(pr.changePct, 1), "% change", pr.caption]);
    if (pr.lowPct !== null && pr.highPct !== null) rows.push([`${pr.agesWord} by ${pr.to}: range, low`, shown(pr.lowPct, 1), "% change", null], [`${pr.agesWord} by ${pr.to}: range, high`, shown(pr.highPct, 1), "% change", null]);
  } else rows.push(["Projection", null, null, "no projection held for this area"]);
  rows.push(["Schools nearby", n.schools.count, "schools", `${n.schools.phaseWord === "all" ? "all phases" : n.schools.phaseWord}, all sectors, ${n.schools.scope}`]);
  if (n.mix) rows.push(["Authority mix", null, null, `${n.mix.line} (${n.mix.ages})`]);
  if (n.pupilsNearby) rows.push([`Pupils at schools within ${c.radius}`, whole(n.pupilsNearby.value), "pupils", yr(n.pupilsNearby.period)]);
  if (s.lsoa && s.imd !== null && s.idaci !== null) rows.push([`${SMT_NOTES.neighbourhood}: IMD`, s.imd, "decile of 10", s.lsoa], [`${SMT_NOTES.neighbourhood}: IDACI`, s.idaci, "decile of 10", s.lsoa]);
  else rows.push([SMT_NOTES.neighbourhood, null, null, SMT_NOTES.noLsoa]);
  if (s.mix && s.deprived20 !== null) {
    rows.push([`Children within ${c.radius} in IDACI deciles 1 and 2`, whole(s.deprived20), "%", null]);
    s.mix.forEach((v, i) => rows.push([`Children within ${c.radius} in IDACI decile ${i + 1}`, shown(v, 1), "%", null]));
  }
  const f = s.fsm;
  if (f.status === "published") {
    rows.push([`${SMT_NOTES.fsmTitle}, ${periodLabel(f.period)}`, shown(f.value, 1), "%", null], [`${SMT_NOTES.fsmTitle}, ${f.la.name ?? "LA"}`, shown(f.la.value, 1), "%", null], [`${SMT_NOTES.fsmTitle}, England`, shown(f.england, 1), "%", null]);
    if (f.first) rows.push([`${SMT_NOTES.fsmTitle}: change since ${periodLabel(f.first.period)}`, shown(f.value - f.first.value, 1), "percentage points", null]);
  } else rows.push([SMT_NOTES.fsmTitle, null, null, f.status === "independent" ? SMT_NOTES.wIndependentFsm : SMT_NOTES.fsmNone]);
  return { about: NONE, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** The map: the neighbourhoods (or, shaded by free school meals, the schools) the map draws; the LA map's
 * local authorities where the neighbourhoods aren't drawn. */
export function contextMapCsv(c: Context, map: Load<ContextMap> | undefined, shade: ShadeBy = "children"): CsvTable | null {
  if (c.area === "around" && (!map || map.status === "loading")) return null;
  if (c.area === "around" && map && map.status === "ready" && map.data.state === "lsoa") {
    const m = map.data;
    if (shade === "fsm") {
      return {
        about: { set: null, year: m.fsmYear !== null ? periodLabel(m.fsmYear) : null },
        columns: ["School", "URN", "Role", "Free school meals (%)", "Year"],
        rows: m.schools.map((s) => [s.name, s.urn, s.urn === c.urn ? "this school" : "nearby", s.fsmNotPublished ? "free school meals not published" : s.fsm ? shown(s.fsm.value, 1) : "no free-school-meals figure", s.fsm ? periodLabel(s.fsm.period) : null]),
      };
    }
    return {
      about: { set: null, year: `mid-${m.year}` },
      columns: ["Neighbourhood", "LSOA code", `Children aged ${c.agesWord}`, "Children per hectare", "IMD decile", "IDACI decile", `Within ${m.radius}`],
      rows: m.lsoas.map((l) => [l.name, l.code, whole(l.children), l.areaHa > 0 ? shown(l.children / l.areaHa, 2) : null, l.imd, l.idaci, l.within ? "yes" : "no"]),
    };
  }
  if (!c.map.schools.length) return null;
  return {
    about: { set: null, year: c.map.period !== null ? periodLabel(c.map.period) : null },
    columns: ["Local authority", "GSS code", `Pupils (${c.map.shade})`, "The school's LA"],
    rows: c.map.las.filter((l) => l.geometry).map((l) => [l.name, l.gss, l.value === null ? "no figure" : whole(l.value), l.isSchoolLa ? "yes" : "no"]),
  };
}

/** Residents by single year of age, the school's ages marked. */
export function byAgeCsv(c: Context): CsvTable | null {
  const rows = c.byAge.ages;
  if (!rows.length) return null;
  const where = c.byAge.scope === "around" ? `within ${c.radius}` : (c.byAge.laName ?? "the LA");
  return {
    about: { set: null, year: c.byAge.period !== null ? `mid-${c.byAge.period}` : null },
    columns: ["Age", `Residents, ${where}`, `The school's ages (${c.agesWord})`],
    rows: rows.map((r) => [r.age, whole(r.value), r.age >= c.ages[0] && r.age <= c.ages[1] ? "yes" : "no"]),
  };
}

/** Children nearby over time: each line's children and index (base = 100), the radius's projection after. */
export function nearbyCsv(c: Context): CsvTable | null {
  const ix = c.nearby.indexed;
  if (ix.school.filter((p) => p.value !== null).length < 2) return null;
  const projected = (ix.projected ?? []).length > 1 ? ix.projected! : [];
  const years = Array.from(new Set([...ix.school, ...ix.la, ...ix.england, ...projected].map((p) => p.year))).sort((a, b) => a - b);
  const la = c.place.la ?? "LA";
  const base = indexBaseWords(c.nearby.base, "calendar");
  return {
    about: NONE,
    columns: ["Year", `Within ${c.radius}: children`, `Within ${c.radius}: index (${base} = 100)`, ...(projected.length ? [`Within ${c.radius}, projected: index`] : []), `${la}: children`, `${la}: index`, "England: children", "England: index"],
    rows: years.map((y) => [y, whole(at(c.nearby.school, y)), whole(at(ix.school, y)), ...(projected.length ? [whole(at(projected, y))] : []), whole(at(c.nearby.la, y)), whole(at(ix.la, y)), whole(at(c.nearby.england, y)), whole(at(ix.england, y))]),
  };
}

/** Births and projections: the children counted then projected, and births by year of birth (with the
 * year those children reach the school's first age, where the view labels it). */
export function birthsStoryCsv(c: Context): CsvTable | null {
  const f = c.forward;
  const where = f?.where ?? "";
  const counted = (f?.estimates ?? []).filter((p) => p.value !== null);
  const proj = (f?.projection ?? []).map((p) => ({ year: p.year, value: p.middle }));
  const b = c.births.la;
  const peak = peakOf(c);
  const kids = counted.length + proj.length > 1;
  const births = b.filter((p) => p.value !== null).length > 1;
  if (!kids && !births) return null;
  const who = `Children aged ${c.agesWord}${where ? ` ${where}` : ""}`;
  const rows: CsvCell[][] = [
    ...(kids ? [...counted.map((p) => [who, p.year, whole(p.value), "counted (ONS mid-year estimates)", null]), ...proj.map((p) => [who, p.year, whole(p.value), "projected", null])] : []),
    ...(births ? b.map((p) => [`Births in ${c.place.la ?? c.births.laName ?? "the LA"}`, p.year, whole(p.value), "births", peak ? p.year + peak.lag : null]) : []),
  ];
  return { about: NONE, columns: ["Series", "Year", "Value", "Counted, projected or births", peak ? `Year those children reach ${peak.lag}` : "Year those children reach the school's first age"], rows };
}

/** Births, and indexed (the indexed chart and its table): the LA's and England's births and index. */
export function birthsCsv(c: Context): CsvTable | null {
  if (!c.births.la.length) return null;
  const la = c.births.laName ?? "LA";
  const base = indexBaseWords(c.births.base, "calendar");
  return {
    about: NONE,
    columns: ["Year", `${la}: births`, `${la}: index (${base} = 100)`, "England: births", "England: index"],
    rows: c.births.la.map((p, i) => [p.year, whole(p.value), whole(c.births.indexed.la[i]?.value), whole(c.births.england[i]?.value), whole(c.births.indexed.england[i]?.value)]),
  };
}

/** Forward: estimates to the latest count, then the projection and its range; the scenario and ONS's
 * line only when the view's toggles draw them (the view registers its own, with its toggles). */
export function projectionCsv(c: Context, opts: { ons?: boolean; scenario?: boolean } = {}): CsvTable | null {
  const f = c.forward;
  if (!f || f.estimates.filter((x) => x.value !== null).length < 2 || f.projection.length < 2) return null;
  const ons = !!opts.ons && !!f.ons;
  const scenario = !!opts.scenario;
  const years = Array.from(new Set([...f.estimates.map((x) => x.year), ...f.projection.map((p) => p.year)])).sort((a, b) => a - b);
  const onsLabel = f.ons ? smtNote("onsLine", { base: f.ons.base ?? "" }) : "";
  return {
    about: NONE,
    columns: ["Year", `Estimate: aged ${c.agesWord}, ${f.where}`, "Projection", ...(f.bandMissing ? [] : ["Range, low", "Range, high"]), `Projection ${SMT_NOTES.includesUnborn}`, ...(scenario ? [f.scenarioLabel.charAt(0).toUpperCase() + f.scenarioLabel.slice(1)] : []), ...(ons ? [onsLabel] : [])],
    rows: years.map((y) => {
      const e = f.estimates.find((x) => x.year === y);
      const p = f.projection.find((x) => x.year === y);
      return [y, whole(e?.value), whole(p?.middle), ...(f.bandMissing ? [] : [whole(p?.low), whole(p?.high)]), p ? (f.unbornFrom !== null && y >= f.unbornFrom ? "yes" : "no") : null, ...(scenario ? [whole(p?.scenario)] : []), ...(ons ? [whole(p?.ons)] : [])];
    }),
  };
}

/** The rows for one Context view as ViewBody draws it; null where it draws nothing tabular. */
export function contextCsv(dv: string, d: Context, map?: Load<ContextMap>, shade?: ShadeBy): CsvTable | null {
  switch (dv) {
    case "DV-SMT-C-NOW":
      return contextNowCsv(d);
    case "DV-SMT-C-MAP":
      return contextMapCsv(d, map, shade);
    case "DV-SMT-C-BYAGE":
    case "DV-SMT-C-AGES":
      return byAgeCsv(d);
    case "DV-SMT-C-NEARBY":
      return nearbyCsv(d);
    case "DV-SMT-C-BIRTHS":
      return birthsStoryCsv(d);
    case "DV-SMT-C-BIRTHS-INDEXED":
      if (d.births.indexed.la.filter((p) => p.value !== null).length < 2) return null;
      return birthsCsv(d);
    case "DV-SMT-C-BIRTHS-TABLE":
      return birthsCsv(d);
    case "DV-SMT-C-PROJECTION":
      // PopulationProjected registers its own rows (projectionCsv with its ONS and scenario toggles):
      // null here, so the registry's latest non-null entry is always the view's, however they mount.
      return null;
  }
  return null;
}
