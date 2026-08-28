-- Precomputed single-year-age (5-15) DfE census pupil totals, by LA and by ONS
-- region (dashboard rebuild, Shape card's "population trend in the area" piece).
-- Real SCHOOL ENROLMENT data (same source and same "undercounts home-schooled/
-- not-yet-enrolled children" limitation as every other census-derived figure
-- already on this page -- an accepted, already-precedented limitation here, not a
-- new problem), NOT true local population data -- that would be a genuinely
-- different, ONS-population-based feature, deliberately out of scope for this piece
-- (see docs/OPEN_QUESTIONS.md, 2026-08-28).
--
-- Same "precompute, don't live-aggregate" reasoning as roll_aggregates/
-- age_band_pupil_distributions: a live per-request sum across every school in an LA
-- or region is the same paginated-remote-RPC cost problem those tables already exist
-- to avoid. One JSONB column per row (age -> total), same shape roll_aggregates uses
-- for age_band_totals, rather than one row per age -- 11 ages (5-15) is small enough
-- that a single row per (scope, scope_key, period) is simpler to read than a join.
--
-- Region rows are a genuine rollup across every LA in that region (via
-- la_gss_crosswalk.region, migration 20260828130000) -- NOT a second independent
-- fetch; both LA and region accumulators are filled from the exact same single pass
-- over the census facts (scripts/sync-age-profile-aggregates.ts), so they can never
-- silently disagree about which schools/pupils they cover.
create table public.age_profile_aggregates (
    id uuid primary key default gen_random_uuid(),
    scope text not null check (scope in ('la', 'region')),
    scope_key text not null,
    period integer not null,
    by_age jsonb not null,
    school_count integer not null,
    computed_at timestamptz not null default now(),
    unique (scope, scope_key, period)
);

create index age_profile_aggregates_scope_idx on public.age_profile_aggregates (scope, scope_key, period);

alter table public.age_profile_aggregates enable row level security;

create policy age_profile_aggregates_select_anyone on public.age_profile_aggregates
    for select using (true);

comment on table public.age_profile_aggregates is
    'Precomputed single-year-age (5-15) DfE census pupil totals, by LA and by ONS region. Real school-enrolment data, not true population data -- see this table''s own migration comment. Written only by scripts/sync-age-profile-aggregates.ts (service-role); never computed live per request.';
