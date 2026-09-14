# Build report: Academic Results — Region/Nation-scale comparator sets (round 2 of 2)

Brief: `docs/vicdata_phase3_academic_results_region_nation_comparator_brief_v1.md`.
Built and tested locally only; nothing committed or pushed, per this round's own
explicit local-only instruction.

**Browser tool check**: re-checked at the start of this round — `tabs_context_mcp`
still returns "Browser extension is not connected," consistent with every prior round.
No rendered screenshot was possible; all verification below is real script execution
against real hosted data, plus `tsc`/`eslint`/`npm run build`.

**Local stack check**: confirmed no dev server (`ps aux`) and no local Supabase/Docker
stack (`docker ps` can't reach the daemon — Docker isn't running) before or after this
round.

## What this round connects

Everything Rankings needed to reach Region/Nation scale for Academic: a new backend
RPC (`academic_region_nation_rank()`, vicdata's own database), a new Graphs data
source (`academic-aggregate-trends.ts`, reusing round 1's own choropleth table), and
the frontend wiring across `DataViewShell.tsx` → `AcademicDataView.tsx` →
`AcademicMapView.tsx` / `AcademicGraphsView.tsx` / `AcademicRankingsView.tsx`.

## Real design calls made

**1. The new RPC lives entirely in vicdata's own database — no cross-database join,
unlike round 1.** Confirmed directly before writing anything: `academic_headline_
snapshot`, `school_entities.la_name`, and `la_name_region_crosswalk` are all already
in vicdata's own Postgres project. `academic_region_nation_rank()`
(`vicdata/supabase/migrations/20260913340000_academic_region_nation_rank.sql`) is a
single real SQL function, modeled directly on `region_nation_rank()`'s own final
shape (its original migration plus its target-always-included, bounded-neighbours,
and drop-closed-schools follow-ups — all four read in full before writing this).

**2. Filter-parity scope is deliberately narrower than `region_nation_rank()`'s own —
the first flagged-open question, resolved by checking, not assuming.** vicdata_public's
own `FilterBar` (sector/boarding/gender/phase) is hidden entirely while the Academic
tab is active (confirmed directly: `DataViewShell.tsx`, `{activeTopic === "rolls" &&
<FilterBar .../>}`) — there is no live filter selection for this RPC to honour parity
with in the first place, so it takes none of `region_nation_rank()`'s
`p_sectors`/`p_boarding_mode`/`p_gender` params. The only real per-school narrowing
Academic's own UI ever applies — GCSE/IGCSE exclusion and KS5 cohort-type exclusion —
are both computed client-side from already-fetched profile fields, not something this
RPC replicates (a real, logged gap: a large-set ranked school could theoretically be
IGCSE-excluded or on the wrong KS5 cohort and still appear in the ranking, unlike the
small-set path's real exclusion). Single implicit measure only (the caller's own
`HEADLINE_MEASURE[ksStage]`) — same whole-school-default scope round 1's choropleth
already established, not extended to per-family/per-cohort variants this round.

**3. Lineage fallback — the second flagged-open question — does apply here, and is
applied to the whole ranked population, not just the target.** Checked directly:
`academic_headline_lookup`'s own migration comment documents a real, live, already-
confirmed gap (four real schools found with full headline coverage under their OLD
URN and zero rows under the NEW one GIAS now considers current). Since `academic_
region_nation_rank()` is per-school (ranking individual real schools), the identical
clean-1:1-Predecessor `school_lineage` fallback CTEs are ported verbatim from
`academic_headline_lookup` — but applied to every real school in the requested
region/nation pool, a genuine extension beyond that function's own per-target-only
scope: a pool school with a real Predecessor link would otherwise silently vanish
from the ranking entirely (excluded from the base population), not just fail to
resolve for the one school being viewed.

**4. Ranking picks each school's own latest period *for the specific measure being
ranked*, not the latest period overall.** `academic_headline_snapshot.measures` is one
flat jsonb blob per (school, stage, period) covering every real measure at once —
unlike round 1's `academic_geography_aggregate`, which is already pre-filtered to one
measure per row. Picking "latest period overall" first, then checking for the measure,
would wrongly drop a school whose most recent real row happens to lack that specific
field. The RPC's own `latest_headline` CTE filters to `measures ->> p_measure is not
null` before taking `distinct on (urn) ... order by period desc` — same
"latestMeasureAt" discipline `academic-data-view.ts` already established on the
frontend, ported to SQL.

**5. Single metric only (the headline measure), not three — confirmed against the
current, already-simplified shape of Rolls' own `RankingsView.tsx`, not the RPC's own
original three-metric comment.** `region_nation_rank()`'s own migration originally
returned roll/girlsPct/boardingPct, but `RankingsView.tsx`'s own current file (a later,
already-shipped follow-up round, "only Current Roll is ranked now") confirms Rolls'
own large-set Rankings UI has since been cut down to one metric. `academic_region_
nation_rank()` mirrors that current, simpler shape directly — one metric, no unused
girlsPct/boardingPct-equivalent fields — rather than porting the RPC's own original,
now-superseded three-metric design.

**6. `LARGE_SET_PROFILE_THRESHOLD` (200) transfers unchanged — confirmed, not
assumed, and doesn't actually depend on Academic-specific counts at all.** `isLargeSet`/
`regionNationScopeKey` are computed once in `DataViewShell.tsx` off the shared
`activeSet.schools.length` — every real school in the region/nation (primaries
included), not just KS4/KS5-eligible ones. Real verification (see below) found 813
real schools with real KS4 data in the South East region ALONE; the true
`activeSet.schools.length` for that same region (every real school, not just
KS4-eligible ones) is necessarily larger still. 200 is comfortably exceeded by any
real region or nation regardless of topic, so no Academic-specific re-tuning is
needed or was made.

**7. The per-ticked-URN profile fetch needs no large-set bypass of its own — a real,
structural confirmation, not a code change.** Unlike Rolls' own profile-fetch effect in
`DataViewShell.tsx` (which reads `activeSet.schools`, the WHOLE active set, and needs
an explicit `> LARGE_SET_PROFILE_THRESHOLD` guard to avoid fetching a full profile per
school), `AcademicDataView.tsx` was never given `activeSet.schools` at all — its own
`urnsKey` is built only from `urn`/`tickedUrns`/`addedUrns`/`ks5WidenedUrns`, every one
of which is already inherently bounded (`tickedUrns` resets to empty whenever a large
set is selected — `DataViewShell`'s own `setTickedUrns` call; `addedUrns` is a manual,
one-at-a-time search-add; `ks5WidenedUrns` caps at `needed = 10 - qualifying`). A
24,000-school Nation-scale set selected while viewing Academic cannot inflate this
fetch — there is no code path here that could read the full `activeSet.schools` list
even if it wanted to. Documented in place (`AcademicDataView.tsx`) rather than
silently left unexplained.

**8. Map: the auto-trigger is a straight mirror of Rolls' own `isRegionOrNationScope`,
adapted for the one real structural difference — Academic's toggle is a piece of UI
state, Rolls' isn't.** `AcademicMapView` gained an `isRegionOrNationScope` prop (the
same boolean value `DataViewShell.tsx` already computes for Rolls' own `MapView`,
reused directly, not re-derived). A new effect force-sets `viewByArea` true whenever
that prop is true and the stage/family combination still allows a choropleth at all
(KS2/family level stay excluded regardless, matching round 1's own real scope limit).
The manual "View by area" toggle button is hidden entirely while the scope forces it
on — there's no real "Schools" mode to escape to at this scale, the same real absence
Rolls' own map already has (which never had a manual toggle to hide in the first
place, since its point/choropleth split is driven purely by the prop).

**9. Graphs' aggregate-lines chart reuses round 1's own choropleth source
(`academic_geography_aggregate`) rather than Rolls' `roll_aggregates` — genuinely
different data, real prior art still reused, not invented.** One fetch
(`academic-aggregate-trends.ts`) returns both a national and a region series (no
sector line — `academic_geography_aggregate`'s own `grouping_type` is la/region/
national only, confirmed against `ingest/academic_aggregates.py`, no sector dimension
exists there at all).

**10. Real finding, checked directly, that changed the Graphs design mid-round:
`academic_geography_aggregate` never carries a real whole-school entries total.**
Originally planned to give Section 1 (Entries) the same aggregate-chart treatment as
Section 2 (Results). Before building it, read `ingest/academic_aggregates.py`'s own
accumulator directly: the whole-school headline branch (`family_id = 'whole_school'`)
only ever sums `avg_value`, never an entries figure — `entries_total` is populated
only for a real, specific subject family (from `academic_subject_family_rollup`),
which this round's whole-school-only large-set scope doesn't fetch. Confirmed a
second time by a live fetch (every real national/region row returned `entries_total:
null`). Section 1's own `isLargeSet` branch withholds the comparator card with an
honest note rather than fabricate a chart from an always-null field — Section 2's own
aggregate chart (the headline measure) is unaffected and works correctly, since
`avg_value` genuinely is populated at whole-school scope.

**11. Section 3 (Subjects/family breakdown) stays mostly visible at large-set scale —
only the one genuinely group-dependent piece is withheld.** The entries-share donut,
the trend line, and the subject table are all real, target-only figures (no ticked-
group dependency at all) and are unaffected by `isLargeSet`. Only the family-level
"average point score vs comparator set" bar chart (which reads `group`, the bounded
ticked set) is replaced with an honest note — the same real reasoning as items 9-10,
scoped to just the one chart that actually needs it, not the whole section.

**12. Rankings mirrors Rolls' own large-set branch exactly, including the "whole view,
not just the tables" early return.** `AcademicRankingsView`'s four-tile row (Latest
results/Trend/Position/Position over time) is computed from `comparableGroup` (the
bounded ticked group) — showing it alongside a real large-set ranking below would
display a stale, misleadingly small "position" next to the real one. The large-set
branch therefore replaces the WHOLE view (mirroring `RankingsView.tsx`'s own early
return), not just the rank tables underneath.

## Frontend wiring

- `DataViewShell.tsx`: the deliberate null-out (`regionOption={activeTopic ===
  "academic" ? null : regionOption}` / `nationOption={...}`) is reversed — Region and
  Nation are now real, selectable `SetOption`s regardless of which topic tab is
  active, since the sidebar itself was always topic-agnostic and this was the one
  place it wasn't.
- `AcademicDataView` gained three new props, all reused directly from values
  `DataViewShell.tsx` already computes for Rolls' own path (`isLargeSet`,
  `regionNationScopeKey` — via the existing `largeSetRankScopeKey()` helper, reused
  unchanged — and `isRegionOrNationScope`). It owns its own `academicLargeSetRank`/
  `academicAggregateTrends` fetch effects (same established pattern as its existing
  academic-schools/academic-subject/academic-comparator-widen fetches — Academic
  fetches its own data, `DataViewShell` doesn't orchestrate a parallel effect for it,
  since `DataViewShell` never lifts `effectiveStage`, which both new fetches need).
- New routes: `/api/data-view/academic-region-nation-rank` and
  `/api/data-view/academic-aggregate-trends` — same membership-gate pattern as every
  other Data View route, region/nation scope resolved server-side via
  `resolveTargetRegionNation()` (reused directly from Rolls' own
  `region-nation-comparator.ts` — a school's real region/nation membership is the
  same physical fact regardless of topic, so this is genuine cross-topic reuse, not a
  duplicate lookup).
- New lib files: `src/lib/academic-region-nation-rank.ts` (client-safe types +
  server-only fetch, mirroring `region-nation-comparator.ts`'s own
  `fetchRegionNationRank` shape), `src/lib/academic-aggregate-trends.ts` (mirroring
  `aggregate-trends.ts`'s own shape). `vicdata-reference.ts` gained
  `lookupAcademicRegionNationRank()`, a direct POST (not paginated via `fetchPage`,
  since the RPC returns one scalar jsonb object, not a set).

## Real verification (execution, not inspection)

**The new RPC's SQL was not deployed to hosted this round.** Creating a new function
on production Supabase is a schema change to shared infrastructure, out of scope for
a "local build/test only" round (unlike round 1, which only added new TypeScript
calling already-existing RPCs). Instead, the identical query logic — the LA→region
join, the closed-school filter, the latest-period-for-this-measure resolution, the
`rank()`-with-ties ordering, the bounded top15/neighbours shape — was reimplemented
in a TypeScript verification script and run against real hosted data, fetched only
through already-existing, already-proven anon-callable functions
(`academic_headline_lookup`, `school_entities_lookup`), with the real
`la_name_region_crosswalk` rows embedded verbatim (copied directly from that
migration file, not re-derived). This is a code-review-level structural check plus a
real-data execution check, not a live call to the actual new function — flagged
plainly rather than implied as a full end-to-end test.

**Real South East region ranking, KS4, `attainment8_average`** (script run against
real hosted data):

```
6,051 real distinct URNs nationally with real KS4 headline data
813 real South East schools resolved via the real LA -> region crosswalk, with real
  KS4 data
Top 5: #1 Kendrick School 84.00, #2 Reading School 83.00,
  #3 Dartford Grammar School / Upton Court Grammar School (tied) 79.90, #5 Dr
  Challoner's High School 79.10
Bottom: #812 St Nicholas' School / St Clare's, Oxford (tied) 0.00
```

Real tie handling confirmed correct (`rank()` semantics: two schools tied at 79.90
both show rank #3, the next real school is rank #5, not #4 — matching the SQL's own
`rank() over (order by value desc)`).

**Real spot-check, one real target** (Upton Court Grammar School, Slough, URN
136420, rank #3 of 813):

```
top15: ranks #1-#15 in order, Upton Court Grammar correctly appearing at its own
  real rank #3 (tied with Dartford Grammar School)
bounded neighbours (11 closest by rank distance): ranks #1-#11 -- correctly the
  SAME set as top15 here, since the target's own real rank (#3) sits within the
  first 11 -- confirming the "up to 11 rows, re-sorted by rank" logic degenerates
  correctly to a contiguous leading block when the target is near the top, not just
  when it's in the middle of a large set.
```

18 real Slough schools were found within the South East pool, ranks spanning #3 to
#505 of 813 — a real, plausible spread, not a data artifact.

**Real aggregate-trends fetch, KS4, `attainment8_average`** (script run against real
hosted data, two real targets — Upton Court Grammar in South East, and Yerbury
Primary's own URN to confirm region resolution works independent of the target having
KS4 data itself):

```
National (England): 2021 41.75, 2022 39.77, 2023 39.51, 2024 39.04 (4 real years)
South East (Upton Court Grammar's own region): 2021 40.84, 2022 38.91, 2023 38.93,
  2024 38.37
London (Yerbury Primary's own region, despite having no real KS4 data itself --
  correctly resolves the REGION regardless): 2021 44.64, 2022 43.00, 2023 43.33,
  2024 42.17
```

Confirms the aggregate-trends fetch correctly resolves a real multi-year national and
region series, and that a target's own region membership resolves independently of
whether the target itself has real data for the requested key stage (the chart's
national/region lines are meaningful even for a school whose own trend would be
empty).

## Verification

- `npx tsc --noEmit`: clean (two real type errors found and fixed along the way — a
  `KsStage` type mismatch between `academic-data-view.ts`'s wider `"ks2"|"ks4"|"ks5"`
  and `vicdata-reference.ts`'s narrower `"ks4"|"ks5"`; fixed by importing the
  narrower type in the two new lib files and two new routes, matching round 1's own
  precedent in `academic-geography-choropleth.ts`).
- `npx eslint` on every new/touched file: clean (one real unused-variable warning
  found and removed — a dead `EMPTY_RANK_METRIC` constant in
  `academic-region-nation-rank.ts`, superseded once `lookupAcademicRegionNationRank`
  itself was written to already return safe defaults).
- `npm run build`: clean, full production build; both new routes
  (`academic-region-nation-rank`, `academic-aggregate-trends`) confirmed registered
  in the build output.
- One real, unrelated environment issue hit and fixed along the way: the build
  initially failed with `Cannot find module '../lightningcss.darwin-arm64.node'` —
  `node_modules` had only the linux-arm64-gnu optional binary installed, not
  darwin-arm64 (this machine's own real platform), unrelated to any code in this
  round. Fixed with a scoped `npm install lightningcss` to pull the correct platform
  binary; the resulting `package.json`/`package-lock.json` changes (a new explicit
  dependency entry neither round actually needs) were reverted via `git checkout --`
  immediately after, leaving `node_modules` fixed but the tracked dependency files
  untouched.
- Real execution throughout the RPC-logic and aggregate-trends checks: run against
  real hosted data via scripts calling the actual already-proven production
  functions, not asserted from inspection.
- **Not verified**: the actual rendered page (Map's auto-choropleth trigger, the
  Rankings large-set table, the Graphs aggregate charts) — no Claude-in-Chrome
  connection this session. Flagged plainly; Guy will need to check the live page
  himself, in particular the one behaviour that can only really be seen live: does
  selecting "London schools"/"England schools" from the sidebar while the Academic
  tab is active correctly flip the Map into choropleth mode, populate Rankings with a
  real percentile ranking, and swap Graphs' Results section into the aggregate chart,
  all without a page reload.
- **Not verified**: the two new API routes end-to-end over real HTTP with a real auth
  token (no stored test credentials available this session) — same deprioritisation
  as round 1, for the same reason (both routes are thin membership-gate wrappers
  copied from the already-proven `region-nation-rank`/`aggregate-trends` route
  pattern, with the underlying logic verified separately above).

## Confirmations

- `git status` before writing this report showed only the files this round's own
  work touched: `src/components/data-view/{DataViewShell,AcademicDataView,
  AcademicMapView,AcademicGraphsView,AcademicRankingsView}.tsx`,
  `src/lib/vicdata-reference.ts` (extended), `src/lib/academic-region-nation-rank.ts`
  (new), `src/lib/academic-aggregate-trends.ts` (new),
  `src/app/api/data-view/academic-region-nation-rank/route.ts` (new),
  `src/app/api/data-view/academic-aggregate-trends/route.ts` (new), plus this round's
  own brief/prompt/report docs and, in vicdata, the one new migration file. The two
  unrelated docs left modified by the earlier, stopped colour-bug/palette prompt
  remain exactly as found — not committed, not discarded, not touched. Round 1's own
  choropleth files (still untracked from that round, never committed) are also
  untouched. In vicdata, several other untracked doc/script files appeared during
  this session that this round never created or touched (names suggest a separate,
  concurrent overnight-ingest task) — left exactly as found, same "investigate,
  don't touch unfamiliar files" discipline as every prior round.
- One incidental cleanup: an empty, stray `.next-retry-*` directory (a Next.js build
  artifact from this round's own troubleshooting of the lightningcss issue above) was
  removed from the working tree — my own session's build cruft, not anyone's work.
- Nothing written to hosted/production — every check this round was a read-only
  query against real, already-ingested data; no ingest, no migration deployed, no
  write of any kind. The new SQL migration file exists locally in vicdata's own repo
  but was never applied anywhere.
- Nothing committed or pushed in either repo, per this round's own explicit
  local-only instruction.
- This closes both rounds of the Region/Nation-scale comparator work (choropleth in
  round 1, ranking/aggregate-trends in round 2) — Academic Results now has feature
  parity with Rolls' own large-set architecture across all three display surfaces.
