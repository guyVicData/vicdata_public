begin;
-- Speed plan 4.2 item 1: SMT Academic's per-school figures, built ahead (smt_school_figures, smt_figures_builds,
-- smt_school_figures_read). docs/v0.8/speed_plan_v1.md §4.2; docs/v0.8/smt_school_figures_v1.md.
--
-- WRITTEN AND TESTED LOCALLY (supabase/tests/v08_smt_figures_pglite.mjs, ROLLBACK=1 too), NOT APPLIED.
-- Additive: two new tables and one function; nothing existing changes. The app reads them only when
-- SMT_FIGURES=on is set on Render and a build is complete. Run with:
--   supabase db query --remote --yes -f supabase/ops/smt_figures/apply_smt_figures.sql
-- then verify_smt_figures.sql, then the build (scripts/build-smt-figures.ts --live).
create table public.smt_figures_builds (
    stage text not null check (stage in ('ks4', 'ks5')),
    data_version text not null,
    status text not null check (status in ('building', 'complete')),
    schools integer,
    row_count integer,
    payload_bytes bigint,
    started_at timestamptz not null default now(),
    finished_at timestamptz,
    primary key (stage, data_version)
);

create table public.smt_school_figures (
    stage text not null,
    data_version text not null,
    urn text not null,
    period integer not null,
    figures jsonb not null,
    subjects jsonb,
    va jsonb,
    primary key (stage, data_version, urn, period),
    foreign key (stage, data_version) references public.smt_figures_builds (stage, data_version) on delete cascade
);

alter table public.smt_figures_builds enable row level security;
alter table public.smt_school_figures enable row level security;
revoke all on public.smt_figures_builds from public, anon, authenticated;
revoke all on public.smt_school_figures from public, anon, authenticated;
grant select, insert, update, delete on public.smt_figures_builds to service_role;
grant select, insert, update, delete on public.smt_school_figures to service_role;

create or replace function public.smt_school_figures_read(p_stage text, p_version text, p_urns text[], p_period_min integer, p_subject_period integer, p_full_urn text)
returns json
language sql
stable
set search_path = public
as $$
    select case
        when not exists (select 1 from public.smt_figures_builds b where b.stage = p_stage and b.data_version = p_version and b.status = 'complete') then null
        else (
            select coalesce(json_agg(json_build_object(
                'u', f.urn,
                'p', f.period,
                'f', f.figures,
                's', case when f.urn = p_full_urn or f.period = p_subject_period then f.subjects end,
                'v', case when f.urn = p_full_urn or f.period = p_subject_period then f.va end)), '[]'::json)
            from public.smt_school_figures f
            where f.stage = p_stage and f.data_version = p_version and f.urn = any(p_urns)
              and (f.period = 0 or f.period >= p_period_min or f.urn = p_full_urn))
    end;
$$;

revoke all on function public.smt_school_figures_read(text, text, text[], integer, integer, text) from public, anon, authenticated;
grant execute on function public.smt_school_figures_read(text, text, text[], integer, integer, text) to service_role;

comment on table public.smt_school_figures is
    'Each school''s SMT Academic figures per key stage, data version and year (src/lib/smt/school-figures.ts yearFigures), with that year''s subject and value-added rows. Written only by scripts/build-smt-figures.ts; read by the app''s server through smt_school_figures_read when SMT_FIGURES=on. Speed plan 4.2 item 1.';
comment on table public.smt_figures_builds is
    'One row per build of smt_school_figures (key stage, data version); the app reads a version only when its build is complete. Deleting a build deletes its figures.';

insert into supabase_migrations.schema_migrations (version, name) values ('20261125090000', 'v08_smt_school_figures') on conflict do nothing;
commit;
