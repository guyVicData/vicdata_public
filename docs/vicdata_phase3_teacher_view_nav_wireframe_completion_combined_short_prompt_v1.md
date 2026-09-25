Read docs/vicdata_phase3_teacher_view_nav_wireframe_completion_combined_claude_code_prompt_v1.md
in full and execute all three parts in one pass, in order (each depends on real pieces the
previous one adds): 1) give ControlBar's subject chips the real per-family qualification icon
they're missing (qualificationFamilyOf + familyIcon already exist, just aren't wired to the
chips); 2) bring TeacherNav to /teacher, /teacher/recruitment and /teacher/meetings, retiring
the old sitewide NavBar on those three routes too, with the real settings/onboarded-phases
plumbing that needs (see the doc for exactly what's missing where); 3) build the phone-width
nav from NavPhone.dc.html for real -- there's no breakpoint logic for it today, just flex-wrap.
Confirm the real locations named in the doc before writing anything. Separate commits per part
are fine, one combined build report at the end. Commit and push, vicdata_public only.
