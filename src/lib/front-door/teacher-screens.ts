// VicData 0.8 front door (B12-B17): each Teacher walk screen -- its chart, the chart's title (the view's own
// dashboard title), its note line and its one-line written answer -- from the TeacherModel (the dashboard's
// own rows). Pure, so the rule tests run it on real data (R-WALK-RHYTHM) and on fixtures (R-DUMBBELL).
//
// Answers are honest about small numbers and missing years: a figure under 10 pupils says "only", a year
// with no figure says so, and nothing is compared across a gap.
import { periodLabel } from "@/catalogue/years";
import { dataviewById } from "@/catalogue/dataviews";
import { fillTitle } from "./walk-titles";
import { SUBJECT_FAMILY_NAMES } from "@/lib/subject-family-colours";
import { firstReal, lastOf, ordinal, prevOf, rankOf, type SubjectRow, type TeacherModel } from "./teacher-model";
import type { Walk, WalkScreen } from "./walks";
import { gradingCaveat, learners, listJoin, placeOf, plural, smallNote } from "./words";

type Series = (number | null)[];
export type Role = "focus" | "peer" | "other" | "average" | "la" | "england" | "nearest" | "region";
export type Marker = "square" | "triangle" | "diamond" | "circle";
/** A key entry: one per colour and mark on the chart (B14, R-WALK-KEYS). */
export type KeyEntry = { label: string; role: Role; mark: "swatch" | "line" | "dash" | "tick" | "ring" | "dot"; shade?: number; marker?: Marker; family?: string | null };

export type Chart =
  | { kind: "tiles"; main: { figure: string; label: string }; tiles: { icon: string; figure: string; scope: string }[]; keys: KeyEntry[] }
  | { kind: "vbars"; rows: { label: string; value: number; role: Role; family?: string | null }[]; average: { value: number; label: string } | null; unit: string; yCaption: string; keys: KeyEntry[] }
  | { kind: "lines"; years: string[]; series: { label: string; values: Series; role: Role; shade?: number; marker?: Marker; family?: string | null }[]; unpublished: number[]; yCaption: string; extraRows?: { label: string; values: Series }[]; keys: KeyEntry[]; digits: number }
  | { kind: "dumbbell"; rows: { label: string; first: number; latest: number; role: Role; family?: string | null }[]; firstYear: string; latestYear: string; noun: string; keys: KeyEntry[] }
  | { kind: "grades"; rows: { grade: string; count: number; share: number; england: number | null }[]; total: number; noun: [string, string]; keys: KeyEntry[] }
  | { kind: "hbars"; rows: { label: string; value: number; role: Role; note?: string; n?: number | null }[]; unit: string; digits: number; keys: KeyEntry[]; caption?: string }
  | { kind: "ranking"; rows: { rank: number; label: string; value: number; role: Role; distanceKm: number | null; n?: number | null }[]; unit: string; digits: number; keys: KeyEntry[]; caption?: string; year?: string }
  | { kind: "map"; points: { label: string; easting: number; northing: number; role: Role; value: number | null; distanceKm?: number | null }[]; keys: KeyEntry[]; year?: string }
  | { kind: "none"; reason: string; keys: KeyEntry[] };

export type Screen = { question: string; answer: string; title: string; note: string; chart: Chart; tag: string };

