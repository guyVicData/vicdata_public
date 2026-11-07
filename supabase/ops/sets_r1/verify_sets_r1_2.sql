select (select count(*) from supabase_migrations.schema_migrations where version='20261121090000') as recorded,
       (select count(*) from pg_policies where tablename in ('sets','set_members','set_user_state')) as policies,
       (select bool_and(relrowsecurity) from pg_class where oid in ('public.sets'::regclass,'public.set_members'::regclass,'public.set_user_state'::regclass)) as rls_on,
       (select count(*) from set_members m join sets s on s.id=m.set_id join admissions_lists l on l.id=s.legacy_list_id where l.members[m.position+1] <> m.urn) as order_mismatches;
