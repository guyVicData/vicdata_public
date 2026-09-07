-- Member Data View performance architecture v1, §4. One row per boarding school,
-- precomputing what default-comparator-lists.ts's boardingQuintileList() used to
-- compute live on every request -- the actual ~41-71s cost this whole architecture
-- round exists to fix. That cost was never the quintile bucketing/sorting itself
-- (trivial over ~400 rows); it was fetching every boarding school's census facts
-- (boarders_total/roll) via the paginated, cross-Supabase-project reference_data_lookup
-- HTTP RPC on every single request (canonical_facts_current lives in a different
-- Supabase project -- vicdata, the Phase-1 ingest repo -- reachable only over that
-- paginated HTTP API, never a local SQL join; see vicdata-reference.ts's own comment).
-- Precomputing here means that cross-project fetch happens once per census-affecting
-- promote, not once per member click.
--
-- Three genuinely separate quintile pools, not one national ranking, mirroring
-- default-comparator-lists.ts's own three-way dispatch exactly (independent senior
-- boarding schools are quintiled by headcount among Independent+Senior boarding
-- schools only; independent prep boarding by RATIO among Independent+Prep; state
-- boarding by headcount among Academies/LA-maintained/Free-Schools+Senior) --
-- `boarding_school_type` + `quintile_basis` record which pool a row belongs to,
-- `national_boarding_pool_size` is that SPECIFIC pool's size, not a blanket ~403.
--
-- Quintile numbering confirmed directly from the real, already-implemented
-- quintileOf() logic in default-comparator-lists.ts (Compared-with panel Round 6),
-- not re-derived or reinterpreted: ascending sort by the pool's own sortKey (headcount
-- or ratio), quintileSize = ceil(poolSize/5), quintile = min(4, floor(sortedIndex /
-- quintileSize)) -- so 0 = smallest boarding population/ratio ("bottom", thinnest),
-- 4 = largest ("top"). Stored here as 0-4 (matching the real code's own output)
-- rather than the architecture doc's "1-5" phrasing, per that doc's own explicit
-- instruction to confirm against and defer to the real implementation.
--
-- Refreshed on census-affecting ingest-promotes (the boarding census re-syncs,
-- quintile boundaries can shift) -- see docs/vicdata_data_view_open_questions.md.
-- Populated by scripts/recompute-census-derived.ts (service-role), which fetches
-- boarding/roll facts via the existing vicdata-reference.ts bulk HTTP helpers (the one
-- part of this recompute that genuinely can't avoid the cross-project fetch, since the
-- census facts only exist there) and upserts the computed quintiles here.

create table public.boarding_quintiles (
    urn text primary key references public.schools(urn) on delete cascade,
    boarding_school_type text not null check (boarding_school_type in ('independent_boarding_senior', 'independent_boarding_prep', 'state_boarding')),
    quintile_basis text not null check (quintile_basis in ('headcount', 'ratio')),
    quintile integer not null check (quintile between 0 and 4),
    national_boarding_pool_size integer not null,
    boarders_total integer,
    boarding_ratio numeric,
    census_period integer not null,
    computed_at timestamptz not null default now()
);

create index boarding_quintiles_type_quintile_idx on public.boarding_quintiles (boarding_school_type, quintile);

alter table public.boarding_quintiles enable row level security;

create policy boarding_quintiles_select_anyone on public.boarding_quintiles
    for select using (true);

comment on table public.boarding_quintiles is 'Precomputed boarding-population/ratio quintile per boarding school (0=thinnest, 4=largest, matching the real quintileOf() ascending index). Written only by scripts/recompute-census-derived.ts (service-role); never computed live per request. See default-comparator-lists.ts for the same-shaped live logic this replaces.';
