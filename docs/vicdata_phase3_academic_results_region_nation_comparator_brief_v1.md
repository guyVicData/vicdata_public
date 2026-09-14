# Academic Results — Region/Nation-scale comparator sets (round 2 of 2)

Round 1 (choropleth) is verified done — see the reply alongside this brief.
This is round 2: real Region/Nation-scale RANKABLE comparator sets for
Academic, the piece explicitly deferred out of round 1. Everything below is
grounded in the real code/schema (Rolls' own large-set architecture, and a
direct check of vicdata's own database schema), not proposed blind.

## The central architectural finding: this does NOT need round 1's
cross-database workaround

Round 1's choropleth needed a TypeScript-side join because its two real
data pieces live in two different Postgres databases (vicdata's project vs
vicdata_public's). Round 2 is different: checked directly, vicdata's OWN
database already has everything a real, single-SQL rank RPC needs, in ONE
place —

- `academic_headline_snapshot` (entity_id, ks_stage, period, measures jsonb)
  — real per-school headline figures, already built.
- `school_entities.la_name` — real per-school LA name, confirmed present
  (188 real distinct values, GIAS-sourced).
- `la_name_region_crosswalk` — real LA→region/nation lookup, "ported
  line-for-line from vicdata_public's own region-crosswalk.ts... so the two
  repos' geography grouping never silently drifts apart" (that migration's
  own comment).

So a new RPC, `academic_region_nation_rank()`, can live entirely inside
vicdata's own database — no cross-database join, no TypeScript-side
stitching, genuinely simpler than round 1's own approach. Model it directly
on Rolls' own `region_nation_rank()` (`supabase/migrations/
20261010093000_region_nation_rank_rpc.sql` in vicdata_public, plus its two
follow-up fix migrations — read all three, not just the first): same
`(p_region_code, p_nation, p_target_urn, ...)` shape, same real
top-N-plus-neighbour-window design the frontend already expects (see
below), computed over `academic_headline_snapshot` joined to
`school_entities`/`la_name_region_crosswalk` instead of `school_
current_snapshot`/`school_region_nation`.

**Real, open questions for this new RPC — confirm directly, don't assume**:
- Filter parity: `region_nation_rank()` honours sector/boarding/gender
  filters, with an explicit, logged scope limit on which filter dimensions
  it replicates (its own header comment names them). Academic's own filter
  surface is different (sector, GCSE/IGCSE exclusion, KS5 cohort) — work out
  the real equivalent scope limit for THIS RPC, name it in the build
  report, don't silently port Rolls' own filter list unexamined.
- `school_lineage`/URN-reissue: `academic_geography_lookup` (round 1)
  explicitly does NOT need a lineage fallback because it's grouped, never
  per-school. This new RPC IS per-school (ranking individual real schools)
  — check whether `academic_headline_lookup`'s own lineage-fallback
  discipline applies here too, rather than assuming it doesn't just because
  the sibling geography RPC didn't need it.
- KS2 stays excluded (same real `ks_stage in ('ks4','ks5')` constraint
  `academic_headline_snapshot` already has) — Region/Nation-scale Academic
  comparisons are ks4/ks5 only, same as round 1's choropleth.

## Three real display surfaces — two are largely ALREADY solved

**Map: essentially already built, by round 1.** Rolls' own `MapView.tsx`
auto-switches into its choropleth via `isRegionOrNationScope` the moment a
Region/Nation-scale set is active — confirmed directly
(`isRegionOrNationScope={isRegionScope(activeSet) || isNationScope
(activeSet)}`, `DataViewShell.tsx`). Round 1 already built the Academic
equivalent (`viewByArea`) as a standalone manual toggle, precisely because
Region/Nation SetOptions didn't exist yet for Academic. Once this round
makes them real SetOptions, mirror Rolls' own pattern: auto-turn `viewByArea`
on (and disable the manual toggle, or just leave it reflecting the same
state) whenever the newly-real Region/Nation scope is active — the
choropleth itself needs no further work, just the same auto-trigger Rolls
already has.

**Rankings: reuse Rolls' own established large-set pattern, don't invent a
new one.** `RankingsView.tsx` already has the real UI convention for this —
past `LARGE_SET_PROFILE_THRESHOLD` (200), "ranks #N of M" becomes a
percentile plus a real top-15-plus-neighbour-window display
(`LARGE_SET_TOP_N`, `LARGE_SET_METRICS`). `AcademicRankingsView` should
mirror this exact shape once the new RPC exists, rather than a different
large-set design — same threshold constant if it reads right for Academic's
own real set sizes, confirm rather than assume it transfers unchanged.

**Graphs: also has real prior art, genuinely worth reusing.** Rolls' own
`GraphsView.tsx` already swaps per-school-mark charts for an
"aggregate-lines chart" past the same threshold (`isLargeSet` prop,
`aggregateTrends`), plus a lower, separate `GRAPH_SECTOR_FALLBACK_THRESHOLD`
for sector-aggregate bars once individual bars stop being legible
(`aggregate-trends.ts`). `AcademicGraphsView`'s own three sections (Entries/
Results/Subjects, this round's own earlier edit) need the equivalent
swap — read `aggregate-trends.ts` and `GraphsView.tsx`'s own large-set
branches directly before designing Academic's version, don't design from
scratch.

## Frontend wiring this round needs

- `DataViewShell.tsx`: the explicit, currently-deliberate null-out —
  `regionOption={activeTopic === "academic" ? null : regionOption}` /
  `nationOption={...}` (documented at that line as "Part C's explicit scope
  boundary: no Region/Nation-scale Academic Rankings this round") — this is
  the one line that made it deliberately unavailable; reversing it is the
  real unlock, once the RPC and the three display surfaces above are ready
  to receive a real large set, not before.
- `AcademicDataView`'s own comment ("Does NOT reuse profilesByUrn... those
  stay Rolls-shaped") means Academic fetches its OWN `AcademicSchoolProfile`
  per ticked URN independently of Rolls' `profilesByUrn`. That fetch effect
  needs the same `isLargeSet`/`LARGE_SET_PROFILE_THRESHOLD` bypass
  `DataViewShell.tsx` already applies to Rolls' own profile fetch (skip
  fetching a full profile per school once the set is large — the whole
  point of the new RPC is not needing that) — confirm the real threshold
  value transfers sensibly for Academic's own real school counts before
  assuming 200 is right unchanged.
- Thread `isLargeSet`/the new RPC's result down through `AcademicMapView`/
  `AcademicGraphsView`/`AcademicRankingsView`, same shape Rolls' own props
  already establish (`isLargeSet`, `aggregateTrends`, `RegionNationRankResult`
  equivalents) — reuse the real prop shapes and naming conventions already
  established, don't invent parallel ones.

## Build notes

This is a genuinely bigger round than any prior one — new backend RPC, new
frontend large-set branch across three view components. Local build/test
only, no commit/push, same discipline as ever. Real verification: run the
new RPC against real hosted data for at least one real region and confirm
its rank/percentile numbers against a manual spot-check (same discipline
round 1's own LA/region joins were verified with, not asserted from
inspection alone). Full build report naming every real design call —
especially the filter-parity scope limit and the lineage-fallback
question, both flagged above as genuinely open, not decided here.
