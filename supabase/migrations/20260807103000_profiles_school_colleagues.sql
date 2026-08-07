-- The account/admin management panel needs to show colleagues' names and emails
-- (including pending members awaiting approval) -- profiles' existing RLS (self-only)
-- blocks this entirely. Any approved member can see the profile of anyone else who has
-- a school_memberships row at the same school_account, any status.
create policy profiles_select_school_colleagues on public.profiles
    for select using (
        exists (
            select 1 from public.school_memberships my
            join public.school_memberships their on their.school_account_id = my.school_account_id
            where my.profile_id = auth.uid()
              and my.status = 'approved'
              and their.profile_id = profiles.id
        )
    );
