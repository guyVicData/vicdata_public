// VicData 0.8 feedback B1 (SMT 7, G1; R-WALK-ENDS-ON-ANSWER): SMT Academic's answer to "Which subjects are
// strong, and which need attention?" -- every subject the school teaches, strongest to weakest, with those
// needing attention marked. Built from the Subject areas view's own figures (Academic.areas), so the walk's
// answer and the dashboard's view never disagree. Pure.
//
// Points, grades and value added sit on different scales across qualifications (A level points beside BTEC
// points mean nothing), so subjects are ranked on their standing in the set: where the school places among
// the set's schools teaching the subject, from 1 (top) to 0 (bottom). The top quarter is strong; the bottom
// quarter needs attention. A subject the set can't place (too few entries, the only school teaching it, no
// published figure) is listed after the ranking with its reason, never ranked.
import type { Academic, AreaSubject, Unit } from "./academic";
import { RANK_MIN } from "@/lib/front-door/teacher-screens";
import { placeText } from "@/lib/rank";

export type RankedSubject = {
  subject: string;
  qualification: string;
  short: string;
  value: number;
  unit: Unit;
  entries: number;
  rank: number;
  of: number;
  tied?: boolean;
  /** 1 = top of the set, 0 = bottom. */
  standing: number;
  mark: "strong" | "attention" | null;
};
export type SubjectsRanked = { rows: RankedSubject[]; unranked: { subject: string; short: string; why: string }[]; unit: Unit; period: number | null; mode: Academic["state"]["mode"] };

/** The share of the set a subject must sit in (top or bottom) to be marked strong or needing attention. */
export const MARK_QUARTER = 0.25;

export function subjectsRanked(a: Academic): SubjectsRanked {
  const mode = a.state.mode;
  const unit: Unit = mode === "va" ? "va" : mode === "entries" ? "share" : a.state.phase === "gcse" ? "grade" : "points";
  const all: { s: AreaSubject; short: string }[] = [...a.areas.blocks.flatMap((b) => b.quals.flatMap((q) => q.subjects.map((s) => ({ s, short: q.short })))), ...a.areas.outside.map((s) => ({ s, short: "EPQ" }))];
  const rows: RankedSubject[] = [];
  const unranked: SubjectsRanked["unranked"] = [];
  for (const { s, short } of all) {
    // R-RANK-MIN: a place needs at least 3 schools with a figure (1st or 2nd of 2 says nothing).
    if (s.value !== null && s.place && s.place.of >= RANK_MIN && s.ranked && !s.only) {
      const standing = (s.place.of - s.place.rank) / (s.place.of - 1);
      rows.push({ subject: s.subject, qualification: s.qualification, short, value: s.value, unit, entries: s.entries, rank: s.place.rank, of: s.place.of, tied: s.place.tied, standing, mark: standing >= 1 - MARK_QUARTER ? "strong" : standing <= MARK_QUARTER ? "attention" : null });
    } else unranked.push({ subject: s.subject, short, why: s.only ? "the only school in the set teaching it" : s.value !== null && s.place && s.place.of < RANK_MIN ? `fewer than ${RANK_MIN} schools in the set with a figure` : s.why ?? (s.value === null ? "no published figure" : "too few schools in the set to place it") });
  }
  // Strongest first; at the same standing, the larger set (a firmer place), then more entries.
  rows.sort((x, y) => y.standing - x.standing || y.of - x.of || y.entries - x.entries || x.subject.localeCompare(y.subject));
  return { rows, unranked, unit, period: a.areas.period, mode };
}

/** The walk's answer, in a sentence: the strongest and those needing attention, by name and place. */
export function subjectsRankedAnswer(r: SubjectsRanked): string {
  if (!r.rows.length) return r.unranked.length ? `No subject can be placed in the set yet: ${r.unranked.length} ${r.unranked.length === 1 ? "has" : "have"} too few schools or entries to compare.` : "No subjects to rank this year.";
  const name = (x: RankedSubject) => `${x.subject} (${x.short}, ${placeText(x)})`;
  const strong = r.rows.filter((x) => x.mark === "strong");
  const weak = r.rows.filter((x) => x.mark === "attention");
  const list = (xs: RankedSubject[]) => (xs.length <= 3 ? xs.map(name).join(", ") : `${xs.slice(0, 3).map(name).join(", ")} and ${xs.length - 3} more`);
  const top = strong.length ? `Strongest: ${list(strong)}.` : `None is in the top quarter of its set; the strongest is ${name(r.rows[0])}.`;
  const bottom = weak.length ? ` Needs attention: ${list([...weak].reverse())}.` : " None is in the bottom quarter of its set.";
  return `${top}${bottom}`;
}


