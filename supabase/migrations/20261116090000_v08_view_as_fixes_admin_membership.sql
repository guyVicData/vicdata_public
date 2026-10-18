-- VicData 0.8 View as fixes (item 4): a platform admin needs no school membership. Removes Guy's
-- leftover membership at Acland Burghley (URN 100053) -- one row, roles admissions + teacher with
-- is_admin, approved 21 Sep 2026 by the old testing switcher -- so the school's People list no longer
-- shows him, and nothing (Back to me, a failed View as check) can land him there. View as reaches any
-- school without a membership (0.8 View as).
--
-- What depends on that membership (read on the app database, 18 Oct 2026) and what happens to it:
--   school_accounts.account_holder / pending holder   none (0)       if any: set to null
--   school_memberships.approved_by (other members)    none (0)       if any: set to null, the member kept
--   saved_sets / saved_rankings owned                 none (0)       if any: STOP (a decision for Guy)
--   team_members                                      none (0)       cascade
--   sign_in_events                                    13 rows        cascade: his own sign-ins
--   admissions_grants                                 1 row          cascade: his own Admissions grant
--   usage_events                                      27 rows        deleted here: his own testing, which
--                                                                    would otherwise stay counted as the
--                                                                    school's (on delete set null)
-- Kept, because they belong to the school account or to Guy, not to the membership:
--   the school account itself; its 3 teams, 4 admissions lists, 2 entry points and 1 school dashboard
--   (all made by Guy while testing; no other member exists); Guy's personal dashboards, meetings and
--   jobs; his teacher_view_* rows under '100053' (no longer reached) and every View as state
--   ('100053~trial~…'). The leftover school-wide rows are logged in docs/OPEN_QUESTIONS.md as a call.
--
-- Safe to run twice: the second run finds no membership and does nothing. Only for a platform admin.
do $$
declare
  v_profile constant uuid := '52a08818-9132-48a0-8665-8362361eff11';
  v_urn constant text := '100053';
  v_ids uuid[];
  v_n int;
begin
  if not exists (select 1 from public.platform_admins where profile_id = v_profile) then
    raise notice 'view_as_fixes: % is not a platform admin; nothing removed', v_profile;
    return;
  end if;
  select coalesce(array_agg(m.id), '{}') into v_ids
  from public.school_memberships m join public.school_accounts a on a.id = m.school_account_id
  where m.profile_id = v_profile and a.school_urn = v_urn;
  if cardinality(v_ids) = 0 then
    raise notice 'view_as_fixes: no membership at % for the platform admin; nothing to do', v_urn;
    return;
  end if;

  if exists (select 1 from public.saved_sets where owner_membership_id = any (v_ids))
     or exists (select 1 from public.saved_rankings where owner_membership_id = any (v_ids)) then
    raise exception 'view_as_fixes: the membership owns saved sets or rankings; decide what happens to them first';
  end if;

  update public.school_accounts set account_holder_membership_id = null where account_holder_membership_id = any (v_ids);
  update public.school_accounts set pending_account_holder_membership_id = null where pending_account_holder_membership_id = any (v_ids);
  update public.school_memberships set approved_by = null where approved_by = any (v_ids) and not (id = any (v_ids));

  delete from public.usage_events where membership_id = any (v_ids);
  get diagnostics v_n = row_count;
  raise notice 'view_as_fixes: % usage rows removed', v_n;
  -- Cascades: sign_in_events, admissions_grants, team_members.
  delete from public.school_memberships where id = any (v_ids);
  get diagnostics v_n = row_count;
  raise notice 'view_as_fixes: % membership(s) at % removed', v_n, v_urn;
end $$;
