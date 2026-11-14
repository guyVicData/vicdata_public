// VicData 0.8 front door (B12, B13; Guy, 13 Nov): head office's walks, one written answer per group view,
// from the group dashboard route's own answer (the same figures the view draws). Honest about missing
// figures: a sentence never invents a number, and says so when there isn't one.
import { periodLabel } from "@/catalogue/years";
import { indexTo } from "@/lib/index-base";
import { MEASURE_LABEL, type GroupOverview, type GroupSchools } from "@/lib/groups/dash";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import { groupWalkDash } from "./walks";
import { groupAcademicHeadline, groupFig } from "./tile-figures";

/** The parts of the group dashboard route's answer the sentences read (DashResponse, structurally). */
export type GroupAnswerData = {
  overview?: GroupOverview;
  now?: GroupOverview;
  schools?: GroupSchools;
  academic?: GroupAcademic;
  pupils?: GroupPupils;
  map?: { urn: string; outside: boolean; easting: number | null; northing: number | null }[];
};
export type ProjectionLite = { urn: string; name: string; now: number | null; end: number | null; endYear: number | null; pct: number | null };

const n = (v: number) => Math.round(v).toLocaleString("en-GB");
const pctWords = (v: number, d = 1) => (Math.abs(v) < 0.5 * 10 ** -d ? "level" : `${v > 0 ? "up" : "down"} ${Math.abs(v).toFixed(d)}%`);
const fig = groupFig;
const plural = (k: number, one: string, many = `${one}s`) => `${n(k)} ${k === 1 ? one : many}`;
const lastOf = <T extends { value: number | null }>(pts: T[]) => [...pts].reverse().find((p) => p.value !== null) ?? null;
const firstOf = <T extends { value: number | null }>(pts: T[]) => pts.find((p) => p.value !== null) ?? null;

