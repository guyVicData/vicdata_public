# Build report: Academic Results stage-1 review fixes (wiring/functionality)

Brief: `docs/vicdata_phase3_academic_results_stage1_fixes_brief_v1.md`. Built and
tested locally only; nothing committed or pushed, per instruction.

**Browser tool check**: checked at the start of this round, same as every prior
round. No Claude-in-Chrome connection was available this session. Part A explicitly
asked for a real interaction test if a browser tool exists — it doesn't, so that
specific check (load → Graphs → Rankings → Map, confirm markers survive) was **not**
performed and is not implied below. Everything else was verified as far as a
dev-server + real data + code-level check can go; where that falls short of a real
rendered-page confirmation, it's flagged explicitly rather than implied.

## Diagnosis — confirmed against the real code before changing anything

- **Part A root cause**: confirmed directly. `MapView.tsx`'s own init effect (lines
  ~502-521) has a `ResizeObserver` calling `map.invalidateSize()` plus a cleanup that
  disconnects it and calls `mapRef.current.remove()`; `AcademicMapView.tsx`'s
  equivalent effect had neither — its cleanup was just `cancelled = true`. Also
  confirmed `AcademicDataView.tsx`'s `DataViewErrorBoundary` key
  (`${activeView}-${effectiveStage}-${familyId ?? "whole"}`) does fully unmount/remount
  `AcademicMapView` on every view switch or Category change, exactly as the brief
  said.
- **Part B root causes**: confirmed `AcademicDataView.tsx`'s render call for
  `AcademicRankingsView` passes only `targetProfile`/`tickedProfiles`/`stage`/
  `startPeriod` (no `familyId`), confirmed `AcademicRankingsView.tsx`'s own header
  comment documents this as deliberate, and confirmed `CategoryFilter` was rendered
  unconditionally regardless of `activeView`. Confirmed `CategoryPill`'s `hasCaret`
  prop rendered a bare `▾` with no expansion behaviour anywhere.
- **Part D root cause**: re-confirmed against real local data before writing any code
  (same real figures the brief itself cites): Leighton Park (URN 110110) and
  Wellington College (URN 110125) both show `ebacc_94_percent`/`engmath_94_percent`
  exactly 0.0 with a real, low `attainment8_average` (15.0/15.1 for 2024/25), and
  Huntington School (URN 121673, the control) shows real EBacc figures (38.6%/25.8%).

## Part A — Map remount fix

`AcademicMapView.tsx`'s Leaflet init effect now matches `MapView.tsx`'s own pattern
exactly: a `ResizeObserver` is created after `mapRef.current = map`, observes
`mapElRef.current`, and calls `map.invalidateSize()` on resize; the effect's cleanup
disconnects the observer and calls `mapRef.current.remove()` before nulling the ref.
Copied the mechanism only, not clustering/gesture-handling (out of scope, unchanged
from the original build brief).

**Verification**: no browser tool available, so the actual "map survives a Map →
Graphs → Rankings → Map switch" behaviour was **not visually confirmed** this round —
flagging this plainly rather than implying it was. What was confirmed:
`npx tsc --noEmit` and `eslint` both clean; the new code is a line-for-line copy of
the exact mechanism already live and working in Rolls' own `MapView.tsx` in
production (the same `ResizeObserver`/`invalidateSize`/`remove()` calls, same
`useEffect` shape), not a new, untested approach. Confirmed via the real
`/api/data-view/academic-schools` route that the underlying data this component
renders (population/family figures for Leighton Park) is unaffected by this change —
a real regression check at the data layer, even though the visual remount itself
couldn't be observed.

## Part B — Category filter fixes

1. `CategoryFilter` is now only rendered when `activeView !== "rankings"` in
   `AcademicDataView.tsx` — hidden, not disabled (it doesn't apply to Rankings at
   all, not "temporarily unavailable"). Family-level Rankings was **not** built —
   confirmed this stays a deliberate round-2 scope cut, not reopened.
2. Removed `CategoryPill`'s `hasCaret` prop and the `▾` it rendered entirely, since
   nothing expands from the pill. Flagging explicitly, as asked: **whether the
   Subject picker should move closer to the Category pills it logically follows from
   is a real, separate design question** — stage 2/4 territory (UI/UX, changes/
   additions), not decided or attempted here.
3. Confirmed `AcademicGraphsView`'s own `{familyId && familyLabel && (...)}` section
   is real, present code (verified by reading the file directly) and confirmed via
   the real `/api/data-view/academic-schools` route that Leighton Park has 30 real
   `ks4Families` rows to render there — the section has real data to show. Could
   **not** visually confirm it actually renders/updates on a real category-pill click
   (needs a browser, none available) — flagging this the same way as Part A rather
   than assuming Guy's original flag was purely a "below the fold" issue.

