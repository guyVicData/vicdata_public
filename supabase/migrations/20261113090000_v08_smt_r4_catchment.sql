-- VicData 0.8 SMT round 4 (R3): the school's saved catchment radius, and a wider boundary read.
-- docs/v0.8/vicdata_0_8_smt_round4_area_projection_radius_claude_code_prompt_v1.md; Guy's decisions of
-- 15 Oct 2026 in docs/OPEN_QUESTIONS.md ("2026-10-15 -- 0.8 SMT r4").
--
-- 1. school_catchment: one radius per school, in whole kilometres ("Our usual catchment: N km").
--    Read by SMT Context (the whole board) and Admissions' list editor (its radius starts there).
--    The school's own School-Admin (or account holder) writes it; its approved members read it;
--    nobody else does. No row = the default (5 km for a state school, 15 km for an independent
--    school), worked out in the app (src/lib/smt/catchment.ts), as is the cap by the school's type
--    (15 km for a state school without a sixth form, 30 km otherwise). The table holds 2-30 km, the
--    widest any school may save.
-- 2. lsoa_boundaries_near is capped at 32 km (was 20 km): the map draws a mile beyond the circle,
--    so a 30 km catchment asks for 31.6 km. Still far short of the whole country.
--
-- Additive. Nothing existing changes meaning: every boundary call that worked still works.

-- 1. The saved catchment ------------------------------------------------------------------------

create table if not exists public.school_catchment (
    school_account_id uuid primary key references public.school_accounts (id) on delete cascade,
    km integer not null check (km between 2 and 30),
    updated_by uuid references public.profiles (id) on delete set null,
    updated_at timestamptz not null default now()
);
comment on table public.school_catchment is
  '0.8 SMT r4: the school''s usual catchment radius in whole km, set by its School-Admin. SMT Context draws the whole board at it; Admissions'' list editor starts its radius there. No row = the default by the school''s type (5 km state, 15 km independent).';

alter table public.school_catchment enable row level security;
revoke all on public.school_catchment from anon;
grant select, insert, update, delete on public.school_catchment to authenticated;

drop policy if exists school_catchment_select on public.school_catchment;
create policy school_catchment_select on public.school_catchment
    for select using (public.is_member_of_school_account(school_account_id));

-- The write condition is inline in the policy (INSERT ... RETURNING then passes). WITH CHECK also
-- stops a row being moved to another school.
drop policy if exists school_catchment_write on public.school_catchment;
create policy school_catchment_write on public.school_catchment
    for all using (public.is_school_admin_or_holder(school_account_id))
    with check (public.is_school_admin_or_holder(school_account_id));

-- 2. The boundary read, to 32 km -----------------------------------------------------------------

create or replace function public.lsoa_boundaries_near(p_easting double precision, p_northing double precision, p_metres double precision)
returns table (gss_code text)
language sql
stable
set search_path = public
as $$
    with pt as (
        select ST_SetSRID(ST_MakePoint(p_easting, p_northing), 27700) as bng
    )
    select b.gss_code
    from public.lsoa_boundaries b, pt
    where p_metres > 0 and p_metres <= 32000
      and b.geom && ST_Transform(ST_Expand(pt.bng, p_metres), 4326)
      and ST_DWithin(ST_Transform(b.geom, 27700), pt.bng, p_metres);
$$;

grant execute on function public.lsoa_boundaries_near(double precision, double precision, double precision) to anon, authenticated;
