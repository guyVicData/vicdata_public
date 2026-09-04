-- Consortium sixth-form-centre membership (group-page build): which real, open
-- constituent schools sit behind each of the 14 open "Sixth form centres" URNs
-- (confirmed live, 0/14 have any real roll/participation data of their own -- their
-- real activity lives on these constituent schools instead). Sourced from GIAS's own
-- public "Establishment links" bulk CSV, LinkType IN ('Sixth Form Centre School',
-- 'Sixth Form Centre Link') -- the same real, official DfE data
-- ingest/sources/gias_links.py (vicdata repo) already mirrors into school_lineage,
-- fetched directly here instead (that table's RLS is authenticated-only, not
-- anon-reachable, and not worth working around when the source CSV is itself a
-- public, no-login, directly-fetchable file -- see
-- scripts/sync-consortium-links.ts's own comment).
--
-- Deliberately thin: no name/roll/location duplicated here -- both group_urn and
-- member_urn resolve against the real, live `schools` table by URN at render time,
-- the same "don't cache what you can look up live" discipline this project applies
-- elsewhere (e.g. FeCollegeLocalContextCard reading laComposition/sixthFormLa live
-- rather than duplicating LA totals into a third place).
create table public.consortium_members (
    group_urn text not null,
    member_urn text not null,
    link_type text not null,
    synced_at timestamptz not null default now(),
    primary key (group_urn, member_urn)
);

create index consortium_members_member_urn_idx on public.consortium_members (member_urn);

alter table public.consortium_members enable row level security;

create policy consortium_members_select_anyone on public.consortium_members
    for select using (true);

comment on table public.consortium_members is
    'Real, open constituent-school membership for consortium sixth-form-centre URNs, sourced from GIAS''s public establishment-links CSV (LinkType Sixth Form Centre School/Link). Written only by scripts/sync-consortium-links.ts (service-role); never computed live per request. member_urn is always resolved to a currently-open school -- see that script''s own comment for how a superseded URN is handled.';
