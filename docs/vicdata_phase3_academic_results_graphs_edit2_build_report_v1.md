# Build report: Academic Results — Graphs page (edit 2)

Brief: `docs/vicdata_phase3_academic_results_graphs_edit2_brief_v1.md`. Built and
tested locally only; nothing committed or pushed. Standalone Graphs-page round —
nothing about the Map's colour/palette was touched (confirmed by `git status` at
the end — only the files this report names were modified).

**Browser tool check**: checked at the start of this round — no Claude-in-Chrome
connection available this session, consistent with every prior round. Flagged
explicitly below wherever this round's own build notes ask for a screenshot.

## Section 1 — KS2's "candidate numbers since [year]" now a real multi-year trend

Root cause was already correctly identified in the brief: KS2's roll-population
fallback (`populationAtAge`) only ever reads `AcademicSchoolProfile.ageGenderCounts`,
a single current-snapshot Map, never a series — so the trend line could only ever
plot one point, regardless of the fallback itself being the right real source.

**Fix**: extended `AcademicSchoolProfile` with a new `ageGenderCountsByPeriod: Map<number,
AgeGenderCounts>` field, computed in `fetchAcademicProfiles` from the SAME already-
fetched `censusFacts` (no extra round-trip) via `singleAgeGenderCountsForPeriod` per
real distinct period present — mirroring `data-view-profiles.ts`'s own real
`ageGenderCountsByPeriod` computation exactly, not re-derived differently. Added
`populationSeriesAtAge(profile, age)`, the KS2 analogue of `entriesSeries`, and wired
Section 1's KS2 branch to it. Extended the wire serialize/deserialize functions
(`serializeAcademicProfile`/`deserializeAcademicProfile`) for the new Map field, same
array-of-tuples convention `ageGenderCounts` itself already uses (nested one level,
since this is a Map of Maps) — a real bug class this codebase already hit once before
(`JSON.stringify` silently drops `Map` fields), guarded against here from the start.

**Real per-school year range found** (confirmed directly, not assumed, before wiring
the chart — read-only against hosted, via a script importing and calling the actual
production functions):

```
Yerbury Primary School (100429):    2019, 2020, 2021, 2022, 2023, 2024, 2025
Brookfield Primary School (100011): 2019, 2020, 2021, 2022, 2023, 2024, 2025
Duncombe Primary School (100403):   2019, 2020, 2021, 2022, 2023, 2024, 2025
St Aidan's VC Primary (102132):     2019, 2020, 2021, 2022, 2023, 2024, 2025
```

