Read docs/vicdata_phase3_academic_results_subject_deep_dive_qualification_type_bugfix_brief_v1.md
in full and execute it. Two live bugs Guy found in production, both traced back to the
same root gap: every subject-grain raw fact (`SubjectEntry`, `SubjectGradeCount`,
`SubjectValueAdded` in academic-data-view.ts) carries a real `qualificationType` field,
parsed correctly, but it's dropped downstream in two different places.

**Bug 1 — IB grade distribution shows empty bars.** SubjectDeepDiveDrawer.tsx picks
grade bands purely by stage (GCSE_GRADE_ORDER for ks4, ALEVEL_GRADE_ORDER for
everything else, line ~226) — IB's real grades don't match A*-E-U so every bar renders
zero. Before fixing: confirm the real distinct `grade` values IB entries actually carry
in ingested SubjectGradeCount rows, and check whether any other non-GCSE/non-A-level
qualification type (Core Maths, OCR Cambridge Technical, VRQ) has real grade-count rows
too, rather than assuming only IB needs a fix.

**Bug 2 — Capital City College's BTEC subject breakdown shows A-level subjects.**
buildSubjectRows in SubjectAreaSection.tsx groups/filters/dedupes subject rows purely by
`subject` name string — qualificationType is never referenced despite being present on
every input row. The brief lays out two real, different candidate mechanisms (subject-
name collision/merging across qualification types, vs. BTEC subject names being absent
from subjectFamilyMap entirely and filtered out by namesInFamily.has(s)) — do not guess
which one is real. Look up Capital City College's URN and query its actual
SubjectEntry/SubjectGradeCount/subjectFamilyMap data directly to show which mechanism is
actually happening there before writing a fix. Same discipline as every prior round on
this page — the drawer timeout bug's own root-cause round is the precedent for why
guessing here would be a mistake.

Once both real mechanisms are confirmed against real data (show the evidence in the
build report, not just code inspection): fix Bug 1 by making grade-band selection
qualification-type-aware rather than a two-item stage lookup, and fix Bug 2 by
incorporating qualificationType into buildSubjectRows's grouping/filtering (and, if the
subjectFamilyMap-exclusion mechanism turns out to be the real one, fixing how that map
represents non-GCSE/A-level subjects). Both fixes must preserve existing GCSE/A-level
behaviour exactly — equivalence-check this the same way the timeout fix was equivalence-
checked, not just eyeballed.

Full build report, same shape as every prior round: real data verified (Capital City
College's actual BTEC data, IB's actual grade values), not just code inspection. Commit
and push once verified, per the normal working pattern.
