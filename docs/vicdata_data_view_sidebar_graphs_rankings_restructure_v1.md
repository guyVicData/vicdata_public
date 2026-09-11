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

## Part B — Graphs restructure (DONE, commit `188bb59`)

The largest of the three parts. `GraphsView.tsx` moves from three sections to
four, each an independent accordion (`SectionHeading` is now a real toggle
button; `closedSections` state, all four open by default, no adaptive
show/hide — matches the "training wheels" principle already established
elsewhere in this app).

### Section 01 — Overview (deliberately lightened)

- **Graph 1** (new): `TargetRollBarChart.tsx` — a column/bar chart of the
  target's own filtered roll, one bar per real academic year, in
  `FOCUS_SCHOOL_COLOUR`, with a fitted (least-squares) trend line overlaid.
  Reuses `CombinedRollChart.tsx`'s own regression math verbatim, but as real
  bars for one school rather than a lollipop of the set's combined total —
  no existing component did this combination.
- **Graph 2**: the existing "Current roll" card, byte-for-byte unchanged.
- `CombinedRollChart` and the Growth/decline chart both moved OUT to
  Sections 03/02 respectively, per the spec.

### Section 02 — Roll trends compared (new)

Home for the main `RollTrendsChart` (Graph 3) and Growth/decline (Graph 4,
moved here). `RollTrendsChart.tsx` itself gained four things:

- **(a)** At ≤10 schools, every legend entry except the target now has an
  on/off checkbox, hiding that one line without leaving "show all" mode.
- **(b)** The average-toggle button's text changed from "average of all
  other schools" to "average roll of this set of schools" — same
  mode-switch behaviour, just reworded.
- **(c)** Above 10 schools, the chart now *defaults* to average-only (target
  + average line), with a reduced legend (no checkboxes). Per our own
  reading, the (b) toggle button doesn't apply at this size — there's no way
  back to "show every line" via that control once above the threshold
  (schools can still be pulled back in individually via (d)). This is our
  interpretation of an ambiguous line in the handoff ("flag if wrong"),
  logged here rather than silently assumed.
