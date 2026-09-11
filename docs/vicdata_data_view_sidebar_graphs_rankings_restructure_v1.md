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

## Part C — Rankings restructure (DONE, commit `5353d03`)

### Scope

Four additions to `RankingsView.tsx`'s non-large-set path (the server-side
Region/Nation large-set branch, `LargeSetMetricRanking`, is untouched — not in
scope). The three pre-existing metrics not named below (% girls, % boarding,
market share) keep their original `MetricRanking` rendering and thresholds
(`LARGE_SET_THRESHOLD=40`/`NEIGHBOUR_WINDOW=5`) completely unchanged.

**C1 — overview tiles**, a new row above the existing tables:
- *"This school's position"* — `#N of M schools` (Current Roll basis) plus a
  sub-line comparing the target's own pupils against the group average
  (`"1,252 pupils — 191% above the average of 430"`, real numbers from
  verification below).
- *"Position over time"* — `Average rank #N, {first year}–{last year}` (mean
  of the target's real per-period ranks across the Start-Year-to-now range),
  plus a concrete sub-line (`"Risen from #9 (2019/20) to #6 (2025/26)"`) rather
  than a bare arrow — falls back to `"Ranked #N ({year})"` when there's only
  one real period, and to a "not enough data" message when there's none.

**C2 — Current Roll table**: target row highlight strengthened (a 4px coloured
left border plus a deeper `bg-red-50`/`dark:bg-red-950/40` background,
replacing the old single subtle tint) and a new display shape once the group
exceeds 20 schools: Top 10, "Around this school" (target ± 2, deduplicated
against Top 10/Bottom 3), Bottom 3, each its own subheading. Deliberately a
new, separate threshold/window (`RANK_TABLE_LARGE_THRESHOLD=20`,
`RANK_TABLE_TOP_N=10`, `RANK_TABLE_BOTTOM_N=3`, `RANK_TABLE_NEIGHBOUR_SPAN=2`
in `data-view-cards.ts`) from the pre-existing `LARGE_SET_THRESHOLD=40`/
`NEIGHBOUR_WINDOW=5` pair, per direct instruction not to conflate them.

**C3 — comparison-over-time table**: same chunking/highlight as C2, one
column per real academic year from Start Year through now, but each cell
shows the school's Current Roll **rank** for that year (not the raw pupil
figure — Graphs already shows those; this table's reason to exist is the rank
trajectory). Row set/order is driven by the same ranking C2 uses, so both
tables agree on who's "top 10." A new "Avg rank" summary column (mean of each
row's real per-period ranks) sits at the end, and a small sparkline of the
target's own rank-over-time sits to the right — the same `Sparkline`
component Part A built, fed rank values. Values are inverted (`-rank`) before
being handed to `Sparkline`, since that component always draws "bigger number
= higher on the chart" (correct for a roll trend, backwards for rank, where
smaller is better) — this sign convention wasn't specified in the handoff;
logged as our own call, not an assumed one.

**C4 — Growth/decline ranking**: a new table ranking schools by roll growth/
decline % since Start Year, using the *exact* current/anchor pairing
`GraphsView.tsx`'s own Growth/decline chart (Graph 4, `DivergingBarChart`)
already computes — current is each school's own current-snapshot value
(`profileToFilterableData`), anchor is the real snapshot at
`filters.startPeriod` specifically (not the nearest available real period,
mirroring `GraphsView`'s own `anchorSnapshot`/`anchorPoints`). Same C2 large-
set treatment.

### New shared plumbing

- **`rankAcrossPeriods()`** (`RankingsView.tsx`, local) — per-school,
  per-period rank on Current Roll, computed once and shared by C1's "Position
  over time" tile and C3's table, per direct instruction ("build once...
  not separately for C1/C3"). Deliberately uses
  `profileToFilterableDataForPeriod` per real period rather than the profile's
  "current" snapshot — there's no meaningful per-*past*-period equivalent of
  "current," mirroring the same targetCurrent-vs-trend-series distinction
  `GraphsView.tsx` already keeps.
- **`chunkedRankingDisplay()`** (`data-view-cards.ts`, exported) — the
  Top-10/Around-this-school/Bottom-3 chunker, shared by C2, C3 and C4's
  `RankTable`/`ComparisonOverTimeTable` components. Below the 20-school
  threshold it returns the full list as one unlabelled chunk (no subheadings).

A genuine design decision worth flagging: "Current Roll" throughout C1/C2 is
kept as the profile's own current-snapshot value (`METRICS[0].getValue`, i.e.
`profileToFilterableData`) — the same figure the rest of this page has always
called "Current Roll" — rather than the periods-array "latest" value
`rankAcrossPeriods` produces for C3. These are usually identical for an
open school whose current snapshot is the group's own latest real period
(confirmed on real data below), but are computed via genuinely different
paths and could in principle diverge for an edge-case school; keeping them
separate avoids a subtle definition drift from what "Current Roll" already
means everywhere else on this page.

### Verification

All against real, unmodified data — a throwaway script (deleted after use)
logged into the shared test membership, switched the testing account to urn
100053 (Acland Burghley School) via the existing testing-only school
switcher, and fetched 13 real profiles (the target plus 12 real nearby
schools) from the live local server running this round's code.

- **Ranking correctness**: the Current Roll ranking (`#1` University College
  School 1,297 pupils ... `#2` Acland Burghley 1,252 ... down to `#13` St
  Richard of Chichester School, 0 pupils, real ties handled correctly at
  ranks 7 and 11) matched an independently computed manual sort exactly.
- **Cross-path consistency**: the per-period rank series' latest entry
  (`rankAcrossPeriods`, via `profileToFilterableDataForPeriod`) matched the
  separately-computed "current" rank (`METRICS[0]`, via
  `profileToFilterableData`) for every real period this school had data —
  target ranked `#2` in all 7 real years (2019–2025), consistent with both
  computations agreeing at the latest period.
- **Filter reactivity**: a Senior+Girls filter reordered the ranking for
  real (La Sainte Union Catholic Secondary School jumped from unfiltered
  `#4` to filtered `#1`), and the target's own filtered figure (450 pupils)
  matched exactly the same figure Part A's own filter-reactivity check found
  for this school under the same filter — a real, independent cross-check
  between the two rounds' work.
- **Chunking dedup**: `chunkedRankingDisplay` was exercised on a synthetic
  25-school list with the target placed (a) comfortably in the middle,
  (b) at rank 11 (touching the Top-10 boundary), and (c) at rank 22 (touching
  the Bottom-3 boundary) — every case produced the correct chunk labels with
  zero duplicate rows across chunks.
- **Build health**: `npx tsc --noEmit`, `npm run lint`, `npm run build` all
  clean. Lint at the same 7-problem baseline that predates this work.

### Files changed

- `src/lib/data-view-cards.ts` (new constants + `chunkedRankingDisplay()`)
- `src/components/data-view/RankingsView.tsx` (C1–C4)

Commit: `5353d03`.

## Part B — Graphs restructure (NOT YET STARTED)

Full spec captured in the originating handoff; not reproduced here until
built, per the "build and report in stages" instruction.
