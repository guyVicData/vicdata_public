-- Member Data View performance architecture v1 backfill, real problem found running
-- it for real (2026-10-09): recompute_nearest_neighbours_general_batch() calls
-- public.nearest_schools() once per target school via a LATERAL join to populate
-- school_nearest_neighbours -- fine for nearest_schools()'s existing live call sites
-- (one call per page view), but calling it in a loop across thousands of schools in
-- one batch is a different cost profile entirely. Confirmed directly, not guessed:
-- nearest_schools() does a full sequential scan of `schools` (~52,500 rows) plus a
-- sort on `sqrt(power(...))` for EVERY call -- no index behind that expression at
-- all. Reproduced consistent timeouts via both PostgREST RPC batching (every batch
-- size tried) and the Supabase SQL Editor directly (SET statement_timeout = '30min'
-- did not help) -- a genuine query-cost problem, not a transient/artificial ceiling.
--
-- Fix: a real spatial index. British National Grid easting/northing is already
-- planar/Cartesian (unlike lat/lng, which needs a proper geographic projection to get
-- correct distances) -- Postgres's own BUILT-IN `point` type already has GiST index
-- support and a `<->` "distance between" operator with native KNN-ordered index scan
-- support, no extension needed (not earthdistance/cube/PostGIS -- genuinely just core
-- Postgres geometric-type indexing, the right tool for already-planar coordinates).
--
-- `location_point` is a GENERATED STORED column (not a live-computed expression index)
-- so ordinary `select easting, northing from schools` callers are completely
-- unaffected -- this is purely additive. Naming avoids "geom", which would misleadingly
-- suggest PostGIS geometry semantics; this is a plain built-in point, on a plain
-- Cartesian plane, nothing more.
alter table public.schools
    add column location_point point generated always as (point(easting, northing)) stored;

create index schools_location_point_gist_idx on public.schools using gist (location_point);

comment on column public.schools.location_point is 'Generated from (easting, northing) -- a plain built-in Postgres point, GiST-indexed for KNN (<->) nearest-neighbour queries. British National Grid is already planar, so plain Euclidean point distance is correct distance in metres, same as the sqrt(power(...)) this replaces.';

-- nearest_schools() rewritten to use location_point <-> location_point for both the
-- returned distance_metres AND the ORDER BY/LIMIT (the piece that lets the planner
-- use the new GiST index for an ordered KNN scan instead of scan+sort). Every other
-- line is byte-identical to 20260930120000_nearest_schools_special_and_through_school.sql
-- -- same special-school symmetry, same AP/PRU exclusion, same statutory age-range
-- overlap, same p_relax_sector semantics -- this is a distance-computation swap, not a
-- behaviour change. Verified identical output before/after for real schools (Woldingham,
-- Acland Burghley, Cambridge School) -- see docs/vicdata_data_view_open_questions.md.
drop function if exists public.nearest_schools(text, int, boolean);

create function public.nearest_schools(
    p_urn text,
    p_limit int default 30,
    p_relax_sector boolean default false
)
returns table (
    urn text,
    current_name text,
    town text,
    postcode text,
    establishment_type_group text,
    establishment_type text,
    statutory_low_age integer,
    statutory_high_age integer,
    distance_metres double precision
)
language sql
stable
as $$
    with target as (
        select
            location_point, establishment_type_group, establishment_type,
            statutory_low_age, statutory_high_age,
            (
                establishment_type_group = 'Special schools'
                or establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
            ) as is_special
        from public.schools where urn = p_urn
    )
    select s.urn, s.current_name, s.town, s.postcode, s.establishment_type_group, s.establishment_type,
           s.statutory_low_age, s.statutory_high_age,
           s.location_point <-> target.location_point as distance_metres
    from public.schools s, target
    where s.urn <> p_urn
      and s.status <> 'closed'
      and s.location_point is not null
      and target.location_point is not null
      and s.establishment_type not ilike '%alternative provision%'
      and s.establishment_type not ilike '%referral%'
      and (
          (
              not target.is_special
              and s.establishment_type_group in ('Academies', 'Local authority maintained schools', 'Independent schools', 'Free Schools')
              and s.establishment_type not in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
              and (
                  p_relax_sector
                  or (target.establishment_type_group = 'Independent schools') = (s.establishment_type_group = 'Independent schools')
              )
          )
          or (
              target.is_special
              and (
                  s.establishment_type_group = 'Special schools'
                  or s.establishment_type in ('Academy special converter', 'Academy special sponsor led', 'Free schools special')
              )
          )
      )
      and s.statutory_low_age is not null and s.statutory_high_age is not null
      and target.statutory_low_age is not null and target.statutory_high_age is not null
      and s.statutory_low_age <= target.statutory_high_age
      and s.statutory_high_age >= target.statutory_low_age
    order by s.location_point <-> target.location_point asc
    limit p_limit;
$$;

grant execute on function public.nearest_schools(text, int, boolean) to anon, authenticated;

-- recompute_nearest_neighbours_boarding_batch's own inline distance computation
-- (school_nearest_neighbours.sql) -- not the reported bottleneck (a ~403x403
-- self-join over the boarding-only pool is cheap regardless), but switched to the
-- same location_point <-> operator for consistency now that column exists, rather
-- than leaving two different distance idioms in this codebase to drift apart.
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
    select urn, location_point
    from public.schools
    where status <> 'closed'
      and boarders_name is not null and boarders_name <> 'No boarders'
      and location_point is not null
      and urn = any(p_urns)
  ) t
  cross join lateral (
    select
      c.urn,
      (c.location_point <-> t.location_point) / 1000.0 as dist
    from public.schools c
    where c.status <> 'closed'
      and c.boarders_name is not null and c.boarders_name <> 'No boarders'
      and c.location_point is not null
      and c.urn <> t.urn
  ) c;
end;
$$;
