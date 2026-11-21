-- VicData 0.8 front door, part 3 (E24, E25, F27; R-DEVICE-CODES, R-DEVICE-CAP, R-SIGNINS-RLS, R-JOIN-DOMAIN).
-- docs/v0.8/vicdata_0_8_front_door_part3_signin_gate_security_claude_code_prompt_v1.md, milestone 3.
--
--   account_devices        one row per browser a person has signed in on: what it is ("Chrome on Mac"), a rough
--                          place (city at most, from Cloudflare's headers), the Supabase session signed in there
--                          now, until when it is trusted (60 days after a code), last active, and when and why it
--                          was signed out. The browser holds only a random token (an httpOnly cookie); this holds
--                          its SHA-256. The beta gate (src/proxy.ts) lets a session in only while its row is
--                          signed in.
--   device_codes           the 6-digit codes for a device VicData hasn't seen: HMAC-hashed, 10 minutes, 5 tries.
--   account_sign_ins       each sign-in and each change of place: the "used from more than 4 places in 24 hours"
--                          flag is read from it.
--   school_email_domains   a school account's own email domains (E25), seeded from its first School-Admin's.
--   school_memberships     + off_domain (a join request from outside the list: an exception), and who approved
--                          the exception and when. Existing members are unaffected (off_domain false).
--   join_school            marks an off-domain request; a first member matched on the website seeds the list.
--   revoke_auth_session    ends a Supabase session (deletes it from auth.sessions, so its refresh token dies):
--                          the service role's only, used when a device is signed out by its owner, the cap, a
--                          School-Admin or a platform admin.
--
-- RLS: a person reads their own devices and sign-ins; a School-Admin (or the account holder) reads those of the
-- school's approved staff; nobody else (the platform's own pages read with the service role after checking a
-- platform admin). Nobody writes them but the service role (the server's auth routes). Codes: the service role
-- only. Domains: the school's School-Admin or account holder reads, adds and removes them.
-- Idempotent (runs twice). Guy applies it: supabase/ops/front_door_r3/.

-- ------------------------------------------------------------------------------------------ personal domains

-- Personal mail domains never stand for a school: they don't seed a school's list and can't be added to one.
create or replace function public.is_personal_email_domain(p_domain text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(p_domain, '')) in (
    'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'hotmail.co.uk', 'live.com', 'live.co.uk', 'msn.com',
    'yahoo.com', 'yahoo.co.uk', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'btinternet.com', 'sky.com',
    'virginmedia.com', 'talktalk.net', 'protonmail.com', 'proton.me', 'gmx.com', 'gmx.co.uk', 'mail.com', 'zoho.com'
  );
$$;

-- ------------------------------------------------------------------------------------------ account_devices

create table if not exists public.account_devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  account_kind text not null default 'staff' check (account_kind in ('staff', 'platform_admin', 'preview')),
  label text not null default 'A browser' check (length(label) <= 80),
  browser text check (length(browser) <= 40),
  os text check (length(os) <= 40),
  form text check (form in ('desktop', 'phone', 'tablet')),
  place text check (length(place) <= 80),
  session_id uuid unique,
  trusted_until timestamptz,
  signed_in_at timestamptz,
  last_active_at timestamptz not null default now(),
  signed_out_at timestamptz,
  signed_out_reason text check (signed_out_reason in ('here', 'elsewhere', 'all', 'cap', 'admin', 'platform')),
  created_at timestamptz not null default now()
);
create index if not exists account_devices_profile_idx on public.account_devices (profile_id);
alter table public.account_devices enable row level security;

-- ------------------------------------------------------------------------------------------ device_codes

