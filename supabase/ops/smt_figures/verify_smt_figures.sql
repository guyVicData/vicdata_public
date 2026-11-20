-- After apply_smt_figures.sql: read-only checks (supabase db query --remote --read-only -f ...).
-- Expect: recorded 1, both tables, rls_on true, no policies, anon/authenticated locked out, the service role
-- can call the read; builds/rows 0 until scripts/build-smt-figures.ts --live has run.
select (select count(*) from supabase_migrations.schema_migrations where version = '20261125100000') as recorded,
       to_regclass('public.smt_school_figures') is not null and to_regclass('public.smt_figures_builds') is not null as tables,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.smt_school_figures'::regclass, 'public.smt_figures_builds'::regclass)) as rls_on,
       (select count(*) from pg_policies where tablename in ('smt_school_figures', 'smt_figures_builds')) as policies,
       not has_table_privilege('anon', 'public.smt_school_figures', 'select') and not has_table_privilege('authenticated', 'public.smt_school_figures', 'select') as tables_locked,
       not has_function_privilege('anon', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute')
         and not has_function_privilege('authenticated', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute') as read_locked,
       has_function_privilege('service_role', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute') as server_reads;

-- After the build: one complete build per key stage, its size.
select stage, data_version, status, schools, row_count, pg_size_pretty(payload_bytes) as json, finished_at - started_at as took
from public.smt_figures_builds order by stage;
select pg_size_pretty(pg_total_relation_size('public.smt_school_figures')) as table_size, (select count(*) from public.smt_school_figures) as rows;
