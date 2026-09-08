# VicData — Phase 3: Member Data View — Large Comparator Sets (Map + Graphs + Rankings) — Design v1

*Companion to `claude/vicdata_phase3_member_data_view_performance_architecture_v1.md` (the precompute round that made Region/Nation sets fast to fetch) and `claude/vicdata_phase3_member_data_view_build_results_v1.md` §13-15 (what that round actually built and how it was verified). This doc answers the question those left open: once a Region/Nation-scale set (up to ~49,000 schools) is selected, what should Map, Graphs, and Rankings actually show? Written 2026-09-08, before any of this is built — a real design pass, not a patch.*

## The framing mistake worth naming

The performance round solved "how do we find out which schools are in scope quickly" (`region_nation_set()` — one RPC call, sub-second, whatever the scale). It did not solve "what do we know about each of those schools" — that question was pushed onto the Map alone, framed as "stub markers vs. full profiles," with two options on the table: a lightweight roll cache (marker sizing/colour only) or porting the public map's viewport-based lazy full-profile fetch.

Both options were scoped to the Map. But the same gap breaks Rankings and Graphs identically, and for the same underlying reason: **filters, marker encoding, ranking metrics, and rollover labels all read from a school's *current-period* breakdown (age×gender counts, boarding split) — not its full multi-year history.** Confirmed directly in the code: `filteredCount()` (`data-view-filters.ts`), the function every one of these features calls, only ever reads `ageGenderCounts` (current period) and `boarding` (current period) off a profile — never `trend`, `ageGenderCounts2019`, or `ageGenderCountsByPeriod` (the genuinely large, multi-year parts of a full profile). A stub profile fails every one of these features not because it lacks *history*, it fails because it lacks *current-period numbers at all*.

That reframes the actual gap: it's not "Map needs richer markers." It's "there is no cheap way to get every school in a 49,000-school set's current-period numbers." Fix that once, in the right shape, and Map marker encoding, Map rollover labels, Map filtering, and Rankings-at-scale are all unlocked from the same table. Graphs is a separate problem (below) — it doesn't need per-school data at scale at all.

## Confirmed live, not assumed

