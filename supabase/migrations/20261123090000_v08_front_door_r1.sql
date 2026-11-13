-- VicData 0.8 front door, part 1 (A5, A7): the first visit and "New since your last visit".
--
--   front_door_state    one row per person: when they saw the welcome (shown once), their last visit to a
--                       home, and when they last saw the "New since your last visit" strip. Each person
--                       reads and writes their own row only.
--   changelog_entries   the short changelog Guy writes (a seed file; docs/v0.8/front_door_1_report_v1.md
--                       has the template). Platform admins write it; nobody reads the table directly: the
--                       app reads changelog_for_me(), which carries an entry's feedback credit ("Your
--                       feedback on X led to this") only to the people it credits.
--
-- Nothing else changes. Applied by Guy (no database writes from the build); proved in PGlite
-- (supabase/tests/v08_front_door_r1_pglite.mjs).

create table if not exists public.front_door_state (
    profile_id uuid primary key references public.profiles (id) on delete cascade,
    welcome_seen_at timestamptz,
    last_visit_at timestamptz,
    whats_new_seen_at timestamptz,
    updated_at timestamptz not null default now()
);

alter table public.front_door_state enable row level security;

drop policy if exists front_door_state_select_own on public.front_door_state;
create policy front_door_state_select_own on public.front_door_state
    for select to authenticated using (profile_id = auth.uid());
drop policy if exists front_door_state_insert_own on public.front_door_state;
create policy front_door_state_insert_own on public.front_door_state
    for insert to authenticated with check (profile_id = auth.uid());
drop policy if exists front_door_state_update_own on public.front_door_state;
create policy front_door_state_update_own on public.front_door_state
    for update to authenticated using (profile_id = auth.uid()) with check (profile_id = auth.uid());

revoke all on public.front_door_state from anon;
grant select, insert, update on public.front_door_state to authenticated;

create table if not exists public.changelog_entries (
    id uuid primary key default gen_random_uuid(),
    published_at timestamptz not null default now(),
    title text not null check (char_length(title) between 1 and 200),
    body text check (body is null or char_length(body) <= 2000),
    -- "Your feedback on X led to this": shown only to the people in credit_profile_ids.
    credit_text text check (credit_text is null or char_length(credit_text) <= 300),
    credit_profile_ids uuid[] not null default '{}',
    link text check (link is null or link ~ '^/'),
    created_at timestamptz not null default now()
);

create index if not exists changelog_entries_published_at on public.changelog_entries (published_at desc);

alter table public.changelog_entries enable row level security;

drop policy if exists changelog_entries_admin_all on public.changelog_entries;
create policy changelog_entries_admin_all on public.changelog_entries
    for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());

revoke all on public.changelog_entries from anon;
grant select, insert, update, delete on public.changelog_entries to authenticated;

-- Every published entry, newest first; credit_text only for the people it credits.
create or replace function public.changelog_for_me(max_entries integer default 30)
returns table (id uuid, published_at timestamptz, title text, body text, credit_text text, link text)
language sql
stable
security definer
set search_path = public
as $$
    select e.id, e.published_at, e.title, e.body,
           case when auth.uid() = any (e.credit_profile_ids) then e.credit_text end,
           e.link
    from public.changelog_entries e
    where e.published_at <= now() and auth.uid() is not null
    order by e.published_at desc
    limit greatest(1, least(coalesce(max_entries, 30), 100));
$$;

revoke all on function public.changelog_for_me(integer) from public, anon;
grant execute on function public.changelog_for_me(integer) to authenticated;