- **(d)** A new "Add/subtract schools to this graph" button (shown only
  above 10 schools, since below that every school is already on screen),
  reusing `AddSubtractSchoolsWindow` — now with an `onAddSchool` prop made
  optional and its "Add a school" search section rendered only when that
  prop is passed, so this scoped reuse can't add a school outside the
  already-ticked/filtered set (the sidebar's own original call site is
  unaffected — it still always passes `onAddSchool`). State
  (`graphAddedUrns`/`hiddenLineUrns`/the window's open flag) lives entirely
  in `GraphsView.tsx`, not lifted to `DataViewShell.tsx`, per the handoff's
  own "threaded through GraphsView" wording — it affects only this one
  chart's display, not the real comparator set every other view reads.
  Added schools get their own colour via the same `assignSeriesColours`
  mechanism as every other line (not a second colour source), drawn on top
  of the average line.

### Section 03 — Market share (renumbered)

Keeps the existing share-over-time chart and the two market-share bar/
diverging tiles (Graphs 5/6), and gains `CombinedRollChart` (Graph 7, moved
here from Section 01). Graphs 5, 6, and Section 04's Graph 10 share a new
**sector-aggregate fallback** above `GRAPH_SECTOR_FALLBACK_THRESHOLD = 20`
schools (`aggregate-trends.ts` — deliberately separate from
`LARGE_SET_PROFILE_THRESHOLD = 200`, the unrelated Region/Nation-scale
threshold):

- `fetchSectorAggregatesForMany()` (new, `aggregate-trends.ts`) queries the
  *same* `roll_aggregates` table the existing single-target-sector fetch
  already reads, once per distinct `establishment_type_group` actually
  present in the visible group — built once, shared by all three graphs, per
  direct instruction. A sector with no real aggregate row (Special
  Schools/FE aren't populated yet, a pre-existing, documented data-coverage
  gap) is simply omitted, never shown as a fabricated zero.
- The `/api/data-view/aggregate-trends` route gained an optional `sectors`
  query param returning this data alongside its existing, unchanged
  single-sector `trends` payload.
- `AggregateTrendPoint` now also carries real `genderMale`/`genderFemale`
  (the same `roll_aggregates` row already has these columns) — one shared
  fetch feeds the roll bars (Graphs 5/6) and the new gender stacked-bar
  (Graph 10), not two near-duplicate queries.
- Because `roll_aggregates` only carries whole-school totals (no phase/age
  breakdown), the fallback bars — including the target's own — use
  whole-school figures (`targetProfile.current`/`.trend`), the same basis
  Section 01's existing Region/Nation large-set chart already uses for the
  identical reason. A caption states this explicitly on every fallback
  chart (`SectorFallbackNote`), matching this app's "state the real basis,
  don't silently compare filtered against unfiltered" discipline.
- `DataViewShell.tsx` fetches this independently of `isLargeSet` (a
  member's own self-curated set can cross 20 schools long before
  Region/Nation scale) — the fetch effect ended up needing to sit with the
  other top-level fetch effects rather than near where `tickedProfiles` is
  computed, see the Rules-of-Hooks note below.

### Section 04 — Gender split (renumbered)

Keeps the existing stat line + `TrendPill` + `SpreadStrip` card and adds:

- **Graph 8**: `ShapeChart.tsx` (the real public-site population-pyramid
  chart), fed the target's own current `ageGenderCounts` directly — reused,
  not rebuilt.
- **Graph 9**: the `Donut` component from `GenderSplitCard.tsx`, now
  exported (it was previously a local, unexported function) and made
  self-contained — its theme-aware `--girls`/`--boys` CSS custom-property
  `<style>` block used to be rendered once by its parent `GenderSplitCard`;
  moved *into* `Donut` itself so a caller that renders `Donut` without ever
  rendering `GenderSplitCard` (Graphs' own new usage) still gets working
  colours instead of undefined CSS variables.
- **Graph 10** (new): `GenderSplitBarChart.tsx` — one 100%-stacked
  horizontal bar per school, girls%/boys%, using the exact
  `TAG_COLOURS.Girls`/`.Boys` tokens `ShapeChart`/`Donut` already use. Same
  sector-aggregate fallback as Graphs 5/6 above 20 schools.
- The handoff's own section summary says "gains two charts" but its
  itemised list names three (8/9/10) — resolved by reading Graph 9 as an
  upgrade of the *existing* stat line (same `targetGenderCurrent` figure,
  now a donut instead of bare text) rather than a fourth thing on top of a
  redundant third. Nothing existing was removed; logged here rather than
  silently resolved one way or the other.
- Existing rule preserved unchanged: the whole section stays hidden for a
  confirmed single-sex target (`isSingleSex`).

### A structural fix along the way

The new sector-aggregate fetch effect in `DataViewShell.tsx` initially
depended on `targetProfile`/`tickedProfiles`, which are computed *after*
this component's own early returns (`loadState` checking/loading/
not_a_member/error, and `!target`) — a genuine `react-hooks/rules-of-hooks`
violation, since a hook can never be called conditionally. Fixed by moving
the effect up to sit with the other top-level fetch effects (before those
early returns) and having it re-derive the same "which schools are actually
being compared" logic directly from the earlier-available primitives
(`profilesByUrn`, `tickedUrns`, `activeSet`, `comparedHidden`,
`matchesSectorFilter`) rather than the later `tickedProfiles` const itself.
A first attempt at this also produced a `react-hooks/exhaustive-deps`
warning (a fresh `activeSetSchools` array on every render, as an effect
dependency) — resolved by reading `tickedUrns`/`profilesByUrn` directly
instead of going via `activeSetSchools`, which turned out not to be needed
for this narrower purpose.

### Verification

Real login, real testing-school switch (urn 100053), and a real 25-school
fetch from the live local server:

- The 23 real in-scope schools correctly crossed the new 20-school
  threshold, triggering the fallback path.
- Real distinct `establishmentTypeGroup` values were correctly identified:
  `Independent schools`, `Local authority maintained schools`, `Special
  schools`.
- The new `sectors` query param on `/api/data-view/aggregate-trends`
  returned genuine national `roll_aggregates` rows: Independent schools
  (528,278 pupils, +1.5% since 2019/20, gender split ~50/50) and LA-
  maintained schools (2,876,996 pupils, −11.2% since 2019/20) — real,
  plausible national demographic figures, not fabricated.
- `Special schools` was correctly and honestly omitted from the returned
  sector data (no real `roll_aggregates` row exists for it yet — a known,
  pre-existing data-coverage gap documented in
  `20261010091000_roll_aggregates_sector_scope.sql`'s own comment, not a
  bug introduced this round).
- Graph 1's input series (periods 2019–2025, values
  `[1072, 1135, 1168, 1163, 1166, 1218, 1252]`) matches exactly the same
  figures already independently verified in Parts A and C for this school.
- `tsc`/`lint`/`build` all clean; lint at the same 7-problem pre-existing
  baseline.

**Not verified this round**: the accordion open/close behaviour, the legend
checkboxes, the 10-school threshold's actual on-screen effect, and the new
stacked-bar/donut/shape-chart layouts were all confirmed via code review and
type-checking only — the Chrome browser extension was unreachable for the
whole of this session, so no live visual/interaction check was possible for
any of Part B's UI. This is a bigger honest gap than Parts A/C's narrow-width
caveat, since several of Part B's changes (the checkbox interaction, the
threshold-driven default-mode switch, the modal window) are genuinely
interaction-dependent, not just layout. Recommend a real click-through pass
next time the extension is reachable, before treating Part B as fully done.

### Files changed

- `src/lib/aggregate-trends.ts` (gender fields, `fetchSectorAggregatesForMany`, threshold)
- `src/app/api/data-view/aggregate-trends/route.ts` (`sectors` param)
- `src/components/data-view/TargetRollBarChart.tsx` (new)
- `src/components/data-view/GenderSplitBarChart.tsx` (new)
- `src/components/data-view/RollTrendsChart.tsx` (a/b/c/d)
- `src/components/data-view/AddSubtractSchoolsWindow.tsx` (optional search-add)
- `src/components/dashboard/GenderSplitCard.tsx` (exported, self-contained `Donut`)
- `src/components/data-view/GraphsView.tsx` (full restructure)
- `src/components/data-view/DataViewShell.tsx` (sector-aggregate fetch + prop)

Commit: `188bb59`.
