// Panel menu "Save as CSV" (21 Nov): the group (head office) dashboards' rows -- each view's table, built
// from the same object the view draws (Overview, Schools, Academic, Pupils, and a special and AP trust's
// or nursery federation's own views), at the precision the view shows (fmt's), with what the view
// withholds left withheld: a pooled figure on fewer than 5 schools reads "Too few schools (n)", never the
// figure (R-MIN-SCHOOLS), a school's FSM under 10 pupils "too few pupils (n)". Pure, so
// src/lib/panel-csv-group.test.ts checks each one against the view's own cells.
//
// Who registers what: GroupDashboard's ViewBody registers groupViewCsv for the view on screen; the views
// that hold their own state (the results trend's measure, the entry cohorts' age, the Schools table's
// sort) register their own builder (resultsTrendCsv, entryCohortsCsv, schoolsTableCsv), and
// groupViewCsv answers null for them so the view's own rows are the panel's.
import type { CsvCell, CsvTable } from "@/lib/csv";
import { periodLabel, rollDirectionOfPct } from "@/catalogue/years";
import { indexTo, indexedLabel } from "@/lib/index-base";
import { GROWING_SPAN, MEASURE_LABEL, MEASURE_UNIT, PEER_PLURAL, POOL_MIN_SCHOOLS, reasonWords, tooFewWords, type GroupOverview, type GroupSchools, type SchoolRow } from "@/lib/groups/dash";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import type { NmRow } from "@/lib/groups/dash-nm";
import type { Place } from "@/lib/groups/aggregates";
import { ofGroupsWords, setTrend, type Pt } from "@/lib/groups/group-sets";
import type { DashResponse, ViewId } from "./GroupDashboard";
import type { MapSchool, MembershipRow } from "./views";
import type { ProjectionRow } from "./views-r3";

// ------------------------------------------------------------------------------- the figures

/** A number rounded as the views print it -- the size by toFixed, then its sign (signedValue, toFixed) --
 * so 4.55 is the 4.5 on screen, not Math.round's 4.6. */
export function fx(v: number | null | undefined, dp: number): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  const n = Number(Math.abs(v).toFixed(dp));
  return n === 0 ? 0 : v < 0 ? -n : n;
}
const shown = fx;

const yl = (p: number | null | undefined) => (p === null || p === undefined ? null : periodLabel(p));
const pc = (m: string) => MEASURE_UNIT[m] === "pct";
/** "(%)" on a percentage measure's header; nothing on points or value added. */
const unitHead = (m: string) => (pc(m) ? " (%)" : "");
const unitWord = (m: string) => (pc(m) ? "%" : MEASURE_UNIT[m] === "va" ? "value added" : "points");

/**
 * A measure at the precision the view prints it (smt/ui fmt): a % to 1 place, value added to 2, points to
 * 1 -- A-level points per entry to 2 where the view passes fmt its "aps_per_entry" key: Against others and
 * the Schools table for A-level points only ("alevel"), the Academic views for both post-16 measures
 * ("aps"); the results trend never ("plain").
 */
export function measureNum(v: number | null | undefined, m: string, mode: "plain" | "alevel" | "aps" = "plain"): number | null {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  if (MEASURE_UNIT[m] === "va") return shown(v, 2);
  if (pc(m)) return shown(v, 1);
  const two = (mode === "alevel" && m === "ks5_aps_alevel") || (mode === "aps" && m.startsWith("ks5_aps"));
  return shown(v, two ? 2 : 1);
}
const p1 = (v: number | null | undefined) => shown(v, 1);
const p0 = (v: number | null | undefined) => shown(v, 0);
const pupils = (v: number | null | undefined) => (v === null || v === undefined || !Number.isFinite(v) ? null : Math.round(v));
/** A pooled figure on fewer than 5 schools: withheld, its words in its place (R-MIN-SCHOOLS). */
const withheldN = (n: number | null | undefined) => n !== null && n !== undefined && n > 0 && n < POOL_MIN_SCHOOLS;
const rankCells = (p: Place | null | undefined): CsvCell[] => (p ? [p.rank, p.tied ? "yes" : null, p.of] : [null, null, null]);

// ------------------------------------------------------------------------------- Overview

