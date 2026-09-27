-- Teacher view comparator chooser (docs/wireframes/comparator-chooser-v29, screens 3a/3b):
-- saved RANKINGS -- a named population definition ("All ind. boarding girls schools in
-- UK"), not a hand-picked list of schools.
--
-- A new table rather than a new set_type on saved_sets, deliberately:
--   - a ranking has no members. Stored as a saved_sets comparator row it would appear,
--     empty, in every existing consumer of comparator sets (the Data View's sets
--     controls, /sets, /api/comparator-set-peers, Teacher view's own saved-comparator-sets
--     route) -- and resolving it into members instead would make that route, which
--     fetches a full academic profile for every member of every set on every dashboard
--     load, fetch thousands;
--   - saved_sets' check constraint, RLS and cap trigger stay exactly as they are, so
--     nothing about who can see or edit today's personal and shared sets changes.
--
-- Ownership mirrors saved_sets exactly: owner_membership_id null = shared school-wide
-- (created/edited only by the account holder or an admin); otherwise personal to that
-- member. The four policies below are saved_sets' own, verbatim, on this table.
create table public.saved_rankings (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    owner_membership_id uuid references public.school_memberships (id),
    name text not null check (length(btrim(name)) > 0),
    -- The dashboard phase the ranking was built for: its population is "same phase".
    phase text not null check (phase in ('ks4', 'ks5')),
    -- The chooser's RankingFilters (src/lib/comparator-chooser.ts): sectors, gender,
    -- boarding, qualification, scope, sizes. The population is re-resolved from these
    -- each time, so a saved ranking follows the census rather than freezing a list.
    filters jsonb not null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index saved_rankings_school_account_idx on public.saved_rankings (school_account_id);
create index saved_rankings_owner_idx on public.saved_rankings (owner_membership_id);

-- Personal rankings per member: the same 8 as personal comparator sets
-- (20260925232857_personal_comparator_cap_8), counted separately.
create function public.enforce_personal_ranking_cap()
returns trigger
language plpgsql
as $$
declare
    existing_count integer;
begin
    if new.owner_membership_id is not null then
        select count(*) into existing_count
        from public.saved_rankings
        where owner_membership_id = new.owner_membership_id
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
        if existing_count >= 8 then
            raise exception 'personal ranking cap (8) reached for this member';
        end if;
    end if;
    return new;
end;
$$;

create trigger saved_rankings_personal_cap_trigger
    before insert or update on public.saved_rankings
    for each row execute function public.enforce_personal_ranking_cap();

alter table public.saved_rankings enable row level security;

create policy saved_rankings_select on public.saved_rankings
    for select using (
        (owner_membership_id is null and public.is_member_of_school_account(school_account_id))
        or owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
    );

create policy saved_rankings_insert on public.saved_rankings
    for insert with check (
        owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
        or (
            owner_membership_id is null
            and (
                public.is_admin_of_school_account(school_account_id)
                or public.is_account_holder_of_school_account(school_account_id)
            )
        )
    );

create policy saved_rankings_update_own_or_admin on public.saved_rankings
    for update using (
        owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
        or public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );

create policy saved_rankings_delete_own_or_admin on public.saved_rankings
    for delete using (
        owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
        or public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );
