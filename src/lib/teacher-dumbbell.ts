// VicData 0.8 front door 2b (M2): "Change (dumbbell)" on the dashboard's Context › Trends rail
// (DV-C2-TR-DUMBBELL, R-DUMBBELL). The rows from the Context panel's own figures: the subjects its
// Compared against pill holds, over the span its "From" menu sets -- measured from the same first year as
// Ranked change (the statement span, R-TREND-FROM-2223), so the two agree on every subject's change.
//
// One row per subject with a figure in both years, largest this year first (ties by name); the focus
// marked; the comparison group's own per-subject average (the panel's group line) as the dashed row last,
// else the plain average of the rows drawn. Change is in entries (latest less first). Pure, so the rule
// test runs it on fixtures and the walk's ordering rule (dumbbellRows) is the same.

export type DumbbellSeries = { key: string; label: string; colour: string; values: (number | null)[] };
export type DashboardDumbbellRow = { key: string; label: string; shortLabel: string; colour: string; first: number; latest: number; change: number; focus: boolean };
export type DashboardDumbbell = {
  rows: DashboardDumbbellRow[];
  average: { label: string; first: number; latest: number; change: number } | null;
  firstPeriod: number;
  latestPeriod: number;
  /** Subjects with no figure in one of the two years, left out (the note says how many). */
  leftOut: number;
};

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function dashboardDumbbell(
  span: { periods: number[]; series: DumbbellSeries[] },
  opts: { focusKey: string | null; shortLabels?: Map<string, string>; group?: { label: string } | null },
): DashboardDumbbell | null {
  const n = span.periods.length;
  if (n < 2) return null;
  const fi = 0;
  const li = n - 1;
  const subjects = span.series.filter((s) => !s.key.startsWith("group-"));
  const rows: DashboardDumbbellRow[] = [];
  let leftOut = 0;
  for (const s of subjects) {
    const a = s.values[fi];
    const b = s.values[li];
    if (a === null || a === undefined || b === null || b === undefined) {
      leftOut++;
      continue;
    }
    rows.push({ key: s.key, label: s.label, shortLabel: opts.shortLabels?.get(s.key) ?? s.label, colour: s.colour, first: a, latest: b, change: b - a, focus: s.key === opts.focusKey });
  }
  if (!rows.length) return null;
  rows.sort((x, y) => y.latest - x.latest || x.label.localeCompare(y.label));
  const g = span.series.find((s) => s.key === "group-0");
  const ga = g?.values[fi];
  const gb = g?.values[li];
  let average: DashboardDumbbell["average"] = null;
  if (g && ga != null && gb != null) average = { label: `${opts.group?.label ?? g.label} average`, first: ga, latest: gb, change: gb - ga };
  else {
    const a = mean(rows.map((r) => r.first));
    const b = mean(rows.map((r) => r.latest));
    if (a !== null && b !== null) average = { label: "Average of these subjects", first: a, latest: b, change: b - a };
  }
  return { rows, average, firstPeriod: span.periods[fi], latestPeriod: span.periods[li], leftOut };
}

/** The panel's sentence: the focus's change, then who grew and fell most (never invents a figure). */
export function dumbbellSentence(d: DashboardDumbbell, since: string): string | null {
  const me = d.rows.find((r) => r.focus);
  const byChange = [...d.rows].sort((a, b) => b.change - a.change);
  const top = byChange[0];
  const bottom = byChange[byChange.length - 1];
  const r = (v: number) => Math.round(Math.abs(v)).toLocaleString("en-GB");
  const parts: string[] = [];
  if (me) parts.push(Math.round(me.change) === 0 ? `${me.label} is level since ${since}` : `${me.label} ${me.change > 0 ? "grew" : "fell"} by ${r(me.change)} ${Math.round(Math.abs(me.change)) === 1 ? "entry" : "entries"} since ${since}`);
  if (top && Math.round(top.change) > 0) parts.push(top === me ? "more than any other subject" : `${top.label} grew most (+${r(top.change)})`);
  if (bottom && bottom !== top && Math.round(bottom.change) < 0 && bottom !== me) parts.push(`${bottom.label} fell most (−${r(bottom.change)})`);
  if (!parts.length) return null;
  const [head, ...rest] = parts;
  return `${head}${rest.length ? (me && rest[0] === "more than any other subject" ? `, ${rest[0]}${rest.length > 1 ? `; ${rest.slice(1).join("; ")}` : ""}` : `; ${rest.join("; ")}`) : ""}.`;
}
