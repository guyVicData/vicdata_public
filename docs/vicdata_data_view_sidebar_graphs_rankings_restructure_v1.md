# Data View: sidebar summary panel + Graphs restructure + Rankings restructure

Source: Guy's own design review notes ("Handoff: sidebar summary panel + Graphs
restructure + Rankings restructure"), built in three stages per explicit
instruction: **A (sidebar) → C (Rankings) → B (Graphs)**, reporting back after
each stage.

Two decisions confirmed up front and not re-litigated:
- The Roll Trends "average" line (Graph 3, Part B) always averages over the
  WHOLE set regardless of what's individually added via the new graph button.
- C3's year columns come from the existing Start Year filter through to now —
  no new year-picker.

## Part A — sidebar "Compared with" panel rebuild (DONE, commit `275f60f`)

### Problem

`ComparatorSidebar.tsx`'s summary panel led with the comparator SET's
aggregate numbers (a summed pupil total across every ticked+loaded school,
including the target) rather than the school actually being viewed. Guy's own
framing: "the whole panel leads with the SET's aggregate numbers, when the
school being viewed should be the primary thing shown... school should be
central."

There was also a real, independent layout bug in the same block: the old
"N schools in this set" text was right-aligned and `whitespace-nowrap`, sitting
in a `flex justify-between` row against a large pupil-count number. At narrow
widths — worst on single-column iPad/iPhone portrait, which is the sidebar's
full-width layout — a large number plus a long nowrap string in one row
doesn't reliably fit, and the text overflowed the card frame.

### Fix

Panel order, top to bottom, now:

1. **Target headline** — `{school name}` (bright/white weight) +
   `{latest period, e.g. "2025/6"} Roll` (grey, uppercase, matching the
   existing "Compared with" label style).
2. **Large current roll number** — the target's own current FILTERED roll,
   reusing `targetFilteredCount.total` (the exact figure `DataViewShell`
   already computes and `GraphsView` already uses as `targetCurrent`; not
   recomputed).
3. **Sparkline** — new `Sparkline.tsx` component, fed the target's own
   per-period filtered roll series, drawn in `FOCUS_SCHOOL_COLOUR` (`#dc2626`,
   the same red used for the target/focus school's line everywhere else in
   this app). No axes, gridlines, legend, or tooltip — just the line and its
   real end-point dots.
4. **Trend badge** — reuses `TrendPill` (newly extracted into its own file,
   see below) unchanged, same "▲ 7% since 2019/20" convention used in
   `GraphsView`.
5. `<h2>Compared with</h2>` (unchanged).
6. **Demoted set card** — schools-in-set count, the "+N more ticked, not yet
   loaded" note for large sets, and `compareSentence` — all previously part of
   the same block as the big number, now their own smaller supporting card
   underneath.

The old girls/boys split line was dropped entirely — it wasn't part of the A3
mockup this rebuild follows, and isn't shown anywhere else in the app that it
wasn't already. Flagged as an assumption in the handoff, resolved on the most
literal reading.

### New shared components

- **`TrendPill.tsx`** (new file) — `TrendPill` component and
  `academicYearLabel()` helper, extracted verbatim out of `GraphsView.tsx`
  (which defined them inline). `GraphsView.tsx` now imports from this file
  instead; its own rendering is byte-for-byte unchanged by the move. Exists so
  the sidebar's new badge and `GraphsView`'s existing badges are the exact
  same implementation, not two independently-styled copies that could drift.
- **`Sparkline.tsx`** (new file) — a small, deliberately dumb line chart.
  Takes a plain `(number | null)[]` values array and a stroke colour; draws
  polyline segments (breaking, not interpolating, across `null` gaps — same
  "absence isn't a real zero" convention as every other chart in the app) plus
  a faint start dot and a solid end dot. No data-fetching or filtering opinion
  of its own — callers compute whatever series they need the way the full-size
  charts already do. Built reusable for Part C3's rank-over-time mini chart
  (same shape, fed rank values instead of roll values).

