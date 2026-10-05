// VicData 0.6.1 S3: what a view is compared with (1 · Data's "compare"), resolved for one
// panel's frame.
//
// `compare: "follows-page"` (D1a) resolves to exactly what the host draws today from the
// member's own settings -- docs/v0.6/views_preset_table.md, "What follows-page draws
// today" -- by the frame: the page has already resolved Context's Compare against pill
// (againstKey("context")) into the subjects and the group line it hands Context, and
// Comparisons' Compared against set (setKey("rankings")) and its "vs:" choice into the
// schools and the versus line. Nothing here reads the page's controls a second way.
//
// An explicit list keeps the series the frame can honestly supply and drops the rest (step
// 3's greying of what a measure can't draw is S4's, from the catalogue -- D7).
import type { CompareSeries, ViewSpec } from "@/catalogue/viewspec";
import type { ViewFrame } from "./frames";

// The two halves of a Trends panel each have their own "From" year. A view's span follows
// the half its preset sits in; a spec made from scratch, by what it shows.
const CHANGE_HALF = /-(CHANGELIST|CHANGETABLE|CHANGEMAP|GEO-CHART|GEO-TABLE)$/;
export function onChangeHalf(spec: ViewSpec): boolean {
  if (spec.preset) return CHANGE_HALF.test(spec.preset);
  return spec.data.shownAs === "change" || (spec.view.kind === "table" && spec.view.look.sort === "change");
}

// The geography presets: LA / region / England as their own lines or rows, from the host's
// own fetch (useSubjectGeography), handed over in the frame (S3c).
export function needsGeography(spec: ViewSpec): boolean {
  return !!spec.preset && /-GEO-(CHART|TABLE)$/.test(spec.preset);
}

export function resolveCompare(spec: ViewSpec, frame: ViewFrame): CompareSeries[] {
  if (spec.compare !== "follows-page") return spec.compare;
  const kind = spec.view.kind;
  const change = spec.data.shownAs === "change";
  const perYear = spec.data.per === "year";
  if (needsGeography(spec)) {
    return [
      { kind: "self", colour: "accent", as: spec.view.kind === "table" ? "row" : "line" },
      { kind: "la", colour: "palette", as: spec.view.kind === "table" ? "row" : "line" },
      ...(spec.view.kind === "table" ? [{ kind: "region" as const, colour: "palette", as: "row" as const }] : []),
      { kind: "england", colour: "england", as: spec.view.kind === "table" ? "row" : "line" },
    ];
  }
  switch (frame.kind) {
    case "grades":
      // Grade counts: Current's England ticks; Spread by year (the members' year pick) the
      // subject itself in an earlier year; the change table nothing beyond its grades.
      if (kind !== "spread") return [];
      return "memberPick" in spec.data.years && spec.data.years.memberPick
        ? [{ kind: "self", colour: "muted", as: "line", at: "earlier-year" }]
        : [{ kind: "england", colour: "fg", as: "marker" }];
    case "subjects": {
      // Results' Grades view: England's share at each grade, the latest year.
      if (kind === "spread") return [{ kind: "england", colour: "fg", as: "marker" }];
      // Current: Results' bars carry England's marker; the tables' third column is the
      // benchmark (England on Results, the group's average on Context), else the subject's
      // own previous year (R-PREV-YEAR-FALLBACK).
      if (!perYear && !change) {
        if (kind === "bar") return frame.benchmarkKind === "england" && frame.benchmarkLabel ? [{ kind: "england", colour: "fg", as: "marker" }] : [];
        if (kind === "table")
          return frame.benchmarkKind && frame.benchmarkLabel
            ? [{ kind: frame.benchmarkKind, colour: "fg", as: "row", ...(frame.benchmarkKind === "england" ? {} : { average: "mean" as const }) }]
            : [{ kind: "self", colour: "fg", as: "row", at: "earlier-year" }];
        return [];
      }
      // A ranked change: the group's change as a dashed reference line.
      if (change && kind === "bar") return frame.groups[0] && frame.groupKind ? [{ kind: frame.groupKind, colour: "fg", as: "reference", average: "mean" }] : [];
      // Trends: nothing beyond the rows (Context's All subjects card is a look, below).
      return [];
    }
    case "candidates":
      if (change && kind === "bar") return frame.groupLabel && frame.subjects.length > 1 ? [{ kind: "category", colour: "fg", as: "reference", average: "mean" }] : [];
      return [];
    case "comparisons":
      if (perYear && kind === "line") {
        // The members' "vs:" choice: the set's average (a ranking's own population on its
        // measure), or one named school.
        return [
          frame.versus.urn === "average"
            ? { kind: frame.setKind, colour: "muted", as: "line", average: "mean" }
            : { kind: "chosenSchool", colour: "muted", as: "line" },
        ];
      }
      if (change && kind === "bar") return [{ kind: frame.setKind, colour: "fg", as: "reference", average: "mean" }];
      return [];
  }
}
