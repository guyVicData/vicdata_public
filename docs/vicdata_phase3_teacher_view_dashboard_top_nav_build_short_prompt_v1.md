Read docs/vicdata_phase3_teacher_view_dashboard_top_nav_build_brief_v1.md in full and execute
it: build a top nav bar for src/app/teacher/[phase]/page.tsx (it has none today -- VicData
wordmark, Home link, a GCSE/Post-16 switcher reusing the real PhaseGlyph icon, a label-
visibility toggle persisted through the real teacher_view_preferences path, and an Account
dropdown), and move the theme toggle out of the control bar into that nav, right after
Account -- splitting TeacherChrome.tsx so the toggle and Export don't share one component
that only works in one place. Confirm the real locations named in the brief (page.tsx,
TeacherChrome.tsx, HomeCard.tsx's PhaseGlyph, teacher-view-theme.ts's PHASE_ACCENT, teacher-
view-data.ts's settings path, account/page.tsx's sign-out) before writing anything. Leave
/teacher, /teacher/recruitment, /teacher/meetings untouched. This is a first pass we'll
fine-tune live, not a final spec -- get the structure and the real data/persistence right,
don't agonise over exact pixels. Build report + commit/push when done, vicdata_public only.