### New computations (`DataViewShell.tsx`)

Added right after the existing `compareSentence` computation, before the
large-set design block:

- `targetSparklinePeriods` — real periods present in `targetProfile.trend`,
  filtered to `>= filters.startPeriod`, ascending. Derived from the target's
  own trend only (not the wider group), since the sparkline only ever plots
  the target.
- `targetSparklineValues` — one filtered total per period, `null` where
  `ageGenderCountsByPeriod` has no data for that period (real gap, not zero),
  computed via `filteredCount(profileToFilterableDataForPeriod(targetProfile,
  p), filters).total` — the same per-period filtering primitive
  `perSchoolFilteredSeries` in `GraphsView.tsx` already uses.
- `targetAnchorSnapshot` / `targetRollTrendBadge` — mirrors `GraphsView`'s own
  `rollTrendBadge` pattern: compares the current filtered total against the
  filtered total at `filters.startPeriod`, via `trendBadge()`.
- `targetLatestPeriod` — `targetProfile.current?.period ?? null` (the real
  latest snapshot's own period, not a hardcoded census period constant).

Five new props threaded down to `ComparatorSidebar`: `targetCurrentRoll`,
`targetLatestPeriod`, `targetSparklineValues`, `targetRollTrendBadge`,
`startPeriod`.

### Verification

All against real, unmodified data — no fabricated fixtures.

**Sparkline correctness** — a standalone script computed the new
`targetSparklineValues` series for urn 100053 (periods 2019–2025, no filter)
and compared it directly against `RollTrendsChart`'s own target-line values
for the same school under the same conditions (target + 2 other real
comparator schools, to confirm period-list derivation doesn't drift when a
wider group is present). Result: periods and every value matched exactly —
`[1072, 1135, 1168, 1163, 1166, 1218, 1252]` in both.

**Filter-reactivity** — a second script applied an active Senior+Girls filter
to the same school. Current total dropped `1252 → 450`; the full sparkline
series scaled down consistently across every period:
`[371, 382, 400, 398, 410, 440, 450]`. Confirms nothing in the new panel
accidentally reads an unfiltered value.

**Build health** — `npx tsc --noEmit`, `npm run lint`, `npm run build` all
clean after the full change set. Lint sits at the same 7-problem baseline that
predates this work (`src/app/account/page.tsx` x2, `src/components/
SchoolSearch.tsx` x5 across `react-hooks/refs` and `react-hooks/set-state-in-
effect`), unrelated to these files.

**Narrow-width layout** — the Chrome browser extension was unreachable this
session (consistent with every prior round), so this is a structural
code-level confirmation rather than a live screenshot: the new panel is
block-structured throughout (heading line, then number, then sparkline, then
badge, each its own line) with no row that pairs a large number against a
right-aligned `whitespace-nowrap` string. The specific pattern that caused the
original overflow no longer exists anywhere in the file — confirmed by grep,
the only remaining match is in an explanatory code comment describing the old
bug, not live markup. Should be spot-checked visually against a real portrait
viewport when the extension is next reachable, but the fix is structural
(removes the failure mode entirely) rather than a narrower-font patch that
could still break at some width.

### Files changed

- `src/components/data-view/TrendPill.tsx` (new)
- `src/components/data-view/Sparkline.tsx` (new)
- `src/components/data-view/GraphsView.tsx` (import swap only, no behaviour
  change)
- `src/components/data-view/DataViewShell.tsx` (new computations + props)
- `src/components/data-view/ComparatorSidebar.tsx` (panel rebuild)

Commit: `275f60f`.

## Part C — Rankings restructure (NOT YET STARTED)

## Part B — Graphs restructure (NOT YET STARTED)

Full specs for both captured in the originating handoff; not reproduced here
until built, per the "build and report in stages" instruction.
