-- ROLLBACK for 20261125090000_v08_results_cache (speed plan §4.2 item 2). PREPARED, NOT RUN.
-- Turn the cache off first (RESULTS_CACHE unset or not "on" in Render), or the app logs a failed read
-- or write once every ten minutes (it builds as without the cache either way: nothing fails).
-- Drops the table and every stored answer (no other data: every row can be rebuilt). Tested in PGlite
-- (supabase/tests/v08_results_cache_pglite.mjs).
begin;
drop table if exists public.results_cache;
delete from supabase_migrations.schema_migrations where version = '20261125090000';
commit;
