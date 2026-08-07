-- Extensions: pg_trgm for fuzzy/typo-tolerant search (membership spec §3).
-- gen_random_uuid() is core in PG13+, no pgcrypto/uuid-ossp needed.
create extension if not exists pg_trgm;

-- schools: search-optimized copy of school reference data, pulled from Phase 1's live
-- hosted API (vicdata's school_entities_export RPC) -- never a direct shared table
-- (brief, "Infrastructure setup"). Sector/independent-vs-state taxonomy deliberately NOT
-- baked in as a stored column here -- vicdata's own reference_data.py docstring flags a
-- real GIAS-vs-DfE classification mismatch (OPEN_QUESTIONS.md #17 there) as not fully
-- resolved; application code filters on establishment_type_group directly rather than
-- committing to a derived label this migration would then own.
create table public.schools (
    urn text primary key,
    current_name text not null,
    status text not null,
    la_name text,
    establishment_type_group text,
    establishment_type text,
    town text,
    postcode text,
    phase text,
    boarders_code text,
    boarders_name text,
    boarding_establishment text,
    statutory_low_age integer,
    statutory_high_age integer,
    easting numeric,
    northing numeric,
    msoa_code text,
    lsoa_code text,
    -- Weighted per membership spec §3: name matches ranked above town/postcode.
    search_vector tsvector generated always as (
        setweight(to_tsvector('english', coalesce(current_name, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(town, '') || ' ' || coalesce(postcode, '')), 'B')
    ) stored,
    source_updated_at timestamptz,
    synced_at timestamptz not null default now()
);

create index schools_search_vector_idx on public.schools using gin (search_vector);
create index schools_name_trgm_idx on public.schools using gin (current_name gin_trgm_ops);
create index schools_town_idx on public.schools (town);
create index schools_phase_idx on public.schools (phase);
create index schools_establishment_type_group_idx on public.schools (establishment_type_group);
create index schools_easting_northing_idx on public.schools (easting, northing);

alter table public.schools enable row level security;

comment on table public.schools is 'Search-optimized mirror of vicdata (ingest repo) school_entities, synced via school_entities_export RPC. Never written to directly by app users.';
