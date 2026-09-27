-- Teacher view comparator chooser, screen 1's "Victoria Consultancy Sets" row
-- (docs/wireframes/comparator-chooser-v29): comparator sets authored by Victoria
-- Consultancy -- not by any member of the school -- shown to a school only once VC has
-- switched them on for it. "Shared with leadership, can't be edited."
--
-- Deliberately separate from saved_sets, and touching nothing there: a saved_sets row
-- belongs to one school_account and its RLS lets that school's admins edit and delete its
-- shared rows, which a VC set must never allow. Three new tables instead:
--   vc_comparator_sets           a VC set: its name (platform-level, not per school)
--   vc_comparator_set_members    its schools
--   vc_set_school_visibility     which schools may see which VC sets -- "switched on
--                                for this school" is a row here
--
-- Who can write: nobody through the API. There are no insert/update/delete policies on
-- any of the three, so only the service role (bypassing RLS) can write -- in practice
-- scripts/vc-sets.ts, run by Guy. The platform has no operator role in these RLS helpers
-- (all school-scoped), so this is the v1 the build prompt allows rather than a new role
-- system; see docs/OPEN_QUESTIONS.md (2026-09-27).
--
-- Who can read: a member of a school sees exactly the VC sets switched on for that
-- school, and their members; nothing about any other school's switches.
create table public.vc_comparator_sets (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(btrim(name)) > 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table public.vc_comparator_set_members (
    vc_set_id uuid not null references public.vc_comparator_sets (id) on delete cascade,
    school_urn text not null references public.schools (urn),
    added_at timestamptz not null default now(),
    primary key (vc_set_id, school_urn)
);

create table public.vc_set_school_visibility (
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    vc_set_id uuid not null references public.vc_comparator_sets (id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (school_account_id, vc_set_id)
);

create index vc_set_school_visibility_set_idx on public.vc_set_school_visibility (vc_set_id);

alter table public.vc_comparator_sets enable row level security;
alter table public.vc_comparator_set_members enable row level security;
alter table public.vc_set_school_visibility enable row level security;

create policy vc_set_school_visibility_select on public.vc_set_school_visibility
    for select using (public.is_member_of_school_account(school_account_id));

create policy vc_comparator_sets_select on public.vc_comparator_sets
    for select using (
        exists (
            select 1 from public.vc_set_school_visibility v
            where v.vc_set_id = vc_comparator_sets.id
              and public.is_member_of_school_account(v.school_account_id)
        )
    );

create policy vc_comparator_set_members_select on public.vc_comparator_set_members
    for select using (
        exists (
            select 1 from public.vc_set_school_visibility v
            where v.vc_set_id = vc_comparator_set_members.vc_set_id
              and public.is_member_of_school_account(v.school_account_id)
        )
    );