/** The group now (GroupNow): the tiles, the change in the combined roll, the size spread, the membership. */
export function groupNowCsv(o: GroupOverview): CsvTable {
  const n = o.now;
  const bp = n.byPhase;
  const g = n.change[GROWING_SPAN];
  const phaseLine = [bp.primary ? `${bp.primary} primary` : null, bp.secondary ? `${bp.secondary} secondary` : null, bp.post16 ? `${bp.post16} with sixth forms` : null].filter(Boolean).join(" · ");
  const rows: CsvCell[][] = [
    ["Schools", n.schools, "schools", n.notCounted ? `${n.schools} of ${n.notCounted.total} schools; ${n.notCounted.words}` : phaseLine || null],
    ["Combined roll", pupils(n.roll), "pupils", null],
  ];
  if (n.sinceFirst !== null) rows.push([`Combined roll change since ${periodLabel(o.years.first)}`, p1(n.sinceFirst), "%", null]);
  rows.push(["Schools growing", g.growing, "schools", `of ${g.of}, since ${periodLabel(g.from)}, like for like`]);
  rows.push(["Areas", n.las.length, "LAs", n.regions.filter((r) => r.code !== "outside_england").map((r) => r.name).join(", ") || null]);
  for (const k of ["1", "3", "5"] as const) {
    rows.push([`Combined roll change since ${periodLabel(n.change[k].from)}: combined`, p1(n.change[k].combined), "%", null]);
    rows.push([`Combined roll change since ${periodLabel(n.change[k].from)}: like for like`, p1(n.change[k].sameSchools), "%", null]);
  }
  for (const b of ["XS", "S", "M", "L", "XL"]) rows.push([`Size ${b}`, n.sizeBands[b] ?? 0, "schools", "each school sized against its own phase nationally"]);
  rows.push(["Confirmed members", o.group.confirmed, "schools", null]);
  if (o.group.likely > 0) rows.push(["Likely members", o.group.likely, "schools", null]);
  if (n.outside.length > 0) rows.push(["Outside England", n.outside.length, "schools", n.outside.map((e) => e.name).join(", ")]);
  return { about: { set: null, year: periodLabel(o.years.census) }, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** Against others' rows (the phone's too): the group, its defaults, mix-matched non-group schools. */
export const MAIN_ROWS = ["group", "peer_band:band", "non_group:england", "sat:england", "areas:la", "england:england"];

/** Against others (AgainstOthers): each set's schools, roll, growing and headline cells, as the table. */
export function againstCsv(o: GroupOverview, average: boolean): CsvTable {
  if (o.sideBySide) return sideBySideCsv(o, average);
  const a = o.against;
  const rows = a.rows.filter((r) => MAIN_ROWS.includes(r.key) || r.kind === "mix_matched");
  const w = average ? "average school" : "pupil-weighted";
  const head = (m: string) => `${MEASURE_LABEL[m] ?? m}${o.years.results[m] !== null && o.years.results[m] !== undefined ? `, ${periodLabel(o.years.results[m]!)}` : ""}, ${w}${unitHead(m)}`;
  return {
    about: { set: o.compare.label, year: null },
    columns: ["Set", "Schools", "Roll change, 5 years, like for like (%)", `Growing, ${GROWING_SPAN} years (%)`, "Growing schools", "Schools with both years", ...a.columns.flatMap((m) => [head(m), `${MEASURE_LABEL[m] ?? m}: schools with the figure`])],
    rows: rows.map((r) => [
      `${r.label}${r.kind === "mix_matched" ? " (mix-matched)" : ""}`,
      r.schools,
      p1(r.roll.pct),
      p0(r.growing.pct),
      r.growing.n,
      r.growing.of,
      ...a.columns.flatMap((m): CsvCell[] => {
        const c = r.cells[m];
        if (c?.tooFew && c.n !== null) return [tooFewWords(c.n), null];
        return [measureNum(average ? c?.average : c?.value, m, "alevel"), c?.n ?? null];
      }),
    ]),
  };
}

/** Against a set of groups (SideBySide): our group, each group with its type, size and rank, the median, England. */
export function sideBySideCsv(o: GroupOverview, average: boolean): CsvTable {
  const t = o.sideBySide!;
  const w = average ? "average school" : "pupil-weighted";
  const head = (m: string) => `${MEASURE_LABEL[m] ?? m}${o.years.results[m] !== null && o.years.results[m] !== undefined ? `, ${periodLabel(o.years.results[m]!)}` : ""}, ${w}${unitHead(m)}`;
  const rows: CsvCell[][] = t.rows.map((r) => [
    r.label,
    r.ours ? "our group" : "group in the set",
    r.typeSize,
    r.rank,
    r.schools,
    r.missing ? null : p1(r.roll.pct),
    p0(r.growing.pct),
    ...t.columns.flatMap((m): CsvCell[] => {
      const c = r.cells[m];
      const v = average ? c?.average : c?.value;
      if (r.missing) return ["no figures", null];
      if ((v === null || v === undefined) && r.notPublished.includes(m)) return ["not published", null];
      return [measureNum(v, m, "alevel"), c && c.n !== null && c.n > 0 ? c.n : null];
    }),
  ]);
  rows.push([
    "Median of the set",
    "median",
    `${ofGroupsWords(t.median.n, t.rows.length - 1)}${t.median.mixed ? " · mixed types" : ""}`,
    null,
    t.median.schools === null ? null : Math.round(t.median.schools),
    p1(t.median.roll),
    p0(t.median.growing),
    ...t.columns.flatMap((m): CsvCell[] => {
      const c = t.median.cells[m];
      return [measureNum(average ? c?.average : c?.value, m, "alevel"), c ? ofGroupsWords(c.n, c.of) : null];
    }),
  ]);
  if (t.england) {
    const e = t.england;
    rows.push([e.label, "England", null, null, e.schools, p1(e.roll.pct), p0(e.growing.pct), ...t.columns.flatMap((m): CsvCell[] => [measureNum(average ? e.cells[m]?.average : e.cells[m]?.value, m, "alevel"), null])]);
  }
  return {
    about: { set: o.picker.name, year: null },
    columns: ["Group", "Row", "Type and size", "Rank within its type", "Schools counted", "Roll change, 5 years, like for like (%)", `Growing, ${GROWING_SPAN} years (%)`, ...t.columns.flatMap((m) => [head(m), `${MEASURE_LABEL[m] ?? m}: schools (groups, for the median)`])],
    rows,
  };
}

const DIRECTION = { up: "growing", flat: "steady", down: "shrinking" } as const;

/** The map (GroupMap): every member school, its roll and its 3-year direction; outside England listed. */
export function groupMapCsv(schools: MapSchool[] | undefined): CsvTable | null {
  if (!schools || !schools.some((s) => !s.outside && s.easting !== null && s.northing !== null)) return null;
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "On the map", "Roll", "Roll change, 3 years (%)", "Direction", "Membership"],
    rows: schools.map((s) => [
      s.name,
      s.urn,
      s.outside ? "no: outside England, no DfE data" : s.easting === null || s.northing === null ? "no: not located" : "yes",
      s.roll,
      p1(s.trend),
      s.trend === null ? null : DIRECTION[rollDirectionOfPct(s.trend, 0)],
      s.likely ? "likely" : "confirmed",
    ]),
  };
}

/** Joined and left's rows, newest first, as JoinedLeft orders them. */
export function joinedRows(membership: MembershipRow[], schools?: { urn: string; current: boolean }[]) {
  return membership
    .map((m) => ({ ...m, left: schools ? !schools.find((s) => s.urn === m.urn)?.current : false }))
    .sort((a, b) => (b.joined ?? b.lastSeen ?? "").localeCompare(a.joined ?? a.lastSeen ?? "") || a.name.localeCompare(b.name));
}

