Read `docs/vicdata_phase3_teacher_view_post16_partC_benchmark_wiring_build_report_v1.md` in
full before starting -- both fixes below are the two "Open decisions for Guy" it raised, now
decided.

Two small, independent fixes. One commit each, one build report.

## 1. Drop the England bucket fallback

`englandValue()` (`src/app/teacher/[phase]/page.tsx`) currently falls back to the bucket-grain
England figure when no exact-grain `{subject}::{qualificationType}` national row exists, for the
focused item (`englandAt`) and the onboarding preview (`englandFor`). Your own build report's
flag 2 found this fallback fires ~172 times across 28 schools and never once lands beside a real
school figure -- the school's own exact figure was null every one of those times too (VRQ,
2021/22 AS, OCR, AEA). Remove the fallback entirely: when no exact-grain national row exists, the
England marker for that item/period should be absent, not a bucket-blended figure. This also
removes the one remaining path by which a peer or the focused item could show a cross-
qualification benchmark (a VRQ item marked against BTEC's England average) -- exactly the
blending the rest of this round removed.

## 2. Move Context's group total onto exact-grain figures

Found along the way in the same build report: `groupValueFor()` sums every `headline` row per
subject, but at KS5 the dashboard fetch includes the whole-subject `all`-bucket row alongside
each per-bucket row, so every subject is counted twice (their example: 100369 2024 Biology --
alevel 19 + all 34 + ib 15 = 68 counted against a real 34; the donut share is roughly halved).

Decided: fix this by moving the group onto `qualificationHeadline` (the exact-grain rows this
round added), not by skipping the `all` rows. This is more work but it's the right end state --
it also finally leaves AS/AEA out of Context's group total at the row level, not just the
subject list (Part C1 excluded them from the list and the *displayed* total/average, but the
underlying blended figure still had AS baked into the A-level number it was averaging/summing;
moving to exact grain removes that for good).

Build report: what changed, and reconfirm the same live checks from Part C's report still pass
(especially Context's own numbers, since this round changes what feeds them) -- call out any
place Context's total or share changes in a way Guy should sanity-check on a real school before
trusting it.
