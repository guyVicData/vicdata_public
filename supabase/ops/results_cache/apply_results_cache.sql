begin;
-- VicData 0.8 speed plan §4.2 item 2: 20261125090000_v08_results_cache.sql and its schema_migrations row, in one
-- transaction. WRITTEN AND TESTED LOCALLY (supabase/tests/v08_results_cache_pglite.mjs), NOT APPLIED. The migration
-- has no transaction control or CONCURRENTLY of its own. Apply: supabase db query --remote --yes -f supabase/ops/results_cache/apply_results_cache.sql
-- (then verify_results_cache.sql). Safe to run twice.

-- VicData 0.8 speed plan §4.2 item 2: the shared results cache (docs/v0.8/speed_plan_v1.md).
--
-- One row per built answer of a slow view (SMT, Admissions, Teacher), so a view built once is read in
-- milliseconds by everyone after, across deploys, restarts and instances, until the data or the server
-- code changes. Written and read only by the app's server (src/lib/results-cache.ts) with the service
-- role: RLS is on with NO policies, and anon and authenticated hold no privileges on it, so no browser
-- client can read or write it. Every route checks its caller before it asks this table anything.
--
--   key           the view, the school and a hash of what the answer is built from (never the caller)
--   value         the answer's JSON, as text: byte for byte what the route sends (jsonb would reorder
--                 its keys); Postgres compresses large values (TOAST) all the same
--   data_version  a hash of production's source stamps, the last school sync and RESULTS_CACHE_EPOCH
--   code_version  a hash of the server's code (scripts/write-build-info.mjs, server_code)
--   bytes         the value's size; built_ms how long it took to build
--   created_at    when it was stored; last_read_at when it was last read (updated at most hourly)
-- A row is used only when both versions match. The app prunes, at most hourly: rows of other versions,
-- rows past the maximum age (24 h by default), and rows unread for 60 days.
--
-- Additive; idempotent (runs twice). Rollback: supabase/ops/results_cache/rollback_results_cache.sql.

create table if not exists public.results_cache (
    key           text primary key,
    value         text not null,
    data_version  text not null,
    code_version  text not null,
    bytes         integer not null check (bytes >= 0),
    built_ms      integer not null check (built_ms >= 0),
    created_at    timestamptz not null default now(),
    last_read_at  timestamptz not null default now()
);

create index if not exists results_cache_versions_idx on public.results_cache (data_version, code_version);
create index if not exists results_cache_created_idx on public.results_cache (created_at);
create index if not exists results_cache_last_read_idx on public.results_cache (last_read_at);

alter table public.results_cache enable row level security;
-- No policies: the service role (which bypasses RLS) is the only reader and writer.
revoke all on table public.results_cache from public, anon, authenticated;
grant select, insert, update, delete on table public.results_cache to service_role;

comment on table public.results_cache is 'Speed plan 4.2 item 2: built answers of slow views, shared across deploys and instances. Server (service role) only: RLS on, no policies. Written and pruned by src/lib/results-cache.ts.';

insert into supabase_migrations.schema_migrations (version, name) values ('20261125090000', 'v08_results_cache') on conflict (version) do nothing;
commit;