const fmtN = (v: number) => Math.round(v).toLocaleString("en-GB");
const fmtP = (v: number, d = 1) => v.toFixed(d);
const pupils = (m: TeacherModel, n: number) => `${fmtN(n)} ${m.phase === "ks5" ? (n === 1 ? "student" : "students") : n === 1 ? "pupil" : "pupils"}`;
const signed = (v: number, d = 0) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}`;
const mean = (vs: number[]) => (vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null);
const real = (s: Series) => s.filter((v): v is number => v !== null);
const pointsDigits = (m: TeacherModel) => (m.phase === "ks5" ? 1 : 1);

/** The years a chart spans: from the first year any line has a figure. */
function span(m: TeacherModel, series: Series[]): { from: number; years: string[] } {
  const firsts = series.map((s) => s.findIndex((v) => v !== null)).filter((i) => i >= 0);
  const from = firsts.length ? Math.min(...firsts) : 0;
  return { from, years: m.periods.slice(from).map(periodLabel) };
}

/** "11" or "7–8": how many schools a place is out of, across the years (review fixes, G7: "of N" on the axis). */
function ofRange(ofs: Series): string {
  const v = ofs.filter((x): x is number => x !== null);
  if (!v.length) return "the";
  const lo = Math.min(...v), hi = Math.max(...v);
  return lo === hi ? String(lo) : `${lo}–${hi}`;
}

/** One key entry per subject family on the chart (R-SUBJECT-COLOUR: keyed wherever more than one family
 * appears); a chart of one family keeps its single "Other … subjects" entry. */
function familyKeys(rows: { familyId?: string | null }[], oneLabel: string): KeyEntry[] {
  const fams = Array.from(new Set(rows.map((r) => r.familyId ?? null)));
  if (fams.length <= 1) return rows.length ? [{ label: oneLabel, role: "peer", mark: "swatch", family: fams[0] ?? null }] : [];
  return fams.map((f) => ({ label: f ? (SUBJECT_FAMILY_NAMES[f] ?? f) : "Other subjects", role: (f ? "peer" : "other") as Role, mark: "swatch" as const, family: f }));
}
/** Rows in name order: a peer's shade and marker follow its name, never its rank. */
const byName = <T extends { label: string }>(rows: T[]) => [...rows].sort((a, b) => a.label.localeCompare(b.label));

/** Peer shades (C16): up to about five, light to dark, each with its own marker. */
const MARKERS: Marker[] = ["square", "triangle", "diamond", "circle"];

/** "the 10 nearest schools", "the nearest school", "no nearby schools" (sixth forms at Post-16). */
function nearestWords(m: TeacherModel, cap = false): string {
  const k = m.nearest.length - 1;
  const noun = m.phase === "ks5" ? ["sixth form", "sixth forms"] : ["school", "schools"];
  const w = k <= 0 ? `no nearby ${noun[1]}` : k === 1 ? `the nearest ${noun[0]}` : `the ${k} nearest ${noun[1]}`;
  return cap ? w.charAt(0).toUpperCase() + w.slice(1) : w;
}

function focusRow(m: TeacherModel): SubjectRow | null {
  return m.whole.rows.find((r) => r.focus) ?? m.category.rows.find((r) => r.focus) ?? null;
}

/** Review fixes (14 Nov, M5): a walk screen's title is its view's catalogue title (dataviews.ts), filled from
 * the walk's own context, so the walk and the catalogue (the editor, the chooser) name a chart the same way. */
export function walkTitle(view: string, ctx: { subject: string; category: string; points: boolean; whole: boolean; first: string; latest: string; set: string; school: string }, fallback: string): string {
  const dv = dataviewById(view);
  if (!dv?.titleTemplate) return fallback;
  const trend = dv.supports?.dateMode === "trend";
  const measure = ctx.points ? "average points" : "entries";
  return fillTitle(dv.titleTemplate, {
    subject: ctx.subject,
    category: ctx.category,
    "comparison-group": ctx.whole ? "the whole school" : ctx.category,
    measure,
    Measure: ctx.points ? "Average points" : "Entries",
    "Entries|measure": ctx.points ? "Average points" : "Entries",
    "Entries|Results": ctx.points ? "Results" : "Entries",
    year: trend ? ctx.first : ctx.latest,
    "first-year": ctx.first,
    latest: ctx.latest,
    set: ctx.set,
    versus: ctx.set,
    school: ctx.school,
  }, fallback);
}

export function teacherScreen(m: TeacherModel, walk: Walk, i: number): Screen {
  const sc = teacherScreenRaw(m, walk, i);
  const s = walk.screens[i];
  const first = sc.chart.kind === "lines" ? sc.chart.years[0] : sc.chart.kind === "dumbbell" ? sc.chart.firstYear : null;
  const latest = m.latest !== null ? periodLabel(m.latest) : "the latest year";
  const k = m.nearest.length - 1;
  const title = walkTitle(s.view, { subject: m.focus?.subject ?? "your subject", category: m.category.label ?? "its area", points: s.options?.measure === "points" || s.view.startsWith("DV-C1-RES"), whole: s.options?.against === "whole", first: first ?? latest, latest, set: k === 1 ? "nearest school" : `${k} nearest ${m.phase === "ks5" ? "sixth forms" : "schools"}`, school: m.school.name }, sc.title);
  return { ...sc, title };
}

function teacherScreenRaw(m: TeacherModel, walk: Walk, i: number): Screen {
  const s = walk.screens[i];
  const f = focusRow(m);
  const subject = m.focus?.subject ?? "your subject";
  // Review fixes (27): no "Other its area subjects" when a subject has no category.
  const cat = m.category.label ?? "its area";
  const others = (whole = false) => (m.category.label ? `Other ${cat} subjects` : whole ? "Other subjects in its area" : "Other subjects in its area");
  const catAvg = m.category.label ? `${cat} average` : "the area's average";
  const p16 = m.phase === "ks5";
  const latest = m.latest !== null ? periodLabel(m.latest) : "the latest year";
  const tag = `${s.spot.row === 0 ? "Current" : "Trends"} · Data ${latest}`;
  const question = s.question.replace(/\[subject\]/g, subject).replace(/\[category\]/g, cat);
  const base = { question, tag };
  if (!f || m.latest === null) return { ...base, answer: `No ${subject} figures are published for this school yet.`, title: question, note: "", chart: { kind: "none", reason: "No published figures.", keys: [] } };
  const pts = s.options?.measure === "points";
  const n = m.periods.length;

  switch (s.answer) {
    // ---------------------------------------------------------------- how many
    case "entries-tiles": {
      const now = lastOf(f.entries);
      const before = prevOf(f.entries);
      const catRank = rankOf(m.category.rows.map((r) => ({ key: r.key, value: lastOf(r.entries) })), f.key);
      const schoolRank = rankOf(m.whole.rows.map((r) => ({ key: r.key, value: lastOf(r.entries) })), f.key);
      const first = firstReal(f.entries);
      const change = first && now !== null && first.i < n - 1 && first.v > 0 ? ((now - first.v) / first.v) * 100 : null;
      const answer =
        now === null
          ? `No ${subject} entries are published for ${latest}.`
          : `${pupils(m, now)} took ${subject} in ${latest}${before === null ? "." : now === before ? ", the same as the year before." : `, ${fmtN(Math.abs(now - before))} ${now > before ? "more" : "fewer"} than the year before.`}${now < 10 ? ` A small group, so a few ${learners(m.phase)} move it a lot.` : ""}`;
      return {
        ...base,
        answer,
        title: `${subject} entries, ${latest}`,
        note: `${m.phase === "ks5" ? "Students" : "Pupils"} entered for ${subject} in ${latest} (DfE). Ranks: largest first; subjects with the same number share a place.`,
        chart: {
          kind: "tiles",
          main: { figure: now === null ? "—" : fmtN(now), label: `${now === 1 ? "entry" : "entries"} in ${latest}${before !== null ? ` (${fmtN(before)} in ${periodLabel(m.periods[n - 2])})` : ""}` },
          tiles: [
            ...(catRank && catRank.of > 1 ? [{ icon: "PodiumIcon", figure: ordinal(catRank.rank), scope: `of ${catRank.of} in ${cat}` }] : []),
            ...(schoolRank ? [{ icon: "SchoolIcon", figure: ordinal(schoolRank.rank), scope: `of ${schoolRank.of} subjects at the school` }] : []),
            ...(change !== null && first ? [{ icon: "ChangeArrowIcon", figure: `${signed(change)}%`, scope: `since ${periodLabel(m.periods[first.i])}` }] : []),
          ],
          keys: [],
        },
      };
    }
    case "entries-category":
    case "entries-whole":
    case "points-category":
    case "points-whole": {
      const whole = s.answer.endsWith("whole");
      const rows = (whole ? m.whole.rows : m.category.rows).map((r) => ({ r, v: lastOf(pts ? r.points : r.entries) })).filter((x) => x.v !== null || x.r.focus) as { r: SubjectRow; v: number | null }[];
      const withV = rows.filter((x) => x.v !== null) as { r: SubjectRow; v: number }[];
      const sorted = [...withV].sort((a, b) => b.v - a.v);
      const avg = mean(withV.filter((x) => !x.r.focus || true).map((x) => x.v));
      const catKeys = new Set(m.category.rows.map((r) => r.key));
      const fv = lastOf(pts ? f.points : f.entries);
      const rank = rankOf(withV.map((x) => ({ key: x.r.key, value: x.v })), f.key);
      const where = whole ? "the school" : cat;
      const avgLabel = `${whole ? "School average" : m.category.label ? `${cat} average` : "Area average"}: ${avg === null ? "—" : pts ? fmtP(avg) : fmtN(avg)}`;
      const answer =
        fv === null
          ? pts
            ? `${subject} has no published average points for ${latest}${m.focus?.qualLabel && m.focus.qualLabel !== "GCSE" && m.phase === "ks4" ? " (only GCSE entries carry points)" : ""}.`
            : `No ${subject} entries for ${latest}.`
          : sorted.length < 2
            ? `${subject} is the only subject in ${where} with a figure for ${latest}.`
            : `${rank ? `${subject} is ${placeOf(rank.rank, rank.of, "subjects")}` : subject} ${pts ? `on average points in ${where}, at ${fmtP(fv)}${smallNote(m.phase, lastOf(f.entries))}` : `by entries in ${where}, with ${fmtN(fv)}`}${avg !== null ? `, ${Math.abs(fv - avg) < (pts ? 0.05 : 0.5) ? "right on" : fv > avg ? "above" : "below"} the ${whole ? "school average" : catAvg} of ${pts ? fmtP(avg) : fmtN(avg)}` : ""}.`;
      return {
        ...base,
        answer,
        title: `${pts ? "Results" : "Entries"} by subject in ${whole ? "the whole school" : cat}, ${latest}`,
        note: whole
          ? `Every comparable subject at the school. Average: the plain average of the ${withV.length} subjects.${pts ? " Average points: the average grade per entry." : ""}`
          : `${cat} is the subject category ${subject} belongs to across VicData. Average: the plain average of its ${withV.length} subjects.`,
        chart: {
          kind: "vbars",
          // Review fixes (14 Nov, M7): every subject in its family's colour, the focus in the accent.
          rows: sorted.map((x) => ({ label: x.r.label, value: x.v, role: x.r.focus ? "focus" : !whole || catKeys.has(x.r.key) ? "peer" : "other", family: x.r.focus ? null : (x.r.familyId ?? null) })),
          average: avg === null ? null : { value: avg, label: avgLabel },
          unit: pts ? "average points" : "entries",
          yCaption: pts ? `Average points per entry, ${latest}` : `Entries (${learners(m.phase)}), ${latest}`,
          keys: [
            { label: subject, role: "focus", mark: "swatch" },
            ...familyKeys(sorted.filter((x) => !x.r.focus).map((x) => x.r), others(whole)),
            ...(avg !== null ? [{ label: avgLabel, role: "average" as Role, mark: "dash" as const }] : []),
          ],
        },
      };
    }
    case "entries-trend":
    case "points-trend": {
      const peers = s.answer === "entries-trend" ? m.category.rows.filter((r) => !r.focus).slice(0, 4) : [];
      const sel = (r: SubjectRow) => (pts ? r.points : r.entries);
      const all = [sel(f), ...peers.map(sel), ...(pts ? [m.england.points] : [])];
      const { from, years } = span(m, all);
      const cut = (v: Series) => v.slice(from);
      const fs = cut(sel(f));
      const unpublished = fs.map((v, k) => (v === null ? k : -1)).filter((k) => k >= 0);
      const series: Extract<Chart, { kind: "lines" }>["series"] = [
        { label: subject, values: fs, role: "focus" },
        // Peers in their family's colour (one family here), each a fixed shade and marker by name, never by rank.
        ...peers.map((r) => ({ label: r.label, values: cut(sel(r)), role: "peer" as Role, shade: byName(peers).indexOf(r), marker: MARKERS[byName(peers).indexOf(r) % MARKERS.length], family: r.familyId ?? null })),
        ...(pts && real(cut(m.england.points)).length ? [{ label: "England", values: cut(m.england.points), role: "england" as Role }] : []),
      ];
      const r = real(fs);
      const fi = fs.findIndex((v) => v !== null);
      const li = fs.length - 1 - [...fs].reverse().findIndex((v) => v !== null);
      const trend = r.length >= 2 ? fs[li]! - fs[fi]! : null;
      const answer =
        r.length < 2
          ? `There ${r.length === 1 ? "is only one year" : "are no years"} of ${pts ? "results" : "entries"} for ${subject} so far, so there's no trend yet.`
          : pts
            ? `${trend! > 0.05 ? "Up" : trend! < -0.05 ? "Down" : "Level"} since ${years[fi]}: from ${fmtP(fs[fi]!)} to ${fmtP(fs[li]!)} average points.${unpublished.length ? ` ${listJoin(unpublished.map((k) => years[k]))} had no published results.` : ""}${gradingCaveat(m.periods[from + fi])}`
            : `${trend! > 0 ? "Up" : trend! < 0 ? "Down" : "Level"} since ${years[fi]}, from ${fmtN(fs[fi]!)} to ${fmtN(fs[li]!)}.${peers.length ? ` The other ${m.category.label ? `${cat} subjects are` : "subjects in its area are"} drawn beside it.` : ""}`;
      return {
        ...base,
        answer,
        title: pts ? `${subject} Results over time: average points` : `Entries in ${cat}`,
        note: pts
          ? `Average points per entry each year; England's is the amber line. Years with no published results are dotted and labelled.`
          : `${m.phase === "ks5" ? "Students" : "Pupils"} entered each year. ${subject} is drawn in your colour; the other ${cat} subjects in shades of the ${cat} colour, each with its own marker shape.`,
        chart: {
          kind: "lines",
          years,
          series,
          unpublished,
          yCaption: pts ? "Average points per entry" : `Entries (${m.phase === "ks5" ? "students" : "pupils"})`,
          keys: [{ label: subject, role: "focus", mark: "line" }, ...peers.map((r) => ({ label: r.label, role: "peer" as Role, mark: "line" as const, shade: byName(peers).indexOf(r), marker: MARKERS[byName(peers).indexOf(r) % MARKERS.length], family: r.familyId ?? null })), ...(series.some((x) => x.role === "england") ? [{ label: "England", role: "england" as Role, mark: "line" as const }] : []), ...(unpublished.length ? [{ label: "No published figure", role: "focus" as Role, mark: "dash" as const }] : [])],
          digits: pts ? pointsDigits(m) : 0,
        },
      };
    }
    case "entries-dumbbell":
      return dumbbellScreen(m, base, subject, cat);
    case "entries-area":
    case "points-area": {
      const sel = (x: { entries: Series; points: Series }) => (pts ? x.points : x.entries);
      const nearAvg: Series = m.periods.map((_, k) => mean(m.nearest.filter((x) => !x.isTarget).map((x) => sel(x)[k]).filter((v): v is number => v !== null)));
      const nNear = m.nearest.length - 1;
      const lines: { label: string; v: Series; role: Role }[] = [
        { label: m.school.name, v: sel(f), role: "focus" },
        { label: nNear === 1 ? "Nearest school" : `${nNear} nearest`, v: nearAvg, role: "nearest" },
        ...(m.area.la ? [{ label: m.area.la.name, v: sel(m.area.la), role: "la" as Role }] : []),
        ...(m.area.england ? [{ label: "England", v: sel(m.area.england), role: "england" as Role }] : []),
      ];
      // Entries are indexed (first shared year = 100) so growth compares whatever the size; points are actual.
      // Review fixes (14 Nov, M1): an indexed chart starts at that base year, so every line is 100 at the
      // year the caption names (it started at the first year any line had a figure, and crossed 100 later).
      const shared = m.periods.findIndex((_, k) => lines.every((l) => l.v[k] !== null && l.v[k] !== 0));
      const idx = (v: Series) => (shared < 0 ? v.map(() => null) : v.map((x) => (x === null ? null : (x / (v[shared] as number)) * 100)));
      const shown = lines.map((l) => ({ ...l, v: pts ? l.v : idx(l.v) }));
      const sp = span(m, shown.map((l) => l.v));
      const from = pts || shared < 0 ? sp.from : shared;
      const years = m.periods.slice(from).map(periodLabel);
      const cut = (v: Series) => v.slice(from);
      const fs = cut(shown[0].v);
      const lastI = fs.length - 1;
      const growth = (v: Series) => (v[lastI] ?? null);
      const mine = growth(fs);
      const others = shown.slice(1).map((l) => ({ label: l.label, role: l.role, g: growth(cut(l.v)) })).filter((o) => o.g !== null) as { label: string; role: Role; g: number }[];
      // Each comparator by name and value, in a sentence; one with no figure is left out (and said so).
      const nameOf = (o: { label: string; role: Role }) => (o.role === "nearest" ? (nNear === 1 ? "the nearest school" : `the ${nNear} nearest schools`) : o.label);
      const placeWord = (o: { label: string; role: Role }) => (o.role === "nearest" ? `at ${nameOf(o)}` : `in ${o.label}`);
      const missing = shown.slice(1).filter((l) => !others.some((o) => o.label === l.label));
      const missingWord = missing.length ? ` ${listJoin(missing.map((l) => nameOf(l)))} ${missing.length === 1 ? "has" : "have"} no figure for ${years[lastI]}.` : "";
      const base100 = years[0];
      const answer =
        mine === null || !others.length
          ? `Not enough published years to compare ${subject} here with schools nearby and nationally.`
          : pts
            ? `${subject} here averaged ${fmtP(mine)} in ${years[lastI]}${smallNote(m.phase, lastOf(f.entries))}, against ${listJoin(others.map((o) => `${fmtP(o.g)} ${placeWord(o)}`))}.${missingWord}`
            : (() => {
                const ch = mine - 100;
                const lead = Math.abs(ch) < 0.5 ? `${subject} entries here are level since ${base100}` : `${subject} entries here ${ch > 0 ? "rose" : "fell"} ${Math.abs(ch).toFixed(0)}% since ${base100}`;
                const same = others.every((o) => Math.sign(Math.round(o.g - 100)) === Math.sign(Math.round(ch)));
                const verdict = same ? "Yes" : others.every((o) => Math.sign(Math.round(o.g - 100)) !== Math.sign(Math.round(ch))) ? "No" : "Partly";
                return `${verdict}: ${lead} (index ${fmtP(mine, 0)}), against ${listJoin(others.map((o) => `${fmtP(o.g, 0)} ${placeWord(o)}`))}.${missingWord}`;
              })();
      return {
        ...base,
        answer,
        title: pts ? `${subject} average points per entry, ${years[0]}–${years[lastI]}: this school against ${listJoin([nearestWords(m), ...(m.area.la ? [m.area.la.name] : []), ...(m.area.england ? ["England"] : [])])}` : `${subject} entries, indexed (${years[0]} = 100): this school against ${listJoin([nearestWords(m), ...(m.area.la ? [m.area.la.name] : []), ...(m.area.england ? ["England"] : [])])}`,
        note: pts
          ? `Average points per entry. The nearest schools' line is the plain average of those with a figure. Region is in the table only: its line runs almost on top of England's, as on the dashboard.`
          : `Every line starts at 100 in ${years[0] ?? "its first year"}, so growth compares whatever the size. Region is in the table only: its line runs almost on top of England's, as on the dashboard.`,
        chart: {
          kind: "lines",
          years,
          series: shown.map((l) => ({ label: l.label, values: cut(l.v), role: l.role })),
          unpublished: [],
          yCaption: pts ? "Average points per entry" : `Entries, indexed (${years[0] ?? "first year"} = 100)`,
          // Region: in the table only, never a line (R-WALK-RHYTHM).
          extraRows: m.area.region ? [{ label: m.area.region.name, values: cut(pts ? m.area.region.points : idx(m.area.region.entries)) }] : [],
          // Crosscheck (14 Nov): the key names each line as its end label does (the school, its LA by name).
          keys: shown.map((l) => ({ label: l.role === "nearest" ? nearestWords(m, true).replace(/^The /, "") : l.label, role: l.role, mark: "line" as const })),
          digits: pts ? pointsDigits(m) : 0,
        },
      };
    }
    // ---------------------------------------------------------------- how well
    case "points-tiles": {
      const now = lastOf(f.points);
      const before = prevOf(f.points);
      const eng = lastOf(m.england.points);
      const catRank = rankOf(m.category.rows.map((r) => ({ key: r.key, value: lastOf(r.points) })), f.key);
      const schoolRank = rankOf(m.whole.rows.map((r) => ({ key: r.key, value: lastOf(r.points) })), f.key);
      const answer =
        now === null
          ? `${subject} has no published average points for ${latest}.`
          : `An average of ${fmtP(now)} per entry in ${latest}${smallNote(m.phase, lastOf(f.entries))}${before !== null ? `, ${now > before + 0.05 ? "up" : now < before - 0.05 ? "down" : "level"} from ${fmtP(before)}` : ""}${eng !== null ? `, and ${Math.abs(now - eng) < 0.05 ? "level with" : `${fmtP(Math.abs(now - eng))} ${now > eng ? "above" : "below"}`} England` : ""}.`;
      return {
        ...base,
        answer,
        title: `${subject} results, ${latest}: average points per entry, against England`,
        note: m.phase === "ks4" ? "Average points: the average GCSE grade per entry on the 9–1 scale (a 5.4 sits between a 5 and a 6). The only Results measure with LA and England figures." : "Average points per entry on DfE's points table (A* = 60, A = 50 … E = 10). The only Results measure with LA and England figures.",
        chart: {
          kind: "tiles",
          main: { figure: now === null ? "—" : fmtP(now), label: `average points in ${latest}${before !== null ? ` (${fmtP(before)} in ${periodLabel(m.periods[n - 2])})` : ""}` },
          tiles: [
            ...(catRank && catRank.of > 1 ? [{ icon: "PodiumIcon", figure: ordinal(catRank.rank), scope: `of ${catRank.of} in ${cat}` }] : []),
            ...(schoolRank ? [{ icon: "SchoolIcon", figure: ordinal(schoolRank.rank), scope: `of ${schoolRank.of} subjects at the school` }] : []),
            ...(now !== null && eng !== null ? [{ icon: "FlagIcon", figure: signed(now - eng, 1), scope: `${now >= eng ? "above" : "below"} England (${fmtP(eng)})` }] : []),
          ],
          keys: [],
        },
      };
    }
    case "grades-spread": {
      const g = m.grades;
      if (!g || !g.rows.length) return { ...base, answer: `No grades are published for ${subject} at this school yet.`, title: `${subject} grades`, note: "", chart: { kind: "none", reason: "No published grades.", keys: [] } };
      const total = g.rows.reduce((t, r) => t + r.count, 0);
      const rows = g.rows.map((r) => ({ grade: r.grade, count: r.count, share: total ? r.count / total : 0, england: g.englandShare?.[r.grade] ?? null }));
      const top = m.phase === "ks4" ? ["9", "8", "7"] : ["A*", "A"];
      const mineTop = rows.filter((r) => top.includes(r.grade)).reduce((t, r) => t + r.share, 0);
      const engTop = g.englandShare ? rows.filter((r) => top.includes(r.grade)).reduce((t, r) => t + (r.england ?? 0), 0) : null;
      const mode = [...rows].sort((a, b) => b.count - a.count)[0];
      const topWord = m.phase === "ks4" ? "a 7 or above" : "an A or A*";
      const answer = `${pupils(m, total)} in ${periodLabel(g.period)}; the most common grade was ${mode.grade}. ${Math.round(mineTop * 100)}% got ${topWord}${engTop !== null ? `, against ${Math.round(engTop * 100)}% across England` : ""}.${total < 10 ? ` A small group: one ${p16 ? "student" : "pupil"} is a big share.` : ""}`;
      return {
        ...base,
        answer,
        title: `${subject} grades, ${periodLabel(g.period)}: share of ${learners(m.phase)} at each grade${g.englandShare ? ", against England" : ""}`,
        note: `${pupils(m, total)} in all. Bars: the share of this school's ${m.phase === "ks5" ? "students" : "pupils"} at each grade.${g.englandShare ? " Amber marks: England's share at the same grade." : " England's shares aren't published for this qualification."}`,
        chart: { kind: "grades", rows, total, noun: m.phase === "ks5" ? ["student", "students"] : ["pupil", "pupils"], keys: [{ label: "This school: % at each grade", role: "focus", mark: "swatch" }, ...(g.englandShare ? [{ label: "England: % at each grade", role: "england" as Role, mark: "tick" as const }] : [])] },
      };
    }
    // ---------------------------------------------------------------- nearby
    case "nearby-map": {
      const placed = m.nearest.filter((x) => x.easting !== null && x.northing !== null);
      const far = Math.max(0, ...m.nearest.map((x) => x.distanceKm ?? 0));
      const offering = m.nearest.filter((x) => !x.isTarget && real(x.entries).length > 0).length;
      return {
        ...base,
        answer: `${nearestWords(m, true)}, all within ${Math.ceil(far)} km; ${offering === 0 ? "none of them published" : offering === m.nearest.length - 1 ? `all of them published` : `${offering} of them published`} ${subject} entries in ${latest}.`,
        title: `${m.school.name} and ${nearestWords(m)}, by distance`,
        note: `The dashboard's default comparison: ${nearestWords(m)} by its own rules.${m.nearestNote ? ` ${m.nearestNote}` : ""} Positions on the national grid; no base map in the walk.`,
        chart: placed.length ? { kind: "map", points: placed.map((x) => ({ label: x.name, easting: x.easting!, northing: x.northing!, role: x.isTarget ? "focus" : "nearest", value: lastOf(x.entries), distanceKm: x.distanceKm })), year: latest, keys: [{ label: m.school.name, role: "focus", mark: "dot" }, { label: "The nearest schools", role: "nearest", mark: "dot" }] } : { kind: "none", reason: "No positions published for these schools.", keys: [] },
      };
    }
    case "nearby-entries":
    case "nearby-points": {
      const rows = m.nearest.map((x) => ({ x, v: lastOf(pts ? x.points : x.entries) })).filter((r) => r.v !== null) as { x: (typeof m.nearest)[number]; v: number }[];
      rows.sort((a, b) => b.v - a.v);
      const me = rows.find((r) => r.x.isTarget);
      const rank = me ? rows.indexOf(me) + 1 - rows.slice(0, rows.indexOf(me)).filter((r) => r.v === me.v).length : null;
      const missing = m.nearest.length - rows.length;
      const answer = !me
        ? `${m.school.name} has no published ${pts ? "average points" : "entries"} for ${subject} in ${latest}.`
        : `${pts ? `${fmtP(me.v)} average points here${smallNote(m.phase, lastOf(f.entries))}` : `${pupils(m, me.v)} here`}: ${placeOf(rank!, rows.length, "schools")}, ${pts ? "highest first" : "most first"}.${missing ? ` ${plural(missing, "school publishes", "schools publish")} no figure.` : ""}`;
      return {
        ...base,
        answer,
        title: `${subject} ${pts ? "average points" : "entries"} at each school, ${latest}`,
        note: `The school and ${nearestWords(m)}; a school with no published figure is left out.${pts ? " Average points per entry, the same qualification only." : ""}`,
        // Review fixes (walks.md T2): the year and how many schools on the axis caption; entries beside points.
        chart: { kind: "hbars", rows: rows.map((r) => ({ label: r.x.name, value: r.v, role: r.x.isTarget ? "focus" : "nearest", n: pts ? lastOf(r.x.entries) : null })), unit: pts ? "average points" : "entries", digits: pts ? 1 : 0, caption: `${pts ? "Average points per entry" : `Entries (${learners(m.phase)})`}, ${latest}; ${plural(rows.length, "school")} with a figure${missing ? `, ${missing} without` : ""}`, keys: [{ label: m.school.name, role: "focus", mark: "swatch" }, { label: "The nearest schools", role: "nearest", mark: "swatch" }] },
      };
    }
    case "nearby-rank": {
      const rows = m.nearest.map((x) => ({ x, v: lastOf(x.points) })).filter((r) => r.v !== null) as { x: (typeof m.nearest)[number]; v: number }[];
      const ranked = rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o.v > r.v).length })).sort((a, b) => a.rank - b.rank);
      const me = ranked.find((r) => r.x.isTarget);
      return {
        ...base,
        answer: me ? `${placeOf(me.rank, ranked.length, "schools")} on average points in ${subject}, ${latest}${smallNote(m.phase, lastOf(f.entries))}.${ranked.length < m.nearest.length ? ` ${plural(m.nearest.length - ranked.length, "school publishes", "schools publish")} no figure.` : ""}` : `${m.school.name} has no published average points in ${subject} for ${latest}, so it isn't ranked.`,
        title: `${subject}: the school and its nearest ranked, ${latest}`,
        note: "Ranked on average points per entry, highest first, on the unrounded figure: two schools showing the same figure to one decimal can take different places; only an exact tie shares one.",
        // Review fixes (walks.md T1): each school's entries beside its average, and a caption with the year and N.
        chart: { kind: "ranking", rows: ranked.map((r) => ({ rank: r.rank, label: r.x.name, value: r.v, role: r.x.isTarget ? "focus" : "nearest", distanceKm: r.x.distanceKm, n: lastOf(r.x.entries) })), unit: "average points", digits: 1, year: latest, caption: `Ranked highest first on average points per entry, ${latest}: ${plural(ranked.length, "school")} with a figure${ranked.length < m.nearest.length ? `, ${m.nearest.length - ranked.length} without` : ""}. Ranked on the unrounded figure, so two schools showing the same one decimal can take different places.`, keys: [{ label: m.school.name, role: "focus", mark: "swatch" }] },
      };
    }
    case "nearby-trend": {
      const ranks: Series = m.periods.map((_, k) => {
        const vals = m.nearest.map((x) => ({ key: x.urn, value: x.points[k] }));
        return rankOf(vals, m.school.urn)?.rank ?? null;
      });
      const of: Series = m.periods.map((_, k) => m.nearest.filter((x) => x.points[k] !== null).length || null);
      const { from, years } = span(m, [ranks]);
      const rs = ranks.slice(from);
      const ofs = of.slice(from);
      // Review fixes (14 Nov, M1): compare the first and the last year that have a place, each labelled
      // with its own year and "of N" (a latest year with no place read as "Up").
      const fi = rs.findIndex((v) => v !== null);
      const li = rs.length - 1 - [...rs].reverse().findIndex((v) => v !== null);
      const placed = rs.filter((v) => v !== null).length;
      const at = (k: number) => `${placeOf(rs[k]!, ofs[k] ?? rs[k]!)} in ${years[k]}`;
      const answer =
        fi < 0 || placed < 2
          ? `Not enough years with results to see the place of ${subject} change.`
          : `${rs[li]! < rs[fi]! ? "Up" : rs[li]! > rs[fi]! ? "Down" : "The same"}: ${at(fi)}, ${at(li)}.${li < rs.length - 1 ? ` The school has no place for ${years[rs.length - 1]}.` : ""}`;
      return {
        ...base,
        answer,
        title: `${subject}: the school's place among its nearest, year by year`,
        note: "1st is the highest average points among the school and its nearest that year; the table has how many had a figure each year.",
        chart: { kind: "lines", years, series: [{ label: "Our place", values: rs, role: "focus" }], unpublished: [], yCaption: `Place (1st = highest), of ${ofRange(ofs)} schools with a figure`, extraRows: [{ label: "Schools with a figure", values: of.slice(from) }], keys: [{ label: "Our place", role: "focus", mark: "line" }], digits: 0 },
      };
    }
  }
  return { ...base, answer: "", title: question, note: "", chart: { kind: "none", reason: "", keys: [] } };
}

