// Which list "Nearest 10" resolves to for a genuine boarding target: the ordinary list1
// recipe or the boarding-quintile recipe. Shared by the member Data View
// (DataViewShell.tsx, where it began) and Teacher view's comparator chooser, so the two
// "10 nearest schools" never disagree about which schools that means.
//
// Compared-with panel round (2026-09-10), item 2: there is no separate Boarding schools
// button, so this single ordinary-vs-quintile choice is what the one Nearest-10 button
// (and its +5/-5 stepper) actually shows. Pure function of the already-fetched recipe
// data plus the LIVE boarding filter mode, so it can be called identically for the
// initial landing selection (boardingMode null) and on every later change:
//   - boardingBand "top_two": default is boardingRecipe (same-quintile match,
//     unbounded catchment) -- switches to the ordinary list1 recipe when Day pupils is
//     ticked specifically (a day-pupil framing makes more sense than a
//     boarding-population quintile for that reading).
//   - boardingBand "bottom_three": default is the ordinary list1 recipe -- switches to
//     boardingRecipe (nearest real boarding schools nationally, age/gender) when
//     Boarders is ticked specifically.
//   - boardingBand null (not a genuine boarding school, or the fast-path recipe isn't
//     precomputed yet for a top-two target -- see DefaultComparatorLists' own comment
//     for why no slow fallback is attempted): list1 always.
import type { BoardingQuintileBand } from "./default-comparator-lists";

export function resolveNearestOption<T>(
  list1: T | null,
  boardingBand: BoardingQuintileBand | null,
  boardingRecipe: T | null,
  boardingMode: "boarders" | "day" | "whole" | null,
): T | null {
  if (boardingBand === "top_two") {
    return boardingMode === "day" ? list1 : (boardingRecipe ?? list1);
  }
  if (boardingBand === "bottom_three") {
    return boardingMode === "boarders" ? (boardingRecipe ?? list1) : list1;
  }
  return list1;
}
