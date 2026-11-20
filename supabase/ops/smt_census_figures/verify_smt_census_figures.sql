-- After apply_smt_census_figures.sql: read-only checks (supabase db query --remote --read-only -f ...).
-- Expect: recorded 1, census_allowed true, rls_on true, policies 0, tables_locked true, read_locked true,
-- server_reads true; no census build until scripts/build-smt-figures.ts --live --stage census has run.
select (select count(*) from supabase_migrations.schema_migrations where version = '20261125110000') as recorded,
       (select pg_get_constraintdef(oid) like '%census%' from pg_constraint where conname = 'smt_figures_builds_stage_check') as census_allowed,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.smt_school_figures'::regclass, 'public.smt_figures_builds'::regclass)) as rls_on,
       (select count(*) from pg_policies where tablename in ('smt_school_figures', 'smt_figures_builds')) as policies,
       not has_table_privilege('anon', 'public.smt_school_figures', 'select') and not has_table_privilege('authenticated', 'public.smt_school_figures', 'select') as tables_locked,
       not has_function_privilege('anon', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute')
         and not has_function_privilege('authenticated', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute') as read_locked,
       has_function_privilege('service_role', 'public.smt_school_figures_read(text, text, text[], integer, integer, text, text[])', 'execute') as server_reads;

-- After the build: one complete build per stage (census among them), its size.
select stage, data_version, status, schools, row_count, pg_size_pretty(payload_bytes) as json, finished_at - started_at as took
from public.smt_figures_builds order by stage;
select stage, count(*) as rows from public.smt_school_figures group by stage order by stage;
