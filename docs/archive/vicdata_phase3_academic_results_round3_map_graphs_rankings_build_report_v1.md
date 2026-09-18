# Build report: Academic Results round 3 — Map (edit 2), Graphs (edit 1), Rankings (edit 1)

Brief: `docs/vicdata_phase3_academic_results_round3_map_graphs_rankings_brief_v1.md`.
Built and tested locally only. **Nothing committed or pushed in either repo**;
nothing written to hosted/production in either repo. Two repos touched:
`vicdata` (the A1 ingest change) and `vicdata_public` (everything else).

**Browser tool check**: checked at the start of this round (`tabs_context_mcp`) —
still "Browser extension is not connected," consistent with every prior round.
Verification below is real code + a local Supabase stack for `vicdata` (started
fresh, stopped at the end) + real production TypeScript functions called directly
against real data, not inspection or guessing.

## Part A — Map (edit 2)

### A1. Real entries/candidate numbers (decided) — done, backfilled, verified

**vicdata (ingest)**:
- `dfe_ks4_headline.py`: added `pupil_count` to `_INDICATOR_COLUMNS`. Whole-cohort
  scope already (no `exam_cohort` dimension in this source at all), so no special
  handling needed.
- `dfe_ks5_headline.py`: added `end1618_student_count` to `_NUMERIC_COLUMNS`, but
  **not** treated like every other entry in that list — it's a real
  WHOLE-INSTITUTION figure (identical across every `exam_cohort` row for a
  school/period), and the source CSV has one row per `(school, period, exam_cohort)`.
  Landing it the same way as every per-cohort column would have inserted several
  duplicate `canonical_facts` rows for the same real `(entity_id, period, breakdown)`
  — `insert_canonical_facts` is a plain batched `INSERT`, no `ON CONFLICT`, so these
  would have been real extra rows, not silently deduped. Added a new
  `_WHOLE_INSTITUTION_COLUMNS` set and a real first-seen dedup keyed on
  `(urn, period, indicator)` inside `_parse`, landing this one field WITHOUT the
  cohort prefix in its own breakdown key, exactly as the brief specified.