export function groupAnswer(view: string, d: GroupAnswerData, projection: ProjectionLite[] | null): string {
  const o = (groupWalkDash(view) === "schools" ? d.now : d.overview) ?? d.overview ?? d.now;
  if (!o) return "No figures for this view yet.";
  const g = o.group.name;
  const census = periodLabel(o.years.census);
  const ch3 = o.now.change["3"];
  switch (view) {
    case "GRP-O-NOW":
    case "GRP-S-NOW":
      return `${g}: ${plural(o.now.schools, "school")} and ${n(o.now.roll)} pupils in ${census}${ch3.sameSchools !== null ? `; the roll is ${pctWords(ch3.sameSchools)} over 3 years, like for like` : ""}.`;
    case "GRP-O-AGAINST": {
      const sb = o.sideBySide;
      const ours = o.against.rows[0];
      if (sb) {
        const us = sb.rows.find((r) => r.ours) ?? null;
        const others = sb.rows.length - 1;
        if (us?.roll.pct == null) return `${g} side by side with ${o.picker.name} (${plural(others, "group")}), and the set's median.`;
        return `Over ${us.roll.years} years ${g}'s roll is ${pctWords(us.roll.pct)}; the median of the set (${o.picker.name}) is ${sb.median.roll !== null ? pctWords(sb.median.roll) : "not available"}, ${sb.median.n} of ${others} groups with a figure.`;
      }
      if (ours?.roll.pct == null) return `${g} against ${o.compare.label}.`;
      return `Over ${ours.roll.years} years ${g}'s roll is ${pctWords(ours.roll.pct)}, against ${o.compare.label}.`;
    }
    case "GRP-O-MAP": {
      const mapped = (d.map ?? []).filter((s) => !s.outside && s.easting !== null && s.northing !== null).length;
      const top = [...o.now.las].sort((a, b) => b.n - a.n)[0];
      return `${plural(mapped, "school")} on the map, in ${plural(o.now.las.length, "local authority", "local authorities")}${top && top.n > 1 ? `; the most in ${top.name} (${top.n})` : ""}.`;
    }
    case "GRP-O-ROLL":
    case "GRP-P-ROLL": {
      // The chart's own line: each year's like-for-like change chained from the first shared year = 100.
      const { base, out } = indexTo(o.trends.roll.lines.map((l) => l.pts));
      const last = out[0] ? lastOf(out[0]) : null;
      if (base === null || !last || last.year === base) return `The combined roll, like for like, against ${o.compare.label}.`;
      return `Like for like, the combined roll is ${pctWords(last.value! - 100)} since ${periodLabel(base)}${ch3.sameSchools !== null ? `, and ${pctWords(ch3.sameSchools)} over the last 3 years` : ""}.`;
    }
    case "GRP-O-RESULTS":
    case "GRP-A-TREND": {
      const r = o.trends.results.find((x) => x.lines[0] && lastOf(x.lines[0].pts)) ?? null;
      if (!r) return "No results published for the group's schools yet.";
      const a = firstOf(r.lines[0].pts)!;
      const b = lastOf(r.lines[0].pts)!;
      return a.year === b.year
        ? `${r.label}: ${fig(b.value!, r.unit)} in ${periodLabel(b.year)}, the only year published.`
        : `${r.label}: ${fig(b.value!, r.unit)} in ${periodLabel(b.year)}, from ${fig(a.value!, r.unit)} in ${periodLabel(a.year)}.`;
    }
    case "GRP-O-SHARE": {
      const s = o.trends.share;
      return s.pct === null ? "No share of places for the group's areas yet." : `${g} holds ${s.pct.toFixed(1)}% of the places in its areas${s.sector === "independent" ? " (independent schools)" : ""}.`;
    }
    case "GRP-S-TABLE": {
      const s = d.schools;
      if (!s) return "Every member school, sortable.";
      return `${plural(s.counts.listed, "school")} listed; ${n(s.counts.withHeadline)} with a published headline figure${s.counts.withoutHeadline ? `, ${n(s.counts.withoutHeadline)} without (each says why)` : ""}.`;
    }
    case "GRP-S-GROWING":
      return ch3.of ? `${ch3.growing} of ${ch3.of} schools grew over 3 years; ${ch3.shrinking} shrank.` : "Not enough census years to say which schools are growing.";
    case "GRP-S-SCATTER": {
      const s = d.schools;
      const both = s ? s.rows.filter((r) => r.roll !== null && r.headline).length : 0;
      return both ? `Each school's roll against its headline result: ${plural(both, "school")} with both.` : "No school has both a roll and a published headline yet.";
    }
    case "GRP-S-SHAPES": {
      const s = d.schools;
      const counts = new Map<string, number>();
      for (const r of s?.rows ?? []) if (r.shape) counts.set(r.shape, (counts.get(r.shape) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return top ? `The most common shape is ${top[0].toLowerCase()} (${plural(top[1], "school")}).` : "Each school drawn by age.";
    }
  }
  const a = d.academic;
  const p = d.pupils;
  switch (view) {
    case "GRP-A-NOW": {
      // The same headline the home's Academic tile shows (tile-figures.ts, front door 2b), so the two agree.
      const hd = groupAcademicHeadline(a);
      if (!hd) return "No results published for the group's schools yet.";
      const { headline: h, measure: m, unit } = hd;
      const withFig = m.group?.n_with_figure;
      return `${m.label}: ${fig(hd.group, unit)} across ${withFig && withFig < h.inPhase ? `the ${withFig} of the group's ${h.inPhase} schools with a published figure` : `the group's ${plural(h.inPhase, "school")}`} in ${h.year !== null ? periodLabel(h.year) : "the latest year"}${hd.england !== null ? `; England ${fig(hd.england, unit)}` : ""}.`;
    }
    case "GRP-A-RANKED": {
      if (!a) return "Each school against the group and England.";
      const rows = a.ranked.rows.filter((r) => r.value !== null).sort((x, y) => y.value! - x.value!);
      if (!rows.length) return "No school has a published figure to rank yet.";
      return `${plural(rows.length, "school")} ranked on ${MEASURE_LABEL[a.ranked.measure] ?? a.ranked.measure}; ${rows[0].name} leads.`;
    }
    case "GRP-A-AREAS": {
      if (!a || !a.areas.rows.length) return "Too few entries to compare subject areas yet.";
      return a.areas.strengths.length
        ? `Furthest above England: ${a.areas.strengths.slice(0, 2).join(" and ")}${a.areas.weaknesses.length ? `; furthest below: ${a.areas.weaknesses[0]}` : ""}.`
        : `${plural(a.areas.rows.length, "subject area")} against England${a.areas.weaknesses.length ? `; furthest below: ${a.areas.weaknesses[0]}` : ""}.`;
    }
    case "GRP-A-IMPROVING": {
      const i = a?.improving;
      if (!i || !i.of) return "Not enough published years to say which schools are improving.";
      return `${i.improved} of ${i.of} schools improved on ${MEASURE_LABEL[i.measure] ?? i.measure} since ${periodLabel(i.from)}; ${i.fell} fell and ${i.steady} held steady.`;
    }
    case "GRP-P-NOW": {
      if (!p) return `${n(o.now.roll)} pupils in ${census}.`;
      const parts = (["primary", "secondary", "post16"] as const).filter((k) => p.rollByPhase[k] > 0).map((k) => `${n(p.rollByPhase[k])} ${k === "post16" ? "in the sixth form" : k}`);
      return `${n(o.now.roll)} pupils in ${census}${parts.length > 1 ? `, among them ${parts.join(", ")}` : ""}.`;
    }
    case "GRP-P-SHAPE": {
      if (!p) return "The group's pupils by age.";
      const now = p.shape.ages.reduce((s, x) => s + x, 0);
      const then = p.shape.firstAges.reduce((s, x) => s + x, 0);
      return then > 0 && p.shape.first !== p.shape.year ? `${n(now)} pupils by age in ${periodLabel(p.shape.year)}, against ${n(then)} in ${periodLabel(p.shape.first)}.` : `${n(now)} pupils by age in ${periodLabel(p.shape.year)}.`;
    }
    case "GRP-P-GROWING": {
      const gr = p?.growing;
      return gr && gr.of ? `${gr.growing} of ${gr.of} schools grew from ${periodLabel(gr.from)} to ${periodLabel(gr.to)}; ${gr.shrinking} shrank.` : "Not enough census years to say which schools are growing.";
    }
    case "GRP-P-PROJECTION": {
      const rows = (projection ?? []).filter((r) => r.pct !== null);
      if (!rows.length) return "Children living around each school, from the area's births and projections: not a forecast.";
      const up = rows.filter((r) => r.pct! > 0).length;
      return `Around ${up} of ${rows.length} schools the number of children is projected to rise; around ${rows.length - up}, to fall or hold (not a forecast).`;
    }
  }
  return "";
}
