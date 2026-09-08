-- Member Data View, large-set design v1 (docs/vicdata_phase3_member_data_view_
-- large_set_design_v1.md): one row per school, holding exactly what filteredCount()
-- (data-view-filters.ts) needs to compute a real, honest filtered value for a school
-- that DataViewShell's LARGE_SET_PROFILE_THRESHOLD guard never fetches a full
-- DataViewSchoolProfile for. Confirmed directly against filteredCount()'s own source
-- before designing this: it only ever reads ageGenderCounts (current period) and
-- boarding (current period) off a profile, never the multi-year trend/
-- ageGenderCountsByPeriod fields -- so this table is deliberately narrower than a full
-- profile, current-period (+ one anchor period) only.
--
-- This single table unlocks three things at once, all reading from the same rows (see
-- the design doc's own "what this single table unlocks" section):
--   1. region_nation_set() extended to join it -- real filtered marker sizing/colour
--      and rollover labels at any zoom, any scale (no more zoom-14 declustering gate).
--   2. The filter-blanks-the-map bug (MapView.tsx's `filterActive && current === 0`
--      skip) fixed as a side effect -- a real current-period breakdown means that skip
--      only ever hides a school that genuinely doesn't match, exactly as it already
--      does for small/medium sets.
--   3. region_nation_rank() (new RPC, separate migration) -- rank/percentile/top-15/
--      neighbour-window at any scale, the same shape RankingsView.tsx's existing
--      LARGE_SET_THRESHOLD display already expects, just computed server-side instead
--      of over a client-side array that structurally can't hold 49,000 entries.
--
-- Populated by scripts/recompute-census-derived.ts's new Part 3 (same promote-
-- triggered refresh boarding_quintiles/roll_aggregates already use), not computed
-- live -- same discipline as every other precomputed table this architecture round
-- introduced.
--
-- total_roll/female_total are denormalised plain integers, not derived from
-- age_gender_counts on every read, deliberately: region_nation_rank() ranks up to
-- ~49,000 rows per call, and unpacking a jsonb per-age breakdown via jsonb_each for
-- every row on every ranking request is real, avoidable Postgres work this table's
-- whole reason for existing is to remove (same "push aggregation into Postgres, do it
-- once, not per request" principle the performance-architecture round's own roll_
-- aggregates/boarding_quintiles tables already established). age_gender_counts itself
-- is still stored in full (not just the totals) because Map filtering genuinely needs
-- the real per-age breakdown to honour an active phase/age-band filter -- only the
-- RANKING RPC gets to work off the cheap denormalised totals (see that migration's own
-- comment for the resulting, deliberate scope limit: phase/age-band slicing isn't
-- replicated in SQL, to avoid a second, drift-prone copy of typology.ts's phase-range
-- logic -- logged as a decision in docs/vicdata_data_view_open_questions.md).
--
-- age_gender_counts / anchor_age_gender_counts shape: a jsonb OBJECT keyed by age
-- (as a string, jsonb's only key type) -> {"male": n, "female": n} -- chosen over an
-- array-of-pairs (data-view-serialize.ts's own WireAgeGenderCounts wire shape) because
-- Postgres can sum it directly via jsonb_each() when a future caller needs to, without
-- an extra unnest step; the client converts it to the same AgeGenderCounts Map shape
-- via Object.entries() either way, so this is a one-line difference on the read side,
-- not a second data model.
create table public.school_current_snapshot (
    urn text primary key references public.schools(urn) on delete cascade,
    current_period integer not null,
    total_roll integer not null,
    female_total integer not null,
    age_gender_counts jsonb not null,
    boarding jsonb,
    boarders_gender_split jsonb,
    anchor_period integer,
    anchor_age_gender_counts jsonb,
    sector text,
    computed_at timestamptz not null default now()
);

alter table public.school_current_snapshot enable row level security;

create policy school_current_snapshot_select_anyone on public.school_current_snapshot
    for select using (true);

comment on table public.school_current_snapshot is 'One row per school (open schools with real current-period census data): current-period age/gender + boarding breakdown, plus one anchor-period age/gender breakdown -- exactly what filteredCount() (data-view-filters.ts) needs, nothing more. Written only by scripts/recompute-census-derived.ts (service-role); never computed live per request. Backs region_nation_set() and region_nation_rank() at Region/Nation scale (Member Data View large-set design v1).';