/** The dumbbell (B17, R-DUMBBELL): every comparable subject, first year to latest, largest first; the school average last. */
export function dumbbellRows(m: TeacherModel): { rows: Extract<Chart, { kind: "dumbbell" }>["rows"]; firstIdx: number; lastIdx: number } | null {
  const lastIdx = m.periods.length - 1;
  const firstIdx = m.periods.findIndex((_, k) => m.whole.rows.some((r) => r.entries[k] !== null && r.entries[k] !== 0));
  if (firstIdx < 0 || firstIdx === lastIdx) return null;
  const catKeys = new Set(m.category.rows.map((r) => r.key));
  const rows = m.whole.rows
    .filter((r) => r.entries[firstIdx] !== null && r.entries[lastIdx] !== null)
    .map((r) => ({ label: r.label, first: r.entries[firstIdx] as number, latest: r.entries[lastIdx] as number, role: (r.focus ? "focus" : catKeys.has(r.key) ? "peer" : "other") as Role, family: r.focus ? null : (r.familyId ?? null) }))
    .sort((a, b) => b.latest - a.latest);
  if (!rows.length) return null;
  const avg = { label: "School average", first: mean(rows.map((r) => r.first))!, latest: mean(rows.map((r) => r.latest))!, role: "average" as Role };
  return { rows: [...rows, avg], firstIdx, lastIdx };
}

