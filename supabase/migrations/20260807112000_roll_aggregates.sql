-- Precomputed regional/national roll aggregates (rolls spec §3's "your context"
-- section: "Regional shape/trends... National shape/trends... Buildable now — no
-- ONS needed", both free-tier). Precomputed, not live-aggregated per request: a live
-- national aggregate means pulling ~2M rows (mainstream schools x ~83 breakdown values)
-- through the paginated reference_data_lookup API on every page view, which won't
-- perform -- see docs/OPEN_QUESTIONS.md's original deferral entry for the full
-- reasoning. A scheduled sync job (scripts/sync-roll-aggregates.js, same shape as
-- sync-schools.js) writes here; nothing computes this live.
--
-- scope_key is the empty string for national (not null -- a plain UNIQUE constraint
-- treats every null as distinct from every other null, which would break upsert's
-- ON CONFLICT matching the national row against itself on a re-run), an la_name for
-- regional -- "regional" here means
-- grouped by local authority, not the ONS 9-region taxonomy (no LA->region crosswalk
-- reachable in this environment beyond the LA->GSS one already seeded for market
-- share, which doesn't cover regions) -- a provisional interpretation, documented in
-- docs/OPEN_QUESTIONS.md, same discipline as the age-band boundaries and shape
-- classifier thresholds elsewhere in this build.
create table public.roll_aggregates (
    id uuid primary key default gen_random_uuid(),
    scope text not null check (scope in ('national', 'regional')),
    scope_key text,
    period integer not null,
    total_roll integer not null,
    school_count integer not null,
    age_band_totals jsonb not null,
    shape_label text,
    gender_male integer not null,
    gender_female integer not null,
    boarders_total integer,
    computed_at timestamptz not null default now(),
    unique (scope, scope_key, period)
);

create index roll_aggregates_scope_period_idx on public.roll_aggregates (scope, scope_key, period);

alter table public.roll_aggregates enable row level security;

create policy roll_aggregates_select_anyone on public.roll_aggregates
    for select using (true);

comment on table public.roll_aggregates is 'Precomputed regional (by LA)/national roll aggregates, free tier (rolls spec §3). Written only by scripts/sync-roll-aggregates.js (service-role); never computed live per request.';
