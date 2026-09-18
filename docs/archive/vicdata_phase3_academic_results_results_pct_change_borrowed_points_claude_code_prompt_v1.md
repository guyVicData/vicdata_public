Read docs/vicdata_phase3_academic_results_results_pct_change_borrowed_points_brief_v1.md in
full and execute it.

Found via Guy's own live review of Sevenoaks School (URN 118952, TYPE = IB), Graphs page,
Subjects section, category mode. I traced the exact root cause directly in
SubjectAreaSection.tsx before writing the brief -- this is NOT the bigger, already-flagged gap
("category mode has no real per-bucket points" -- see categoryPointsUnavailable's own comment
in that file) and NOT a data-quality issue. It's a small, precise inconsistency between two
sibling computations that should both obey the same suppression rule, and only one of them
does.

categoryPointsUnavailable correctly nulls both `results` and `resultsPctChange` via
withoutBorrowedPoints() whenever a non-A-level TYPE bucket is active in category mode --
because academic_subject_family_rollup's points figure is always A-level-only, with no bucket
dimension, so showing it under IB/BTec-OCR-VRQ/T-Level/Other would silently display an A-level
number as if it were that bucket's own score. resultComparisonItems (the "Results, 2024/25"
card) correctly reads from the already-suppressed comparatorRowsByUrn, so it correctly shows
"No real results figure..." for both sides under TYPE = IB.

resultsTrendComparisonItems (the "Results, % change" card) does NOT go through the same
suppressed data for its default "Average across set" case -- the exact state Guy was looking at
("Boarding schools nationally (by boarding population)", a real ~60-school quintile-matched
comparableGroup, confirmed in default-comparator-lists.ts, not a precomputed aggregate). Its
categoryMode branch calls `aggregateFamilyTrend(comparableGroup, stage, id, (y) =>
y.avgPointScore, average)` -- reading avgPointScore straight off each profile's raw
familyYearsFor history, completely bypassing comparatorRowsByUrn and therefore bypassing the
suppression entirely. That's a real A-level points trend, silently shown under "Results, %
change" while TYPE = IB is selected, directly contradicting the current-value card right above
it. This is exactly why Guy saw "Results, 2024/25" honestly empty on both sides but "Results, %
change" showing real data specifically on the comparator side.

The fix: make that default-aggregate branch of resultsTrendComparisonItems respect
categoryPointsUnavailable the same way resultComparisonItems already does -- gate the call
directly, or have it read through the already-suppressed comparatorRowsByUrn instead of raw
comparableGroup profiles, whichever is the smaller, cleaner fix once you're looking at
aggregateFamilyTrend's own signature. Do NOT touch the candidates-trend line just above it in
the same file (entries are legitimately bucket-scoped already at a different point in the
pipeline and were never part of this suppression -- that one's correct as-is), and do NOT touch
the selectedRows branch (already correct). Check the KS4 subject-mode branch just below (which
already reads through comparatorRowsByUrn and may already be correctly gated per its own
comment -- confirm directly, don't assume the comment is still accurate after your change).

Also check Ks2DomainSection.tsx and SubjectDeepDiveDrawer.tsx, which have the same "Not enough
real history to compute growth/decline" message, for the same class of bug -- a current-value
suppression not mirrored in the corresponding %-change computation. Don't assume either has it;
confirm and report either way.

Explicitly out of scope: giving category mode a genuine real per-bucket points figure (removing
the suppression entirely) needs academic_subject_family_rollup to gain a bucket dimension -- a
real structural build on the scale of the last IB round, not this one. This brief is only about
making the existing suppression consistent between the two cards, not about removing it.

Verify: Sevenoaks (URN 118952) at TYPE = IB shows the honest unavailable message on both cards,
both sides, no default-aggregate leak. TYPE = A-level (or no filter) is completely unaffected --
both cards still show real data as before. Spot-check TYPE = BTec, OCR, VRQ and T Level at a
real school with real entries there, to confirm the fix generalises rather than being
IB-specific.

Build report: the root cause re-verified independently, the fix applied, the KS4/Ks2/drawer
check and its result, and the verification above. Commit and push.