/** Joined and left (JoinedLeft): each school, joined or listed, with the source's date. */
export function joinedCsv(membership: MembershipRow[], schools?: { urn: string; current: boolean }[], limit?: number): CsvTable | null {
  const rows = joinedRows(membership, schools);
  if (!rows.length) return null;
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "Status", "Joined", "Last seen", "Membership", "Source"],
    rows: rows.slice(0, limit ?? rows.length).map((r) => [r.name, r.urn, r.left ? "left" : r.joined ? "joined" : "listed", r.joined, r.joined ? null : r.lastSeen, r.confidence, r.source]),
  };
}

/** Roll, indexed (RollTrend): each line year by year, indexed to the common base; against a set of
 * groups, the set's median and middle half as SetTrend draws them. */
export function rollTrendCsv(o: GroupOverview): CsvTable | null {
  const lines = o.trends.roll.lines;
  if (!lines.length || lines[0].pts.filter((p) => p.value !== null).length < 2) return null;
  const { base, out } = indexTo(lines.map((l) => l.pts));
  const b = indexedLabel(base);
  if (o.sideBySide) return setTrendCsv(lines.map((l, i) => ({ label: l.label, pts: out[i] })), (v) => shown(v, 1), `index (${b})`, o.picker.name);
  const years = lines[0].pts.map((p) => p.year);
  return {
    about: { set: o.compare.label, year: null },
    columns: ["Year", ...lines.map((l) => `${l.label}: index (${b})`)],
    rows: years.map((y, k) => [periodLabel(y), ...out.map((s) => shown(s[k]?.value, 1))]),
  };
}

/** A trend against a set of groups (SetTrend): ours, each group, the median and the middle half. */
export function setTrendCsv(lines: { label: string; pts: Pt[] }[], num: (v: number | null | undefined) => number | null, unit: string, set: string): CsvTable | null {
  const [ours, ...groups] = lines;
  if (!ours || ours.pts.filter((p) => p.value !== null).length < 2) return null;
  const tr = setTrend(groups);
  const years = Array.from(new Set(lines.flatMap((l) => l.pts.map((p) => p.year)))).sort((a, b) => a - b);
  const at = (l: { pts: Pt[] }, y: number) => l.pts.find((p) => p.year === y)?.value ?? null;
  return {
    about: { set, year: null },
    columns: ["Year", ...lines.map((l) => `${l.label}: ${unit}`), `Median of the set: ${unit}`, ...(tr.band ? [`Middle half, lower: ${unit}`, `Middle half, upper: ${unit}`] : [])],
    rows: years.map((y) => {
      const band = tr.band?.find((x) => x.x === y);
      return [periodLabel(y), ...lines.map((l) => num(at(l, y))), num(tr.median.find((p) => p.year === y)?.value), ...(tr.band ? [num(band?.lo), num(band?.hi)] : [])];
    }),
  };
}

/** Results trend (ResultsTrend): the measure on screen, each set's figure by year and its schools; a
 * pooled year on fewer than 5 schools reads "Too few schools (n)". */
export function resultsTrendCsv(o: GroupOverview, average: boolean, measureIndex: number): CsvTable | null {
  const parts = o.trends.results;
  if (!parts.length) return null;
  const p = parts[Math.min(measureIndex, parts.length - 1)];
  const w = average ? "average school" : "pupil-weighted";
  const label = MEASURE_LABEL[p.measure] ?? p.label;
  if (o.sideBySide) return setTrendCsv(p.lines.map((l) => ({ label: l.label, pts: average ? l.average : l.pts })), (v) => measureNum(v, p.measure), `${label}, ${w}${unitHead(p.measure)}`, o.picker.name);
  const years = p.lines[0]?.pts.map((x) => x.year) ?? [];
  return {
    about: { set: o.compare.label, year: null },
    columns: ["Year", ...p.lines.flatMap((l) => [`${l.label}: ${label}, ${w}${unitHead(p.measure)}`, `${l.label}: schools with the figure`])],
    rows: years.map((y, k) => [
      periodLabel(y),
      ...p.lines.flatMap((l): CsvCell[] => {
        const v = (average ? l.average : l.pts)[k]?.value ?? null;
        const n = l.n[k] ?? null;
        if (v === null && withheldN(n)) return [tooFewWords(n!), null];
        return [measureNum(v, p.measure), n];
      }),
    ]),
  };
}

/** Share of places (ShareOfPlaces): every LA (full screen lists them all), then its regions. */
export function shareCsv(o: GroupOverview): CsvTable | null {
  const s = o.trends.share;
  if (!s.las.length) return null;
  return {
    about: { set: null, year: periodLabel(o.years.census) },
    columns: ["Area", "Area type", "Group pupils", "All pupils", "Share (%)"],
    rows: [
      ...s.las.map((r): CsvCell[] => [r.name, "LA", r.group, r.total, p1(r.pct)]),
      ["Across its regions", "regions", null, null, p1(s.pct)],
      ...s.regions.map((r): CsvCell[] => [r.name, "region", null, null, p1(r.pct)]),
    ],
  };
}

// ------------------------------------------------------------------------------- Schools

