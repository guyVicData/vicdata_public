-- Membership spec §4: signup verification needs a school's official website domain
-- ("GIAS website-domain auto-match, manual fallback for the rest"). Now available from
-- vicdata's school_entities_export RPC (see vicdata@48b4dd3).
alter table public.schools
    add column website text;
