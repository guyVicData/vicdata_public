-- VicData speed plan §4.2 item 1 (docs/v0.8/speed_plan_v1.md): each school's SMT Academic figures, worked out
-- once when new data arrives, so SMT Academic against a big comparison set (488 independent schools; 3,497
-- state schools at GCSE) reads one small row per set school instead of re-deriving every school's figures
-- from tens of thousands of raw rows on every request. The same "precompute, don't live-aggregate" reasoning
-- as subject_entry_size_fifths (20261122090000) and the ingest's academic_subject_rank_figures (17 Oct).
--
-- smt_school_figures: one row per key stage, data version, school and year:
--   figures   the school's figures that year, as src/lib/smt/school-figures.ts yearFigures works them out
--             (entries; Post-16 each qualification group's entries and points and each line's value-added
--             row; GCSE entries and the rollup's row by subject area)
--   subjects  that year's subject rows, [qualification, subject, family, entries, points, place in the read]
--   va        Post-16: that year's subject value-added rows
--   period 0 is the school's marker: built, whatever it has (a set school with no row is not built, and the
--   app then makes today's reads for that request).
-- smt_figures_builds: one row per key stage and data version; the app reads a version only once its build
-- is 'complete'. The version is the app's (smt-figures-store.ts figuresVersion): the source stamps, the
-- last school sync and the subject maps the rows come from, so a new ingest stops the old figures being
-- read until the next build (the app makes today's reads meanwhile).
--
-- Written only by scripts/build-smt-figures.ts (service role); read only by the app's server (service role)
-- through smt_school_figures_read. RLS on with no policies: anon and authenticated can't touch either table.
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

-- One call per request (one json value, as reference_data_lookup_all): every asked school's rows from
-- p_period_min on (and its marker), each year's subject and value-added rows only for p_full_urn (the
-- school itself, every year) and for p_subject_period (the year the page compares subjects in), and the
-- figures without the keys in p_drop (parts the view doesn't read: GCSE's area rows are most of a national
-- set's answer). Null when no complete build carries p_version.
create or replace function public.smt_school_figures_read(p_stage text, p_version text, p_urns text[], p_period_min integer, p_subject_period integer, p_full_urn text, p_drop text[])
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
                'f', case when p_drop is null or f.urn = p_full_urn then f.figures else f.figures - p_drop end,
                's', case when f.urn = p_full_urn or f.period = p_subject_period then f.subjects end,
                'v', case when f.urn = p_full_urn or f.period = p_subject_period then f.va end)), '[]'::json)
            from public.smt_school_figures f
            where f.stage = p_stage and f.data_version = p_version and f.urn = any(p_urns)
              and (f.period = 0 or f.period >= p_period_min or f.urn = p_full_urn))
    end;
$$;

revoke all on function public.smt_school_figures_read(text, text, text[], integer, integer, text, text[]) from public, anon, authenticated;
grant execute on function public.smt_school_figures_read(text, text, text[], integer, integer, text, text[]) to service_role;

comment on table public.smt_school_figures is
    'Each school''s SMT Academic figures per key stage, data version and year (src/lib/smt/school-figures.ts yearFigures), with that year''s subject and value-added rows. Written only by scripts/build-smt-figures.ts; read by the app''s server through smt_school_figures_read when SMT_FIGURES=on. Speed plan 4.2 item 1.';
comment on table public.smt_figures_builds is
    'One row per build of smt_school_figures (key stage, data version); the app reads a version only when its build is complete. Deleting a build deletes its figures.';
