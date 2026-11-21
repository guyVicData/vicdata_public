-- ROLLBACK for 20261126090000_v08_front_door_r3_signins (VicData 0.8 front door, part 3, milestone 3). PREPARED, NOT RUN.
--
-- Undoes exactly what the migration made: the guard and seed triggers on school_memberships and their functions;
-- the three school_memberships columns; the tables account_devices, device_codes, account_sign_ins and
-- school_email_domains (their policies go with them); the helper functions; and join_school goes back to its
-- 20261103090000 definition (Teacher on join, fixed search_path). And the schema_migrations row.
--
-- DATA LOSS: every device, code, sign-in and email domain row, and the off-domain marks and exception approvals on
-- memberships (the memberships themselves stay).
--
-- Roll back the app first: the deployed code reads these tables (the beta gate checks account_devices on every
-- request), so redeploy the pre-merge main -- or set DEVICE_SESSIONS=off on Render -- before running this.
--
-- One transaction, no CASCADE beyond the tables' own policies and indexes.
--   supabase db query --remote --yes -f supabase/ops/front_door_r3/rollback_front_door_r3.sql
begin;

drop trigger if exists school_memberships_exception_guard on public.school_memberships;
drop trigger if exists school_memberships_seed_domain on public.school_memberships;
drop function if exists public.school_memberships_exception_guard();
drop function if exists public.school_memberships_seed_domain();

alter table public.school_memberships drop column if exists exception_approved_by;
alter table public.school_memberships drop column if exists exception_approved_at;
alter table public.school_memberships drop column if exists off_domain;

drop table if exists public.device_codes;
drop table if exists public.account_sign_ins;
drop table if exists public.account_devices;
drop table if exists public.school_email_domains;

drop function if exists public.revoke_auth_session(uuid);
drop function if exists public.is_school_admin_of_profile(uuid);
drop function if exists public.seed_school_email_domain(uuid, uuid);
drop function if exists public.email_on_school_domain(uuid, text);
drop function if exists public.email_domain_of(text);
drop function if exists public.is_personal_email_domain(text);

-- join_school as 20261103090000_v06_s1_roles_teams_platform.sql section 6 defines it.
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
    if v_approved_count = 0 then
        v_branch := 'first_member';
        select website into v_website from public.schools where urn = p_urn;
        v_email_domain := lower(split_part(v_email, '@', 2));
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
        end if;
    else
        v_branch := 'request_to_join';
        v_status := 'pending_approval';
        insert into public.school_memberships (school_account_id, profile_id, status, role)
        values (v_account_id, v_profile_id, v_status, 'teacher')
        returning id into v_membership_id;
    end if;
    select count(*) into v_total_count
    from public.school_memberships
    where school_account_id = v_account_id;
    return query select v_branch, v_status, (v_tier = 'individual' and v_total_count = 2);
end;
$function$;

delete from supabase_migrations.schema_migrations where version = '20261126090000';
commit;
