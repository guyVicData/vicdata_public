// VicData 0.8 front door (B12-B17): each Teacher walk screen -- its chart, the chart's title (the view's own
// dashboard title), its note line and its one-line written answer -- from the TeacherModel (the dashboard's
// own rows). Pure, so the rule tests run it on real data (R-WALK-RHYTHM) and on fixtures (R-DUMBBELL).
//
// Answers are honest about small numbers and missing years: a figure under 10 pupils says "only", a year
// with no figure says so, and nothing is compared across a gap.
import { periodLabel } from "@/catalogue/years";
import { firstReal, lastOf, ordinal, prevOf, rankOf, type SubjectRow, type TeacherModel } from "./teacher-model";
import type { Walk, WalkScreen } from "./walks";

type Series = (number | null)[];
export type Role = "focus" | "peer" | "other" | "average" | "la" | "england" | "nearest" | "region";
export type Marker = "square" | "triangle" | "diamond" | "circle";
/** A key entry: one per colour and mark on the chart (B14, R-WALK-KEYS). */
export type KeyEntry = { label: string; role: Role; mark: "swatch" | "line" | "dash" | "tick" | "ring" | "dot"; shade?: number; marker?: Marker };

export type Chart =
  | { kind: "tiles"; main: { figure: string; label: string }; tiles: { icon: string; figure: string; scope: string }[]; keys: KeyEntry[] }
  | { kind: "vbars"; rows: { label: string; value: number; role: Role }[]; average: { value: number; label: string } | null; unit: string; yCaption: string; keys: KeyEntry[] }
  | { kind: "lines"; years: string[]; series: { label: string; values: Series; role: Role; shade?: number; marker?: Marker }[]; unpublished: number[]; yCaption: string; extraRows?: { label: string; values: Series }[]; keys: KeyEntry[]; digits: number }
  | { kind: "dumbbell"; rows: { label: string; first: number; latest: number; role: Role }[]; firstYear: string; latestYear: string; keys: KeyEntry[] }
  | { kind: "grades"; rows: { grade: string; count: number; share: number; england: number | null }[]; total: number; keys: KeyEntry[] }
  | { kind: "hbars"; rows: { label: string; value: number; role: Role; note?: string }[]; unit: string; digits: number; keys: KeyEntry[] }
  | { kind: "ranking"; rows: { rank: number; label: string; value: number; role: Role; distanceKm: number | null }[]; unit: string; digits: number; keys: KeyEntry[] }
  | { kind: "map"; points: { label: string; easting: number; northing: number; role: Role; value: number | null }[]; keys: KeyEntry[] }
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

/** Peer shades (C16): up to about five, light to dark, each with its own marker. */
const MARKERS: Marker[] = ["square", "triangle", "diamond", "circle"];

function focusRow(m: TeacherModel): SubjectRow | null {
  return m.whole.rows.find((r) => r.focus) ?? m.category.rows.find((r) => r.focus) ?? null;
}

