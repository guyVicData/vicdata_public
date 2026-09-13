-- Real bug fix, 2026-09-13 (same root cause as scripts/recompute-school-geo-derived.ts's
-- own fix, committed alongside this migration -- see that file's own comment for the
-- full real boarders_name breakdown): `recompute_nearest_neighbours_boarding_batch`
-- and `recompute_nearest_neighbours_general_batch` (20261008090000_school_nearest_
-- neighbours.sql, the boarding function later replaced by 20261009090000_nearest_
-- schools_spatial_index.sql for an unrelated performance fix) both treat
-- `boarders_name is not null and boarders_name <> 'No boarders'` as "this school is
-- boarding-eligible" -- wrongly including `boarders_name = 'Not applicable'` (2,811
-- real schools nationally: nurseries, PRUs, and similar institutions the field
-- genuinely doesn't apply to, not a real "yes/no" answer). Fixing only the TypeScript
-- caller's own `boardingUrns` list (which controls WHICH schools get a boarding-pool
-- row computed at all) is not sufficient on its own: both SQL functions' own internal
-- CANDIDATE-POOL queries independently re-derive boarding eligibility from this same
-- buggy condition, so every boarding school's own neighbour ranking would still be
-- computed against the wrong, ~4,002-school candidate pool even with the TypeScript
-- fix alone.
--
-- Same corrected denylist as the TypeScript fix (`No boarders`, `Not applicable`) --
-- confirmed directly against the real distinct `boarders_name` values before writing
-- this, not assumed to be only those two: `Boarding school`, `Children's home
-- (Boarding school)`, and `College / FE residential accommodation` are all genuinely
-- boarding-eligible and correctly remain included.
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
      and boarders_name is not null and boarders_name not in ('No boarders', 'Not applicable')
      and location_point is not null
      and urn = any(p_urns)
  ) t
  cross join lateral (
    select
      c.urn,
      (c.location_point <-> t.location_point) / 1000.0 as dist
    from public.schools c
    where c.status <> 'closed'
      and c.boarders_name is not null and c.boarders_name not in ('No boarders', 'Not applicable')
      and c.location_point is not null
      and c.urn <> t.urn
  ) c;
end;
$$;

-- The general pool's own boarding label (used to mark which of a school's ordinary
-- nearest neighbours are themselves boarding schools, for display) shares the exact
-- same underlying condition -- fixed for the same reason and the same corrected
-- denylist, not left to silently disagree with the boarding pool's own real
-- eligibility now that the two would otherwise define "boarding" differently.
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
    (sc.boarders_name is not null and sc.boarders_name not in ('No boarders', 'Not applicable'))
  from public.schools s
  cross join lateral public.nearest_schools(s.urn, 100, true) n
  join public.schools sc on sc.urn = n.urn
  where s.urn = any(p_urns) and s.status <> 'closed';
end;
$$;

-- Partial index (20261009091000_schools_boarding_partial_index.sql) matched the old
-- buggy predicate exactly, so it can't serve the corrected query above at all --
-- Postgres only uses a partial index when the query's own WHERE clause provably
-- implies the index's predicate. Replaced with a matching corrected index rather than
-- left stale (the corrected boarding-eligible pool is smaller, ~602 vs ~2,335, but the
-- inner lateral above still scans the full ~52,500-row table per target without an
-- index behind this exact predicate -- same real cost problem that migration fixed,
-- reintroduced by leaving the old index in place unmatched).
drop index if exists public.schools_is_boarding_partial_idx;

create index schools_is_boarding_partial_idx on public.schools (urn)
    where boarders_name is not null and boarders_name not in ('No boarders', 'Not applicable') and status <> 'closed';
