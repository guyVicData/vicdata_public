-- After apply_group_sets.sql: read-only checks (supabase db query --remote --read-only -f ...).
select (select count(*) from supabase_migrations.schema_migrations where version = '20261123090000') as recorded,
       (select count(*) from information_schema.columns where table_name = 'sets' and column_name = 'group_account_id') as group_column,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.sets'::regclass, 'public.set_members'::regclass, 'public.set_group_members'::regclass)) as rls_on,
       (select count(*) from pg_policies where tablename = 'set_group_members') as group_member_policies,
       (select count(*) from pg_policies where tablename = 'sets' and qual like '%is_group_member%') as group_read_policy,
       has_function_privilege('authenticated', 'public.share_set_with_group(uuid)', 'execute') as share_callable,
       not has_table_privilege('anon', 'public.set_group_members', 'select') as anon_locked_out,
       (select count(*) from sets where owner_scope = 'school') as school_sets_unchanged_count;
