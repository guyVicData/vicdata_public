// VicData 0.8 front door (B12, B13; Guy, 13 Nov): head office's walks, one written answer per group view,
// from the group dashboard route's own answer (the same figures the view draws). Honest about missing
// figures: a sentence never invents a number, and says so when there isn't one.
import { periodLabel } from "@/catalogue/years";
import { indexTo } from "@/lib/index-base";
import { MEASURE_LABEL, type GroupOverview, type GroupSchools } from "@/lib/groups/dash";
import type { GroupAcademic, GroupPupils } from "@/lib/groups/dash-r3";
import { groupWalkDash } from "./walks";
import { groupAcademicHeadline, groupFig } from "./tile-figures";
import { changedWords, gradingCaveat, listJoin, plural, possessive } from "./words";

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
const fig = groupFig;
const PHASE_WORD: Record<string, string> = { primary: "primary", secondary: "secondary", post16: "sixth-form" };
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
      // One school count per walk (R-WALK-WORDS): the schools counted in the group's census figures.
      return `${g}: ${plural(o.now.schools, "school")} counted and ${n(o.now.roll)} pupils in ${census}${ch3.sameSchools !== null ? `; like for like, the roll has ${changedWords(ch3.sameSchools, 1)} over 3 years` : ""}.`;
    case "GRP-O-AGAINST": {
      const sb = o.sideBySide;
      const ours = o.against.rows[0];
      if (sb) {
        const us = sb.rows.find((r) => r.ours) ?? null;
        const others = sb.rows.length - 1;
        if (us?.roll.pct == null) return `${g} side by side with ${o.picker.name} (${plural(others, "group")}) and the set's median.`;
        const have = sb.median.n === others ? `all ${plural(others, "group")} have a figure` : `${sb.median.n} of the ${plural(others, "group")} have a figure`;
        return `${possessive(g)} roll has ${changedWords(us.roll.pct, 1)} over ${us.roll.years} years; the median of the set (${o.picker.name}) has ${sb.median.roll !== null ? changedWords(sb.median.roll, 1) : "no figure"} (${have}).`;
      }
      if (ours?.roll.pct == null) return `${g} against ${o.compare.label}.`;
      return `${possessive(g)} roll has ${changedWords(ours.roll.pct, 1)} over ${ours.roll.years} years, against ${o.compare.label}.`;
    }
    case "GRP-O-MAP": {
      const mapped = (d.map ?? []).filter((s) => !s.outside && s.easting !== null && s.northing !== null).length;
      const top = [...o.now.las].sort((a, b) => b.n - a.n)[0];
      // The map draws every member school, the census figures count fewer: say so, so the counts agree.
      const diff = mapped - o.now.schools;
      return `${plural(mapped, "member school")} on the map, in ${plural(o.now.las.length, "local authority", "local authorities")}${top && top.n > 1 ? `, the most in ${top.name} (${top.n})` : ""}${diff > 0 ? `; ${o.now.schools} of them are counted in the ${census} figures` : diff < 0 ? `; ${-diff} of the ${o.now.schools} schools counted in the ${census} figures ${diff === -1 ? "has" : "have"} no position to map` : ""}.`;
    }
    case "GRP-O-ROLL":
    case "GRP-P-ROLL": {
      // The chart's own line: each year's like-for-like change chained from the first shared year = 100.
      const { base, out } = indexTo(o.trends.roll.lines.map((l) => l.pts));
      const last = out[0] ? lastOf(out[0]) : null;
      if (base === null || !last || last.year === base) return `The combined roll, like for like, against ${o.compare.label}.`;
      return `Like for like, the combined roll has ${changedWords(last.value! - 100, 1)} since ${periodLabel(base)}${ch3.sameSchools !== null ? `, and ${changedWords(ch3.sameSchools, 1)} over the last 3 years` : ""}.`;
    }
    case "GRP-O-RESULTS":
    case "GRP-A-TREND": {
      const r = o.trends.results.find((x) => x.lines[0] && lastOf(x.lines[0].pts)) ?? null;
      if (!r) return "No results published for the group's schools yet.";
      const a = firstOf(r.lines[0].pts)!;
      const b = lastOf(r.lines[0].pts)!;
      if (a.year === b.year) return `${r.label}: ${fig(b.value!, r.unit)} in ${periodLabel(b.year)}, the only year published.`;
      const d = b.value! - a.value!;
      const dir = Math.abs(d) < (r.unit === "pct" ? 0.5 : 0.05) ? "level" : d > 0 ? "up" : "down";
      return `${r.label} is ${dir}, from ${fig(a.value!, r.unit)} in ${periodLabel(a.year)} to ${fig(b.value!, r.unit)} in ${periodLabel(b.year)}.${gradingCaveat(a.year)}`;
    }
    case "GRP-O-SHARE": {
      const s = o.trends.share;
      return s.pct === null ? "No share of places for the group's areas yet." : `${g} holds ${s.pct.toFixed(1)}% of the places in its areas${s.sector === "independent" ? " (independent schools)" : ""}.`;
    }
    case "GRP-S-TABLE": {
      const s = d.schools;
      if (!s) return "Every member school, sortable.";
      const diff = s.counts.listed - o.now.schools;
      return `${plural(s.counts.listed, "member school")} listed${diff > 0 ? ` (${o.now.schools} counted in the ${census} figures)` : ""}; ${s.counts.withHeadline ? n(s.counts.withHeadline) : "none"} with a published headline figure${s.counts.withoutHeadline ? `, ${n(s.counts.withoutHeadline)} without (each says why)` : ""}.`;
    }
    case "GRP-S-GROWING":
      return ch3.of ? `${ch3.growing === ch3.of ? `All ${plural(ch3.of, "school")}` : `${ch3.growing} of the ${plural(ch3.of, "school")}`} with 3 years of rolls grew; ${ch3.shrinking ? `${ch3.shrinking} shrank` : "none shrank"}.` : "Not enough census years to say which schools are growing.";
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
  // A special and AP trust or nursery federation publishes no results (R-NM-NO-RESULTS): every results screen says so.
  if (o.nm && view.startsWith("GRP-A-")) return `No results are compared for ${g}: its schools are ${o.nm.family === "nursery" ? "nursery schools" : "special, AP and PRU schools"}, and DfE's results tables don't rank them.`;
  switch (view) {
    case "GRP-A-NOW": {
      // The same headline the home's Academic tile shows (tile-figures.ts, front door 2b), so the two agree.
      const hd = groupAcademicHeadline(a);
      if (!hd) return "No results published for the group's schools yet.";
      const { headline: h, measure: m, unit } = hd;
      const withFig = m.group?.n_with_figure;
      // The phase named where it narrows the count ("30 secondary schools" of 54), and England as the group's sector.
      const ph = PHASE_WORD[h.phase] ?? "";
      const eng = o.group.type.startsWith("independent") ? "England's independent schools" : "England";
      return `${m.label}: ${fig(hd.group, unit)} across ${withFig && withFig < h.inPhase ? `the ${withFig} of the group's ${plural(h.inPhase, `${ph} school`)} with a published figure` : `the group's ${plural(h.inPhase, `${ph} school`)}`} in ${h.year !== null ? periodLabel(h.year) : "the latest year"}${hd.england !== null ? `; ${eng} ${fig(hd.england, unit)}` : ""}.`;
    }
    case "GRP-A-RANKED": {
      if (!a) return "No school has a published result to rank yet.";
      const rows = a.ranked.rows.filter((r) => r.value !== null).sort((x, y) => y.value! - x.value!);
      if (!rows.length) return "No school has a published figure to rank yet.";
      const unit = a.ranked.measure.includes("pct") || a.ranked.measure.includes("rwm") ? "pct" : "points";
      const yr = a.ranked.year !== null ? ` in ${periodLabel(a.ranked.year)}` : "";
      return `${rows[0].name} leads the ${plural(rows.length, `${PHASE_WORD[a.ranked.phase] ?? ""} school`)} ranked on ${MEASURE_LABEL[a.ranked.measure] ?? a.ranked.measure}${yr}, at ${fig(rows[0].value!, unit)}; the lowest is ${fig(rows[rows.length - 1].value!, unit)}.`.replace("  ", " ");
    }
    case "GRP-A-AREAS": {
      if (!a || !a.areas.rows.length) return "Too few entries to compare subject areas yet.";
      const gaps = a.areas.rows.filter((r) => r.gap !== null).sort((x, y) => y.gap! - x.gap!);
      const yr = a.areas.year !== null ? ` in ${periodLabel(a.areas.year)}` : "";
      const g2 = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}`;
      if (!gaps.length) {
        // No England figure to set them against yet: which areas lead the group's own points per entry.
        const own = a.areas.rows.filter((r) => r.group?.shown && r.group.points_per_entry != null).sort((x, y) => y.group!.points_per_entry! - x.group!.points_per_entry!);
        if (!own.length) return "Too few entries to compare subject areas yet.";
        const hi = own[0], lo = own[own.length - 1];
        return `${hi.label} leads${yr}, at ${hi.group!.points_per_entry!.toFixed(2)} points per entry; ${lo.label} trails, at ${lo.group!.points_per_entry!.toFixed(2)}. England's figures by area aren't published for that year yet.`;
      }
      return a.areas.strengths.length
        ? `${listJoin(a.areas.strengths.slice(0, 2))} ${a.areas.strengths.length === 1 ? "leads" : "lead"}, furthest above England${yr}${a.areas.weaknesses.length ? `; ${a.areas.weaknesses[0]} trails most` : ""}.`
        : `No subject area is above England${yr}; the closest is ${gaps[0].label} (${g2(gaps[0].gap!)} points per entry)${a.areas.weaknesses.length ? `, and ${a.areas.weaknesses[0]} trails most` : ""}.`;
    }
    case "GRP-A-IMPROVING": {
      const i = a?.improving;
      if (!i || !i.of) return "Not enough published years to say which schools are improving.";
      const others = [i.fell ? `${i.fell} fell` : "none fell", i.steady ? `${i.steady} held steady` : "none held steady"];
      return `${i.improved} of the ${plural(i.of, "school")} improved on ${MEASURE_LABEL[i.measure] ?? i.measure} since ${periodLabel(i.from)}; ${listJoin(others)}.${gradingCaveat(i.from)}`;
    }
    case "GRP-P-NOW": {
      if (!p) return `${n(o.now.roll)} pupils in ${census}.`;
      const parts = (["primary", "secondary", "post16"] as const).filter((k) => p.rollByPhase[k] > 0).map((k) => `${n(p.rollByPhase[k])} ${k === "post16" ? "in the sixth form" : `in ${k}`}`);
      return `${n(o.now.roll)} pupils in ${census}${parts.length > 1 ? `: ${listJoin(parts)}` : ""}.`;
    }
    case "GRP-P-SHAPE": {
      if (!p) return "The group's pupils by age.";
      const now = p.shape.ages.reduce((s, x) => s + x, 0);
      const then = p.shape.firstAges.reduce((s, x) => s + x, 0);
      // The shape itself: where the pupils are by age (primary 4-10, secondary 11-15, sixth form 16-18).
      const band = (lo: number, hi: number) => p.shape.ages.slice(lo, hi + 1).reduce((t, x) => t + (x ?? 0), 0);
      const bands = [["primary ages (4–10)", band(4, 10)], ["secondary ages (11–15)", band(11, 15)], ["sixth-form ages (16–18)", band(16, 18)]] as const;
      const big = [...bands].sort((x, y) => y[1] - x[1])[0];
      const share = now > 0 ? Math.round((big[1] / now) * 100) : null;
      const grew = then > 0 && p.shape.first !== p.shape.year ? ` The group had ${n(then)} pupils in ${periodLabel(p.shape.first)}; that change includes schools joining, which the like-for-like roll leaves out.` : "";
      return share !== null ? `Most of the group's ${n(now)} pupils are of ${big[0]}: ${share}% in ${periodLabel(p.shape.year)}.${grew}` : `${n(now)} pupils by age in ${periodLabel(p.shape.year)}.`;
    }
    case "GRP-P-GROWING": {
      const gr = p?.growing;
      return gr && gr.of ? `${gr.growing === gr.of ? `All ${plural(gr.of, "school")}` : `${gr.growing} of the ${plural(gr.of, "school")}`} grew from ${periodLabel(gr.from)} to ${periodLabel(gr.to)}; ${gr.shrinking ? `${gr.shrinking} shrank` : "none shrank"}.` : "Not enough census years to say which schools are growing.";
    }
    case "GRP-P-PROJECTION": {
      const rows = (projection ?? []).filter((r) => r.pct !== null);
      if (!rows.length) return "No projection of the children around the schools yet (ONS-based projections, not a forecast).";
      const up = rows.filter((r) => r.pct! > 0).length;
      const words = up === 0 ? `Near none of the ${plural(rows.length, "school")} is the number of children projected to rise: near all of them it is projected to fall or hold.` : up === rows.length ? `Near all ${plural(rows.length, "school")} the number of children is projected to rise.` : `Near ${up} of the ${plural(rows.length, "school")} the number of children is projected to rise; near ${rows.length - up} it is projected to fall or hold.`;
      return `${words} (ONS-based projections, not a forecast.)`;
    }
  }
  return "";
}
