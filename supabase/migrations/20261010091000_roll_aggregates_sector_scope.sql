-- Member Data View large-set design v1, item 4: adds a fourth roll_aggregates scope,
-- 'sector' -- scope_key = the school's own establishment_type_group verbatim (e.g.
-- 'Independent schools', 'Academies') -- so Graphs' new large-set aggregate-lines
-- chart (item 5, separate change) can plot a target school's own line against a real
-- national sector trend, alongside the existing 'national'/'ons_region' lines. Same
-- one-line-constraint-change pattern the 'ons_region' scope was already added with
-- (20261008093000_roll_aggregates_ons_region_scope.sql).
--
-- Populated by scripts/recompute-census-derived.ts's existing Part 2 loop, extended to
-- also group by establishment_type_group -- see that script's own comment for why the
-- scope_key is the raw establishment_type_group string (the design doc's own literal
-- instruction) rather than the coarser SectorTag taxonomy, and why Special Schools/FE
-- don't get a real 'sector' row this round (Part 2's entity fetch is still
-- MAINSTREAM_GROUPS-only).
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public' and rel.relname = 'roll_aggregates' and con.contype = 'c'
    and pg_get_constraintdef(con.oid) like '%scope%';

  if constraint_name is not null then
    execute format('alter table public.roll_aggregates drop constraint %I', constraint_name);
  end if;

  alter table public.roll_aggregates add constraint roll_aggregates_scope_check
    check (scope in ('national', 'regional', 'ons_region', 'sector'));
end $$;

comment on table public.roll_aggregates is 'Precomputed roll aggregates: national, regional (by LA, free tier), ons_region (the 9 ONS regions), and sector (by establishment_type_group) -- the last three power the Member Data View''s Region/Nation comparator buttons and Graphs'' large-set aggregate-lines chart. Written only by scripts/sync-roll-aggregates.ts and scripts/recompute-census-derived.ts (service-role); never computed live per request.';
