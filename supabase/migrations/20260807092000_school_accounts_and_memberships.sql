-- school_accounts: one per school with any member. Tier is directly settable (brief's
-- Stripe hold -- "Build a member's tier ... as a directly settable field").
create table public.school_accounts (
    id uuid primary key default gen_random_uuid(),
    school_urn text not null unique references public.schools (urn),
    account_holder_membership_id uuid, -- FK added below, after school_memberships exists
    tier text not null default 'individual' check (tier in ('individual', 'school')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- school_memberships: roles per membership spec §5 (head_governor, admissions, finance,
-- director_of_studies, head_of_department -- kept as genuinely separate roles, not
-- reconciled). is_admin is separate from account holder (multiple admins allowed, exactly
-- one account holder per school_accounts.account_holder_membership_id).
-- individual_tier_active: relevant when school_accounts.tier = 'individual' -- each
-- approved member has their own individual subscription state (directly settable, no
-- Stripe); irrelevant once tier = 'school' (one shared subscription covers everyone).
create table public.school_memberships (
    id uuid primary key default gen_random_uuid(),
    school_account_id uuid not null references public.school_accounts (id) on delete cascade,
    profile_id uuid not null references public.profiles (id) on delete cascade,
    status text not null default 'pending_verification'
        check (status in ('pending_verification', 'pending_approval', 'approved', 'rejected')),
    is_admin boolean not null default false,
    role text check (role in ('head_governor', 'admissions', 'finance', 'director_of_studies', 'head_of_department')),
    individual_tier_active boolean not null default true,
    requested_at timestamptz not null default now(),
    approved_at timestamptz,
    approved_by uuid references public.school_memberships (id),
    unique (school_account_id, profile_id)
);

alter table public.school_accounts
    add constraint school_accounts_account_holder_fk
    foreign key (account_holder_membership_id) references public.school_memberships (id);

alter table public.school_accounts enable row level security;
alter table public.school_memberships enable row level security;

-- SECURITY DEFINER helpers: RLS policies on school_memberships can't safely reference
-- school_memberships from within its own policy (self-join in a policy body only works
-- via a function evaluated outside the RLS check, otherwise it recurses).
create function public.is_member_of_school_account(p_school_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships
        where school_account_id = p_school_account_id
          and profile_id = auth.uid()
          and status = 'approved'
    );
$$;

create function public.is_admin_of_school_account(p_school_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.school_memberships
        where school_account_id = p_school_account_id
          and profile_id = auth.uid()
          and status = 'approved'
          and is_admin = true
    );
$$;

create function public.is_account_holder_of_school_account(p_school_account_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
    select exists (
        select 1 from public.school_accounts sa
        join public.school_memberships sm on sm.id = sa.account_holder_membership_id
        where sa.id = p_school_account_id
          and sm.profile_id = auth.uid()
    );
$$;

-- school_accounts: any approved member of the school can read it; only the account
-- holder can update it (tier changes, handoff -- membership spec §5's "deliberate
-- handoff, always").
create policy school_accounts_select_member on public.school_accounts
    for select using (public.is_member_of_school_account(id));

create policy school_accounts_update_account_holder on public.school_accounts
    for update using (public.is_account_holder_of_school_account(id));

-- Anyone authenticated can create the first school_account for a school (the
-- first-member verification path, membership spec §4) -- app logic enforces the
-- one-account-per-school constraint via the unique(school_urn) above.
create policy school_accounts_insert_authenticated on public.school_accounts
    for insert with check (auth.uid() is not null);

-- school_memberships: a member can see their own row and every approved member's row at
-- their own school (real scoping, not per-role content hiding yet -- membership spec §6
-- explicitly defers full role-by-role access scoping). Account holder/admin can update
-- roles, is_admin, and status (approve pending joins) within their own school -- fixes
-- the Club ISS "Remove button shown to everyone, silently fails for non-admins" bug by
-- making this a real RLS check, not a frontend-only gate (reuse strategy, brief).
create policy school_memberships_select_own_or_school on public.school_memberships
    for select using (
        profile_id = auth.uid()
        or public.is_member_of_school_account(school_account_id)
    );

create policy school_memberships_insert_own on public.school_memberships
    for insert with check (profile_id = auth.uid());

create policy school_memberships_update_admin_or_holder on public.school_memberships
    for update using (
        public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );

create policy school_memberships_delete_admin_or_holder on public.school_memberships
    for delete using (
        public.is_admin_of_school_account(school_account_id)
        or public.is_account_holder_of_school_account(school_account_id)
    );