export function teacherScreen(m: TeacherModel, walk: Walk, i: number): Screen {
  const s = walk.screens[i];
  const f = focusRow(m);
  const subject = m.focus?.subject ?? "your subject";
  const cat = m.category.label ?? "its area";
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
          : `${pupils(m, now)} took ${subject} in ${latest}${before === null ? "." : now === before ? ", the same as the year before." : `, ${fmtN(Math.abs(now - before))} ${now > before ? "more" : "fewer"} than the year before.`}${now < 10 ? " A small group, so a few pupils move it a lot." : ""}`;
      return {
        ...base,
        answer,
        title: `${subject} Candidates: ${latest}`,
        note: `${m.phase === "ks5" ? "Students" : "Pupils"} entered for ${subject} in ${latest} (DfE). Ranks: largest first; subjects with the same number share a place.`,
        chart: {
          kind: "tiles",
          main: { figure: now === null ? "—" : fmtN(now), label: `entries in ${latest}${before !== null ? ` (${fmtN(before)} in ${periodLabel(m.periods[n - 2])})` : ""}` },
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
      const avgLabel = `${whole ? "School" : cat} average: ${avg === null ? "—" : pts ? fmtP(avg) : fmtN(avg)}`;
      const answer =
        fv === null
          ? pts
            ? `${subject} has no published average points for ${latest}${m.focus?.qualLabel && m.focus.qualLabel !== "GCSE" && m.phase === "ks4" ? " (only GCSE entries carry points)" : ""}.`
            : `No ${subject} entries for ${latest}.`
          : sorted.length < 2
            ? `${subject} is the only subject in ${where} with a figure for ${latest}.`
            : `${rank ? `${subject} is ${rank.rank === 1 ? "the highest" : `${ordinal(rank.rank)} of ${rank.of}`}` : subject} ${pts ? `on average points in ${where}, at ${fmtP(fv)}` : `by entries in ${where}, with ${fmtN(fv)}`}${avg !== null ? `, ${Math.abs(fv - avg) < (pts ? 0.05 : 0.5) ? "right on" : fv > avg ? "above" : "below"} the ${whole ? "school" : cat} average of ${pts ? fmtP(avg) : fmtN(avg)}` : ""}.`;
      return {
        ...base,
        answer,
        title: `${pts ? "Results" : "Entries"} by subject in ${whole ? "the whole school" : cat}, ${latest}`,
        note: whole
          ? `Every comparable subject at the school. Average: the plain average of the ${withV.length} subjects.${pts ? " Average points: the average grade per entry." : ""}`
          : `${cat} is the subject category ${subject} belongs to across VicData. Average: the plain average of its ${withV.length} subjects.`,
        chart: {
          kind: "vbars",
          rows: sorted.map((x) => ({ label: x.r.label, value: x.v, role: x.r.focus ? "focus" : !whole || catKeys.has(x.r.key) ? "peer" : "other" })),
          average: avg === null ? null : { value: avg, label: avgLabel },
          unit: pts ? "average points" : "entries",
          yCaption: pts ? "Average points per entry" : `Entries (${m.phase === "ks5" ? "students" : "pupils"})`,
          keys: [
            { label: subject, role: "focus", mark: "swatch" },
            { label: whole ? `Other ${cat} subjects` : `Other ${cat} subjects`, role: "peer", mark: "swatch" },
            ...(whole ? [{ label: "Other subjects", role: "other" as Role, mark: "swatch" as const }] : []),
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
        ...peers.map((r, k) => ({ label: r.label, values: cut(sel(r)), role: "peer" as Role, shade: k, marker: MARKERS[k % MARKERS.length] })),
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
            ? `${trend! > 0.05 ? "Up" : trend! < -0.05 ? "Down" : "Level"} since ${years[fi]}: from ${fmtP(fs[fi]!)} to ${fmtP(fs[li]!)} average points.${unpublished.length ? ` ${unpublished.map((k) => years[k]).join(" and ")} had no published results.` : ""}`
            : `${trend! > 0 ? "Up" : trend! < 0 ? "Down" : "Level"} since ${years[fi]}, from ${fmtN(fs[fi]!)} to ${fmtN(fs[li]!)}.${peers.length ? ` The other ${cat} subjects are drawn beside it.` : ""}`;
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
          keys: [{ label: subject, role: "focus", mark: "line" }, ...peers.map((r, k) => ({ label: r.label, role: "peer" as Role, mark: "line" as const, shade: k, marker: MARKERS[k % MARKERS.length] })), ...(series.some((x) => x.role === "england") ? [{ label: "England", role: "england" as Role, mark: "line" as const }] : []), ...(unpublished.length ? [{ label: "No published figure", role: "focus" as Role, mark: "dash" as const }] : [])],
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
      const lines: { label: string; v: Series; role: Role }[] = [
        { label: m.school.name, v: sel(f), role: "focus" },
        { label: `${m.nearest.length - 1} nearest`, v: nearAvg, role: "nearest" },
        ...(m.area.la ? [{ label: m.area.la.name, v: sel(m.area.la), role: "la" as Role }] : []),
        ...(m.area.england ? [{ label: "England", v: sel(m.area.england), role: "england" as Role }] : []),
      ];
      // Entries are indexed (first shared year = 100) so growth compares whatever the size; points are actual.
      const shared = m.periods.findIndex((_, k) => lines.every((l) => l.v[k] !== null && l.v[k] !== 0));
      const idx = (v: Series) => (shared < 0 ? v.map(() => null) : v.map((x) => (x === null ? null : (x / (v[shared] as number)) * 100)));
      const shown = lines.map((l) => ({ ...l, v: pts ? l.v : idx(l.v) }));
      const { from, years } = span(m, shown.map((l) => l.v));
      const cut = (v: Series) => v.slice(from);
      const fs = cut(shown[0].v);
      const lastI = fs.length - 1;
      const growth = (v: Series) => (v[lastI] ?? null);
      const mine = growth(fs);
      const others = shown.slice(1).map((l) => ({ label: l.label, g: growth(cut(l.v)) })).filter((o) => o.g !== null) as { label: string; g: number }[];
      const answer =
        mine === null || !others.length
          ? `Not enough published years to compare ${subject} here with schools nearby and nationally.`
          : pts
            ? `${subject} here averaged ${fmtP(mine)} in ${years[lastI]}: ${others.map((o) => `${o.label} ${fmtP(o.g)}`).join(", ")}.`
            : others.every((o) => mine > o.g)
              ? `Yes and more: ${subject} entries have grown faster here than at the ${m.nearest.length - 1} nearest schools, in ${m.area.la?.name ?? "the LA"} or in England.`
              : others.every((o) => mine < o.g)
                ? `No: ${subject} entries have grown more slowly here than at the ${m.nearest.length - 1} nearest schools, in ${m.area.la?.name ?? "the LA"} and in England.`
                : `Partly: ${subject} entries here moved to ${fmtP(mine, 0)} (from 100), against ${others.map((o) => `${o.label} ${fmtP(o.g, 0)}`).join(", ")}.`;
      return {
        ...base,
        answer,
        title: pts ? `${subject} average points: this school, the ${m.nearest.length - 1} nearest, ${m.area.la?.name ?? "the LA"} and England` : `${subject} against the ${m.nearest.length - 1} nearest schools, its LA and England, year by year`,
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
          keys: shown.map((l) => ({ label: l.role === "focus" ? "This school" : l.role === "nearest" ? `${m.nearest.length - 1} nearest schools` : l.role === "la" ? "LA" : l.label, role: l.role, mark: "line" as const })),
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
          : `An average of ${fmtP(now)} per entry in ${latest}${before !== null ? `, ${now > before + 0.05 ? "up" : now < before - 0.05 ? "down" : "level"} from ${fmtP(before)}` : ""}${eng !== null ? `, and ${Math.abs(now - eng) < 0.05 ? "level with" : `${fmtP(Math.abs(now - eng))} ${now > eng ? "above" : "below"}`} England` : ""}.`;
      return {
        ...base,
        answer,
        title: `${subject} Results: ${latest}`,
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
      if (!g || !g.rows.length) return { ...base, answer: `No grades are published for ${subject} at this school yet.`, title: `${subject}'s grades`, note: "", chart: { kind: "none", reason: "No published grades.", keys: [] } };
      const total = g.rows.reduce((t, r) => t + r.count, 0);
      const rows = g.rows.map((r) => ({ grade: r.grade, count: r.count, share: total ? r.count / total : 0, england: g.englandShare?.[r.grade] ?? null }));
      const top = m.phase === "ks4" ? ["9", "8", "7"] : ["A*", "A"];
      const mineTop = rows.filter((r) => top.includes(r.grade)).reduce((t, r) => t + r.share, 0);
      const engTop = g.englandShare ? rows.filter((r) => top.includes(r.grade)).reduce((t, r) => t + (r.england ?? 0), 0) : null;
      const mode = [...rows].sort((a, b) => b.count - a.count)[0];
      const topWord = m.phase === "ks4" ? "a 7 or above" : "an A or A*";
      const answer = `${pupils(m, total)} in ${periodLabel(g.period)}; the most common grade was ${mode.grade}. ${Math.round(mineTop * 100)}% got ${topWord}${engTop !== null ? `, against ${Math.round(engTop * 100)}% across England` : ""}.${total < 10 ? " A small group: one pupil is a big share." : ""}`;
      return {
        ...base,
        answer,
        title: `${subject}'s grades: share of ${m.phase === "ks5" ? "students" : "pupils"} at each grade${g.englandShare ? ", against England" : ""}`,
        note: `${pupils(m, total)} in all. Bars: the share of this school's ${m.phase === "ks5" ? "students" : "pupils"} at each grade.${g.englandShare ? " Amber marks: England's share at the same grade." : " England's shares aren't published for this qualification."}`,
        chart: { kind: "grades", rows, total, keys: [{ label: "This school: % at each grade", role: "focus", mark: "swatch" }, ...(g.englandShare ? [{ label: "England: % at each grade", role: "england" as Role, mark: "tick" as const }] : [])] },
      };
    }
    // ---------------------------------------------------------------- nearby
    case "nearby-map": {
      const placed = m.nearest.filter((x) => x.easting !== null && x.northing !== null);
      const far = Math.max(0, ...m.nearest.map((x) => x.distanceKm ?? 0));
      const offering = m.nearest.filter((x) => !x.isTarget && real(x.entries).length > 0).length;
      return {
        ...base,
        answer: `The ${m.nearest.length - 1} nearest ${m.phase === "ks5" ? "sixth forms" : "schools"}, all within ${Math.ceil(far)} km; ${offering} of them published ${subject} entries.`,
        title: `${m.school.name} and the ${m.nearest.length - 1} nearest`,
        note: `The dashboard's default comparison: the ${m.nearest.length - 1} nearest ${m.phase === "ks5" ? "schools with a sixth form" : "schools"} by its own rules.${m.nearestNote ? ` ${m.nearestNote}` : ""} Positions on the national grid; no base map in the walk.`,
        chart: placed.length ? { kind: "map", points: placed.map((x) => ({ label: x.name, easting: x.easting!, northing: x.northing!, role: x.isTarget ? "focus" : "nearest", value: lastOf(x.entries) })), keys: [{ label: m.school.name, role: "focus", mark: "dot" }, { label: "The nearest schools", role: "nearest", mark: "dot" }] } : { kind: "none", reason: "No positions published for these schools.", keys: [] },
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
        : `${pts ? `${fmtP(me.v)} average points here` : `${pupils(m, me.v)} here`}: ${rank === 1 ? "the most" : `${ordinal(rank!)} of ${rows.length}`} among these schools${pts ? "" : ""}.${missing ? ` ${missing} ${missing === 1 ? "school publishes" : "schools publish"} no figure.` : ""}`;
      return {
        ...base,
        answer,
        title: `${subject} ${pts ? "average points" : "entries"} at each school, ${latest}`,
        note: `The school and the ${m.nearest.length - 1} nearest; a school with no published figure is left out.${pts ? " Average points per entry, the same qualification only." : ""}`,
        chart: { kind: "hbars", rows: rows.map((r) => ({ label: r.x.name, value: r.v, role: r.x.isTarget ? "focus" : "nearest" })), unit: pts ? "average points" : "entries", digits: pts ? 1 : 0, keys: [{ label: m.school.name, role: "focus", mark: "swatch" }, { label: "The nearest schools", role: "nearest", mark: "swatch" }] },
      };
    }
    case "nearby-rank": {
      const rows = m.nearest.map((x) => ({ x, v: lastOf(x.points) })).filter((r) => r.v !== null) as { x: (typeof m.nearest)[number]; v: number }[];
      const ranked = rows.map((r) => ({ ...r, rank: 1 + rows.filter((o) => o.v > r.v).length })).sort((a, b) => a.rank - b.rank);
      const me = ranked.find((r) => r.x.isTarget);
      return {
        ...base,
        answer: me ? `${ordinal(me.rank)} of ${ranked.length} on average points in ${subject}, ${latest}.${ranked.length < m.nearest.length ? ` ${m.nearest.length - ranked.length} of the schools publish no figure.` : ""}` : `${m.school.name} has no published average points in ${subject} for ${latest}, so it isn't ranked.`,
        title: `${subject}: the school and its nearest ranked, ${latest}`,
        note: "Ranked on average points per entry, highest first; schools with the same figure share a place.",
        chart: { kind: "ranking", rows: ranked.map((r) => ({ rank: r.rank, label: r.x.name, value: r.v, role: r.x.isTarget ? "focus" : "nearest", distanceKm: r.x.distanceKm })), unit: "average points", digits: 1, keys: [{ label: m.school.name, role: "focus", mark: "swatch" }] },
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
      const r = real(rs);
      const answer = r.length < 2 ? `Not enough years with results to see ${subject}'s place change.` : `${rs[rs.length - 1]! < r[0] ? "Up" : rs[rs.length - 1]! > r[0] ? "Down" : "The same"}: ${ordinal(r[0])} in ${years[rs.findIndex((v) => v !== null)]}, ${ordinal(rs[rs.length - 1] ?? r[r.length - 1])} in ${years[years.length - 1]}.`;
      return {
        ...base,
        answer,
        title: `${subject}: the school's place among its nearest, year by year`,
        note: "1st is the highest average points among the school and its nearest that year; the table has how many had a figure each year.",
        chart: { kind: "lines", years, series: [{ label: "Our place", values: rs, role: "focus" }], unpublished: [], yCaption: "Place (1st = highest)", extraRows: [{ label: "Schools with a figure", values: of.slice(from) }], keys: [{ label: "Our place", role: "focus", mark: "line" }], digits: 0 },
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
    .map((r) => ({ label: r.label, first: r.entries[firstIdx] as number, latest: r.entries[lastIdx] as number, role: (r.focus ? "focus" : catKeys.has(r.key) ? "peer" : "other") as Role }))
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
    ? `${subject} has no entries in both ${fy} and ${ly}.`
    : `${me.latest - me.first === 0 ? `${subject} is level since ${fy}` : `${subject} ${me.latest > me.first ? "grew" : "fell"} by ${pupils(m, Math.abs(me.latest - me.first))} since ${fy}`}${top.r === me && top.c > 0 ? ", more than any other subject" : top.c > 0 ? `; ${top.r.label} grew most (${signed(top.c)})` : ""}${bottom.c < 0 && bottom.r !== me ? `; ${bottom.r.label} fell most (${signed(bottom.c)})` : ""}.`;
  return {
    ...base,
    answer,
    title: `Entries by subject in the whole school, ${fy} and ${ly}, largest first`,
    note: `Ordered by this year's entries. Ring: ${fy}; dot: ${ly}. Change in ${m.phase === "ks5" ? "students" : "pupils"}; ▲ / ▼ show direction, so colour is free to mean the subject area. A proposed view for the dashboard's Context › Trends rail.`,
    chart: {
      kind: "dumbbell",
      rows: d.rows,
      firstYear: fy,
      latestYear: ly,
      keys: [
        { label: subject, role: "focus", mark: "swatch" },
        { label: `Other ${cat} subjects`, role: "peer", mark: "swatch" },
        { label: "Other subjects", role: "other", mark: "swatch" },
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
