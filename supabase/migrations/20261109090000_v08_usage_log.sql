-- VicData 0.8 shell + SMT round 1, B7 (docs/v0.8/vicdata_usage_tracking_note_v1.md, steps 1-2 only):
-- start collecting usage before launch, so the "Who's looking at us" view has months to draw on.
--
-- Target: the app database (lnhulykjlxmoneappnsp). NOT APPLIED by the build: Guy applies it
-- (docs/v0.8/shell_smt_r1_report_v1.md). Additive only. The app works before it is applied (every
-- write is fire-and-forget and ignores a missing table or function) and after.
--
-- Who can do what:
--   * Only the server writes, with the service role (src/lib/usage.ts, src/proxy.ts).
--   * Nobody reads through the API: RLS is on with no policy, and anon and authenticated hold no
--     privilege on either table. Members, School-Admins and the public see nothing.
--   * No reporting UI in this round. Reports come later, as aggregates with small-number
--     suppression (the note's "fewer than 5").

-- -------------------------------------------------------------------------------------------
-- 1. Members' events: a page view of a Teacher, Admissions or SMT dashboard, or a view opened in
--    full screen. Counts, never content: no figures, no free text.
-- -------------------------------------------------------------------------------------------
create table public.usage_events (
    id bigint generated always as identity primary key,
    occurred_at timestamptz not null default now(),
    -- Who: the membership and its role at the time. A platform admin outside the school (View as)
    -- is logged with no membership and role 'platform_admin'. A deleted membership leaves its
    -- events, unlinked.
    membership_id uuid references public.school_memberships(id) on delete set null,
    role text,
    -- Whose data was shown.
    school_urn text,
    product text not null check (product in ('teacher', 'admissions', 'smt')),
    event text not null check (event in ('page_view', 'fullscreen')),
    dashboard text,
    view text,
    -- The focus in view: SMT's level, Teacher's subject, Admissions' entry point.
    level text,
    -- The comparison set's kind (nearest, la, saved, school, ranking), never its schools.
    set_kind text,
    constraint usage_events_text_lengths check (
        coalesce(length(role), 0) <= 40 and coalesce(length(school_urn), 0) <= 12
        and coalesce(length(dashboard), 0) <= 120 and coalesce(length(view), 0) <= 120
        and coalesce(length(level), 0) <= 120 and coalesce(length(set_kind), 0) <= 40
    )
);

comment on table public.usage_events is
  '0.8 usage log: members'' dashboard page views and full-screen opens. Written by the server (service role) only; no client reads. See docs/v0.8/vicdata_usage_tracking_note_v1.md.';

create index usage_events_school_time on public.usage_events (school_urn, occurred_at);
create index usage_events_time on public.usage_events (occurred_at);

alter table public.usage_events enable row level security;
revoke all on public.usage_events from anon, authenticated;
revoke all on sequence public.usage_events_id_seq from anon, authenticated;
grant insert on public.usage_events to service_role;
grant select on public.usage_events to service_role;

-- -------------------------------------------------------------------------------------------
-- 2. The public school page: one counter per school per day. No cookies, no IP address, no user
--    agent, no personal data: the count only.
-- -------------------------------------------------------------------------------------------
create table public.public_page_daily_views (
    school_urn text not null check (length(school_urn) <= 12),
    day date not null,
    views integer not null default 0 check (views >= 0),
    primary key (school_urn, day)
);

comment on table public.public_page_daily_views is
  '0.8 usage log: views of the public school page per school per day (UK date), counted server-side with no cookies and no personal data.';

alter table public.public_page_daily_views enable row level security;
revoke all on public.public_page_daily_views from anon, authenticated;
grant select on public.public_page_daily_views to service_role;

-- One view, counted: the only way in. Callable by the service role only.
create function public.count_public_page_view(p_urn text)
returns void
language sql
security definer
set search_path = public
as $$
    insert into public.public_page_daily_views (school_urn, day, views)
    values (p_urn, (now() at time zone 'Europe/London')::date, 1)
    on conflict (school_urn, day) do update set views = public_page_daily_views.views + 1;
$$;

revoke all on function public.count_public_page_view(text) from public, anon, authenticated;
grant execute on function public.count_public_page_view(text) to service_role;
