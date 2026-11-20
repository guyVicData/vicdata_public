-- VicData speed plan §4.2 item 1, extended to SMT's Overview (docs/v0.8/smt_overview_figures_v1.md): each
-- school's census figures for the Overview, worked out once when new data arrives, so an Overview against a
-- big set (488 independent schools in England; 457 sixth forms in the South East) reads one small row per set
-- school instead of every set school's whole census twice over (roll by year, then age by age).
--
-- No new table: smt_school_figures (20261125100000) takes a third stage, 'census'. One row per school, period 0,
-- figures = src/lib/smt/overview-figures.ts overviewFigures (the roll each census year with its day and boarding
-- split, the latest census's pupils in each age band, the Year 7 entry cohort each year). The build marks a
-- census version complete in smt_figures_builds as for ks4 and ks5, and smt_school_figures_read answers it
-- unchanged (p_period_min 0: the one row). The data version is the app's (overview-figures-store.ts
-- censusVersion): dfe_school_census's stamp, gias and gias_links (the lookups' lineage), the last school sync
-- and the format. RLS, grants and the read function are unchanged: service role only.
alter table public.smt_figures_builds drop constraint smt_figures_builds_stage_check;
alter table public.smt_figures_builds add constraint smt_figures_builds_stage_check check (stage in ('ks4', 'ks5', 'census'));

comment on table public.smt_school_figures is
    'Each school''s SMT figures per stage and data version, built ahead by scripts/build-smt-figures.ts. ks4/ks5: SMT Academic, per year (src/lib/smt/school-figures.ts yearFigures), with that year''s subject and value-added rows, read when SMT_FIGURES=on. census: SMT Overview, one row per school at period 0 (src/lib/smt/overview-figures.ts overviewFigures), read when SMT_OVERVIEW_FIGURES=on. Speed plan 4.2 item 1.';
