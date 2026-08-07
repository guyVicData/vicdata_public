-- pending_school_requests: the "can't find your school?" manual-entry fallback ported
-- from Club ISS (membership spec §3) -- creates a pending record for admin follow-up
-- rather than blocking the visitor. Reachable pre-signup (search is stateless, no
-- membership semantics -- membership spec §4), so submitted_by_profile_id is nullable.
create table public.pending_school_requests (
    id uuid primary key default gen_random_uuid(),
    submitted_by_profile_id uuid references public.profiles (id),
    school_name text not null,
    town text,
    postcode text,
    notes text,
    status text not null default 'pending' check (status in ('pending', 'resolved')),
    created_at timestamptz not null default now()
);

alter table public.pending_school_requests enable row level security;

-- Anyone (including anonymous) can submit one. No select/update policy is defined --
-- RLS default-denies read/write to everyone except service_role, matching the fact
-- there's no platform-staff admin role in this schema yet to scope it to.
create policy pending_school_requests_insert_anyone on public.pending_school_requests
    for insert with check (true);
