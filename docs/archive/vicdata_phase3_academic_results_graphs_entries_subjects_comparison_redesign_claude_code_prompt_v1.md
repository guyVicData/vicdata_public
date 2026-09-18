Read docs/vicdata_phase3_academic_results_graphs_entries_subjects_comparison_redesign_brief_v1.md
in full and execute it. It covers two changes to the Graphs page
(src/components/data-view/AcademicGraphsView.tsx): a new pie-chart row at the bottom
of Section 01 "Entries", and a full redesign of Section 03 "Subjects" into four
school-vs-comparison-set rows. The brief already traces the real current code (what
SubjectAreaSection.tsx does today and why, what comparableGroup already carries,
what Card/FullscreenChartModal already give you for free) — read that reasoning, don't
re-derive it from scratch, but verify anything you build against the real live code and
data the same way the brief itself did, not on the brief's word alone.

Build Section 01's new row first — it's small, and confirms the comparator-set data
you'll need is where the brief says it is before you rely on that same finding for the
bigger Section 03 work.

For Section 03, build in this order: the four rows' school-side content and layout
first (much of this already exists in SubjectAreaSection.tsx and should be reused, not
rebuilt), then category-mode comparison-set data (already available client-side per the
brief), then the individual-school selector, then subject-mode comparison-set data last
— that's the one genuinely new fetch this brief calls out, and the rest of the UI should
work correctly in category mode before you take that on. If subject-mode fetching
doesn't fully land in this round, get category mode fully correct and say exactly where
you stopped, rather than a half-working version of both modes.

Two things the brief flags as its own assumptions, not settled decisions — confirm
against the real data/behaviour once built, and say plainly in your report if either
reads differently once you see it live: (1) Candidates % change being total-based on
the comparison side (school's own % change was clear; the comparison side's convention
was inferred, not confirmed with Guy); (2) Results % change on the comparison side
needing to inherit the exact same KS4/KS5-value-added omission logic the school side
already applies, rather than computing a technically-possible number that would
mislead.

Check at the start of this session whether a browser tool is available and use it for a
real visual check of both sections once built, in both category and subject mode; if
not available, say so plainly rather than implying a check that didn't happen.

Run whatever this repo's own lint/typecheck/build commands are before calling anything
done — check package.json or prior build reports for the exact commands rather than
guessing them.

Write up a full build report in the same shape as prior rounds in this docs/ folder.
Commit and push when it's done, per the project's normal working pattern — small,
real commit messages, not one giant commit for both sections if they land at different
times.
