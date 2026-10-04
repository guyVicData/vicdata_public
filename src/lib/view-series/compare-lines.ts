// VicData 0.6.1 S3c: a view's own compare series ("compared with" in 1 · Data, a spec that
// isn't "follows-page") as lines or rows -- one value per period of the frame, from what the
// frame already holds:
//
//   at this school   category / all subjects / selected subjects: the page's own group line
//                    (the mean it already derived), a median of the group's subjects, or a
//                    weighted average where the frame has the counts behind them
//   LA / region / England
//                    the geography fetch the host already made (useSubjectGeography; R-MIN-
//                    SCHOOLS is the route's), England on Results being the subject's own
//                    England benchmark (the same national aggregate)
//   across schools   the set's other schools (10 nearest / a saved set): mean, median, or
//                    weighted by their entries; one named school (the members' "vs:")
//
// Only where the catalogue allows it (D7, src/catalogue/honest.ts compareHonest -- R-NO-GRADE-
// RATE-GEO, R-BANDS-ENGLAND-BENCH, R-GEO-POINTS-ELIGIBLE, R-KS4-POINTS-GCSE-FULL, R-KS5-ENGLAND-
// EXACT) and the frame really has the figure: a series it can't honestly draw is left out,
// as step 3's "Show this view for" says it will be. Every value is a figure the page already
// has, or an average of them.
import { compareHonest, type HonestContext } from "@/catalogue/honest";
import type { CompareSeries, CompareSeriesKind } from "@/catalogue/viewspec";
import type { HostId } from "@/catalogue/types";
import { meanOf, type PanelSeries } from "@/lib/teacher-view-panels";
import { memberMeans } from "@/lib/teacher-view-populations";
import { geographyTiers, geographyValues } from "@/lib/teacher-view-geography";
import { compareColour } from "./colours";
import type { CandidatesFrame, ComparisonsFrame, FrameGeography, FrameGroupMember, SubjectsFrame, ViewFrame } from "./frames";
import { medianOf, weightedMeanOf } from "./looks";

export type CompareLine = PanelSeries & { kind: CompareSeriesKind; comparison: true };

const HOW = { mean: "Average", median: "Median", weighted: "Weighted average" } as const;
const AREA_KINDS = new Set<CompareSeriesKind>(["la", "region", "england"]);
const SET_KINDS = new Set<CompareSeriesKind>(["nearest", "savedSet"]);

function hostOf(f: ViewFrame): HostId {
  if (f.kind === "subjects") return f.host;
  return f.kind === "candidates" ? "teacher.c1.candidates" : "teacher.c3.comparisons";
}

function themeOf(f: ViewFrame): "dark" | "light" {
  return f.kind === "comparisons" ? f.theme ?? "dark" : f.theme;
}

// D7: may this frame draw this kind at all? (A frame without its phase -- an older embed --
// keeps S3a's rules: only what it holds.)
export function compareAllowed(f: ViewFrame, kind: CompareSeriesKind, span: boolean): boolean {
  if (!f.phase) return true;
  const measure = f.kind === "candidates" ? "entries" : f.measure.id;
  const ctx: HonestContext = { phase: f.phase, measure, host: hostOf(f) };
  return compareHonest(ctx, kind, { span }).ok;
}

// The area's figure per frame period, from the geography the host fetched (null = none:
// not applicable, still loading, or no such tier published).
export function areaValues(g: FrameGeography | null | undefined, kind: "la" | "region" | "england", periods: number[]): { name: string; values: (number | null)[] } | null {
  if (!g || !g.applies || !g.payload) return null;
  const tier = geographyTiers(g.payload).find((t) => t.kind === kind);
  if (!tier) return null;
  const values = geographyValues(tier.area.rows, g.metric, periods);
  return values.some((v) => v !== null) ? { name: `${tier.area.name}${tier.suffix}`, values } : null;
}

const perPeriod = (periods: number[], rows: (number | null)[][], fn: (vs: (number | null)[]) => number | null) => periods.map((_, i) => fn(rows.map((r) => r[i] ?? null)));

