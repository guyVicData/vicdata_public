# Grade bands & counts — Teacher view frontend build (Claude Code prompt v1)

Backend is live in production (`academic_subject_grade_rollup`, `academic_subject_grade_geography_aggregate`, `academic_subject_grade_geography_lookup` — the last granted to `anon`, `p_grade: text[]`, `p_grade = null` returns every grade's own row unsummed). This round is `vicdata_public` only. Ground every step against the real files named below before writing — they were read to write this prompt, but re-check anything version-sensitive (this repo moves fast) rather than trusting this prompt's line numbers.

## Step 0 — re-ground the measure architecture

Read `src/lib/teacher-view-panels.ts` in full (`MeasureId`, `Measure`, `measuresFor()`, `COMING_SOON_MEASURES`), `src/components/teacher/MeasurePicker.tsx`, and wherever `resultsMeasures`/`measuresFor(phase)` feeds `MeasurePicker` (`src/app/teacher/[phase]/page.tsx` around the `MeasurePicker` call). Confirm nothing has moved since this prompt was written; if it has, follow the real current shape, not this prompt's description of it, and note the drift in your build report the way earlier rounds did for T Level and VRQ sizing.

## Step 1 — grade scale ordering and presets

`src/lib/subject-grades.ts` already exports `gradeOrderFrom(...gradeSets)`, `GRADE_SCALES`, `BOTTOM_RANK`, `NON_GRADE_VALUES` — use `gradeOrderFrom` to get a subject's real scale order from whatever grades are actually present in its `SubjectGradeCount`/geography rows (union of school + benchmark grades, so a grade the school has but the benchmark suppressed, or vice versa, still orders correctly). Do not add a second static per-qualification-type scale table.

Add a small presets table, keyed to the GCSE 9-1 scale specifically (matched by identity against `GRADE_SCALES[0]`, not by qualification-type string, since the same scale array can carry different qualification-type labels): `{ "4-9": ["4","5","6","7","8","9"], "7-9": ["7","8","9"] }`. Every other scale gets no presets — the picker still works (Custom only), it just has no quick-select chips. Do not invent presets for A-level/IB/vocational/Pre-U/T Level; if a real DfE convention for one of those turns up during this build, flag it rather than adding it unasked.

## Step 2 — the range-picker + distribution chart component

New shared component (e.g. `src/components/teacher/GradeDistribution.tsx`): one per-grade horizontal bar list, in `gradeOrderFrom` order, each row a real `<button>` (the grade label) plus a track showing this school's `%`/count and a benchmark tick mark for the LA/region/national figure. Props roughly:

```ts
type GradeRow = { grade: string; ownCount: number; benchPct: number | null };
function GradeDistribution({
  rows,           // GradeRow[], already in scale order
  total,          // school's own total entries, for pct = ownCount/total
  color,          // this subject's qualification-family colour (teacher-view-theme.ts's colourByGroup)
  rangeLo, rangeHi,     // grade strings or null -- the currently highlighted span, inclusive
  onGradeClick,   // (grade: string) => void -- the two-click range mechanism lives in the CALLER's state, not in this component
}: { ... }): JSX.Element
```

Click handling (own the state in whichever component renders this per measure/subject — likely alongside the other chosen-subject/from-year state already lifted in `SubjectPanels.tsx`): first click on a grade sets it as both `rangeLo` and `rangeHi` (a zero-width pending range); the next click on ANY grade sets the final `rangeLo`/`rangeHi` as the min/max of the two clicked grades' scale positions (order-independent). Clicking a grade already inside an active range starts a new pending range from that grade rather than requiring a clear first. A small clear control removes the range entirely (only relevant where a range isn't required, i.e. Grade counts).

Exclude `NON_GRADE_VALUES` from the chart entirely (they are not attainment). Grades in `BOTTOM_RANK` (Fail/U/Unclassified) still render, at the bottom, and are clickable like any other grade — a custom range CAN legitimately include them (a real teacher might want "5 and above, and separately how many got U"), only the two shipped presets happen not to.

## Step 3 — benchmark fetch

