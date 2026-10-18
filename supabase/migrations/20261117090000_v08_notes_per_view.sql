-- VicData 0.8 notes and feedback (decision 3): a member's private note now attaches to one view in a
-- panel's rail, at their school -- teacher_view_notes.chart_key "view:{dashboard}:{panel}:{view instance}"
-- (src/lib/view-ref.ts viewNoteKey). No schema change: chart_key is free text, and the table's RLS
-- (profile_id = auth.uid()) is unchanged.
--
-- The notes written under the old per-panel / per-card keys ("ks4:results:Biology", "ks5:results",
-- "ks4:candidates") would never be shown again, so Guy's call is to delete them. Read on the app
-- database, 18 Oct 2026: 3 rows, 2 people, September 2026 --
--     school_urn  chart_key              written
--     100053      ks4:results:Biology    19 Sep 2026
--     100053      ks5:results            19 Sep 2026
--     137625      ks4:candidates         21 Sep 2026
--
-- What is never touched:
--   * View as' own comparison sets and rankings: rows under a "{urn}~trial~{role}~sets" school key,
--     chart_key "set:{id}" / "ranking:{id}" (src/lib/teacher-view-saved-sets.ts);
--   * meeting slides' notes, which keep their own keys: "meeting:{meeting id}:{view id}";
--   * notes under the new scheme ("view:…"), so a second run after the deploy removes nothing a
--     member has written since.
--
-- Safe to run twice: the second run finds nothing to delete.
do $$
declare
  v_n int;
begin
  delete from public.teacher_view_notes
  where school_urn !~ '~sets$'
    and chart_key !~ '^(view|meeting|set|ranking):';
  get diagnostics v_n = row_count;
  raise notice 'notes_per_view: % old per-panel note(s) removed', v_n;
end $$;
