begin;
-- Speed plan 4.2 item 1, extended to the Overview: smt_school_figures takes a third stage, 'census'.
-- docs/v0.8/smt_overview_figures_v1.md. Needs 20261125100000 (smt_figures) applied first (it is, live, 20 Nov).
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v08_smt_census_figures_pglite.mjs, ROLLBACK=1 too), NOT APPLIED.
-- Widens one check constraint and rewrites one comment; nothing else changes. The app reads census figures only
-- when SMT_OVERVIEW_FIGURES=on is set on Render and a census build is complete. Run with:
--   supabase db query --remote --yes -f supabase/ops/smt_census_figures/apply_smt_census_figures.sql
-- then verify_smt_census_figures.sql, then the build (scripts/build-smt-figures.ts --live --stage census).
alter table public.smt_figures_builds drop constraint smt_figures_builds_stage_check;
alter table public.smt_figures_builds add constraint smt_figures_builds_stage_check check (stage in ('ks4', 'ks5', 'census'));

comment on table public.smt_school_figures is
    'Each school''s SMT figures per stage and data version, built ahead by scripts/build-smt-figures.ts. ks4/ks5: SMT Academic, per year (src/lib/smt/school-figures.ts yearFigures), with that year''s subject and value-added rows, read when SMT_FIGURES=on. census: SMT Overview, one row per school at period 0 (src/lib/smt/overview-figures.ts overviewFigures), read when SMT_OVERVIEW_FIGURES=on. Speed plan 4.2 item 1.';

insert into supabase_migrations.schema_migrations (version, name) values ('20261125110000', 'v08_smt_census_figures') on conflict do nothing;
commit;
