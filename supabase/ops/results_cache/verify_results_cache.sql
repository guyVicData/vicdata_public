-- After apply_results_cache.sql: read-only checks (supabase db query --remote --read-only -f ...).
-- Every column should read true / the counts as noted.
select (select count(*) from supabase_migrations.schema_migrations where version = '20261125090000') = 1 as recorded,
       (select relrowsecurity from pg_class where oid = 'public.results_cache'::regclass) as rls_on,
       (select count(*) from pg_policies where schemaname = 'public' and tablename = 'results_cache') = 0 as no_policies,
       not has_table_privilege('anon', 'public.results_cache', 'select') as anon_cant_read,
       not has_table_privilege('authenticated', 'public.results_cache', 'select') as authenticated_cant_read,
       not has_table_privilege('authenticated', 'public.results_cache', 'insert') as authenticated_cant_write,
       has_table_privilege('service_role', 'public.results_cache', 'select,insert,update,delete') as service_role_can,
       (select string_agg(column_name || ':' || data_type, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'results_cache')
         = 'key:text,value:text,data_version:text,code_version:text,bytes:integer,built_ms:integer,created_at:timestamp with time zone,last_read_at:timestamp with time zone' as columns_ok,
       (select count(*) from pg_indexes where schemaname = 'public' and tablename = 'results_cache') = 4 as four_indexes;

-- Once RESULTS_CACHE=on: what it holds (no values read).
select code_version, data_version, count(*) as rows, pg_size_pretty(sum(bytes)::bigint) as json_bytes,
       round(avg(built_ms)) as avg_built_ms, min(created_at) as first, max(last_read_at) as last_read
from public.results_cache group by 1, 2 order by max(created_at) desc;
select split_part(key, '|', 1) as view, count(*) as rows, pg_size_pretty(sum(bytes)::bigint) as json_bytes, round(avg(built_ms)) as avg_built_ms
from public.results_cache group by 1 order by 2 desc;
select pg_size_pretty(pg_total_relation_size('public.results_cache')) as on_disk_compressed;
