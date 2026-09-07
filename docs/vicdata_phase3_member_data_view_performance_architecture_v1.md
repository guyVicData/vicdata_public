# VicData — Phase 3: Member Data View — Performance Architecture v1

*Requested 2026-09-07, after live-testing showed the boarding-quintile comparator taking 41-71 seconds and the Region/Nation comparator buttons still disabled placeholders. Session goal, in Guy's own words: turn on Boarding, Region, and Nation filters "and not crash the site or wait for more than a second or so." Discussed as architecture before building, per Guy's explicit instruction — this doc is the record of that discussion and the plan it produced, not a retrospective build report.*

---

## 1. Diagnosis — why the members side is slow and the public side isn't

The root cause is already visible in the build-results log (§2, List 3 performance note): the naive boarding-quintile fetch took **71.6 seconds** end to end across the ~403-school national boarding pool; parallelising the chunked fetches (bounded concurrency of 4, 40-row chunks) cut it to **~41 seconds** — still far outside an interactive budget. That "optimisation" made the same architecture faster, it didn't fix what was wrong with the architecture.

**What's actually happening**: comparator computation — quintile bucketing, nearest-neighbour distance sorting, age/gender filtering, roll aggregation — is being done in TypeScript inside the Next.js API routes, after pulling full per-school profile rows out of Postgres page by page via PostgREST (the 40-row chunking is a PostgREST/Supabase REST pagination artefact, not a deliberate batch design). A well-indexed Postgres query doing the equivalent aggregation server-side would return in single-digit milliseconds for a pool this size — the 41 seconds is entirely fetch-and-compute-in-app-code overhead, not genuine computational cost.

**Why this doesn't show up on the public site**: the public map's `schools-in-bounds` route does a simple indexed bounding-box query against `canonical_facts_current` and returns basic fields directly — it was never asked to compute quintiles, sort by distance across the whole country, or aggregate roll totals across thousands of schools. It never hit this failure mode because it was never structured to.

**Why Region and Nation are the real stress test, not smaller versions of Boarding**: the boarding-quintile pool is ~403 schools nationally. Region ("London schools") is potentially several hundred to low-thousands. Nation ("All schools") is, per the roadmap's own market-sizing (§9), ~24,000 schools in England at full build. Fetch-then-compute-in-app-code doesn't just get slower at that scale — it stops working: PostgREST pagination, per-row JSON serialization, and in-memory aggregation across tens of thousands of rows in a serverless API route is a plausible direct cause of the "crashed the selector" incident already logged in Round 3 of the Compared-with panel testing, independent of the race condition already found and fixed there.

## 2. The fix, in two parts

**Part 1 — push aggregation into Postgres itself.** API routes should ask the database a question and get back a small answer (a stat, a short list, a single row), never pull thousands of full rows out to compute the answer in application code. This means SQL functions/views doing the actual `GROUP BY`, distance-ranking, and quintile-bucketing work, callable via Supabase RPC, returning only the final shape the UI needs.

**Part 2 — precompute what doesn't change per request.** Distances between schools don't change between requests — only when a school opens, closes, or moves (rare, tied to a GIAS ingest). Boarding-quintile membership only changes when the census re-syncs (an infrequent, controlled `promote` event per the ingest schema doc, §2, not a continuous process). Region/nation membership is administrative geography that barely ever changes. None of this needs computing live, on every request, ever. It should be computed once per relevant ingest-promote and stored in small, properly indexed tables.

## 3. Decisions (discussed and confirmed 2026-09-07)

