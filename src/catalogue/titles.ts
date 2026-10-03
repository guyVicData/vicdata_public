// Shared title words for honest number types (S3b fix 3b): one place that says how a
// change is worded for counts, points and rates, used by every title resolver (Pick in
// pick.ts, meeting slots in meeting-views.ts) so they can't drift apart.
//   counts  "% change"                     "% change in entries"
//   points  "change in points"             "Change in average points, in points"
//   rates   "change in percentage points"  "Change in Grade 4+ rate, in percentage points"
import type { DataId, ResultsMeasure } from "./types";

export type ChangeKind = "count" | "points" | "rate";

export function changeKind(data: DataId, results?: ResultsMeasure | "pill" | null): ChangeKind {
  if (data !== "academic.results") return "count";
  return results === "threshold" || results === "bands" ? "rate" : "points";
}

// [change-word]: "% change" / "change in points" / "change in percentage points".
export function changeWord(kind: ChangeKind): string {
  return kind === "count" ? "% change" : kind === "points" ? "change in points" : "change in percentage points";
}

// [change-of-measure]: the change phrase with its measure, before "since [year]".
export function changeOfMeasure(kind: ChangeKind, measure: string): string {
  return kind === "count" ? `% change in ${measure}` : `Change in ${measure}`;
}

// The unit tail a points or rate change carries after "since [year]" in a title.
export function changeUnitTail(kind: ChangeKind): string {
  return kind === "points" ? ", in points" : kind === "rate" ? ", in percentage points" : "";
}