- `filteredCount()` only reads `school.ageGenderCounts` and `school.boarding` — both are already-current-period-only fields on the profile type (`data-view-profiles.ts`), not the multi-year `trend`/`ageGenderCountsByPeriod`.
- `RankingsView.tsx` already has a "large set" degrade — `LARGE_SET_THRESHOLD = 40` switches the display from "ranks #N of M" to a percentile + `NEIGHBOUR_WINDOW = 5` window either side of the target. This is exactly the shape Guy asked for ("school's position and the top 15, or similar") — it already exists as a *display* pattern, it just currently ranks whatever's in `tickedProfiles` (a client-side array built from fetched full profiles), which is structurally never going to hold 49,000 entries. The display logic doesn't need to change; where the ranking is computed does.
- **A real, live bug, confirmed by reading `MapView.tsx` directly**: `if (!isTarget && filterActive && current === 0) continue;` — any marker whose filtered count is zero is skipped from drawing. A stub profile always computes to zero under any active phase/gender/boarding filter. So today, turning on *any* filter while viewing a Region/Nation set silently empties the map, with no message. This is a correctness bug already live in production, not a hypothetical.
- `roll_aggregates` already holds precomputed aggregate trend data at **three scopes**: `national` (1 row), `regional` (153 LAs — powers the free-tier public page's own Regional card), and the new `ons_region` (9 ONS regions, built this round) — each with 7 years of `total_roll`, `school_count`, `age_band_totals` (jsonb), `gender_male`/`gender_female`, `boarders_total`. Confirmed by querying the live table directly. **There is no `sector` scope** (Independent/State/FE/Special) — that dimension doesn't exist yet.
- The scope column has an explicit check constraint (`scope in ('national','regional','ons_region')`) added by the last migration — adding a fourth value is a one-line constraint change, same pattern already used twice.

## Recommendation: one new precomputed table, correctly scoped, does most of the work

**`school_current_snapshot`** (name TBD) — one row per school (~52,500 rows, trivial size), holding exactly what `filteredCount()` needs and nothing more:

- `urn`, `current_period`
- `age_gender_counts` (jsonb — same shape as the existing `AgeGenderCounts` type, current period only)
- `boarding` (jsonb — boarders/day totals + gender split, current period only, same shape as the existing `BoardingTag`)
- `anchor_period`, `anchor_age_gender_counts` (jsonb) — whichever single historical period the A3/trend-badge "since 20xx" comparison uses today; **not** the full `ageGenderCountsByPeriod` map (that's the expensive, genuinely multi-year part, and nothing at scale needs more than one anchor point)
- `sector` (denormalised from `establishment_type_group`, since sector is a membership filter, not a slice — cheap to carry here rather than re-join every read)

This is a smaller, cheaper, *purpose-built* version of "Option A" — not total_roll + a trend percentage (which only serves marker colour), but the actual current-period breakdown `filteredCount()` needs. Populated the same way `boarding_quintiles`/`roll_aggregates` already are: one more thing `recompute-census-derived.ts` writes while it's already iterating every school's census data on a promote-triggered refresh — not a new expensive pass.

**What this single table unlocks, all at once, all correctly filtered:**

1. **Map marker sizing/colour at any zoom, any scale** — `region_nation_set()` extended to join this table (cheap — indexed on `urn`), so a marker's real filtered value and trend badge are available immediately, not gated behind zoom-14 declustering.
2. **Map rollover labels** — the same joined data, no separate mechanism needed. Guy's ask here is fully covered by the same fix.
3. **The filter-blanks-the-map bug, fixed as a side effect** — once every marker has a real current-period breakdown, `filteredCount()` returns real (possibly genuinely zero) values instead of "always zero because there's no data at all," so the existing `filterActive && current === 0` skip only hides schools that *actually* don't match, exactly as it already does for small sets.
4. **Rankings at any scale** — a new SQL RPC (same shape as `region_nation_set()`: one function, one round trip, works at any N) that, given a scope + metric + filters, computes the metric for every school in `school_current_snapshot` joined to the scope, ranks with `rank() over (order by ...)`, and returns the target's rank/percentile plus the top 15 plus a neighbour window — reusing the exact three metrics `RankingsView.tsx` already defines (current roll, %girls, %boarding all derive directly from `age_gender_counts`/`boarding`). `RankingsView.tsx`'s existing large-set display logic (percentile + neighbour window) barely changes — it already expects this shape, it just currently gets it from a client-side array instead of a server-side rank.

## Graphs at scale: aggregate, per Guy's own instinct — and most of it already exists

Guy's instinct (aggregate into sectors/regions above a threshold, so a school sees itself against wider trends) is the right call, and for a different reason than Rankings/Map: Graphs plots *trends over time*, which means every school's *full multi-year history* — not just current-period — and there is no cheap way to cache that at 49,000-school scale (nor should there be; nobody can read a 49,000-line chart). Aggregation isn't a performance workaround here, it's the only visualisation that means anything at this scale.

- **Region and Nation aggregate lines are close to free**: `roll_aggregates` already has exactly this — 7 years of real total-roll/age-band/gender/boarding totals per ONS region and nationally. A "your school vs. its region vs. England" trend chart is mostly new chart code plus a query against a table that already exists and is already populated.
- **Sector aggregate lines need one small, low-risk migration**: add `'sector'` to `roll_aggregates`'s scope check constraint, and extend `recompute-census-derived.ts` (which already loops every school for `boarding_quintiles`/the ons_region rows) to also group by `establishment_type_group`. Same script, same refresh trigger, same shape of change as the ons_region extension that just shipped.
- **The target school's own line stays real and exact**, same as today — its full profile is always fetched regardless of set size, so nothing about *that* line changes.
- What Graphs should NOT do at scale: attempt per-school lines, bars, or any chart type that currently iterates `tickedProfiles` directly (`RollTrendsChart`, `SortedBarChart`, `DivergingBarChart`, `CombinedRollChart`, `MarketShareTrendChart` all currently do this) — those stay exactly as they are for small/medium sets, and Region/Nation-scale sets get a genuinely different chart (aggregate lines, not a school-per-mark chart with 49,000 marks).

## Where "Option B" (viewport-based lazy full-profile fetch) actually still fits

Once `school_current_snapshot` covers marker encoding, filtering, rollover labels, and ranking, viewport-based lazy loading isn't needed to make any of those *work* — which was the framing gap in the original two-option choice. What's left for it is narrower and smaller: **drilling into one specific school's full detail (real multi-year trend, exact numbers) from within a large set.** That's better served by reusing the *existing* full-profile-fetch endpoint (already built, already used for small/medium sets) triggered by a single click/tap on one marker — not by porting the public map's continuous pan/zoom viewport-bounds querying machinery, which was built for a different problem (unauthenticated, unbounded exploratory browsing) than a bounded, curated comparator set. This is simpler to build than full viewport-fetch, and it's the only piece of the original "B" that's still genuinely needed.

## Summary of what to actually build, in dependency order

1. **`school_current_snapshot` table** + one line added to `recompute-census-derived.ts`'s existing per-school loop. Unlocks items 2-4.
2. **`region_nation_set()` extended** to join it and return filtered current values + trend — fixes Map marker encoding, rollover labels, and the filter-blanking bug in one change.
3. **A new ranking RPC** (`region_nation_rank()` or similar) using the same table — powers Rankings at scale with the display pattern `RankingsView.tsx` already has.
4. **`roll_aggregates` gets a `sector` scope** (one migration, one small script extension) — unlocks sector-aggregate Graphs lines alongside the region/nation lines the table already supports.
5. **A new Graphs chart type for large sets** (aggregate lines: target school vs. region/nation/sector, not per-school marks) — the only genuinely new UI component in this list; everything else is a data-layer change feeding existing display logic.
6. **Click-to-fetch full profile for one marker**, reusing the existing single-school profile endpoint — the narrowed, correctly-scoped remainder of "Option B."

Items 1-3 are one coherent unit of work (all read from the same new table) and should ship together. Item 4-5 (Graphs) is a separate, independent unit — it doesn't depend on `school_current_snapshot` at all, only on the `roll_aggregates` sector extension. Item 6 is small and can go last.