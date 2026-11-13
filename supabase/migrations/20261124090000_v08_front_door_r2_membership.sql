-- VicData 0.8 front door, part 2 (F28-F29; R-MEMBERSHIP): the membership record and the plans it is on.
-- No payments are built: this is the record the School-Admin's membership page reads, and the shape a
-- payment provider will fill later. Card numbers are never stored -- the provider holds them; VicData keeps
-- only a summary ("Visa ending 4417", expiry). Written by platform admins only (Guy sets the real dates);
-- read by the school's School-Admin and account holder (and a group's head-office admins for the group's
-- own record), and by platform admins.
--
--   membership_plans         the plans and their prices, in pence: secondary £10 a month billed annually
--                            (£120 a year), primary £5 (£60), group (a group rate not set yet, then each school
--                            at £10 a month less any volume band). Every member of staff, every role.
--   membership_volume_bands  a plan's per-school price from a number of schools up (the bulk discounts:
--                            modelled, no rows yet -- the rates aren't set)
--   account_memberships      one row per school account or per group account: the plan, the status (pilot,
--                            active, covered_by_group, lapsed), the pilot's and the renewal's dates, billing
--                            contact, purchase order, invoice address, a nullable card summary
--   membership_invoices      a record's invoices: period, amount, status, and where its PDF will be
--
-- Pilot schools and groups in the beta are free for 6 months; they add a card during the free months.
-- supabase/seeds/membership_pilots.sql seeds every current school account as a pilot from its join date.
-- Idempotent: runs twice.

-- 1. Plans --------------------------------------------------------------------------------------------

