-- VicData 0.8 front door, part 2 (F29): every current school account as a pilot, free for 6 months from
-- the day it joined (school_accounts.created_at), on the plan its phase takes: Primary for a school whose
-- oldest pupils are 11 or younger, else School membership (secondary). Re-runnable: a school that already
-- has a record keeps it. Guy sets the real dates afterwards (Platform, or an update by hand).
-- Run after 20261124090000_v08_front_door_r2_membership.sql.
insert into public.account_memberships (school_account_id, plan_code, status, joined_on, pilot_ends_on, renews_on, auto_renew)
select
    sa.id,
    case when s.statutory_high_age is not null and s.statutory_high_age <= 11 then 'primary' else 'secondary' end,
    'pilot',
    sa.created_at::date,
    (sa.created_at + make_interval(months => 6))::date,
    (sa.created_at + make_interval(months => 6))::date,
    true
from public.school_accounts sa
join public.schools s on s.urn = sa.school_urn
on conflict (school_account_id) do nothing;

-- Group accounts in the beta too (pilot groups): the group plan, free for 6 months from the account's creation.
-- Preview accounts (the preview route's test accounts) are left out.
insert into public.account_memberships (group_account_id, plan_code, status, joined_on, pilot_ends_on, renews_on, auto_renew)
select ga.id, 'group', 'pilot', ga.created_at::date, (ga.created_at + make_interval(months => 6))::date, (ga.created_at + make_interval(months => 6))::date, true
from public.group_accounts ga
where not ga.preview
on conflict (group_account_id) do nothing;
