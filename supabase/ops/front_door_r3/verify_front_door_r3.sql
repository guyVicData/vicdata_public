-- VERIFY for 20261126090000_v08_front_door_r3_signins. Read-only.
--   supabase db query --remote -f supabase/ops/front_door_r3/verify_front_door_r3.sql
-- Expect: four tables with RLS on; the policies below; the three new school_memberships columns; the guard and
-- seed triggers; revoke_auth_session executable by service_role only; one schema_migrations row; each school
-- account's domain list (empty where its first School-Admin is on a personal address: add the school's domain
-- on Sign-ins and devices, or in SQL); no membership marked off-domain yet.
select c.relname as table_name, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('account_devices', 'device_codes', 'account_sign_ins', 'school_email_domains')
order by 1;

select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and tablename in ('account_devices', 'device_codes', 'account_sign_ins', 'school_email_domains')
order by 1, 2;

select column_name, data_type from information_schema.columns
where table_schema = 'public' and table_name = 'school_memberships' and column_name in ('off_domain', 'exception_approved_at', 'exception_approved_by')
order by 1;

select tgname from pg_trigger where tgrelid = 'public.school_memberships'::regclass and tgname in ('school_memberships_exception_guard', 'school_memberships_seed_domain') order by 1;

select p.proname, r.rolname, has_function_privilege(r.rolname, p.oid, 'execute') as can_execute
from pg_proc p cross join (values ('anon'), ('authenticated'), ('service_role')) as r(rolname)
where p.pronamespace = 'public'::regnamespace and p.proname = 'revoke_auth_session'
order by 2;

select version, name from supabase_migrations.schema_migrations where version = '20261126090000';

select s.school_urn, coalesce(string_agg(d.domain, ', ' order by d.domain), '(none)') as domains
from public.school_accounts s left join public.school_email_domains d on d.school_account_id = s.id
group by s.school_urn order by s.school_urn;

select count(*) filter (where off_domain) as off_domain_memberships, count(*) as memberships from public.school_memberships;
