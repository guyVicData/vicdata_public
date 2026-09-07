-- Member Data View performance architecture v1, §4. Real region/nation membership as
-- queryable columns -- this is what makes the "London Schools"/"England Schools"
-- comparator buttons real (a `where region_code = 'E12000007'` / `where nation =
-- 'england'` indexed query), replacing their previous disabled-placeholder state.
--
-- Populated by scripts/recompute-school-geo-derived.ts from src/lib/region-crosswalk.ts
-- (a from-scratch, la_name-keyed table cross-validated against this project's own
-- existing la_gss_crosswalk.region column -- 158/158 comparable rows matched exactly,
-- see that file's own header comment for the full reasoning on why a fresh la_name-
-- keyed table was built rather than joining la_gss_crosswalk directly). Purely local
-- computation -- no cross-project census fetch needed for this table at all, since
-- region/nation is administrative geography derived from schools.la_name alone.
--
-- Refreshed on GIAS-affecting ingest-promotes (a school's la_name can change on a
-- GIAS update, e.g. a local-government reorganisation moving it to a new LA) -- see
-- docs/vicdata_data_view_open_questions.md.
--
-- region_name/region_code/nation are all nullable: a small number of schools carry a
-- GIAS sentinel la_name (BFPO/overseas/offshore establishments, "Does not apply") that
-- isn't a real comparable English/Welsh local authority at all -- these are left with
-- no region/nation membership rather than guessed into a bucket, and are naturally
-- excluded from both Region- and Nation-scoped comparator sets as a result (see
-- region-crosswalk.ts's own NON_STANDARD_LA_NAMES).

create table public.school_region_nation (
    urn text primary key references public.schools(urn) on delete cascade,
    region_name text,
    region_code text,
    nation text check (nation in ('england', 'wales')),
    computed_at timestamptz not null default now()
);

create index school_region_nation_region_code_idx on public.school_region_nation (region_code);
create index school_region_nation_nation_idx on public.school_region_nation (nation);

alter table public.school_region_nation enable row level security;

create policy school_region_nation_select_anyone on public.school_region_nation
    for select using (true);

comment on table public.school_region_nation is 'Real region/nation membership per school (src/lib/region-crosswalk.ts). Written only by scripts/recompute-school-geo-derived.ts (service-role); never computed live per request. Backs the Data View''s Region/Nation comparator buttons.';