create table if not exists public.device_codes (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.account_devices (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  code_hash text not null check (code_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  attempts int not null default 0 check (attempts >= 0),
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists device_codes_device_idx on public.device_codes (device_id, created_at desc);
alter table public.device_codes enable row level security;

-- ------------------------------------------------------------------------------------------ account_sign_ins

create table if not exists public.account_sign_ins (
  id bigint generated always as identity primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  device_id uuid references public.account_devices (id) on delete set null,
  place text check (length(place) <= 80),
  at timestamptz not null default now()
);
create index if not exists account_sign_ins_profile_at_idx on public.account_sign_ins (profile_id, at desc);
alter table public.account_sign_ins enable row level security;

-- ------------------------------------------------------------------------------------------ who may read them

-- Is the caller the School-Admin (or account holder) of a school where this person is approved staff?
create or replace function public.is_school_admin_of_profile(p_profile uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_memberships m
    where m.profile_id = p_profile and m.status = 'approved' and public.is_school_admin_or_holder(m.school_account_id)
  );
$$;
revoke all on function public.is_school_admin_of_profile(uuid) from public, anon;
grant execute on function public.is_school_admin_of_profile(uuid) to authenticated, service_role;

revoke all on public.account_devices from anon, authenticated;
revoke all on public.device_codes from anon, authenticated;
revoke all on public.account_sign_ins from anon, authenticated;
-- Never the token's hash or the Supabase session id, even to the device's owner.
grant select (id, profile_id, account_kind, label, browser, os, form, place, trusted_until, signed_in_at, last_active_at, signed_out_at, signed_out_reason, created_at) on public.account_devices to authenticated;
grant select on public.account_sign_ins to authenticated;
grant all on public.account_devices, public.device_codes, public.account_sign_ins to service_role;

drop policy if exists account_devices_select on public.account_devices;
create policy account_devices_select on public.account_devices
  for select to authenticated
  using (profile_id = auth.uid() or public.is_school_admin_of_profile(profile_id));

drop policy if exists account_sign_ins_select on public.account_sign_ins;
create policy account_sign_ins_select on public.account_sign_ins
  for select to authenticated
  using (profile_id = auth.uid() or public.is_school_admin_of_profile(profile_id));
-- device_codes: RLS on, no policy: the service role only.

-- ------------------------------------------------------------------------------------------ ending a session

create or replace function public.revoke_auth_session(p_session uuid)
returns void
language sql
security definer
set search_path = auth, public
as $$
  delete from auth.sessions where id = p_session;
$$;
revoke all on function public.revoke_auth_session(uuid) from public, anon, authenticated;
grant execute on function public.revoke_auth_session(uuid) to service_role;

-- ------------------------------------------------------------------------------------------ school_email_domains

create table if not exists public.school_email_domains (
  id uuid primary key default gen_random_uuid(),
  school_account_id uuid not null references public.school_accounts (id) on delete cascade,
  domain text not null check (domain ~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' and not public.is_personal_email_domain(domain)),
  added_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (school_account_id, domain)
);
alter table public.school_email_domains enable row level security;
revoke all on public.school_email_domains from anon, authenticated;
grant select, insert, delete on public.school_email_domains to authenticated;
grant all on public.school_email_domains to service_role;

drop policy if exists school_email_domains_select on public.school_email_domains;
create policy school_email_domains_select on public.school_email_domains
  for select to authenticated using (public.is_school_admin_or_holder(school_account_id));
drop policy if exists school_email_domains_insert on public.school_email_domains;
create policy school_email_domains_insert on public.school_email_domains
  for insert to authenticated with check (public.is_school_admin_or_holder(school_account_id) and added_by = auth.uid());
drop policy if exists school_email_domains_delete on public.school_email_domains;
create policy school_email_domains_delete on public.school_email_domains
  for delete to authenticated using (public.is_school_admin_or_holder(school_account_id));

-- The domain part of an address, lower-cased; null for anything without one.
create or replace function public.email_domain_of(p_email text)
returns text
language sql
immutable
set search_path = public
as $$
  select nullif(lower(split_part(coalesce(p_email, ''), '@', 2)), '');
$$;

-- Is this address on one of the school account's domains (the domain itself or a subdomain of it)?
create or replace function public.email_on_school_domain(p_school_account_id uuid, p_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.school_email_domains d
    where d.school_account_id = p_school_account_id
      and (public.email_domain_of(p_email) = d.domain or public.email_domain_of(p_email) like '%.' || d.domain)
  );
$$;
revoke all on function public.email_on_school_domain(uuid, text) from public, anon;
grant execute on function public.email_on_school_domain(uuid, text) to authenticated, service_role;

-- Seed a school account's list from one person's address, when the list is empty and the address isn't personal.
create or replace function public.seed_school_email_domain(p_school_account_id uuid, p_profile uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_domain text;
begin
  if exists (select 1 from public.school_email_domains where school_account_id = p_school_account_id) then
    return;
  end if;
  select public.email_domain_of(email) into v_domain from public.profiles where id = p_profile;
  if v_domain is null or public.is_personal_email_domain(v_domain)
     or v_domain !~ '^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$' then
    return;
  end if;
  insert into public.school_email_domains (school_account_id, domain, added_by)
  values (p_school_account_id, v_domain, p_profile)
  on conflict (school_account_id, domain) do nothing;
end;
$$;
revoke all on function public.seed_school_email_domain(uuid, uuid) from public, anon, authenticated;
grant execute on function public.seed_school_email_domain(uuid, uuid) to service_role;

-- ------------------------------------------------------------------------------------------ school_memberships

alter table public.school_memberships add column if not exists off_domain boolean not null default false;
alter table public.school_memberships add column if not exists exception_approved_at timestamptz;
alter table public.school_memberships add column if not exists exception_approved_by uuid references public.school_memberships (id) on delete set null;

-- An off-domain request becomes a member only as an explicit exception (both set in the same update), and a
-- signed-in caller can never clear the mark itself. The service role (platform tools) is not held to it.
create or replace function public.school_memberships_exception_guard()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'UPDATE' and new.off_domain is distinct from old.off_domain then
      raise exception 'off_domain is set by join_school only';
    end if;
    if tg_op = 'UPDATE' and new.status = 'approved' and old.status is distinct from 'approved'
       and new.off_domain and new.exception_approved_at is null then
      raise exception 'This request is from outside the school''s email domains: approve it as an exception.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists school_memberships_exception_guard on public.school_memberships;
create trigger school_memberships_exception_guard
  before update on public.school_memberships
  for each row execute function public.school_memberships_exception_guard();

-- The first School-Admin's domain seeds the list (E25): whenever someone becomes an approved School-Admin of a
-- school account whose list is still empty.
create or replace function public.school_memberships_seed_domain()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'approved' and new.is_admin and (tg_op = 'INSERT' or not (old.status = 'approved' and old.is_admin)) then
    perform public.seed_school_email_domain(new.school_account_id, new.profile_id);
  end if;
  return new;
end;
$$;
drop trigger if exists school_memberships_seed_domain on public.school_memberships;
create trigger school_memberships_seed_domain
  after insert or update of status, is_admin on public.school_memberships
  for each row execute function public.school_memberships_seed_domain();

-- Backfill: each school account's list from its account holder, else its earliest approved School-Admin.
do $$
declare
  r record;
begin
  for r in
    select a.id as account_id,
           coalesce(
             (select m.profile_id from public.school_memberships m where m.id = a.account_holder_membership_id and m.status = 'approved'),
             (select m.profile_id from public.school_memberships m where m.school_account_id = a.id and m.status = 'approved' and m.is_admin order by m.approved_at nulls last, m.requested_at limit 1)
           ) as profile_id
    from public.school_accounts a
    where not exists (select 1 from public.school_email_domains d where d.school_account_id = a.id)
  loop
    if r.profile_id is not null then
      perform public.seed_school_email_domain(r.account_id, r.profile_id);
    end if;
  end loop;
end;
$$;

-- ------------------------------------------------------------------------------------------ join_school

-- As 20261103090000 (Teacher on join, fixed search_path), plus E25: a request to join a school that already has
-- members is marked off_domain unless the address is on the school's list; a first member verified on the
-- school's website seeds the list with their domain.
create or replace function public.join_school(p_urn text, p_role text)
 returns table(branch text, membership_status text, upsell boolean)
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
    v_profile_id uuid := auth.uid();
    v_email text := auth.jwt() ->> 'email';
    v_account_id uuid;
    v_approved_count int;
    v_website text;
    v_email_domain text;
    v_website_domain text;
    v_membership_id uuid;
    v_status text;
    v_branch text;
    v_tier text;
    v_total_count int;
begin
    if v_profile_id is null then
        raise exception 'not authenticated';
    end if;

    select id, tier into v_account_id, v_tier from public.school_accounts where school_urn = p_urn;
    if v_account_id is null then
        insert into public.school_accounts (school_urn) values (p_urn)
        returning id, tier into v_account_id, v_tier;
    end if;

    select count(*) into v_approved_count
    from public.school_memberships
    where school_account_id = v_account_id and status = 'approved';

    v_email_domain := lower(split_part(v_email, '@', 2));

    if v_approved_count = 0 then
        v_branch := 'first_member';

        select website into v_website from public.schools where urn = p_urn;

        v_website_domain := lower(v_website);
        v_website_domain := regexp_replace(v_website_domain, '^https?://', '');
        v_website_domain := regexp_replace(v_website_domain, '^www\.', '');
        v_website_domain := split_part(v_website_domain, '/', 1);

        if v_website_domain is not null and v_website_domain <> '' and v_website_domain = v_email_domain then
            v_status := 'approved';
        else
            v_status := 'pending_verification';
        end if;

        insert into public.school_memberships (school_account_id, profile_id, status, role, approved_at)
        values (v_account_id, v_profile_id, v_status, 'teacher', case when v_status = 'approved' then now() else null end)
        returning id into v_membership_id;

        if v_status = 'approved' then
            update public.school_accounts set account_holder_membership_id = v_membership_id, updated_at = now()
            where id = v_account_id;
            perform public.seed_school_email_domain(v_account_id, v_profile_id);
        end if;
    else
        v_branch := 'request_to_join';
        v_status := 'pending_approval';
        insert into public.school_memberships (school_account_id, profile_id, status, role, off_domain)
        values (v_account_id, v_profile_id, v_status, 'teacher', not public.email_on_school_domain(v_account_id, v_email))
        returning id into v_membership_id;
    end if;

    select count(*) into v_total_count
    from public.school_memberships
    where school_account_id = v_account_id;

    return query select v_branch, v_status, (v_tier = 'individual' and v_total_count = 2);
end;
$function$;