## Part C — Map tooltip fix

`AcademicMapView.tsx`'s marker tooltip now shows real figures, not just the school
name: the same value already driving circle size (population at the stage's age, or
family `entriesTotal` when a category is selected) and the same average already
driving circle colour (the headline measure, formatted via the existing
`HEADLINE_UNIT`/`HEADLINE_LABEL` pattern, or family `avgPointScore`) — both hoisted
out of the existing colour-mode branches rather than recomputed, so the tooltip can
never disagree with what the circle itself is showing. Built as HTML via
`L.Tooltip`'s HTML support, matching `MapView.tsx`'s own multi-line
`<strong>name</strong><br/>stats` pattern (including its `escapeHtml` — duplicated
locally, matching this file's existing "small self-contained copy" convention, since
`MapView.tsx`'s own version is module-private).

Example real output for a headline-level A-level map, Huntington School: `<strong>Huntington
School (this school)</strong><br/>53 17-year-olds, 38.5 average points per A-level entry`
(confirmed by tracing the exact real values through the code against the same data
verified in earlier rounds — 53 = age-17 population, 38.5 = `A level::aps_per_entry`
for 2024).

## Part D — IGCSE exclusion caveat

New `igcseExclusionLikely(profile)` and `IGCSE_EXCLUSION_CAVEAT` in
`academic-data-view.ts` — the real, checkable trigger (`ebacc_94_percent === 0 &&
engmath_94_percent === 0 && attainment8_average !== null && attainment8_average > 5`,
using the `> 5` threshold from the wordings doc's own §11, not a looser "non-trivial"
guess) and the exact wording from `vicdata`'s own
`docs/vicdata_phase3_academic_results_summary_wordings_v1.md` §11, copied verbatim,
not redrafted. Wired into both places the brief named:

- The free Academic snapshot card (`AcademicSnapshotCard.tsx`) — shown under the GCSE
  line only, when the trigger fires.
- Data View Graphs' Overview section (`AcademicGraphsView.tsx`) — shown under the
  headline stat, KS4 only (`stage === "ks4" && igcseExclusionLikely(targetProfile)`).

**Verified with real data, real execution**:

```
$ npx tsx <script calling fetchAcademicProfiles + igcseExclusionLikely>
110110 Leighton Park School -> igcseExclusionLikely: true
110125 Wellington College -> igcseExclusionLikely: true
121673 Huntington School -> igcseExclusionLikely: false
```

**Verified with a real dev-server request** (not just the function in isolation) —
the free card's actual server-rendered HTML:

- Leighton Park (110110): "...Attainment 8 score of 15.0 in 2024/25." **+ the caveat,
  present.**
- Wellington College (110125): "...Attainment 8 score of 15.1 in 2024/25." **+ the
  caveat, present.**
- Huntington School (121673, control): "...Attainment 8 score of 48.2 in 2024/25."
  **caveat correctly absent.**

The Data View Overview path reuses the exact same `igcseExclusionLikely`/
`IGCSE_EXCLUSION_CAVEAT` values already proven correct above, just rendered from a
client component instead of a server component — not independently re-verified in a
rendered browser (none available), but the trigger logic and data are identical to
what the free-card test already exercised end-to-end.

## Verification summary

- `npx tsc --noEmit`: clean, both before and after every change.
- `npx eslint` on every changed file: clean, no issues.
- Real execution, not just type-checking: `igcseExclusionLikely` run against real
  local data for all three named schools (exact expected true/true/false); the free
  snapshot card's real server-rendered HTML confirmed for all three; the
  `/api/data-view/academic-schools` route confirmed returning correct real data
  (headline measures + 30 real family rows) for Leighton Park post-fix.
- **Not verified, plainly**: the actual visual behaviour of the Map after a
  Graphs/Rankings/Map switch (Part A), the Category filter's visibility toggle and
  the family section's live update on a real click (Part B), and the tooltip's real
  on-hover rendering (Part C) — all genuinely need a browser, which wasn't available
  this session. The underlying data and logic for all of these were confirmed
  correct at the code/data level; only the actual rendered interaction is unconfirmed.

## Confirmations

- Nothing was written to hosted/production: all testing used local Supabase stacks
  (`vicdata` and `vicdata_public`, ports temporarily remapped to coexist, config
  reverted afterward — `git diff` on `config.toml` is clean) with explicit local env
  overrides; neither repo's own hosted `.env` was read into any command's
  environment. Both local stacks stopped since testing finished, matching their
  state at the start of this round.
- No unrelated regressions: `tsc`/`eslint` clean across the whole project, and the
  data layer underlying every one of these components was re-confirmed working via
  real API calls, not just assumed unaffected.
- Do not commit or push, as instructed — stopping here. Guy will review these fixes
  against Leighton Park, Wellington College, and Huntington School himself.
