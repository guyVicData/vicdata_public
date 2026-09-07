-- Member Data View performance architecture v1, §4/§5. Consolidates the planned new
-- `comparator_aggregates` table onto the EXISTING roll_aggregates table instead of
-- building a parallel one, per direct instruction after review: roll_aggregates
-- already precomputes exactly this shape (total_roll, school_count, age_band_totals,
-- gender split, boarders_total) for 'national' and 'regional' (by-LA) scope, already
-- populated by scripts/sync-roll-aggregates.ts, and already read by production code
-- (RollCard.tsx, schools/[urn]/page.tsx's context.regional/national, RegionalNationalCard
-- in SmallCards.tsx). Building a second, differently-shaped aggregates table for the
-- Data View's Region/Nation buttons would mean two sources of truth for overlapping
-- geography-scoped roll numbers -- exactly the "parallel infrastructure" this
-- consolidation avoids.
--
-- Adds a THIRD scope, 'ons_region' (the 9-region ONS taxonomy, scope_key = the ONS GSS
-- region code e.g. 'E12000007' for London), genuinely distinct from the existing
-- 'regional' scope (which means by-LA, per that column's own original comment --
-- naming collision with the Data View's "Region" button avoided by using a different
-- scope value rather than overloading 'regional' with a second meaning). The existing
-- 'national' scope is reused as-is for the Data View's "England Schools" button --
-- no schema change needed there, it already covers exactly this.
--
-- Populated for the new scope by scripts/recompute-census-derived.ts, extending
-- sync-roll-aggregates.ts's own proven fetch/accumulate pattern to also group by
-- src/lib/region-crosswalk.ts's region_code, and to loop across every available
-- census year (not just the current one) so the Data View's A3 trend sentence has the
-- same "since 2019/20"-style multi-year basis the Round 6 boarding fix already
-- established. Refreshed on census-affecting ingest-promotes.
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
    check (scope in ('national', 'regional', 'ons_region'));
end $$;

comment on table public.roll_aggregates is 'Precomputed roll aggregates: national, regional (by LA, free tier), and ons_region (the 9 ONS regions, Member Data View Region/Nation comparator buttons). Written only by scripts/sync-roll-aggregates.ts and scripts/recompute-census-derived.ts (service-role); never computed live per request.';