/** Schools, the group now (SchoolsNow): the tiles, the membership, the pooled kind lines, the joined list. */
export function schoolsNowCsv(o: GroupOverview, membership: MembershipRow[], s: GroupSchools): CsvTable {
  const n = o.now;
  const rows: CsvCell[][] = [
    ["Schools", o.group.confirmed + o.group.likely, "schools", `${n.byPhase.primary} primary-age · ${n.byPhase.secondary} senior · ${n.byPhase.post16} sixth-form`],
    ["Combined roll", pupils(n.roll), "pupils", null],
  ];
  if (n.sinceFirst !== null) rows.push([`Combined roll change since ${periodLabel(o.years.first)}`, p1(n.sinceFirst), "%", null]);
  rows.push(["Day pupils", pupils(n.roll - n.boarders), "pupils", "latest census"], ["Boarders", pupils(n.boarders), "pupils", "latest census"]);
  rows.push(["Outside England", n.outside.length, "schools", n.outside.length ? "no DfE data: listed, not added" : "every school in England"]);
  rows.push(["Confirmed members", o.group.confirmed, "schools", null]);
  if (o.group.likely > 0) rows.push(["Likely members", o.group.likely, "schools", null]);
  for (const k of s.kindLines ?? []) {
    rows.push([`${k.label}, pooled: roll`, k.roll, "pupils", null], [`${k.label}, pooled: FSM`, p1(k.fsm), "%", null], [`${k.label}, pooled: roll change over 3 years, same schools`, p1(k.change3), "%", null]);
    if (k.england) rows.push([`${k.england.label}: FSM`, p1(k.england.fsm), "%", null], [`${k.england.label}: roll change over 3 years`, p1(k.england.change3), "%", null]);
  }
  for (const r of joinedRows(membership, s.rows).slice(0, 6)) rows.push([`Joined and left: ${r.name}`, r.joined ?? r.lastSeen, "date", r.left ? "left" : r.joined ? "joined" : "listed · last seen"]);
  return { about: { set: null, year: periodLabel(o.years.census) }, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** Schools (the table), in the order on screen: a mainstream group's headline, ranks, value added and
 * roll; a special and AP trust's or nursery federation's FSM and roll beside its region's pool. */
export function schoolsTableCsv(s: GroupSchools, rows: SchoolRow[]): CsvTable | null {
  if (!rows.length) return null;
  if (s.nm) {
    return {
      about: { set: null, year: periodLabel(s.years.census) },
      columns: ["School", "URN", "Membership", "Kind", "Ages", "Roll", "FSM (%)", "Region's pool: FSM (%)", "Roll change, 3 years (%)", "Region's pool: roll change, 3 years (%)", "Its region's pool", "Joined"],
      rows: rows.map((r) => {
        const p = r.placing;
        const few = p?.pool?.tooFew ? tooFewWords(p.pool.n) : null;
        return [
          r.name,
          r.urn,
          r.confidence,
          r.kindTag ?? null,
          r.ages,
          r.roll,
          r.fsmFewPupils != null ? `too few pupils (${r.fsmFewPupils})` : p1(r.fsm),
          p ? (few ?? p1(p.fsm.pool)) : null,
          p1(r.trend),
          p ? (few ?? p1(p.change.pool)) : null,
          p?.pool ? (few ?? (p.pool.label.split(", ").slice(1).join(", ") || p.pool.label)) : r.reason,
          r.joined ?? (r.basis === "assumed" ? "undated" : null),
        ];
      }),
    };
  }
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "Membership", "Phase", "Roll", "Size", "Shape", "Headline measure", "Headline year", "Headline", "Headline unit", "No headline: why", "Rank in group", "Rank in group: tied", "Rank in group: of", "Rank in England", "Rank in England: tied", "Rank in England: of", "Value added measure", "Value added year", "Value added", "Value added: note", `Roll change, ${GROWING_SPAN} years (%)`, "Joined"],
    rows: rows.map((r) => {
      const h = r.headline;
      const after = !!h && !r.inGroup && !!r.joined && r.joined > `${h.year + 1}-07-31`;
      return [
        r.name,
        r.urn,
        r.confidence,
        r.ages ?? (r.outsideEngland ? "16–19" : null),
        r.roll,
        r.size,
        r.shape,
        h ? (MEASURE_LABEL[h.measure] ?? h.label) : null,
        h ? periodLabel(h.year) : null,
        h ? measureNum(h.value, h.measure, "alevel") : null,
        h ? unitWord(h.measure) : null,
        h ? null : (r.placingText ?? r.reason),
        ...(r.inGroup ? rankCells(r.inGroup) : [after ? "joined after results" : null, null, null]),
        ...rankCells(r.national),
        r.va ? (MEASURE_LABEL[r.va.measure] ?? r.va.measure) : null,
        r.va ? periodLabel(r.va.year) : null,
        r.va ? shown(r.va.value, 2) : null,
        r.va ? null : r.vaNote ? "not published" : null,
        p1(r.trend),
        r.joined ?? (r.basis === "assumed" ? "undated" : null),
      ];
    }),
  };
}

/** Who is growing (WhoIsGrowing): each school's roll indexed to its own first year, and the group's line. */
export function whoIsGrowingCsv(s: GroupSchools, o: GroupOverview): CsvTable | null {
  const series = s.rows.filter((r) => r.rollsByYear.filter((p) => p.value).length >= 2);
  if (!series.length) return null;
  const group = o.trends.roll.lines[0];
  const years = Array.from(new Set([...(group?.pts ?? []), ...series.flatMap((r) => r.rollsByYear)].map((p) => p.year))).sort((a, b) => a - b);
  const indexed = series.map((r) => {
    const first = r.rollsByYear.find((p) => p.value);
    return { label: r.name, urn: r.urn, at: (y: number) => { const v = r.rollsByYear.find((p) => p.year === y)?.value; return v && first?.value ? (100 * v) / first.value : null; } };
  });
  return {
    about: { set: null, year: null },
    columns: ["Line", "URN", "Index", ...years.map((y) => periodLabel(y))],
    rows: [
      ...(group ? [[`${o.group.name}, like for like`, null, "group's line", ...years.map((y) => shown(group.pts.find((p) => p.year === y)?.value, 0))] as CsvCell[]] : []),
      ...indexed.map((x): CsvCell[] => [x.label, x.urn, "its own first year = 100", ...years.map((y) => shown(x.at(y), 0))]),
    ],
  };
}

/** Size and results (SizeAndResults): each school with both figures on the one measure drawn. */
export function sizeAndResultsCsv(s: GroupSchools): CsvTable | null {
  const pts = s.rows.filter((r) => r.headline && r.roll);
  const measure = pts[0]?.headline?.measure ?? null;
  const same = pts.filter((r) => r.headline!.measure === measure);
  if (!measure || same.length < 2) return null;
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "Roll", `${MEASURE_LABEL[measure] ?? measure}${unitHead(measure)}`, "Year"],
    rows: same.map((r) => [r.name, r.urn, r.roll, measureNum(r.headline!.value, measure), periodLabel(r.headline!.year)]),
  };
}

