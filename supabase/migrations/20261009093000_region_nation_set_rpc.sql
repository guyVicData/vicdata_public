-- Member Data View performance architecture v1 -- real fix found live verifying
-- against production (2026-10-09): region-nation-comparator.ts's own application-side
-- pagination (25+ concurrent .range() calls for a Nation-scale set of tens of
-- thousands of rows, PostgREST capping every response at config.toml's max_rows=1000)
-- first 500'd (an unbounded exact-COUNT re-run on every page, fixed separately) and
-- then, once that crash was fixed, still took ~7.6s -- real DB/network round-trip
-- cost multiplied by ~25 pages, not something concurrency tuning alone was going to
-- get under the ~1s target.
--
-- Same principle as this whole round's own root-cause diagnosis (push aggregation
-- into Postgres, return one small answer): a single SQL function that joins schools
-- to school_region_nation and aggregates the WHOLE result into one jsonb array
-- server-side sidesteps PostgREST's row-count cap entirely -- the cap applies to how
-- many ROWS a response can contain, and this function's own return shape is exactly
-- one row (containing an array), regardless of how many schools are actually in
-- scope. One query, one round trip, no per-page COUNT, no pagination logic on the
-- application side at all.
create or replace function public.region_nation_set(
    p_region_code text,
    p_nation text,
    p_exclude_urn text
)
returns jsonb
language sql
stable
as $$
    select coalesce(jsonb_agg(jsonb_build_object('urn', s.urn, 'name', s.current_name)), '[]'::jsonb)
    from public.schools s
    join public.school_region_nation srn on srn.urn = s.urn
    where srn.urn <> p_exclude_urn
      and (
          (p_region_code is not null and srn.region_code = p_region_code)
          or (p_region_code is null and srn.nation = p_nation)
      );
$$;

grant execute on function public.region_nation_set(text, text, text) to anon, authenticated;