type Got = Omit<CompareLine, "colour" | "kind" | "comparison"> | null;

// LA / region / England for a subject column: Results' England is the subject's own England
// benchmark (the same national aggregate the geography fetch reads); the rest the fetch.
function areaLine(f: SubjectsFrame | CandidatesFrame, kind: CompareSeriesKind, focusedKey: string | null): Got {
  if (kind === "england" && f.kind === "subjects" && f.benchmarkKind === "england") {
    const focus = f.subjects.find((s) => s.key === focusedKey);
    return focus?.benchmark ? { key: "england", label: "England", values: focus.benchmark } : null;
  }
  const area = areaValues(f.geography, kind as "la" | "region" | "england", f.periods);
  return area ? { key: kind === "england" ? "england" : `area-${kind}`, label: kind === "england" ? "England" : area.name, values: area.values } : null;
}

// An average over a group's members, per period: mean, median, or weighted by their entries
// (null when no member has a count).
export function groupAverage(periods: number[], members: FrameGroupMember[], how: "mean" | "median" | "weighted"): (number | null)[] | null {
  if (!members.length) return null;
  if (how === "mean") return memberMeans(periods, members);
  if (how === "median") return perPeriod(periods, members.map((m) => m.values), medianOf);
  if (!members.some((m) => m.counts?.some((c) => c !== null))) return null;
  return periods.map((_, i) => weightedMeanOf(members.map((m) => m.values[i] ?? null), members.map((m) => m.counts?.[i] ?? null)));
}

const AVERAGE_NAME = { mean: "average", median: "median", weighted: "weighted average" } as const;

// "Add an average" at this school: the page's own group line where it is the very group the
// frame draws (its self-inclusive mean), else the group the page builds on demand.
function atSchoolLine(f: SubjectsFrame | CandidatesFrame, cs: CompareSeries): Got {
  const kind = cs.kind as "category" | "allSubjects" | "selectedSubjects";
  const how = cs.average ?? "mean";
  if (how === "mean" && f.kind === "subjects" && kind === f.groupKind && f.groups[0]) return { key: "group-0", label: f.groups[0].label, values: f.groups[0].values };
  if (how === "mean" && f.kind === "candidates" && kind === "category" && f.groupLabel && f.subjects.length > 1)
    return { key: "group", label: f.groupLabel, values: memberMeans(f.periods, f.subjects) };
  const g = f.schoolGroup?.(kind) ?? (f.kind === "subjects" && kind === f.groupKind ? { label: groupWord(f), members: f.subjects } : null);
  if (!g || g.members.length < 2) return null;
  const values = groupAverage(f.periods, g.members, how);
  return values ? { key: `avg-${kind}-${how}`, label: `${g.label} ${AVERAGE_NAME[how]}`, values } : null;
}

// "Add an average" across schools on a subject column: the page's Compared against set.
function acrossSchoolsLine(f: SubjectsFrame | CandidatesFrame, cs: CompareSeries): Got {
  const set = f.schoolSet?.();
  if (!set) return null;
  const how = cs.average ?? "mean";
  const values = groupAverage(f.periods, set.schools, how);
  return values ? { key: `set-${how}`, label: `${how === "mean" ? "Average" : HOW[how]} across ${set.label.toLowerCase()}`, values } : null;
}

function subjectsLine(f: SubjectsFrame, cs: CompareSeries, focusedKey: string | null): Got {
  if (AREA_KINDS.has(cs.kind)) return areaLine(f, cs.kind, focusedKey);
  if (SET_KINDS.has(cs.kind)) return acrossSchoolsLine(f, cs);
  if (cs.kind === "category" || cs.kind === "allSubjects" || cs.kind === "selectedSubjects") return atSchoolLine(f, cs);
  return null;
}

const groupWord = (f: SubjectsFrame) => (f.groupKind === "category" && f.categoryLabel ? f.categoryLabel : f.compareAgainstLabel ?? "the group");

