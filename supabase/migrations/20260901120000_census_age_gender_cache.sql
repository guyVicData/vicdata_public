-- Precomputed per-school, per-age, per-sex DfE census headcounts (narrative
-- generator's Topic 3 LA-average mechanism, round 10 performance fix).
--
-- Root cause, confirmed directly via EXPLAIN ANALYZE against the real production
-- database (round 8/10): reference_data_age_gender_totals's live "direct" CTE alone
-- took 2.56s and 11,140 real buffer reads for Hampshire's 416-school peer list,
-- before its own regex-parse and group-by stages add more -- an entity_id-first
-- index scan against canonical_facts_current (27M rows across every source, not
-- just this one) has to walk every row for each requested school before the
-- period/breakdown filters narrow it down. Reproduced independently on Birmingham.
-- Any LA with several hundred schools hits this; not a Hampshire-specific fluke.
--
-- Same "precompute, don't live-aggregate" reasoning as roll_aggregates/
-- age_profile_aggregates/age_band_pupil_distributions -- this table is the
-- per-SCHOOL analogue: one row per (urn, age, period), not pre-summed by
-- geography, because Topic 3's LA-average needs each peer's own individual
-- headcount (to compute per-tag/per-split reliable headcounts exactly as
-- narrative-lookup.ts already does client-side) before averaging, not a
-- geography-level total. Deliberately NOT denormalized with la_name/sector on
-- this table -- computeTopic3SizeSentence already queries `schools` for its peer
-- list (fast, already indexed on la_name/establishment_type_group); this table is
-- joined against that result by urn, not queried by LA directly.
--
-- Written only by scripts/sync-census-age-gender-cache.ts (service-role); never
-- computed live per request. computeTopic3SizeSentence reads from this table
-- instead of calling reference_data_age_gender_totals live.
create table public.census_age_gender_cache (
    urn text not null,
    age integer not null,
    male_total numeric not null default 0,
    female_total numeric not null default 0,
    period integer not null,
    computed_at timestamptz not null default now(),
    primary key (urn, age, period)
);

create index census_age_gender_cache_period_idx on public.census_age_gender_cache (period);

alter table public.census_age_gender_cache enable row level security;

create policy census_age_gender_cache_select_anyone on public.census_age_gender_cache
    for select using (true);

comment on table public.census_age_gender_cache is
    'Precomputed per-school, per-age, per-sex DfE census headcounts -- the narrative generator Topic 3 LA-average mechanism''s data source, replacing a live reference_data_age_gender_totals call that timed out on large LAs (Hampshire, Birmingham -- see migration comment). Written only by scripts/sync-census-age-gender-cache.ts; never computed live per request.';
