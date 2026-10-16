-- VicData 0.8 groups round 2 (A): the usage log learns the group dashboards' product, "groups" -- a
-- member school's SMT reading its group's Overview or Schools (round 1's Access page counts these per
-- school as "Opened, last 30 days", src/lib/groups/server.ts groupViewUsage).
--
-- Target: the app database (lnhulykjlxmoneappnsp). NOT APPLIED by the build: Guy applies it
-- (docs/v0.8/groups_r2_report_v1.md). Additive and idempotent: the product check widens; nothing else
-- changes. Before it's applied, a "groups" event is refused by the check and dropped silently (every
-- usage write is fire-and-forget), so the app works before and after.
alter table public.usage_events drop constraint if exists usage_events_product_check;
alter table public.usage_events add constraint usage_events_product_check check (product in ('teacher', 'admissions', 'smt', 'groups'));
