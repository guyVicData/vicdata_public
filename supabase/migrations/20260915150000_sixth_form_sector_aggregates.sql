-- Precomputed sixth-form/16-18 roll (State/Independent, real DfE census) and FE
-- under-19 ILR participation, split by sector, at LA/region/national scope (Prompt B's
-- characterization -> this build). A NEW dedicated table, not an extension of
-- age_band_pupil_distributions -- that table's own shape (mean_roll/p20/p40/p60/p80)
-- is a DISTRIBUTION over per-school values (for the size-badge cards); what item 1's
-- local pie and item 6's stacked bar/pie charts need is a plain SUM (total + school
-- count) per scope+sector, a genuinely different shape, and that table has no sector
-- column to add one to without contorting its own existing meaning.
--
-- Naming, deliberately NOT reusing 'regional': roll_aggregates and
-- age_band_pupil_distributions both already use scope='regional' to mean "by LA", and
-- population-trend-lookup.ts separately reads age_profile_aggregates' own
-- scope='region' (singular) for genuine ONS/DfE 9-region rows. Reusing 'regional' here
-- for LA-level rows would collide with the FIRST meaning; reusing 'region' loosely
-- would only be safe if it means the same thing the SECOND table already means by it.
-- This table's own scope enum is 'la'/'region'/'national' -- 'la' is a value neither
-- sibling table uses at all (so it can never be mistaken for either of their existing
-- meanings), and 'region' here means exactly what age_profile_aggregates' 'region'
-- already means (a genuine ONS/DfE region rollup via la_gss_crosswalk.region) -- the
-- same word reused for the same real meaning in a sibling table, not a second,
-- diverging definition of it.
--
-- sector='fe' rows are DfE ILR under-19 participation totals (dfe_fe_participation),
-- NOT the same measurement as sector='state'/'independent' rows (DfE school census
-- sixth-form/16-18 roll) -- Prompt B could not confirm from ingested data that ILR's
-- "under-19" and census's "16-18" cover exactly the same population (dfe_fe_participation
-- has no age granularity finer than one under-19 bucket). Every caller that reads across
-- sectors from this table (the item-1 pie, item-6's stacked bar and both pies) must
-- carry the same short honest caveat caption Prompt A's IlrParticipationCard already
-- uses for its own DfE-rounding disclosure -- never present the three sectors as
-- directly equivalent without it. Kept in the SAME table as state/independent (not a
-- separate one) because every real caller needs all three sectors for one scope+
-- scope_key in a single query -- the caveat belongs at the render layer, not enforced
-- by physical table separation (same "one table, a naming/tag convention carries the
-- distinction" precedent as age_band_pupil_distributions' own fe_under_19/fe_19_plus
-- band_keys).
create table public.sixth_form_sector_aggregates (
    id uuid primary key default gen_random_uuid(),
    scope text not null check (scope in ('la', 'region', 'national')),
    scope_key text not null,
    sector text not null check (sector in ('state', 'independent', 'fe')),
    period integer not null,
    total integer not null,
    school_count integer not null,
    computed_at timestamptz not null default now(),
    unique (scope, scope_key, sector, period)
);

create index sixth_form_sector_aggregates_scope_idx
    on public.sixth_form_sector_aggregates (scope, scope_key, period);

alter table public.sixth_form_sector_aggregates enable row level security;

create policy sixth_form_sector_aggregates_select_anyone on public.sixth_form_sector_aggregates
    for select using (true);

comment on table public.sixth_form_sector_aggregates is
    'Precomputed sixth-form/16-18 roll (state/independent, DfE census) and FE under-19 ILR participation (sector=fe), split by sector, at LA/region/national scope -- see this table''s own migration comment for the scope-naming rationale (deliberately not "regional", which two sibling tables already use to mean LA) and the state/independent-vs-fe measurement caveat. Written only by scripts/sync-sixth-form-sector-aggregates.ts and scripts/sync-fe-participation-region-national.ts (service-role); never computed live per request.';