**Real bug found and fixed along the way**: `ingest/academic_aggregates.py`'s
`_ks5_headline_numeric_rows` does `cohort, indicator = breakdown.split("::", 1)` over
every key in a school's `academic_headline_snapshot.measures` blob — this crashed
("not enough values to unpack") the first time a real snapshot containing the new
bare `end1618_student_count` key (no `"::"` at all) was recomputed. Fixed with a
guard (`if "::" not in breakdown: continue`) — a whole-institution figure has no
per-cohort split to preserve and was never a candidate for this function's own
`_KS5_NUMERIC_INDICATORS` set anyway. Searched the rest of both repos for other
`.split("::")` sites that touch KS5 headline breakdown keys specifically — none
found (the other Python site is subject-level only; the two TypeScript sites are
subject-level only; the one SQL `split_part` site can't throw on a missing
delimiter, confirmed from Postgres's own documented behaviour).

**Real backfill, against a local Supabase stack (`supabase start` in `vicdata`,
never hosted)** — before/after row counts:

| source | before | after | new snapshot rows | new field's own real rows |
|---|---|---|---|---|
| `dfe_ks4_headline` | 113,471 | 243,907 | 130,436 | 16,965 `pupil_count` facts |
| `dfe_ks5_headline` | 208,799 | 428,412 | 219,613 | 10,814 `end1618_student_count` facts |

`end1618_student_count`'s dedup was checked directly: `10,814` unique `(urn, period)`
pairs for exactly `10,814` total facts of that breakdown — no duplicates landed.
Confirmed `dominantKs5Cohort`'s own real signal (`aps_per_entry_student_count`) is
completely unaffected: Acland Burghley's real per-cohort counts are still `A level:
102`, `Academic: 111` (URN 100053), identical to every prior round's own confirmed
figures.

**vicdata_public**: new `entriesCountAt`/`latestEntriesCount`/`entriesSeries`/
`latestMeasureAt` helpers in `academic-data-view.ts` — `AcademicSchoolProfile`
itself didn't need new fields (the new columns flow through the existing generic
`measures` passthrough automatically, confirmed directly via the real RPC). GCSE/
Post-16 circle size + popup entries figure now use these; Post-16 uses the
whole-institution total in the default (no cohort selected) state, the specific
cohort's own `aps_per_entry_student_count` once one is selected, per the brief's own
instruction. KS2 unchanged (`populationAtAge`).

**Real execution verification** (local `vicdata` stack + hosted `vicdata_public`
schools data, same read-only precedent every prior round used):
```
Wellington College (KS4): pupil_count = 217 (2024/25) -- matches the DB directly.
Acland Burghley (KS5), default: end1618_student_count = 143 (whole-institution)
  per-cohort A level = 102, Academic = 111 -- exactly the prior rounds' own figures.
```
**Caught and fixed in my own verification script, not a product bug**:
`fetchAcademicProfiles`'s own doc comment already says "same order as the input
WHERE POSSIBLE" — not a strict guarantee. My first pass destructured its result
positionally and silently got Wellington/Acland Burghley's data swapped; re-run
matching by URN gave the correct figures above. Flagged here for transparency about
the verification process itself, not because any production code needed a fix.

### A2. Grade-band colour scale (decided) — real, separate, value-based scale

New `gradeBandColour`/`GRADE_BAND_LEGEND_STOPS` in `trend-colours.ts`: a genuinely
separate sequential (light-to-dark blue) palette, five real named hex stops, same
shape as `TREND_STOPS`. `min`/`max` now real per-render state (`useMemo`, hoisted
alongside `minSize`/`maxSize`), recomputed on every set/exclusion/stage change,
shared by the drawing effect AND the new `GradeBandColourKey` legend (never
recomputed twice). `min === max` (one school, or no real variation) reads as the
middle stop, not the flattest or richest colour.

### A3. Button reorder + reposition — done

Order reversed (Grade band, then Trends); moved back to the right-side overlay
stack under `PdfExportButton`, superseding round 2's left-overlay placement.

### A4. Popup refinement — done

Bold key numbers, one stat per line, a real per-stat date (see `latestMeasureAt`
below), a real rank on the grade-band popup, shared noun-form growth/decline
wording (`src/lib/trend-labels.ts`, new).

**Real per-stat dates**: `latestMeasureAt` walks backward from the most recent year
row to the first one where that SPECIFIC key has a real value — not just
`latestYear(years)`, which only finds the most recent row at all regardless of
which measures within it are populated. This is what makes entries and headline
figures able to genuinely show different real years (Guy's own KS4 example: entries
at 2025/6, headline at 2024/5) rather than assuming they're always the same row.

**Real rank**: computed via `rankDescendingWithTies` against the current
`withCoords` set's own real headline values, recomputed every render (same
"recompute against the live set" discipline round 2's comparator widening already
established), not cached.

**`src/lib/trend-labels.ts`** (new): `TREND_LABELS` — noun (`Growth`/`Decline`/`No
change`) and adjective (`Growing`/`Declining`/`Broadly stable`) forms, keyed on
`trendBadge()`'s own real `direction` values. Rolls' `GraphsView.tsx`'s own inline
`TrendStatement` now reads its adjective from this module instead of a hardcoded
local copy — confirmed it's the only other consumer needing this exact three-way
split.

**Real design/judgement calls, named explicitly**:
- **pp vs. % magnitude** (`trendMagnitudeFor`, `academic-data-view.ts`): percent-unit
  measures (KS2 only) show a raw percentage-POINT difference; points-unit measures
  (GCSE Attainment 8, Post-16 UCAS points) show the existing relative percentage
  change `trendBadge()` already computes everywhere else — a genuinely different
  real quantity, matching Guy's own two worked examples exactly (`-25pp` vs. `-15%`).
  One shared function so the Map's popups and Rankings' Trend tile can't disagree.
- **Date format**: used the site's one existing `academicYearLabel` convention
  (`2024/25`, two-digit) rather than the brief's own worked-example shorthand
  (`2024/5`, one-digit) — read as informal shorthand in Guy's own note, not a
  deliberate third format, but flagged explicitly in case the shorter form was
  actually intended.
- **Popup-specific short labels**: `ENTRIES_NOUN`/`HEADLINE_STAT_LABEL`
  (`AcademicMapView.tsx`) are new, short, popup-only wording, distinct from the
  existing, more verbose `HEADLINE_LABEL`/`ks5HeadlineLabel` used elsewhere
  (Rankings' "Latest results" tile, Graphs captions) — matching Guy's own worked
  examples verbatim. `TREND_STAT_LABEL` is different: Part C's own Trend-tile
  example quotes A4's short wording verbatim, so that one specific label lives in
  `academic-data-view.ts`, shared by both the Map popup and Rankings' new Trend tile.
- **Real regression, flagged not silently accepted**: round 2's popup showed each
  circle's own specific resolved KS5 cohort label (e.g. "Academic" vs. "A level")
  for mixed-default-state transparency. A4's own worked Post-16 example ("36.3
  average UCAS points... #9 of 21 compared schools") has no cohort qualifier at
  all — implementing the literal requested copy drops that per-marker cohort
  transparency this round. A real, deliberate trade for matching the brief's own
  exact requested text, not an oversight — worth a look if the mixed-cohort case
  reads as confusing again.
- **Minor pre-existing wording tension, observed not fixed**: `trendBadge`'s own
  "flat" classification is based on relative `pctChange`, which can read oddly
  paired with a nonzero `pp` figure (real example found: Yerbury Primary's real
  current KS2 data gives `direction: "flat"` alongside a real `-4pp` move — "No
  change -4pp..."). `trendBadge` is shared, foundational code used everywhere in
  this app; not touched this round.

### A5. Post-16 map: Trend/Grade-band toggle real root cause — found and fixed

**Confirmed the brief's own suspected cause, by real execution against Post-16's
actual default state, not by inspection alone**: `gradeBandAvailable` was
`!familyId && (stage !== "ks5" || ks5Cohort === "A level")`. `AcademicDataView.tsx`'s
own `ks5Cohort` state defaults to `null` (Stage 2's own "no forced default"
decision) — evaluating the real expression with real default values:
`!null && ("ks5" !== "ks5" || null === "A level")` = `true && (false || false)` =
**`false`**. Confirmed deterministically: the ENTIRE colour-mode toggle was hidden
for every real Post-16 school in its real default state, and for every cohort
except "A level" once selected — not a partial gap, the whole control never
rendered. This matches Guy's own report exactly ("no map view" for trends — there
was no visible toggle to reach it at all).

**The real, separate data constraint underneath**: `GRADE_BAND_MEASURE.ks5`
(`"A level::aab_percent"`) is genuinely only a real DfE field for the A-level
cohort — confirmed directly, no equivalent AAB-or-higher-style threshold exists for
Academic/Applied general/Tech level/Technical certificate. Simply dropping the gate
without addressing this would have left grade band "available" but silently null
for every non-A-level cohort.

**Fix**: `gradeBandAvailable = !familyId` (family level keeps its own separate,
always-trend-only scope, round 2 Part B, untouched). Grade band's own colour SOURCE
now resolves per real school: when the row's resolved cohort (explicit selection,
or the school's own real dominant cohort in the default state) is "A level", it
colours by the real `aab_percent`; every other resolved cohort falls back to the
real headline value already being computed for that row — still a real, min-max
normalised, value-based colour (A2), just not an AAB-specific one, rather than a
fabricated figure or a silently-hidden feature.

**Real execution verification** (Acland Burghley, URN 100053, real dominant cohort
"Academic", the exact case the bug report was about):
```
resolved cohort: Academic
headline (own cohort) value: 36.26 (2024/25)
real A level::aab_percent at that period: 42.5 (confirms the field genuinely only
  exists for A level -- Acland Burghley's own resolved cohort isn't A level, so
  this figure is real but NOT what grade band colours this circle by)
A5 fallback in effect: grade band colours by 36.26 (the real headline value) --
  NOT null, so grade band mode now genuinely works for this school by default.
```

## Part B — Graphs (edit 1)

Restructured into three real, independently-collapsible sections (all open by
default), reusing Rolls' own `SectionHeading`/`Card`/`FullscreenChartModal`
directly (`GraphsView.tsx` — exported for this, matching the precedent
`GenderSplitCard.tsx`'s own `Donut` was exported under), not rebuilt versions.

- **Section 1 — Entries**: left, `TargetRollBarChart` (Rolls' own real bar+trend-line
  component, generic props, reused directly) plotting the target's own real entries
  series (`entriesSeries`, A1) for GCSE/Post-16; KS2 gets a single real current
  population point, which the SAME component already renders honestly as "not
  enough real history to plot a trend" rather than a fabricated line — matching
  Part B's own "same source... not a second computation" instruction without extra
  code. Right, `SortedBarChart` (existing, generic) of the comparison set's own
  latest real entries figures.
- **Section 2 — Results**: 50:50 two-column (`grid-cols-2`, same pattern as Rolls'
  own Section 02) — left, the same-year `SortedBarChart` (promoted from the old
  "Context over time" section); right, the growth/decline `DivergingBarChart`,
  moved here unchanged.
- **Section 3 — Subjects**: the existing subject-family selector and its content,
  relocated as-is under its own collapsible heading — "for now, just make the
  existing subject graphs visible here... then I will refine," per Guy's own note;
  not redesigned beyond the move.

**Real design call, named explicitly**: the brief's own 3-section spec doesn't
place the existing headline number/spread strip or the target-vs-average trend line
chart anywhere. Both are real, useful, pre-existing content the brief doesn't ask
to remove — kept as Section 2's own introductory content, above its two new/
relocated bar charts, rather than deleted or left floating outside every section.

**Small, additive change to the reused `Card`/`FullscreenChartModal`**:
`onOpenAddSubtract` is now optional. Academic has no equivalent global "Add/subtract
schools" window for the fullscreen modal's own button to open (its comparator set
lives in `AcademicDataView`'s ticked/added state, a different mechanism entirely) —
rather than wiring a dead button or building new comparator UI just to satisfy the
prop, the button is omitted when no callback is supplied. Every existing Rolls call
site still always passes a real callback, so this is purely additive.

## Part C — Rankings (edit 1)

Four real headline-number tiles above the existing rank tables, all reusing
existing computations (Overview's own Part-3 headline number, the rank tables'
own `rankDescendingWithTies`), not new calculations:

- **Latest results** / **Position**: split out of what used to be one combined
  "This school's position" tile — separate tiles now, matching Part C's own naming.
- **Trend** (new): direction + magnitude + since-date, using the SAME
  `trendMagnitudeFor`/`TREND_STAT_LABEL`/`TREND_LABELS` the Map's own popup uses
  (A4) — one real computation, not a second one here.
- **Position over time**: already existed; wording aligned to Guy's own
  "Up/Down/Static" (was "Risen/Fallen/Steady"), and "#N of M schools" changed to
  "#N of M **compared** schools" for consistency with the Map's own rank wording.

## Verification

- `npx tsc --noEmit`: clean, after every change.
- `npx eslint` on every touched file (both `vicdata_public` and, via the Python
  equivalent read-through, `vicdata`'s ingest changes): clean.
- `npm run build`: clean, full production build, all 35 routes.
- Real backfill against a local `vicdata` Supabase stack (started fresh this round,
  stopped at the end) — real before/after row counts given above, never run against
  hosted.
- Real execution, not code inspection alone, for A1's threading and A5's root cause
  and fix — against Wellington College, Acland Burghley, Sevenoaks, and Yerbury
  Primary, via scripts that import and call the actual production TypeScript
  functions, matching this session's own established methodology whenever a
  browser tool is unavailable.
- **Not verified**: the actual visual rendering of any of this round's six Map
  items, the three Graphs sections, or the four Rankings tiles in a real browser —
  no Claude-in-Chrome connection this session, flagged plainly rather than implied.

## Confirmations

- Nothing committed or pushed in either repo.
- Nothing written to hosted/production in either repo: `vicdata`'s own
  `supabase/config.toml` diff is empty (confirmed directly); the ingest backfill
  ran only against a local stack, which has been stopped.
- `git status` in both repos shows only the files this report names as touched.
- Stopping here, as instructed — Guy will review Post-16's own map (both colour
  modes, on a real school), the new Graphs sections, and the four Rankings tiles
  himself.
