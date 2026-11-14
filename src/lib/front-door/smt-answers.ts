// VicData 0.8 review fixes (14 Nov, M1 and M3): SMT's walk answers, one per view, from the SMT routes'
// own answers (overview, academic, pupils, context) -- the figures each view draws. Every screen answers
// its own question with a figure; no fixed caption stands in for an answer (R-WALK-WORDS). Pure.
import { CENSUS_FIRST_PERIOD, periodLabel } from "@/catalogue/years";
import type { Overview, ScoreRow } from "@/lib/smt/overview";
import type { Academic } from "@/lib/smt/academic";
import type { Pupils } from "@/lib/smt/pupils";
import type { Context } from "@/lib/smt/context";
import { fmt } from "@/components/smt/ui";
import { gradingCaveat, listJoin, num, pctWords, placeOf, plural, possessive } from "./words";

type Pt = { year: number; value: number | null };
const lastPt = (pts: Pt[]) => [...pts].reverse().find((p) => p.value !== null) ?? null;
const firstPt = (pts: Pt[]) => pts.find((p) => p.value !== null) ?? null;
const n = (v: number | null | undefined) => (v === null || v === undefined ? "—" : num(v));
/** A results figure in its own unit, as the dashboards print it (SMT's fmt). */
const fig = (v: number | null | undefined, unit: string, key?: string) => fmt(v ?? null, (unit === "entries" ? "pupils" : unit) as never, key);
const trendWord = (a: number, b: number, flat: number) => (b - a > flat ? "up" : b - a < -flat ? "down" : "level");
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "the 10 nearest" for a set named by a count; a set's own name as it is. */
const theSet = (label: string) => (/^\d/.test(label) ? `the ${label}` : label);
/** A measure in mid-sentence: "points per entry", but "Attainment 8" keeps its capital. */
const measureWord = (m: string) => (/^(Points|Share|Value|Average|Entries|Grade)/.test(m) ? m.charAt(0).toLowerCase() + m.slice(1) : m);

/** The headline row SMT ranks best against the set: the lowest rank as a share of the set. */
export function strongestRow(o: Overview): ScoreRow | null {
  const ranked = o.rows.filter((r) => r.set && r.value !== null);
  return [...ranked].sort((x, y) => x.set!.rank / x.set!.of - y.set!.rank / y.set!.of)[0] ?? null;
}

/** The largest year group by pupils (it was sorted on a field YearGroup doesn't have, so always the first). */
export function largestYearGroup(p: Pupils): Pupils["shape"]["yearGroups"][number] | null {
  return [...p.shape.yearGroups].sort((x, y) => y.total - x.total)[0] ?? null;
}

