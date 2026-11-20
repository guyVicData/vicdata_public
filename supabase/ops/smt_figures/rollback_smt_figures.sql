-- ROLLBACK for 20261125090000_v08_smt_school_figures (speed plan 4.2 item 1). PREPARED, NOT RUN.
-- Unset SMT_FIGURES on Render first (or leave it: with the tables gone every read fails over to today's
-- reads, logging one warning per request). Drops both tables (only rebuildable figures: no data loss) and
-- the read function. Tested in PGlite (supabase/tests/v08_smt_figures_pglite.mjs with ROLLBACK=1).
begin;
drop function if exists public.smt_school_figures_read(text, text, text[], integer, integer, text);
drop table if exists public.smt_school_figures;
drop table if exists public.smt_figures_builds;
delete from supabase_migrations.schema_migrations where version = '20261125090000';
commit;