create table if not exists public.membership_plans (
    code text primary key check (code ~ '^[a-z_]{2,40}$'),
    name text not null check (length(btrim(name)) between 1 and 80),
    -- Who it is for: a school by phase, or a group.
    applies_to text not null check (applies_to in ('secondary', 'primary', 'group')),
    -- The price, in pence. A group's own rate may be unset (null) until it is agreed.
    price_month_pence integer check (price_month_pence is null or price_month_pence >= 0),
    price_year_pence integer check (price_year_pence is null or price_year_pence >= 0),
    -- A group's price for each member school, a month, before any volume band.
    per_school_month_pence integer check (per_school_month_pence is null or per_school_month_pence >= 0),
    billing text not null default 'annual' check (billing in ('annual')),
    pilot_months smallint not null default 6 check (pilot_months between 0 and 24),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

insert into public.membership_plans (code, name, applies_to, price_month_pence, price_year_pence, per_school_month_pence)
values
    ('secondary', 'School membership', 'secondary', 1000, 12000, null),
    ('primary', 'Primary membership', 'primary', 500, 6000, null),
    ('group', 'Group membership', 'group', null, null, 1000)
on conflict (code) do nothing;

create table if not exists public.membership_volume_bands (
    plan_code text not null references public.membership_plans (code) on delete cascade,
    min_schools integer not null check (min_schools >= 1),
    per_school_month_pence integer not null check (per_school_month_pence >= 0),
    primary key (plan_code, min_schools)
);

-- 2. The record ---------------------------------------------------------------------------------------

create table if not exists public.account_memberships (
    id uuid primary key default gen_random_uuid(),
    -- Exactly one of a school account and a group account.
    school_account_id uuid unique references public.school_accounts (id) on delete cascade,
    group_account_id uuid unique references public.group_accounts (id) on delete cascade,
    plan_code text not null references public.membership_plans (code),
    status text not null check (status in ('pilot', 'active', 'covered_by_group', 'lapsed')),
    joined_on date not null,
    pilot_ends_on date,
    renews_on date,
    auto_renew boolean not null default true,
    -- A school covered by its group: the group's account (its billing contact is shown instead).
    covered_by_group_account_id uuid references public.group_accounts (id) on delete set null,
    billing_contact_name text check (billing_contact_name is null or length(billing_contact_name) <= 120),
    billing_contact_email text check (billing_contact_email is null or (length(billing_contact_email) <= 200 and billing_contact_email ~ '^[^@\s]+@[^@\s]+$')),
    purchase_order text check (purchase_order is null or length(purchase_order) <= 60),
    invoice_address text check (invoice_address is null or length(invoice_address) <= 400),
    -- The card summary only, never its number: the payment provider holds the card.
    card_brand text check (card_brand is null or card_brand in ('Visa', 'Mastercard', 'American Express')),
    card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
    card_exp_month smallint check (card_exp_month is null or card_exp_month between 1 and 12),
    card_exp_year smallint check (card_exp_year is null or card_exp_year between 2024 and 2100),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint account_memberships_one_holder check ((school_account_id is null) <> (group_account_id is null)),
    constraint account_memberships_pilot_dates check (status <> 'pilot' or pilot_ends_on is not null),
    constraint account_memberships_covered check ((status = 'covered_by_group') = (covered_by_group_account_id is not null)),
    constraint account_memberships_card_whole check ((card_last4 is null) = (card_brand is null))
);

create table if not exists public.membership_invoices (
    id uuid primary key default gen_random_uuid(),
    membership_id uuid not null references public.account_memberships (id) on delete cascade,
    period_start date not null,
    period_end date not null check (period_end >= period_start),
    amount_pence integer not null check (amount_pence >= 0),
    status text not null check (status in ('free', 'due', 'paid', 'void')),
    -- Where the provider's PDF will be (a storage path); null until payments exist.
    pdf_path text check (pdf_path is null or pdf_path ~ '^[a-z0-9/_.-]{1,200}$'),
    created_at timestamptz not null default now()
);
create index if not exists membership_invoices_membership_idx on public.membership_invoices (membership_id, period_start desc);

-- 3. Who reads it -------------------------------------------------------------------------------------

create or replace function public.can_read_membership(p_school_account_id uuid, p_group_account_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select public.is_platform_admin()
        or (p_school_account_id is not null and public.is_school_admin_or_holder(p_school_account_id))
        or (p_group_account_id is not null and public.is_group_admin(p_group_account_id));
$$;
revoke all on function public.can_read_membership(uuid, uuid) from public;
grant execute on function public.can_read_membership(uuid, uuid) to authenticated;

alter table public.membership_plans enable row level security;
alter table public.membership_volume_bands enable row level security;
alter table public.account_memberships enable row level security;
alter table public.membership_invoices enable row level security;

revoke all on public.membership_plans, public.membership_volume_bands, public.account_memberships, public.membership_invoices from anon;
grant select on public.membership_plans, public.membership_volume_bands to authenticated;
grant select, insert, update, delete on public.account_memberships, public.membership_invoices to authenticated;
grant insert, update, delete on public.membership_plans, public.membership_volume_bands to authenticated;

drop policy if exists membership_plans_read on public.membership_plans;
create policy membership_plans_read on public.membership_plans for select to authenticated using (true);
drop policy if exists membership_plans_write on public.membership_plans;
create policy membership_plans_write on public.membership_plans for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists membership_bands_read on public.membership_volume_bands;
create policy membership_bands_read on public.membership_volume_bands for select to authenticated using (true);
drop policy if exists membership_bands_write on public.membership_volume_bands;
create policy membership_bands_write on public.membership_volume_bands for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists account_memberships_read on public.account_memberships;
create policy account_memberships_read on public.account_memberships for select to authenticated
    using (public.can_read_membership(school_account_id, group_account_id));
drop policy if exists account_memberships_write on public.account_memberships;
create policy account_memberships_write on public.account_memberships for all to authenticated
    using (public.is_platform_admin()) with check (public.is_platform_admin());

drop policy if exists membership_invoices_read on public.membership_invoices;
create policy membership_invoices_read on public.membership_invoices for select to authenticated
    using (exists (select 1 from public.account_memberships m where m.id = membership_id and public.can_read_membership(m.school_account_id, m.group_account_id)));
drop policy if exists membership_invoices_write on public.membership_invoices;
create policy membership_invoices_write on public.membership_invoices for all to authenticated
    using (public.is_platform_admin()) with check (public.is_platform_admin());