- **Refresh trigger: tied to ingest-promote**, not a separate scheduled job. Recomputing the derived comparator/aggregate layer runs automatically as the final step whenever a relevant snapshot is promoted (GIAS-affecting promotes recompute nearest-neighbours and region/nation membership; census-affecting promotes recompute boarding quintiles and the aggregate rollups). This reuses the versioned-snapshot discipline the ingest pipeline already has rather than introducing a second, independently-scheduled thing to keep in sync. A manual "rebuild derived data" trigger should also exist (admin-gated) for the case where the computation logic itself changes, not the underlying data — same principle as the existing approve-and-promote audit trail.
- **Map at scale: marker clustering.** Region and Nation comparator sets render as clustered count-bubbles that split apart on zoom, rather than either raw unclustered markers (impractical at nation scale) or dropping individual schools from the map entirely (loses the thing that makes VicData's map genuinely spatial). Every school stays a real marker somewhere in the cluster hierarchy; nothing is silently capped or sampled.
- **Caching layer: Postgres-first.** No HTTP/edge cache or Redis layer for this round. At current and near-term data volumes, indexed reads against precomputed tables should comfortably clear the sub-1-second target on their own — proving that first avoids adding a second layer to reason about (cache invalidation, staleness windows) before it's actually needed. Revisit only if precomputed+indexed reads genuinely aren't enough once built and measured.

## 4. New precomputed schema

All four tables below are populated/refreshed by the ingest-promote recompute step (§3), never written to at request time.

### `school_nearest_neighbours`
One row per (school, ranked neighbour), precomputed nationally.

| Field | Notes |
|---|---|
| `urn` | the school this row is *for* |
| `neighbour_urn` | a candidate comparator |
| `rank` | 1 = nearest |
| `distance_km` | |
| `neighbour_is_boarding` | boolean, lets the boarding-nearest-10 query filter without a join back to school attributes |

Precompute enough rank depth per school to serve every consumer without a live distance recompute — Nearest-10 (plus its "+N more" expansion), the LA-any-sector default set, and the bottom-3-quintile boarding "10 nearest boarding schools, matched by age/gender" logic (Compared-with panel Round 6) can all read from this one table, filtered/limited differently per use, rather than each having its own bespoke distance computation. Refreshed whenever a GIAS-affecting snapshot promotes (school opens/closes/moves).

### `boarding_quintiles`
One row per boarding school.

| Field | Notes |
|---|---|
| `urn` | |
| `quintile` | 1-5, using whichever direction the existing `quintileOf()` logic already established (confirmed against real code in Round 6, not re-derived here) |
| `national_boarding_pool_size` | for the honest "quintile computed against N schools" caption already in use |

Refreshed whenever a census-affecting snapshot promotes (boarding rolls change, quintile boundaries can shift).

### `school_region_nation`
Real region/nation membership as queryable columns, not a placeholder.

| Field | Notes |
|---|---|
| `urn` | |
| `region_code`, `region_name` | via the LA→region crosswalk logic already proven and flagged reusable in `roll pipileine geolocation.md` §5/§8 (`region_hierarchy.py` — "already generic, reusable as-is") |
| `nation` | `england` / `wales` for now, matching the jurisdictions already in the ingest schema (§3) |

Indexed on `region_code` and `nation`. This is what makes the London and All-schools buttons real: a comparator set becomes `WHERE region_code = 'E12...'` or `WHERE nation = 'england'` against an indexed column, not a computed join. Refreshed on GIAS-affecting promotes.

### `comparator_aggregates`
Precomputed rollups so a stat card is a single indexed row lookup, never a live scan across hundreds or thousands of schools.

| Field | Notes |
|---|---|
| `scope_type` | `region`, `nation`, `boarding_quintile`, etc. — extensible |
| `scope_key` | e.g. `E12000007` (London), `england`, `quintile:3` |
| `breakdown` | mirrors `canonical_facts`'s own breakdown convention (age band, gender, sector) rather than inventing a parallel vocabulary |
| `year` | |
| `value_numeric` | |
| `school_count` | how many schools fed this rollup, for honest "based on N schools" captions |

Refreshed on census-affecting promotes. This is the piece that makes Region/Nation stat cards and trend charts fast — the Map's clustered markers still need per-school rows (from `school_region_nation` joined to current roll data), but every aggregate number shown alongside the map should come from here, not be summed client-side.

## 5. What changes in the Data View app

- **Boarding, LA-any, Nearest-10, and the bottom-3-quintile boarding comparator** all move from chunked-fetch-and-compute to reading `school_nearest_neighbours` / `boarding_quintiles` directly, via indexed queries or a thin Supabase RPC function per case. This alone should resolve the 41-second boarding-quintile wait.
- **Region ("London schools") and Nation ("All schools") buttons go live** — currently greyed-out placeholders per the Compared-with panel redesign spec (§1: "Greyed out/disabled until the backend infrastructure to compute it exists"). Backed by `school_region_nation` for membership and `comparator_aggregates` for the stat-card/trend numbers.
- **Map view gains marker clustering** for any comparator set past a reasonable threshold (exact threshold left to Claude Code's judgement — log it — but Region and Nation should always cluster; Nearest-10/LA-scale sets likely never need to).
- **A3's dynamic summary sentence** needs a genuinely fast path for Region/Nation scope too, reading from `comparator_aggregates` rather than re-deriving from a live scan — same principle as the fix already applied to the boarding-quintile case in Round 6.

## 6. Target and what "done" means this session

By the end of this session: turning on Boarding, Region, or Nation should complete in **about a second, not tens of seconds, with no crash** — for Boarding specifically, that means the existing ~41-second wait needs to come down by roughly 40x, not just improve incrementally. If genuinely reaching sub-1-second requires a step not covered above (an index this plan missed, a Postgres RPC function instead of a view, materialized-view refresh timing against promote), that's an implementation detail Claude Code should resolve directly against the real schema — log the reasoning in `docs/vicdata_data_view_open_questions.md` rather than silently settling for "better but not there."

## 7. Explicitly out of scope this round

- HTTP/edge caching or Redis (§3 — Postgres-first, revisit only if measured and insufficient).
- The academy-group ("same-group") comparator — still blocked on the schema gap already logged in §10/B3 of the build-results doc, unrelated to this performance work.
- Any change to the ingest pipeline's own source registry, validation, or admin view (`vicdata_ingest_schema_and_build_plan_v2.md`) beyond adding the promote-triggered recompute step itself.# VicData — Phase 3: Member Data View — Performance Architecture v1

*Requested 2026-09-07, after live-testing showed the boarding-quintile comparator taking 41-71 seconds and the Region/Nation comparator buttons still disabled placeholders. Session goal, in Guy's own words: turn on Boarding, Region, and Nation filters "and not crash the site or wait for more than a second or so." Discussed as architecture before building, per Guy's explicit instruction — this doc is the record of that discussion and the plan it produced, not a retrospective build report.*

---

## 1. Diagnosis — why the members side is slow and the public side isn't

The root cause is already visible in the build-results log (§2, List 3 performance note): the naive boarding-quintile fetch took **71.6 seconds** end to end across the ~403-school national boarding pool; parallelising the chunked fetches (bounded concurrency of 4, 40-row chunks) cut it to **~41 seconds** — still far outside an interactive budget. That "optimisation" made the same architecture faster, it didn't fix what was wrong with the architecture.

**What's actually happening**: comparator computation — quintile bucketing, nearest-neighbour distance sorting, age/gender filtering, roll aggregation — is being done in TypeScript inside the Next.js API routes, after pulling full per-school profile rows out of Postgres page by page via PostgREST (the 40-row chunking is a PostgREST/Supabase REST pagination artefact, not a deliberate batch design). A well-indexed Postgres query doing the equivalent aggregation server-side would return in single-digit milliseconds for a pool this size — the 41 seconds is entirely fetch-and-compute-in-app-code overhead, not genuine computational cost.

**Why this doesn't show up on the public site**: the public map's `schools-in-bounds` route does a simple indexed bounding-box query against `canonical_facts_current` and returns basic fields directly — it was never asked to compute quintiles, sort by distance across the whole country, or aggregate roll totals across thousands of schools. It never hit this failure mode because it was never structured to.

**Why Region and Nation are the real stress test, not smaller versions of Boarding**: the boarding-quintile pool is ~403 schools nationally. Region ("London schools") is potentially several hundred to low-thousands. Nation ("All schools") is, per the roadmap's own market-sizing (§9), ~24,000 schools in England at full build. Fetch-then-compute-in-app-code doesn't just get slower at that scale — it stops working: PostgREST pagination, per-row JSON serialization, and in-memory aggregation across tens of thousands of rows in a serverless API route is a plausible direct cause of the "crashed the selector" incident already logged in Round 3 of the Compared-with panel testing, independent of the race condition already found and fixed there.

## 2. The fix, in two parts

**Part 1 — push aggregation into Postgres itself.** API routes should ask the database a question and get back a small answer (a stat, a short list, a single row), never pull thousands of full rows out to compute the answer in application code. This means SQL functions/views doing the actual `GROUP BY`, distance-ranking, and quintile-bucketing work, callable via Supabase RPC, returning only the final shape the UI needs.

**Part 2 — precompute what doesn't change per request.** Distances between schools don't change between requests — only when a school opens, closes, or moves (rare, tied to a GIAS ingest). Boarding-quintile membership only changes when the census re-syncs (an infrequent, controlled `promote` event per the ingest schema doc, §2, not a continuous process). Region/nation membership is administrative geography that barely ever changes. None of this needs computing live, on every request, ever. It should be computed once per relevant ingest-promote and stored in small, properly indexed tables.

## 3. Decisions (discussed and confirmed 2026-09-07)

- **Refresh trigger: tied to ingest-promote**, not a separate scheduled job. Recomputing the derived comparator/aggregate layer runs automatically as the final step whenever a relevant snapshot is promoted (GIAS-affecting promotes recompute nearest-neighbours and region/nation membership; census-affecting promotes recompute boarding quintiles and the aggregate rollups). This reuses the versioned-snapshot discipline the ingest pipeline already has rather than introducing a second, independently-scheduled thing to keep in sync. A manual "rebuild derived data" trigger should also exist (admin-gated) for the case where the computation logic itself changes, not the underlying data — same principle as the existing approve-and-promote audit trail.
- **Map at scale: marker clustering.** Region and Nation comparator sets render as clustered count-bubbles that split apart on zoom, rather than either raw unclustered markers (impractical at nation scale) or dropping individual schools from the map entirely (loses the thing that makes VicData's map genuinely spatial). Every school stays a real marker somewhere in the cluster hierarchy; nothing is silently capped or sampled.
- **Caching layer: Postgres-first.** No HTTP/edge cache or Redis layer for this round. At current and near-term data volumes, indexed reads against precomputed tables should comfortably clear the sub-1-second target on their own — proving that first avoids adding a second layer to reason about (cache invalidation, staleness windows) before it's actually needed. Revisit only if precomputed+indexed reads genuinely aren't enough once built and measured.

## 4. New precomputed schema

All four tables below are populated/refreshed by the ingest-promote recompute step (§3), never written to at request time.

### `school_nearest_neighbours`
One row per (school, ranked neighbour), precomputed nationally.

| Field | Notes |
|---|---|
| `urn` | the school this row is *for* |
| `neighbour_urn` | a candidate comparator |
| `rank` | 1 = nearest |
| `distance_km` | |
| `neighbour_is_boarding` | boolean, lets the boarding-nearest-10 query filter without a join back to school attributes |

Precompute enough rank depth per school to serve every consumer without a live distance recompute — Nearest-10 (plus its "+N more" expansion), the LA-any-sector default set, and the bottom-3-quintile boarding "10 nearest boarding schools, matched by age/gender" logic (Compared-with panel Round 6) can all read from this one table, filtered/limited differently per use, rather than each having its own bespoke distance computation. Refreshed whenever a GIAS-affecting snapshot promotes (school opens/closes/moves).

### `boarding_quintiles`
One row per boarding school.

| Field | Notes |
|---|---|
| `urn` | |
| `quintile` | 1-5, using whichever direction the existing `quintileOf()` logic already established (confirmed against real code in Round 6, not re-derived here) |
| `national_boarding_pool_size` | for the honest "quintile computed against N schools" caption already in use |

Refreshed whenever a census-affecting snapshot promotes (boarding rolls change, quintile boundaries can shift).

### `school_region_nation`
Real region/nation membership as queryable columns, not a placeholder.

| Field | Notes |
|---|---|
| `urn` | |
| `region_code`, `region_name` | via the LA→region crosswalk logic already proven and flagged reusable in `roll pipileine geolocation.md` §5/§8 (`region_hierarchy.py` — "already generic, reusable as-is") |
| `nation` | `england` / `wales` for now, matching the jurisdictions already in the ingest schema (§3) |

Indexed on `region_code` and `nation`. This is what makes the London and All-schools buttons real: a comparator set becomes `WHERE region_code = 'E12...'` or `WHERE nation = 'england'` against an indexed column, not a computed join. Refreshed on GIAS-affecting promotes.

### `comparator_aggregates`
Precomputed rollups so a stat card is a single indexed row lookup, never a live scan across hundreds or thousands of schools.

| Field | Notes |
|---|---|
| `scope_type` | `region`, `nation`, `boarding_quintile`, etc. — extensible |
| `scope_key` | e.g. `E12000007` (London), `england`, `quintile:3` |
| `breakdown` | mirrors `canonical_facts`'s own breakdown convention (age band, gender, sector) rather than inventing a parallel vocabulary |
| `year` | |
| `value_numeric` | |
| `school_count` | how many schools fed this rollup, for honest "based on N schools" captions |

Refreshed on census-affecting promotes. This is the piece that makes Region/Nation stat cards and trend charts fast — the Map's clustered markers still need per-school rows (from `school_region_nation` joined to current roll data), but every aggregate number shown alongside the map should come from here, not be summed client-side.

## 5. What changes in the Data View app

- **Boarding, LA-any, Nearest-10, and the bottom-3-quintile boarding comparator** all move from chunked-fetch-and-compute to reading `school_nearest_neighbours` / `boarding_quintiles` directly, via indexed queries or a thin Supabase RPC function per case. This alone should resolve the 41-second boarding-quintile wait.
- **Region ("London schools") and Nation ("All schools") buttons go live** — currently greyed-out placeholders per the Compared-with panel redesign spec (§1: "Greyed out/disabled until the backend infrastructure to compute it exists"). Backed by `school_region_nation` for membership and `comparator_aggregates` for the stat-card/trend numbers.
- **Map view gains marker clustering** for any comparator set past a reasonable threshold (exact threshold left to Claude Code's judgement — log it — but Region and Nation should always cluster; Nearest-10/LA-scale sets likely never need to).
- **A3's dynamic summary sentence** needs a genuinely fast path for Region/Nation scope too, reading from `comparator_aggregates` rather than re-deriving from a live scan — same principle as the fix already applied to the boarding-quintile case in Round 6.

## 6. Target and what "done" means this session

By the end of this session: turning on Boarding, Region, or Nation should complete in **about a second, not tens of seconds, with no crash** — for Boarding specifically, that means the existing ~41-second wait needs to come down by roughly 40x, not just improve incrementally. If genuinely reaching sub-1-second requires a step not covered above (an index this plan missed, a Postgres RPC function instead of a view, materialized-view refresh timing against promote), that's an implementation detail Claude Code should resolve directly against the real schema — log the reasoning in `docs/vicdata_data_view_open_questions.md` rather than silently settling for "better but not there."

## 7. Explicitly out of scope this round

- HTTP/edge caching or Redis (§3 — Postgres-first, revisit only if measured and insufficient).
- The academy-group ("same-group") comparator — still blocked on the schema gap already logged in §10/B3 of the build-results doc, unrelated to this performance work.
- Any change to the ingest pipeline's own source registry, validation, or admin view (`vicdata_ingest_schema_and_build_plan_v2.md`) beyond adding the promote-triggered recompute step itself.