7 real years, consistent across all four schools checked (2019/20 through 2025/26 —
the real census range this project's roll data already covers elsewhere). Yerbury's
own real age-10 population series: `59, 61, 60, 58, 61, 59, 57` — a real, genuinely
plottable trend, not a single point.

**Real wire round-trip verified** (the actual production data path — server
`serializeAcademicProfile` → `JSON.stringify`/`JSON.parse` → client
`deserializeAcademicProfile` — not just the in-process fetch): Yerbury's real
`ageGenderCountsByPeriod` survives the round-trip with all 7 real periods and
identical values, confirmed by direct comparison.

## Section 2 — preserved headline block deleted

Deleted the entire `<div className="mb-6">...</div>` block: the headline number,
`SpreadStrip`, and `TargetVsAverageTrend` chart that Round 3's own build had kept as
a named, deliberate "introductory" judgement call. Section 2 is now just the two
`Card` components (the same-year "Results summary" bar chart, and the growth/decline
chart), side by side, nothing above them — exactly Part B's own original ask.

Also removed the resulting dead code this deletion left behind (traced by hand, then
confirmed against `eslint`'s own unused-variable warnings): `targetDominantKs5Cohort`/
`targetHeadlineMeasureKey`/`targetHeadlineLabel`/`targetHeadlineValueAt`/
`targetLatestYear`/`targetCurrent`/`targetAnchor`/`targetTrendBadge` (the whole
headline-number computation chain), `spreadPoints`/`spread`/`groupAverage`, and
`targetSeries`/`averageSeries` — along with their now-unused imports
(`dominantKs5Cohort`, `ks5HeadlineMeasureKey`, `ks4ExclusionTargetSentence`,
`spreadData`, `SpreadStrip`). `groupHeadlineLabel` and the `TargetVsAverageTrend`
component itself both stay — the label is still used by Section 2's own retained
captions, and the chart component is still used by Section 3's family-level trend.

**Before/after**: no screenshot possible this session (no browser tool). Before —
the section opened with a large "74.0%" stat, a "▲ 5% since 2022/23" line, a
dot-strip spread indicator with min/max labels (47.0%/93.0%) and an "X% above the
average of Y%..." sentence, then a two-line target-vs-average chart, all above the
two side-by-side graphs. After — the section opens directly on the
`grid grid-cols-1 gap-4 lg:grid-cols-2` two-`Card` row; nothing renders above it.
Confirmed by direct code diff (the exact block named in the brief, `~L440-476` in
the pre-edit file, is gone in full) rather than a rendered screenshot.

## Section 3 — the actual picker moved, not just its downstream content

Confirmed the brief's own diagnosis by reading both files directly: `CategoryFilter`
(and its private `CategoryPill`) really was still being rendered from
`AcademicDataView.tsx`'s own header row, gated on `activeView === "graphs"`, while
Round 3 had only relocated the family-dependent CONTENT into `AcademicGraphsView.tsx`'s
new Section 3 — the control that actually sets `familyId` was never moved.

**Fix**: moved `CategoryPill`/`CategoryFilter` out of `AcademicDataView.tsx` entirely,
into a new file, `src/components/data-view/CategoryFilter.tsx` — a genuinely separate
file rather than exporting the definition from `AcademicDataView.tsx` and importing
it into `AcademicGraphsView.tsx` directly, because that would have created a real
circular import (`AcademicDataView.tsx` already imports `AcademicGraphsView` to
render it). Both `AcademicDataView.tsx` (Map's own copy, unchanged position/behaviour,
below the map div) and `AcademicGraphsView.tsx` (the actual fix, Section 3) now
import the same component from the new shared file — one real definition, not two.
`familyId`/`families` state stays owned by `AcademicDataView.tsx` exactly as before;
`AcademicGraphsView` now also receives `families` and `onFamilyChange` as new props,
threaded from the same existing state via the existing `setFamilyId` handler — a real
relocation of the rendered control, not a new picker or a new state owner.

**Real design call, confirmed rather than assumed**: Section 3 now always renders
(previously gated on `familyId && familyLabel`, i.e. invisible until a family was
already picked). With the picker living inside Section 3 itself now, that old gate
would have made the section permanently unreachable — there would be no control
anywhere else on the page to ever set `familyId` in the first place. The section now
shows the picker plus a real empty state ("Pick a category above to see its own
subject/family breakdown here") before a family is selected, and the existing content
once one is.

**Confirmed unaffected**: Rankings never rendered `CategoryFilter` at all (a
deliberate, pre-existing round-2 scope cut, untouched) — no import, no reference,
confirmed by reading `AcademicRankingsView.tsx` directly. Map keeps its own
`CategoryFilter` render exactly where it was (below the map div, item 8's own
existing placement), driving the exact same `familyId`/`setFamilyId` state as before
— only its import path changed (now from the new shared file), not its behaviour.

**Real data confirmed for the picker itself**: Wellington College's own real KS4
subject families (`availableFamilies`, read-only against hosted) — 5 real
categories: Arts/Media/Design, Enterprise & Applied Studies, Humanities & Social
Sciences, Languages & Literature, Technology/Engineering/Construction — confirming
the moved picker has real, meaningful options to show once rendered in its new
position.

## Verification

- `npx tsc --noEmit`: clean.
- `npx eslint` on every touched/new file: clean (several genuinely dead variables
  and imports were found via eslint's own unused-var warnings after Section 2's
  deletion, then removed — not left as silent dead code).
- `npm run build`: clean, full production build (confirms the new
  `CategoryFilter.tsx` module and its two real import sites resolve correctly, and
  that moving the component didn't introduce a real circular-import failure at
  bundle time).
- Real execution, not code inspection alone, for Section 1 (real per-school year
  range across 4 real schools, a real wire-serialization round-trip) and Section 3
  (real family list for a real school) — read-only against hosted, via scripts that
  import and call the actual production functions.
- **Not verified**: the actual rendered page for any of the three items — no
  Claude-in-Chrome connection this session. Section 2's own before/after is
  described from a direct code diff, not a screenshot, as asked for but not
  possible this round; flagged plainly rather than implied.

## Confirmations

- `git status` before writing this report showed only the files this report names
  as touched (`AcademicDataView.tsx`, `AcademicGraphsView.tsx`, the new
  `CategoryFilter.tsx`, `academic-data-view.ts`, plus this round's own brief/report/
  prompt docs) — nothing Map-colour/palette-related was touched by this round's own
  work. (Two unrelated docs from a separate, stopped prompt were already sitting
  modified in the working tree before this round started — left exactly as found,
  not committed, not discarded.)
- Nothing written to hosted/production — every check this round was a read-only
  query against real, already-ingested data; no ingest, no migration, no write of
  any kind.
- Nothing committed or pushed, per this round's own explicit local-only instruction.
- Stopping here — Guy will review all three items against the live page himself.