function candidatesLine(f: CandidatesFrame, cs: CompareSeries): Got {
  if (AREA_KINDS.has(cs.kind)) return areaLine(f, cs.kind, null);
  if (SET_KINDS.has(cs.kind)) return acrossSchoolsLine(f, cs);
  if (cs.kind === "category" || cs.kind === "allSubjects" || cs.kind === "selectedSubjects") {
    if (cs.kind === "category" && !f.schoolGroup && (cs.average ?? "mean") === "median" && f.subjects.length > 1)
      return { key: "avg-category-median", label: `${f.categoryLabel ?? "Category"} median`, values: perPeriod(f.periods, f.subjects.map((s) => s.values), medianOf) };
    return atSchoolLine(f, cs);
  }
  return null;
}

// The set's other schools, averaged per period over those with a figure that year (as the
// Trend "vs:" line reads it); a ranking's own population on its measure for the mean.
export function setAverage(f: ComparisonsFrame, how: "mean" | "median" | "weighted"): (number | null)[] | null {
  const others = f.schools.filter((s) => !s.isTarget);
  if (how === "mean") return f.onRankingMeasure && f.ranking ? f.periods.map((p) => f.ranking!.averageAt(p)) : perPeriod(f.periods, others.map((s) => s.values), meanOf);
  if (how === "median") return perPeriod(f.periods, others.map((s) => s.values), medianOf);
  // Weighted by each school's entries, only where the page has them (not on a rate).
  if (!others.some((s) => s.counts?.some((c) => c !== null))) return null;
  return f.periods.map((_, i) => weightedMeanOf(others.map((s) => s.values[i] ?? null), others.map((s) => s.counts?.[i] ?? null)));
}

function comparisonsLine(f: ComparisonsFrame, cs: CompareSeries): Omit<CompareLine, "colour" | "kind" | "comparison"> | null {
  const setNoun = f.setLabel.toLowerCase();
  if (cs.kind === "chosenSchool") {
    const school = f.schools.find((s) => !s.isTarget && s.urn === f.versus.urn);
    return school ? { key: "versus", label: school.name, values: school.values } : null;
  }
  if (!SET_KINDS.has(cs.kind)) return null;
  const how = cs.average ?? "mean";
  const values = setAverage(f, how);
  if (!values) return null;
  const label = how === "mean" ? (f.versus.urn === "average" ? f.versus.label : `Average across ${setNoun}`) : `${HOW[how]} across ${setNoun}`;
  return { key: how === "mean" ? "versus" : `versus-${how}`, label, values };
}

// The explicit compare series a frame can draw, in the spec's order, each its own line (or
// row) aligned to the frame's periods. `span`: the view runs over several years (D7's
// "latest year only" figures drop out). "self" and markers are the caller's.
export function compareLinesFor(f: ViewFrame, compare: CompareSeries[], opts: { focusedKey: string | null; span: boolean; as?: CompareSeries["as"][] }): CompareLine[] {
  const theme = themeOf(f);
  const out: CompareLine[] = [];
  const asOk = (cs: CompareSeries) => (opts.as ?? ["line", "row"]).includes(cs.as ?? "line");
  for (const cs of compare) {
    if (cs.kind === "self" || cs.kind === "otherSubject" || !asOk(cs)) continue;
    if (!compareAllowed(f, cs.kind, opts.span)) continue;
    const got = f.kind === "subjects" ? subjectsLine(f, cs, opts.focusedKey) : f.kind === "candidates" ? candidatesLine(f, cs) : comparisonsLine(f, cs);
    if (!got || out.some((o) => o.key === got.key)) continue;
    out.push({ ...got, colour: compareColour(cs.colour, theme), kind: cs.kind, comparison: true });
  }
  return out;
}

// Candidates: an area line counts points-eligible entries (R-GEO-POINTS-ELIGIBLE), so the
// school's own line beside one does too -- the host's own geography row.
export function pointsEligibleOwn(f: CandidatesFrame, lines: CompareLine[]): (number | null)[] | null {
  return lines.some((l) => AREA_KINDS.has(l.kind)) && f.geography?.applies ? f.geography.own : null;
}