/** Shapes (Shapes): each school's pupils by single year of age (full screen shows them all). */
export function shapesCsv(s: GroupSchools): CsvTable | null {
  const rows = s.rows.filter((r) => r.rollByAge.some((n) => n > 0));
  if (!rows.length) return null;
  const lo = Math.min(...rows.map((r) => r.rollByAge.findIndex((n) => n > 0)));
  const hi = Math.max(...rows.map((r) => r.rollByAge.length - 1 - [...r.rollByAge].reverse().findIndex((n) => n > 0)));
  const ages = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return {
    about: { set: null, year: periodLabel(s.years.census) },
    columns: ["School", "URN", "Shape", ...ages.map((a) => `Age ${a}`)],
    rows: rows.map((r) => [r.name, r.urn, r.shape, ...ages.map((a) => r.rollByAge[a] ?? 0)]),
  };
}

// ------------------------------------------------------------------------------- Academic

const PH_LABEL = { secondary: "Secondary", post16: "Post-16", primary: "Primary" } as const;

/** Results now (AcademicNow): each phase's tiles, the side-by-side lines, the spread, the schools without. */
export function academicNowCsv(a: GroupAcademic, average: boolean): CsvTable | null {
  if (!a.headlines.length) return null;
  const o = a.overview;
  const w = average ? "average school" : "pupil-weighted";
  const peer = PEER_PLURAL[o.group.type] ?? "groups";
  const rows: CsvCell[][] = [];
  for (const h of a.headlines) {
    const main = h.measures[0];
    const ph = PH_LABEL[h.phase];
    const y = yl(h.year);
    const kind = h.phase === "secondary" ? "GCSE" : h.phase === "post16" ? "A-level" : "KS2";
    rows.push([ph, y, `Schools with ${kind} results`, h.withFigure, "schools", `of ${h.inPhase}`]);
    for (const m of h.measures.slice(0, 2)) {
      const u = unitWord(m.measure);
      rows.push([ph, y, `${m.label}: ${o.group.name}`, measureNum(average ? m.group?.average_school : m.group?.weighted, m.measure, "aps"), u, w]);
      if (m.median) rows.push([ph, y, `${m.label}: set median`, measureNum(average ? m.median.average : m.median.value, m.measure, "aps"), u, ofGroupsWords(m.median.n, m.median.of)]);
      else rows.push([ph, y, `${m.label}: ${o.picker.short}`, m.set?.tooFew ? tooFewWords(m.set.n_with_figure) : measureNum(average ? m.set?.average_school : m.set?.weighted, m.measure, "aps"), u, w]);
      rows.push([ph, y, `${m.label}: England`, measureNum(m.england?.weighted, m.measure, "aps"), u, "pupil-weighted"]);
    }
    const place = main.place;
    rows.push([ph, y, `${main.label}: rank among peer ${peer}`, place ? place.rank : null, "rank", place ? `${place.tied ? "tied; " : ""}of ${place.of} ${peer}` : "no peer figure this year"]);
    for (const g of h.groups ?? []) {
      const v = average ? g.average : g.value;
      rows.push([ph, y, `${main.label}, side by side: ${g.label}`, v === null && g.notPublished ? "not published" : measureNum(v, main.measure, "aps"), unitWord(main.measure), w]);
    }
    rows.push([ph, y, `${main.label}: lowest school`, measureNum(h.spread.lowest, main.measure, "aps"), unitWord(main.measure), `${h.spread.n} schools`]);
    rows.push([ph, y, `${main.label}: median school`, measureNum(h.spread.median, main.measure, "aps"), unitWord(main.measure), `${h.spread.n} schools`]);
    rows.push([ph, y, `${main.label}: highest school`, measureNum(h.spread.highest, main.measure, "aps"), unitWord(main.measure), `${h.spread.n} schools`]);
    for (const e of h.excluded) rows.push([ph, y, `No figure: ${e.name}`, null, null, reasonWords(e.reason)]);
  }
  return { about: { set: o.sideBySide ? o.picker.name : o.compare.label, year: null }, columns: ["Phase", "Year", "Figure", "Value", "Unit", "Note"], rows };
}

/** Schools ranked (SchoolsRanked): every school (full screen lists them all), then the benchmarks. */
export function schoolsRankedCsv(a: GroupAcademic): CsvTable | null {
  const r = a.ranked;
  if (!r.rows.length) return null;
  const m = r.measure;
  const setCell: CsvCell = r.set ? (r.set.value === null && withheldN(r.set.n) ? tooFewWords(r.set.n!) : measureNum(r.set.value, m, "aps")) : null;
  return {
    about: { set: r.set?.label ?? null, year: yl(r.year) },
    columns: ["School", "URN", "Membership", `${MEASURE_LABEL[m] ?? m}${unitHead(m)}`, "No figure: why", "Rank in group", "Rank in group: tied", "Rank in group: of", "Rank in England", "Rank in England: tied", "Rank in England: of"],
    rows: [
      ...r.rows.map((x): CsvCell[] => [x.name, x.urn, x.likely ? "likely" : "confirmed", measureNum(x.value, m, "aps"), x.value === null ? x.reason : null, ...rankCells(x.inGroup), ...rankCells(x.national)]),
      ["Group median", null, null, measureNum(r.groupMedian, m, "aps"), null, null, null, null, null, null, null],
      ...(r.set ? [[`${r.set.label}${r.set.n !== null && !withheldN(r.set.n) ? ` (${r.set.n} schools)` : ""}`, null, null, setCell, null, null, null, null, null, null, null] as CsvCell[]] : []),
      ["Non-group", null, null, measureNum(r.nonGroup, m, "aps"), null, null, null, null, null, null, null],
      ["England", null, null, measureNum(r.england, m, "aps"), null, null, null, null, null, null, null],
    ],
  };
}

