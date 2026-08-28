-- Precomputed per-age-band pupil-count distributions (dashboard rebuild, phase-
-- breakdown size-badge card): "this school's headcount in [band] against the
-- distribution of headcounts among other schools with that same band" needs a
-- national/regional distribution of PER-SCHOOL headcounts in each age band, which
-- roll_aggregates does not carry (it only has a single summed total per band, not the
-- per-school spread) -- same "precompute, don't live-aggregate" reasoning as that
-- table (roll_aggregates' own migration comment): live would mean pulling phase-sliced
-- roll data for every one of the ~6,574+ same-band schools nationally through the
-- paginated reference_data_lookup API on every page view.
--
-- Reference population, per band, is schools with a genuine NON-ZERO headcount in
-- that band only -- a primary-only school contributes nothing to the Sixth Form
-- distribution, otherwise the quintiles and mean would be diluted by every school
-- that doesn't offer that band at all, which isn't the comparison a viewer wants
-- ("how big is my sixth form compared to schools that HAVE one").
--
-- quintile boundaries (p20/p40/p60/p80) split that same-band population into five
-- equal-frequency buckets (XS/S/M/L/XL) -- a genuine first pass, not a final
-- definition (see docs/OPEN_QUESTIONS.md): quintile-based was the explicit
-- instruction, but which reference population feeds it (this migration uses
-- NATIONAL only, per band, as the single scale every school -- regardless of LA --
-- is measured against; "regional" rows are computed too and stored, but only ever
-- used for the descriptive LA-average caption number, not a second quintile scale)
-- is a real, documented interpretation choice, not the only possible one.
create table public.age_band_pupil_distributions (
    id uuid primary key default gen_random_uuid(),
    scope text not null check (scope in ('national', 'regional')),
    scope_key text,
    band_key text not null,
    period integer not null,
    school_count integer not null,
    mean_roll numeric not null,
    p20 numeric not null,
    p40 numeric not null,
    p60 numeric not null,
    p80 numeric not null,
    computed_at timestamptz not null default now(),
    unique (scope, scope_key, band_key, period)
);

create index age_band_pupil_distributions_scope_band_idx
    on public.age_band_pupil_distributions (scope, scope_key, band_key, period);

alter table public.age_band_pupil_distributions enable row level security;

create policy age_band_pupil_distributions_select_anyone on public.age_band_pupil_distributions
    for select using (true);

comment on table public.age_band_pupil_distributions is
    'Precomputed per-age-band (roll-data.ts AGE_BANDS) distribution of PER-SCHOOL non-zero headcounts, national + regional (by LA). Written only by scripts/sync-age-band-distributions.ts (service-role); never computed live per request. Powers the State of the School page''s phase-breakdown size-badge card.';
