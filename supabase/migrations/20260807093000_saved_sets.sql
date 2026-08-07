-- saved_sets: Comparator Set and Feeder Set share one table (rolls spec §6: "Same
-- underlying UX pattern ... deliberately reused") with a set_type discriminator, rather
-- than two near-duplicate tables. entry_point is required for feeder (rolls spec §5:
-- "a feeder-link needs an entry_point field") and meaningless for comparator (whole-
-- school comparison). owner_membership_id null = shared/admin-owned (unlimited);
-- non-null = personal (capped at 3 for comparator -- see the trigger below; feeder has
-- no personal cap by default, matching membership spec §5's table: "Not really
-- applicable -- one real answer per entry point", with admissions' personal exploratory
-- "wider pool" layer as the one named exception, which is still just an uncapped
-- personal feeder row, not a special case this schema needs to model separately).
create table public.saved_sets (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    set_type text not null check (set_type in ('comparator', 'feeder')),
    name text not null,
    owner_membership_id uuid references public.school_memberships (id),
    entry_point text,
    config jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    check (
        (set_type = 'feeder' and entry_point is not null)
        or (set_type = 'comparator' and entry_point is null)
    )
);

create index saved_sets_school_account_idx on public.saved_sets (school_account_id);
create index saved_sets_owner_idx on public.saved_sets (owner_membership_id);

-- saved_set_members: the candidate-generation -> curate -> save workflow both set types
-- share. member_status tracks Feeder Set's self-correction flow (candidate shown,
-- school confirms/excludes -- rolls spec §5) as well as Comparator Set's simpler
-- curated membership.
create table public.saved_set_members (
    id uuid primary key default gen_random_uuid(),
    saved_set_id uuid not null references public.saved_sets (id) on delete cascade,
    school_urn text not null references public.schools (urn),
    member_status text not null default 'candidate'
        check (member_status in ('candidate', 'confirmed', 'excluded')),
    added_at timestamptz not null default now(),
    unique (saved_set_id, school_urn)
);

create index saved_set_members_saved_set_idx on public.saved_set_members (saved_set_id);

-- Personal comparator cap: 3 per individual member, editable (rolls spec §6). Enforced
-- at the DB layer as a backstop, not just app-side validation.
create function public.enforce_personal_comparator_cap()
returns trigger
language plpgsql
as $$
declare
    existing_count integer;
begin
    if new.set_type = 'comparator' and new.owner_membership_id is not null then
        select count(*) into existing_count
        from public.saved_sets
        where owner_membership_id = new.owner_membership_id
          and set_type = 'comparator'
          and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);
        if existing_count >= 3 then
            raise exception 'personal comparator set cap (3) reached for this member';
        end if;
    end if;
    return new;
end;
$$;

create trigger saved_sets_personal_cap_trigger
    before insert or update on public.saved_sets
    for each row execute function public.enforce_personal_comparator_cap();

alter table public.saved_sets enable row level security;
alter table public.saved_set_members enable row level security;

-- Shared sets (owner_membership_id is null): visible to every approved member of the
-- school. Personal sets: visible to their owner only. Any approved member can create a
-- personal set for themselves; only admin/account holder can create shared sets.
create policy saved_sets_select on public.saved_sets
    for select using (
        (owner_membership_id is null and public.is_member_of_school_account(school_account_id))
        or owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
    );

create policy saved_sets_insert_personal on public.saved_sets
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

create policy saved_sets_update_own_or_admin on public.saved_sets
    for update using (
        owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
        or public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );

create policy saved_sets_delete_own_or_admin on public.saved_sets
    for delete using (
        owner_membership_id in (
            select id from public.school_memberships where profile_id = auth.uid()
        )
        or public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );

create policy saved_set_members_select on public.saved_set_members
    for select using (
        exists (
            select 1 from public.saved_sets ss
            where ss.id = saved_set_id
              and (
                  (ss.owner_membership_id is null and public.is_member_of_school_account(ss.school_account_id))
                  or ss.owner_membership_id in (
                      select id from public.school_memberships where profile_id = auth.uid()
                  )
              )
        )
    );

create policy saved_set_members_write on public.saved_set_members
    for all using (
        exists (
            select 1 from public.saved_sets ss
            where ss.id = saved_set_id
              and (
                  ss.owner_membership_id in (
                      select id from public.school_memberships where profile_id = auth.uid()
                  )
                  or public.is_admin_of_school_account(ss.school_account_id)
                  or public.is_account_holder_of_school_account(ss.school_account_id)
              )
        )
    );