/** Subject areas (SubjectAreasAcross): each area's gap to England, its schools and entries, or withheld. */
export function subjectAreasCsv(a: GroupAcademic): CsvTable | null {
  const s = a.areas;
  if (!s.stage || !s.rows.length) return null;
  const withheld = `withheld: fewer than ${s.min?.schools ?? 2} schools with ${s.min?.entries ?? 10}+ entries`;
  return {
    about: { set: null, year: `${s.stage === "ks4" ? "GCSE" : "Post-16"} ${yl(s.year) ?? ""}`.trim() },
    columns: ["Subject area", "Gap to England (points per entry)", "Schools", "Entries", "Note"],
    rows: s.rows.map((r) => {
      const ok = !!r.group?.shown;
      return [r.label, ok ? shown(r.gap, 2) : null, ok ? r.group!.n_schools : null, ok ? r.group!.entries : null, ok ? null : withheld];
    }),
  };
}

/** Value added (ValueAddedPanel): A-level value added and Progress 8, highest first, with the group and England. */
export function valueAddedCsv(a: GroupAcademic): CsvTable | null {
  const al = a.va.alevel;
  const p8 = a.va.p8;
  const order = <T extends { value: number | null; name: string }>(rows: T[]) => [...rows].sort((x, y) => (y.value ?? -Infinity) - (x.value ?? -Infinity) || x.name.localeCompare(y.name));
  const rows: CsvCell[][] = [
    ["A-level value added", yl(al.year), `${a.overview.group.name} (pupil-weighted)`, null, shown(al.group?.weighted, 2), `${al.group?.n_with_figure ?? 0} schools`],
    ["A-level value added", yl(al.year), "England", null, shown(al.england, 2), null],
    ...order(al.rows).map((r): CsvCell[] => ["A-level value added", yl(al.year), r.name, r.urn, shown(r.value, 2), r.value === null ? r.note : null]),
  ];
  if (p8.rows.length > 0 || p8.notPublished > 0) {
    rows.push(["Progress 8", yl(p8.year), `${a.overview.group.name} (pupil-weighted)`, null, shown(p8.group?.weighted, 2), `${p8.group?.n_with_figure ?? 0} state schools${p8.notPublished ? `; ${p8.notPublished} independent schools: not published` : ""}`]);
    rows.push(...order(p8.rows).map((r): CsvCell[] => ["Progress 8", yl(p8.year), r.name, r.urn, shown(r.value, 2), r.value === null ? r.note : null]));
  }
  if (!al.rows.length && !p8.rows.length) return null;
  return { about: { set: null, year: null }, columns: ["Measure", "Year", "School", "URN", "Value added", "Note"], rows };
}

/** Improving and declining (ImprovingDeclining): improved, steady and fell, and the schools behind them. */
export function improvingCsv(a: GroupAcademic): CsvTable | null {
  const i = a.improving;
  if (!i.of) return null;
  const span = `${periodLabel(i.from)} to ${yl(i.to) ?? ""}`;
  const m = MEASURE_LABEL[i.measure] ?? i.measure;
  return {
    about: { set: null, year: span },
    columns: ["Measure", "Change", "Schools", "Schools with both years", `Steady: within (${unitWord(i.measure) === "%" ? "percentage points" : "points"})`],
    rows: [
      [m, "Improved", i.improved, i.of, i.threshold],
      [m, "Steady", i.steady, i.of, i.threshold],
      [m, "Fell", i.fell, i.of, i.threshold],
    ],
  };
}

// ------------------------------------------------------------------------------- Pupils

/** Pupils now (PupilsNow): the tiles, the change rows, and the side-by-side roll where a set of groups is on. */
export function pupilsNowCsv(p: GroupPupils): CsvTable {
  const n = p.overview.now;
  const so = p.stayingOn;
  const rows: CsvCell[][] = [
    ["Combined roll", pupils(n.roll), "pupils", null],
    [`Combined roll change on ${periodLabel(n.change["1"].from)}, combined`, p1(n.change["1"].combined), "%", null],
    ["Pupils aged 5–10", pupils(p.rollByPhase.primary), "pupils", `in ${n.byPhase.primary} schools`],
    ["Pupils aged 11–15", pupils(p.rollByPhase.secondary), "pupils", `in ${n.byPhase.secondary} schools`],
    ["Pupils aged 16–18", pupils(p.rollByPhase.post16), "pupils", `in ${n.byPhase.post16} schools`],
    ["Year 12 against Year 11", p1(so.pct), "%", so.pct === null ? "no sixth form with both years" : `${so.y12} in Year 12 against ${so.y11} in Year 11 last year · ${so.schools} schools`],
  ];
  if (p.boarding.boarders > 0) rows.push(["Day pupils", pupils(p.boarding.day), "pupils", null], ["Boarders", pupils(p.boarding.boarders), "pupils", `${p.boarding.schools} schools with boarders`]);
  else rows.push(["Schools growing", p.growing.growing, "schools", `of ${p.growing.of}, since ${periodLabel(p.growing.from)}`], ["Schools shrinking", p.growing.shrinking, "schools", `of ${p.growing.of}, since ${periodLabel(p.growing.from)}`]);
  for (const k of ["1", "3", "5"] as const) {
    rows.push([`Roll change since ${periodLabel(n.change[k].from)}: like for like`, p1(n.change[k].sameSchools), "%", null], [`Roll change since ${periodLabel(n.change[k].from)}: combined`, p1(n.change[k].combined), "%", null]);
  }
  const t = p.overview.sideBySide;
  if (t) {
    for (const r of t.rows) rows.push([`Side by side: ${r.label} (${r.typeSize}): pupils`, pupils(r.pupils), "pupils", null], [`Side by side: ${r.label}: roll change, 5 years`, p1(r.roll.pct), "%", "like for like"]);
    const mw = `${ofGroupsWords(t.median.n, t.rows.length - 1)}${t.median.mixed ? " · mixed types" : ""}`;
    rows.push(["Side by side: median: pupils", pupils(t.median.pupils), "pupils", mw], ["Side by side: median: roll change, 5 years", p1(t.median.roll), "%", mw]);
  }
  return { about: { set: t ? p.overview.picker.name : null, year: periodLabel(p.overview.years.census) }, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** The group's shape (GroupShape): pupils by single year of age, this census and the first. */
export function groupShapeCsv(p: GroupPupils): CsvTable | null {
  const ages = p.shape.ages;
  const lo = ages.findIndex((n) => n > 0);
  if (lo < 0) return null;
  const hi = ages.length - 1 - [...ages].reverse().findIndex((n) => n > 0);
  return {
    about: { set: null, year: null },
    columns: ["Age", `Pupils, ${periodLabel(p.shape.year)}`, `Pupils, ${periodLabel(p.shape.first)}`],
    rows: Array.from({ length: hi - lo + 1 }, (_, i) => [lo + i, ages[lo + i], p.shape.firstAges[lo + i] ?? 0]),
  };
}

/** Entry cohorts (EntryCohorts): the entry age on screen, each school's pupils of that age each January. */
export function entryCohortsCsv(p: GroupPupils, age: number | null): CsvTable | null {
  const rows = p.entries.filter((e) => e.pts.filter((x) => x.value).length >= 2);
  if (!rows.length) return null;
  const ages = Array.from(new Set(rows.map((r) => r.age))).sort((a, b) => a - b);
  const at = age !== null && ages.includes(age) ? age : ages.includes(11) ? 11 : ages[0];
  const years = rows[0].pts.map((x) => x.year);
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "Entry age", ...years.map((y) => `Pupils, ${periodLabel(y)}`)],
    rows: rows.filter((r) => r.age === at).map((r) => [r.name, r.urn, r.age, ...years.map((y) => r.pts.find((x) => x.year === y)?.value ?? null)]),
  };
}

/** Leaving at 16 (LeavingAt16): every school (full screen lists them all), then the group. */
export function leavingCsv(p: GroupPupils): CsvTable | null {
  if (!p.leaving.length) return null;
  const y = p.stayingOn.year;
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", `Year 11, ${periodLabel(y - 1)}`, `Year 12, ${periodLabel(y)}`, "Year 12 against Year 11 (%)"],
    rows: [...p.leaving.map((r): CsvCell[] => [r.name, r.urn, pupils(r.y11), pupils(r.y12), p1(r.pct)]), [`Group (${p.stayingOn.schools} schools)`, null, pupils(p.stayingOn.y11), pupils(p.stayingOn.y12), p1(p.stayingOn.pct)]],
  };
}

/** Market share (MarketShare): each school's share of its own LA's pupils of its phase, largest first. */
export function marketCsv(p: GroupPupils): CsvTable | null {
  if (!p.market.rows.length) return null;
  return {
    about: { set: p.market.label, year: periodLabel(p.shape.year) },
    columns: ["School", "URN", "LA", "Phase", "School's pupils", "LA's pupils", "Share (%)"],
    rows: p.market.rows.map((r) => [r.name, r.urn, r.la, r.phase === "post16" ? "sixth form" : r.phase, r.pupils, r.laPupils, p1(r.pct)]),
  };
}

/** Children around the schools (ProjectionPerSchool): each school's area now and projected. */
export function projectionCsv(rows: ProjectionRow[] | null): CsvTable | null {
  if (!rows || !rows.length) return null;
  return {
    about: { set: null, year: null },
    columns: ["School", "URN", "Area (km)", "Area from", "Ages", "Now", "Now: year", "Projected", "Projected: by", "Change (%)"],
    rows: rows.map((r) => [r.name, r.urn, r.km, r.from === "saved" ? "saved catchment" : "default", r.ages, pupils(r.now), r.latestYear, pupils(r.end), r.end === null ? null : r.endYear, r.end === null ? null : p1(r.pct)]),
  };
}

/** Growing and shrinking (GrowingShrinking): the three counts, census to census. */
export function growingCsv(p: GroupPupils): CsvTable {
  const g = p.growing;
  return {
    about: { set: null, year: `${periodLabel(g.from)} to ${periodLabel(g.to)}` },
    columns: ["Schools", "Count", "Schools with both years"],
    rows: [["Growing", g.growing, g.of], ["Shrinking", g.shrinking, g.of], ["No change", Math.max(0, g.of - g.growing - g.shrinking), g.of]],
  };
}

// ------------------------------------------------------------------------------- non-mainstream

/** The group now, a special and AP trust's or nursery federation's (NmNow). */
export function nmNowCsv(o: GroupOverview): CsvTable | null {
  const nm = o.nm;
  if (!nm) return null;
  const peer = nm.against.find((r) => r.kind === "peer_band");
  const c1 = o.now.change["1"];
  const rows: CsvCell[][] = [
    ["Schools", o.now.schools, "schools", o.now.notCounted ? `of ${o.now.notCounted.total}; ${o.now.notCounted.words}` : nm.byKind],
    ["Roll", pupils(o.now.roll), "pupils", null],
    [`Roll change since ${periodLabel(c1.from)}, same schools`, p1(c1.sameSchools), "%", null],
    ["FSM", p1(nm.fsm.pct), "%", null],
  ];
  if (peer) rows.push([`FSM: ${peer.label}`, peer.tooFew ? tooFewWords(peer.schools ?? 0) : p1(peer.fsm), "%", null]);
  rows.push(["Areas", o.now.las.length, "LAs", o.now.regions.filter((r) => r.code !== "outside_england").map((r) => r.name).join(", ") || null]);
  rows.push(["In its own figures", null, null, nm.countedByKind]);
  for (const k of ["1", "3", "5"] as const) rows.push([`Roll change since ${periodLabel(o.now.change[k].from)}, same schools`, p1(o.now.change[k].sameSchools), "%", `${o.now.change[k].of} schools with both years`]);
  for (const p of nm.places) rows.push(["Among its peers", null, null, p.text]);
  return { about: { set: null, year: periodLabel(o.years.census) }, columns: ["Measure", "Value", "Unit", "Note"], rows };
}

