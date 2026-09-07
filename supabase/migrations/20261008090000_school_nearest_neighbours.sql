-- Member Data View performance architecture v1 (docs/vicdata_phase3_member_data_view_
-- performance_architecture_v1.md), §4. Precomputed nearest-neighbour distances,
-- SHARED infrastructure between the public "State of the School" page's free-tier
-- surrounding-schools comparison (findSurroundingSchools(), fixed selection) and the
-- member Data View's Nearest-10/LA-any/bottom-3-quintile-boarding comparator sets --
-- per direct instruction, built once here, not twice. Replaces a live per-request
-- nearest_schools() RPC call (already fast, this table isn't fixing a slow RPC) whose
-- real cost was always the census-fact fetch layered on top in application code, not
-- the distance computation itself -- see boarding_quintiles.sql for where the actual
-- ~41s cost lived.
--
-- Two independently-ranked pools per school (see the `pool` column), not one mixed
-- ranking: a single "nearest N schools nationally, mixing boarding and non-boarding"
-- list can't reliably serve "the 10 nearest BOARDING schools" for a target in a
-- boarding-sparse area (boarding schools are ~403 of ~52,500 schools nationally --
-- roughly 1.7% -- so a shallow mixed-pool rank depth would frequently come up short of
-- 10 real boarding matches, and a deep-enough mixed pool to guarantee it would be
-- wastefully large for the 99% of reads that only want ordinary nearest neighbours).
--   - 'general': every school's top 100 nearest eligible schools nationally (candidate
--     eligibility -- special-school symmetry, AP/PRU exclusion, statutory age-range
--     overlap -- exactly matches the existing, already-tested public.nearest_schools()
--     RPC, called here with p_relax_sector always true to store the WIDEST reasonable
--     candidate set; findSurroundingSchools()'s own per-target ENROLLMENT-aware
--     relax-sector decision, which needs a target's live census data and can't be
--     precomputed, is applied by the reader as a cheap local filter over these ~100
--     rows instead -- see that function's own comment for the read-time filter. Depth
--     100 comfortably covers Nearest-10 and its "+5 more" expansion (NEAREST_STEP=5)
--     well past any realistic number of clicks, and the public page's fixed nearest-10
--     selection many times over.
--   - 'boarding': for every boarding school (target), the FULL national ranking of
--     every OTHER boarding school by plain distance -- no sector/age-overlap gate at
--     all, matching default-comparator-lists.ts's existing bottom-3-quintile boarding
--     recipe exactly (that recipe already searches the whole national boarding pool
--     unbounded, gender-filtered only). Storing the full ranking (~402 rows per
--     target, ~403 targets, ~162k rows total) rather than a shallow cap avoids ever
--     silently running out of depth on a "+5 more" expansion -- there is no realistic
--     click count that exhausts "every other boarding school in the country."
--
-- Refreshed on GIAS-affecting ingest-promotes (school opens/closes/moves) -- see
-- docs/vicdata_data_view_open_questions.md for the promote-hook wiring and its own
-- reasoning. Populated by scripts/recompute-school-geo-derived.ts calling the batch
-- RPC functions below in chunks (a single all-schools LATERAL join, while a valid
-- single SQL statement, risks the PostgREST/pooler statement timeout this project has
-- no way to raise from application code -- chunking via repeated small RPC calls is
-- the same discipline every other sync-*.ts script in this repo already uses for
-- reads, extended here to a bulk write for the same reason).

create table public.school_nearest_neighbours (
    urn text not null references public.schools(urn) on delete cascade,
    pool text not null check (pool in ('general', 'boarding')),
    rank integer not null,
    neighbour_urn text not null references public.schools(urn) on delete cascade,
    distance_km numeric not null,
    neighbour_is_boarding boolean not null,
    computed_at timestamptz not null default now(),
    primary key (urn, pool, rank)
);

create index school_nearest_neighbours_urn_pool_idx on public.school_nearest_neighbours (urn, pool, rank);
create index school_nearest_neighbours_urn_pool_boarding_idx on public.school_nearest_neighbours (urn, pool, neighbour_is_boarding, rank);

alter table public.school_nearest_neighbours enable row level security;

create policy school_nearest_neighbours_select_anyone on public.school_nearest_neighbours
    for select using (true);

comment on table public.school_nearest_neighbours is 'Precomputed nearest-neighbour distances, shared by the public State-of-the-School page and the member Data View. Written only by scripts/recompute-school-geo-derived.ts (service-role) via the batch RPC functions in this migration; never computed live per request.';

-- Batch recompute for the 'general' pool -- called repeatedly by
-- scripts/recompute-school-geo-derived.ts with a bounded urn[] batch (not the whole
-- ~52,500-school table in one call), so each call stays comfortably inside any
-- PostgREST/pooler statement timeout regardless of total table size. Delete-then-insert
-- per batch, not a global truncate, so a partial/resumed run never leaves a school with
-- stale AND fresh rows mixed, and a re-run is idempotent.
create or replace function public.recompute_nearest_neighbours_general_batch(p_urns text[])
returns void
language plpgsql
as $$
begin
  delete from public.school_nearest_neighbours where pool = 'general' and urn = any(p_urns);

  insert into public.school_nearest_neighbours (urn, pool, rank, neighbour_urn, distance_km, neighbour_is_boarding)
  select
    s.urn,
    'general',
    row_number() over (partition by s.urn order by n.distance_metres asc),
    n.urn,
    n.distance_metres / 1000.0,
    (sc.boarders_name is not null and sc.boarders_name <> 'No boarders')
  from public.schools s
  cross join lateral public.nearest_schools(s.urn, 100, true) n
  join public.schools sc on sc.urn = n.urn
  where s.urn = any(p_urns) and s.status <> 'closed';
end;
$$;

-- Batch recompute for the 'boarding' pool -- p_urns here should only ever be boarding
-- schools (boarders_name is not null and not 'No boarders'); a non-boarding urn in the
-- batch simply produces no rows (the WHERE clause naturally excludes it), not an error.
create or replace function public.recompute_nearest_neighbours_boarding_batch(p_urns text[])
returns void
language plpgsql
as $$
begin
  delete from public.school_nearest_neighbours where pool = 'boarding' and urn = any(p_urns);

  insert into public.school_nearest_neighbours (urn, pool, rank, neighbour_urn, distance_km, neighbour_is_boarding)
  select
    t.urn,
    'boarding',
    row_number() over (partition by t.urn order by c.dist asc),
    c.urn,
    c.dist,
    true
  from (
    select urn, easting, northing
    from public.schools
    where status <> 'closed'
      and boarders_name is not null and boarders_name <> 'No boarders'
      and easting is not null and northing is not null
      and urn = any(p_urns)
  ) t
  cross join lateral (
    select
      c.urn,
      sqrt(power(c.easting - t.easting, 2) + power(c.northing - t.northing, 2)) / 1000.0 as dist
    from public.schools c
    where c.status <> 'closed'
      and c.boarders_name is not null and c.boarders_name <> 'No boarders'
      and c.easting is not null and c.northing is not null
      and c.urn <> t.urn
  ) c;
end;
$$;