Find and read whichever real function already combines LA + region + national into one result for the sibling `academic_subject_qualification_geography_lookup` (used by `GeographyComparison.tsx`, surfaced there as `geo.data?.la`/`.region`/`.national`) and mirror its exact shape for a new grade equivalent, calling `academic_subject_grade_geography_lookup` with `p_grade: null` (one call per grouping, returns every grade's own `entries_total`/`school_count` row, not pre-summed) rather than writing new combining logic. Respect the RPC's own `p_min_school_count` suppression (default 5) — do not pass a lower value from the frontend to work around a thin row; a suppressed row should read as "not enough schools to show" (the real convention `20260926140000`'s sibling suppression already established), not silently show anyway.

A band's rate for either school or benchmark side is: sum of `entries`/`entries_total` for every grade in the range (inclusive), divided by the sum across every grade found for that subject/qualification/period — one small pure function, used for both the school's own `gradeDistribution` (already fetched, see Step 4) and the benchmark rows from Step 3, so "how do I turn a set of per-grade rows into a range's rate" is written once.

## Step 4 — the school's own data: no new fetch

`fetchSubjectLevelData`/`fetchSubjectLevelDataForSchools` in `src/lib/academic-data-view.ts` already return `gradeDistribution: SubjectGradeCount[]` from the same raw facts these functions already pull for entries/value-added — confirm this is already wired into whatever loads Column 1/Column 3's subject data today, and read it there rather than adding a parallel fetch. Its own comment states it only covers sources from 2023/24 on; do not extend that coverage as part of this round, and make sure any period list this build shows (Trend axis, the "From" year picker) is built from whichever periods `gradeDistribution` actually has rows for, not the longer period list `entries`/`points` can show — a Grade bands Trend line with a period on the axis but no real grade-level data for it is worse than a shorter, honest axis.

## Step 5 — wire the two measures

Extend `MeasureId` to `"entries" | "points" | "threshold" | "bands" | "counts"`. Add `bands` and `counts` `Measure` records (or whatever the real `Measure`-adjacent shape turns out to need once you're inside the type — `counts` may need a variant of `Measure` without `format`/`formatDelta`/`aggregate` if those turn out to be load-bearing for panels this measure doesn't have; don't force a single-number contract onto a measure that has none). Remove both from `COMING_SOON_MEASURES`.

**Grade bands**: Current panel renders via `NumberTiles`, mirroring whatever real component/layout `threshold`'s own Current view uses today (read it before generalising it) — hero = the active range's rate, tiles = raw count in range / benchmark rate / signed gap (`DIRECTION_TEXT`/`DIRECTION_HEX` for the gap's colour, matching every other gap figure in this build). The preset/custom chip row (Step 1/2) sits above the tiles. Trend and % change reuse the existing line-chart/bar-chart mechanism `threshold` already has, fed the range's own rate per available period. Default range on load: the `7-9` preset where one exists (GCSE), else no range (Current shows a "pick a range to see a rate" prompt, not a fabricated default).

**Grade counts**: Current panel renders `GradeDistribution` directly, no range highlighted by default (the picker is still there — a teacher can highlight a range ad hoc without switching to the Grade bands measure to do it). Trend panel: no line chart; reuse the real `FromYearMenu` component (already used on Context's and Comparisons' Trend panels) to pick an earlier year, and render two `GradeDistribution`s (or one paired/mirrored rendering) — this year vs. the chosen year — so the shift per grade is visible directly, not summarised into one number. % change panel: each grade's own change (count and/or share), computed with whatever real `changeOver`-equivalent function this codebase already uses for other panels' change lists, not a bespoke calculation.

## Step 6 — Column 3 (Comparisons) and Context

Column 3: wire Grade bands into the existing `rankingSet` ranking-by-rate mechanism from the snagging round 1 build (find the real Part 4 implementation and match its pattern exactly — it already exists for Average point score and Grade 4+ rate) — do not build a second ranking mechanism. Feed it each comparator school's own range rate from `fetchSubjectLevelDataForSchools`'s per-school `gradeDistribution` (Step 4, already fetched for the comparator set) against the same benchmark grouping the ranking set already uses. Grade counts gets no Column 3 ranking this round — Current-panel-only there, same as Column 1.

Context: wire Grade bands into the existing generic `donut?: {...}` prop on `SubjectPanels` (already built, already used elsewhere in this app) — group totals = whole-school entries in the active range vs. every other entry, self-inclusive per the existing donut convention. No new component.

## Verify

- Presets and custom range-picking both work on at least one GCSE subject (a numeric 9-1 scale) and one genuinely different scale (a real BTEC/vocational subject at this school, or IB/A-level if that's what's actually taught) — confirm the SAME `GradeDistribution` component renders both correctly with no GCSE-specific assumption leaking in.
- A grade below the RPC's 5-school suppression threshold reads as legitimately hidden, not as zero or missing data.
- Grade bands' Trend/%change and Grade counts' year-comparison all show only real periods that have real grade-level data — no period on an axis with nothing behind it.
- Column 3's ranking for Grade bands matches the existing Average point score/Grade 4+ ranking's real behaviour (sorting, own-school highlight, thin-set handling) exactly, not a re-implementation with different edge-case behaviour.
- `tsc`, `eslint`, `next build` clean.