/** NmTable's rows: a pool on fewer than 5 schools reads "Too few schools (n)" in both its figures. */
function nmRowsCsv(rows: NmRow[], first: string, census: number, set: string | null): CsvTable {
  const c = periodLabel(census);
  return {
    about: { set, year: null },
    columns: [first, "Schools", "Pupils", `Roll change, 1 year, ${c} (%)`, `FSM, ${c} (%)`],
    rows: rows.map((r) => [r.label, r.schools, r.pupils, ...(r.tooFew ? [tooFewWords(r.schools ?? 0), tooFewWords(r.schools ?? 0)] : [p1(r.change1), p1(r.fsm)])]),
  };
}

/** Against others, non-mainstream (NmAgainst): its peer set and its kinds' pools, or a set of groups. */
export function nmAgainstCsv(o: GroupOverview): CsvTable | null {
  const nm = o.nm;
  if (!nm) return null;
  const t = o.sideBySide;
  if (t) {
    const rows: NmRow[] = t.rows.map((r) => ({ key: r.key, label: r.label, kind: r.ours ? "group" : "peer_named", schools: r.schools, pupils: r.pupils, change1: r.nm?.change1 ?? null, change3: null, fsm: r.nm?.fsm ?? null, fsmN: null, tooFew: false, ours: r.ours }));
    rows.push({ key: "median", label: t.median.label, kind: "median", schools: t.median.schools, pupils: t.median.pupils, change1: t.median.nm?.change1 ?? null, change3: null, fsm: t.median.nm?.fsm ?? null, fsmN: null, tooFew: false, ours: false });
    return nmRowsCsv(rows, "Group", o.years.census, o.picker.name);
  }
  return nmRowsCsv(nm.against, "Set", o.years.census, o.compare.label);
}

/** Its mainstream line (NmLine). */
export function nmLineCsv(o: GroupOverview): CsvTable | null {
  const line = o.nm?.line;
  if (!line) return null;
  return nmRowsCsv(line.rows, "Set", o.years.census, null);
}

/** FSM over time (NmFsmTrend): each line by year; against a set of groups, with its median and middle half. */
export function nmFsmCsv(o: GroupOverview): CsvTable | null {
  const nm = o.nm;
  if (!nm) return null;
  const lines = nm.fsmTrend.lines;
  if (!lines.length || lines[0].pts.filter((p) => p.value !== null).length < 2) return null;
  if (o.sideBySide) return setTrendCsv(lines.filter((l) => l.key === "group" || l.key.startsWith("peer_named:")), (v) => shown(v, 1), "FSM, pupil-weighted (%)", o.picker.name);
  const years = lines[0].pts.map((p) => p.year);
  return {
    about: { set: o.compare.label, year: null },
    columns: ["Year", ...lines.map((l) => `${l.label}: FSM, pupil-weighted (%)`)],
    rows: years.map((y, k) => [periodLabel(y), ...lines.map((l) => shown(l.pts[k]?.value, 1))]),
  };
}

// ------------------------------------------------------------------------------- one view

export type GroupCsvInput = { d: DashResponse; o: GroupOverview; s: GroupSchools | null; average: boolean; projection: ProjectionRow[] | null };

/** The views that register their own rows (they hold the state that picks them). */
export const SELF_REGISTERING: ViewId[] = ["GRP-O-RESULTS", "GRP-A-TREND", "GRP-A-POST16", "GRP-S-TABLE", "GRP-P-ENTRIES"];

/** The rows of the group view on screen, from the same objects ViewBody draws it from; null where it
 * draws nothing to save (still loading, an empty state, the reserved bands, the no-results reasons). */
export function groupViewCsv(id: ViewId, c: GroupCsvInput): CsvTable | null {
  const a = c.d.academic;
  const p = c.d.pupils;
  switch (id) {
    case "GRP-O-NOW":
      return groupNowCsv(c.o);
    case "GRP-O-AGAINST":
      return againstCsv(c.o, c.average);
    case "GRP-O-MAP":
      return groupMapCsv(c.d.map);
    case "GRP-O-JOINED":
      return joinedCsv(c.d.membership);
    case "GRP-O-ROLL":
    case "GRP-P-ROLL":
      return rollTrendCsv(c.o);
    case "GRP-O-SHARE":
      return shareCsv(c.o);
    case "GRP-S-NOW":
      return c.s ? schoolsNowCsv(c.o, c.d.membership, c.s) : null;
    case "GRP-S-GROWING":
      return c.s ? whoIsGrowingCsv(c.s, c.o) : null;
    case "GRP-S-SCATTER":
      return c.s ? sizeAndResultsCsv(c.s) : null;
    case "GRP-S-SHAPES":
      return c.s ? shapesCsv(c.s) : null;
    case "GRP-A-NOW":
      return a ? academicNowCsv(a, c.average) : null;
    case "GRP-A-RANKED":
      return a ? schoolsRankedCsv(a) : null;
    case "GRP-A-AREAS":
      return a ? subjectAreasCsv(a) : null;
    case "GRP-A-VA":
      return a ? valueAddedCsv(a) : null;
    case "GRP-A-IMPROVING":
      return a ? improvingCsv(a) : null;
    case "GRP-P-NOW":
      return p ? pupilsNowCsv(p) : null;
    case "GRP-P-SHAPE":
      return p ? groupShapeCsv(p) : null;
    case "GRP-P-LEAVING":
      return p ? leavingCsv(p) : null;
    case "GRP-P-MARKET":
      return p ? marketCsv(p) : null;
    case "GRP-P-PROJECTION":
      return projectionCsv(c.projection);
    case "GRP-P-GROWING":
      return p ? growingCsv(p) : null;
    case "GRP-N-NOW":
      return nmNowCsv(c.o);
    case "GRP-N-AGAINST":
      return nmAgainstCsv(c.o);
    case "GRP-N-LINE":
      return nmLineCsv(c.o);
    case "GRP-N-FSM":
      return nmFsmCsv(c.o);
    // Self-registering (SELF_REGISTERING), and the two with no figures: the reserved bands and R-NM-NO-RESULTS.
    default:
      return null;
  }
}