function dumbbellScreen(m: TeacherModel, base: { question: string; tag: string }, subject: string, cat: string): Screen {
  const d = dumbbellRows(m);
  if (!d) return { ...base, answer: "Not enough years of entries to compare first and latest.", title: "Entries by subject", note: "", chart: { kind: "none", reason: "No two years.", keys: [] } };
  const fy = periodLabel(m.periods[d.firstIdx]);
  const ly = periodLabel(m.periods[d.lastIdx]);
  const subjects = d.rows.filter((r) => r.role !== "average");
  const me = subjects.find((r) => r.role === "focus");
  const changes = subjects.map((r) => ({ r, c: r.latest - r.first })).sort((a, b) => b.c - a.c);
  const top = changes[0];
  const bottom = changes[changes.length - 1];
  const answer = !me
    ? `${subject} doesn't have entries in both ${fy} and ${ly}, so it isn't on this chart.`
    : `${me.latest - me.first === 0 ? `${subject} has been level since ${fy}` : `${subject} has ${me.latest > me.first ? "grown" : "fallen"} by ${pupils(m, Math.abs(me.latest - me.first))} since ${fy}`}${top.r === me && top.c > 0 ? ", more than any other subject" : top.c > 0 ? `; ${top.r.label} grew most (${signed(top.c)})` : ""}${bottom.c < 0 && bottom.r !== me ? `; ${bottom.r.label} fell most (${signed(bottom.c)})` : ""}.`;
  return {
    ...base,
    answer,
    title: `Entries by subject in the whole school, ${fy} and ${ly}, largest first`,
    note: `Ordered by this year's entries. Ring: ${fy}; dot: ${ly}. Change in ${m.phase === "ks5" ? "students" : "pupils"}; ▲ / ▼ show direction, and colour means the subject family (keyed). The same view is on the dashboard's Context › Trends rail, "Change (dumbbell)".`,
    chart: {
      kind: "dumbbell",
      rows: d.rows,
      firstYear: fy,
      latestYear: ly,
      noun: m.phase === "ks5" ? "students" : "pupils",
      keys: [
        { label: subject, role: "focus", mark: "swatch" },
        ...familyKeys(m.whole.rows.filter((r) => !r.focus && d.rows.some((x) => x.label === r.label)), m.category.label ? `Other ${cat} subjects` : "Other subjects in its area"),
        { label: `${fy} (first year)`, role: "other", mark: "ring" },
        { label: `${ly} (latest)`, role: "other", mark: "dot" },
        { label: "School average", role: "average", mark: "dash" },
      ],
    },
  };
}

/** Every screen of a walk, for the end screen ("Here's what you found"). */
export function teacherScreens(m: TeacherModel, walk: Walk): Screen[] {
  return walk.screens.map((_, i) => teacherScreen(m, walk, i));
}

export type { WalkScreen };
