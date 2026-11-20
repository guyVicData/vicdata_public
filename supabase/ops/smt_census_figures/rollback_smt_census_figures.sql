-- ROLLBACK for 20261125110000_v08_smt_census_figures. PREPARED, NOT RUN.
-- Unset SMT_OVERVIEW_FIGURES on Render first (or leave it: with no census build the Overview makes today's
-- reads). Deletes the census builds (their rows go with them: only rebuildable figures) and narrows the stage
-- check back to ks4 and ks5. SMT Academic's figures are untouched. Tested in PGlite
-- (supabase/tests/v08_smt_census_figures_pglite.mjs with ROLLBACK=1).
begin;
delete from public.smt_figures_builds where stage = 'census';
alter table public.smt_figures_builds drop constraint smt_figures_builds_stage_check;
alter table public.smt_figures_builds add constraint smt_figures_builds_stage_check check (stage in ('ks4', 'ks5'));
comment on table public.smt_school_figures is
    'Each school''s SMT Academic figures per key stage, data version and year (src/lib/smt/school-figures.ts yearFigures), with that year''s subject and value-added rows. Written only by scripts/build-smt-figures.ts; read by the app''s server through smt_school_figures_read when SMT_FIGURES=on. Speed plan 4.2 item 1.';
delete from supabase_migrations.schema_migrations where version = '20261125110000';
commit;