export function smtAnswer(view: string, school: { name: string }, data: unknown): string {
  const name = school.name;
  switch (view) {
    case "DV-SMT-O-NOW": {
      const o = data as Overview;
      if (o.now.roll === null) return "No census roll is published for the school yet.";
      return `${n(o.now.roll)} pupils in the ${o.now.census ? periodLabel(o.now.census) : "latest"} census${o.now.changePct !== null ? `, ${pctWords(o.now.changePct)} since ${periodLabel(o.now.base.period)}` : ""}.`;
    }
    case "DV-SMT-O-SCORECARD": {
      const o = data as Overview;
      const ranked = o.rows.filter((r) => r.set && r.value !== null);
      const best = strongestRow(o);
      if (!best) return `No headline is ranked against ${o.set.label} yet.`;
      return `Strongest against ${theSet(o.set.label)}: ${best.label}, ${placeOf(best.set!.rank, best.set!.of)}. ${plural(ranked.length, "headline is", "headlines are")} ranked.`;
    }
    case "DV-SMT-O-ROLL-LINE": {
      const o = data as Overview;
      const line = o.trends.roll.lines[0];
      const f = line ? firstPt(line.actual) : null;
      const l = line ? lastPt(line.actual) : null;
      if (!f || !l || f.year === l.year) return "Not enough census years to see a trend.";
      const pct = f.value ? ((l.value! - f.value) / f.value) * 100 : null;
      return `${cap(l.value! > f.value! ? "grown" : l.value! < f.value! ? "shrunk" : "held level")}: from ${n(f.value)} in ${periodLabel(f.year)} to ${n(l.value)} in ${periodLabel(l.year)}${pct !== null ? ` (${pctWords(pct)})` : ""}.`;
    }
    case "DV-SMT-O-RESULTS-LINE": {
      const o = data as Overview;
      const t = o.trends.results[0];
      const f = t ? firstPt(t.school) : null;
      const l = t ? lastPt(t.school) : null;
      if (!t || !f || !l || f.year === l.year) return "Not enough published years of headline results to see a trend.";
      const unit = t.label.includes("Progress") ? "va" : "points";
      const dir = trendWord(f.value!, l.value!, 0.05);
      return `${t.label} is ${dir}, from ${fig(f.value, unit)} in ${periodLabel(f.year)} to ${fig(l.value, unit)} in ${periodLabel(l.year)}.${gradingCaveat(f.year)}`;
    }
    case "DV-SMT-O-MARKET-LINE": {
      const o = data as Overview;
      const m = o.trends.market;
      // The market figure is Admissions' 11+ share (marketAt11): a school with no 11+ entry has its reason.
      if (m.status === "empty") return m.reason.endsWith(".") ? m.reason : `${m.reason}.`;
      const f = firstPt(m.school);
      const l = lastPt(m.school);
      if (!f || !l) return "No market share at 11+ is published for the school yet.";
      if (f.year === l.year) return `${l.value!.toFixed(1)}% of the 11+ pupils at the school and its rivals joined it in ${periodLabel(l.year)}.`;
      const ch = l.value! - f.value!;
      return `${Math.abs(ch) < 0.05 ? "Holding level" : ch > 0 ? "Yes" : "No"}: the school's share at 11+ ${Math.abs(ch) < 0.05 ? "stayed at" : `went from ${f.value!.toFixed(1)}% in ${periodLabel(f.year)} to`} ${l.value!.toFixed(1)}% in ${periodLabel(l.year)}${m.rivalName ? `; its largest rival is ${m.rivalName}` : ""}.`;
    }
    case "DV-SMT-O-FLAGS": {
      const o = data as Overview;
      if (!o.flags.length) return "No large and lasting changes flagged.";
      const first = o.flags[0] as { label?: string };
      return `${plural(o.flags.length, "large and lasting change")} flagged${first.label ? `, among them: ${first.label.charAt(0).toLowerCase()}${first.label.slice(1)}` : ""}.`;
    }
    case "DV-SMT-A-NOW": {
      const a = data as Academic;
      if (!a.col1.summary.length) {
        // No summary row (Post-16): the view's own lines, the first three with a figure.
        const ls = a.lines.filter((x) => x.value !== null).slice(0, 3);
        if (!ls.length) return a.col1.note ?? `No ${a.col1.sub.split(" · ")[0]} results are published for the school yet.`;
        return `${a.col1.sub.split(" · ").slice(0, 2).join(", ")}: ${listJoin(ls.map((x) => `${x.label} ${fig(x.value, x.unit)}`))}.`;
      }
      return `${a.col1.title} (${a.col1.sub}): ${listJoin(a.col1.summary.slice(0, 3).map((x) => `${x.label} ${x.value}`))}.`;
    }
    case "DV-SMT-A-CHART": {
      const a = data as Academic;
      const b = a.board;
      const me = b.rows.find((r) => r.you);
      const ranked = b.rows.filter((r) => r.value !== null);
      if (b.empty || !me || me.value === null || !b.place.set) return b.empty ?? `The school has no ${measureWord(b.measure)} to rank against ${theSet(a.set.pill)} yet.`;
      return `${placeOf(b.place.set.rank, b.place.set.of)} against ${theSet(a.set.pill)} on ${measureWord(b.measure)} (${fig(me.value, b.unit)}${b.period ? `, ${periodLabel(b.period)}` : ""})${b.median !== null ? `; the set's median is ${fig(b.median, b.unit)}` : ""}.`.replace(/ of (\d+) against/, ` of ${ranked.length} against`);
    }
    case "DV-SMT-A-AREAS": {
      const a = data as Academic;
      const subs = a.areas.blocks.flatMap((bl) => bl.quals.flatMap((q) => q.subjects.map((s) => ({ ...s, area: bl.label }))));
      if (!subs.length) return a.areas.none ?? "No subject areas with a figure yet.";
      const above = subs.filter((s) => s.band && /above/i.test(String(s.band)));
      const below = subs.filter((s) => s.band && /below/i.test(String(s.band)));
      const areasOf = (xs: typeof subs) => Array.from(new Set(xs.map((s) => s.area)));
      if (!above.length && !below.length) return `${plural(a.areas.blocks.length, "subject area")}${a.areas.period ? ` in ${periodLabel(a.areas.period)}` : ""}; no subject is clearly above or below the set.`;
      return `${above.length ? `Leading: ${listJoin(areasOf(above).slice(0, 2))} (${plural(above.length, "subject")} above)` : "No subject is clearly above"}; ${below.length ? `trailing: ${listJoin(areasOf(below).slice(0, 2))} (${plural(below.length, "subject")} below)` : "none clearly below"}${a.areas.period ? `, ${periodLabel(a.areas.period)}` : ""}.`;
    }
    case "DV-SMT-A-GRADES": {
      const a = data as Academic;
      const g = [...a.grades].sort((x, y) => y.entries - x.entries)[0];
      if (!g) return "No grades are published for the school's qualifications yet.";
      return g.top ? `In ${g.short}, ${Math.round(g.top.pct)}% of the ${plural(g.entries, "entry", "entries")} got ${g.top.label}${a.period ? ` in ${periodLabel(a.period)}` : ""}${a.grades.length > 1 ? `; ${plural(a.grades.length - 1, "other qualification")} below` : ""}.` : `${g.short}: ${plural(g.entries, "entry", "entries")}, spread across ${plural(g.bands.length, "band")}.`;
    }
    case "DV-SMT-A-TREND-LINE": {
      const a = data as Academic;
      const f = firstPt(a.trends.school);
      const l = lastPt(a.trends.school);
      if (!f || !l || f.year === l.year) return "Not enough published years to see a trend.";
      return `${a.trends.label} is ${trendWord(f.value!, l.value!, a.trends.unit === "va" ? 0.02 : 0.05)}, from ${fig(f.value, a.trends.unit)} in ${periodLabel(f.year)} to ${fig(l.value, a.trends.unit)} in ${periodLabel(l.year)}, against the set's middle half.${a.trends.unit === "va" ? "" : gradingCaveat(f.year)}`;
    }
    case "DV-SMT-A-LINES": {
      const a = data as Academic;
      const moved = a.trends.lines.filter((x) => x.from !== null && x.to !== null && x.from !== 0).map((x) => ({ x, rel: (x.to! - x.from!) / Math.abs(x.from!) }));
      if (!moved.length) return "No line has figures for both last year and this year yet.";
      const up = [...moved].sort((p, q) => q.rel - p.rel)[0];
      const down = [...moved].sort((p, q) => p.rel - q.rel)[0];
      const w = (m: (typeof moved)[number]) => `${m.x.label} (${fig(m.x.from, m.x.unit)} to ${fig(m.x.to, m.x.unit)})`;
      const ups = moved.filter((m) => m.rel > 0).length;
      return `${up.rel > 0 ? `Up most: ${w(up)}` : "Nothing rose"}${down.rel < 0 ? `; down most: ${w(down)}` : ""}. ${ups} of ${moved.length} lines rose since last year.`;
    }
    case "DV-SMT-P-NOW": {
      const p = data as Pupils;
      if (p.now.roll === null) return "No census roll is published for the school yet.";
      return `${n(p.now.roll)} pupils${p.now.census ? ` in ${periodLabel(p.now.census)}` : ""}${p.now.changePct !== null ? `, ${pctWords(p.now.changePct)} since ${periodLabel(CENSUS_FIRST_PERIOD)}` : ""}${p.now.mainBand ? `; the main band is ${p.now.mainBand}` : ""}.`;
    }
    case "DV-SMT-P-SHAPE": {
      const p = data as Pupils;
      const big = largestYearGroup(p);
      const shape = p.shape.label ? `The school's shape is ${p.shape.label.toLowerCase()}${p.shape.sinceYear ? ` (since ${periodLabel(p.shape.sinceYear)})` : ""}.` : "";
      return `${shape}${big ? ` Its largest year group is ${big.label}, with ${n(big.total)} pupils.` : " No year groups are published yet."}`.trim();
    }
    case "DV-SMT-P-ENTRIES": {
      const p = data as Pupils;
      if (p.entries.status !== "ready") return p.entries.status === "empty" ? p.entries.reason : "No entry points.";
      const rows = p.entries.rows;
      if (!rows.length) return "No entry points.";
      return `${listJoin(rows.map((r) => `${n(r.cohort)} at ${r.label}${r.pool !== null ? ` from a pool of ${n(r.pool)}` : ""}`))}.`.replace(/^./, (c) => c.toUpperCase());
    }
    case "DV-SMT-P-LEAVING": {
      const p = data as Pupils;
      const l = p.leaving[p.leaving.length - 1];
      if (!l || l.stayingPct === null) return "No Year 11 to Year 12 figures yet.";
      return `${Math.round(l.stayingPct)}% stayed on into Year 12 in ${periodLabel(l.year)}${l.leaving !== null ? (l.leaving >= 0 ? `; ${n(l.leaving)} left at 16 (net)` : `; ${n(-l.leaving)} more joined at 16 than left (net)`) : ""}.`;
    }
    case "DV-SMT-P-PHASES": {
      const p = data as Pupils;
      const parts = p.trends.phases.map((ph) => ({ ph, f: firstPt(ph.actual), l: lastPt(ph.actual) })).filter((x) => x.f && x.l && x.f.year !== x.l.year && x.f.value);
      if (!parts.length) return "Not enough census years to compare the phases.";
      const word = (x: (typeof parts)[number]) => `${x.ph.label} ${pctWords(((x.l!.value! - x.f!.value!) / x.f!.value!) * 100)}`;
      return `Since ${periodLabel(parts[0].f!.year)}: ${listJoin(parts.map(word))}.`;
    }
    case "DV-SMT-P-AREA": {
      const p = data as Pupils;
      const ar = p.trends.area;
      const f = firstPt(ar.pts);
      const l = lastPt(ar.pts);
      const who = `${possessive(ar.laName ?? "the LA")} residents aged ${ar.agesWord}`;
      if (!f || !l || f.year === l.year) return `${cap(who)}: not enough years yet.`;
      return `${cap(who)} have ${l.value! > f.value! ? "grown" : l.value! < f.value! ? "fallen" : "held level"}: ${n(f.value)} in ${f.year}, ${n(l.value)} in ${l.year}${f.value ? ` (${pctWords(((l.value! - f.value) / f.value) * 100)})` : ""}.`;
    }
    case "DV-SMT-C-NOW": {
      const c = data as Context;
      const ch = c.now.children;
      if (ch.value === null) return "No residents' figure for the area yet.";
      return `${n(ch.value)} children aged ${c.agesWord} ${/^(living|in|within)\b/.test(ch.scope) ? "" : "live "}${ch.scope}${ch.since ? `, ${pctWords(ch.since.changePct)} since ${ch.since.from}` : ""}.`;
    }
    case "DV-SMT-C-MAP": {
      const c = data as Context;
      return c.now.mix ? `${cap(c.now.mix.line)}${/[.]$/.test(c.now.mix.line) ? "" : "."}` : `${plural(c.now.schools.count, `${c.now.schools.phaseWord} school`)} ${c.now.schools.scope}.`;
    }
    case "DV-SMT-C-BYAGE": {
      const c = data as Context;
      const ages = c.byAge.ages.filter((x) => x.age >= c.ages[0] && x.age <= c.ages[1]);
      if (!ages.length) return "No residents by age for the area yet.";
      const top = [...ages].sort((x, y) => y.value - x.value)[0];
      const low = [...ages].sort((x, y) => x.value - y.value)[0];
      return `The largest age is ${top.age}, with ${n(top.value)} children; the smallest is ${low.age}, with ${n(low.value)}${c.byAge.period ? ` (${c.byAge.period})` : ""}.`;
    }
    case "DV-SMT-C-BIRTHS": {
      const c = data as Context;
      const b = c.now.births;
      return b ? `${n(b.value)} births in ${b.year}${b.since ? `, ${pctWords(b.since.changePct)} since ${b.since.from}` : ""}.` : "No births figure for the area yet.";
    }
    case "DV-SMT-C-NEARBY": {
      const c = data as Context;
      const pr = c.now.projection;
      return pr ? `Children aged ${pr.agesWord} are projected to be ${pctWords(pr.changePct)} from ${pr.from} to ${pr.to} (ONS-based projections, not a forecast).` : "No projection for the area.";
    }
  }
  return `See ${possessive(name)} dashboard for this view.`;
}
