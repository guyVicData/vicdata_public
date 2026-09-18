# "Candidate numbers" card is inflated under non-A-level TYPE filters

## Found, and traced to a precise cause

Guy noticed live: Sevenoaks School (URN 118952), TYPE = IB — the "Candidate numbers" card at the top of the Graphs page (Section 01, Entries, `AcademicGraphsView.tsx`) shows 2,165. Under TYPE = All (unfiltered) it correctly shows 245, and generalises correctly at Brighton College (248). Real IB entries at Sevenoaks 2024 are 1,443 — confirmed directly against `academic_subject_family_rollup` (bucket='ib', entity 118952, ks_stage ks5, period 2024: 25+128+214+487+589 = 1,443 across the 5 real categories), which matches exactly what the Subjects section's own "Candidates" bar chart already shows correctly further down the same page. 2,165 is neither the real subject-entries total nor the real candidate headcount — it's wrong.

Traced the two separate pipelines involved:

- The Subjects section's "Candidates" card (`SubjectAreaSection.tsx`, `buildCategoryRows()`) reads `academic_subject_family_rollup`/`academic_subject_rollup`, which the bucket-aware-points-rollup round just correctly built to exclude the IB Core/Baccalaureate rows from the subject system — 1,443 is right.
- This "Candidate numbers" card (`AcademicGraphsView.tsx`, via `entriesCountAt`/`latestEntriesCount`/`entriesSeries` in `academic-data-view.ts`) reads a *different* measure, `bucket:ib::entries`, computed by `_ks5_bucket_measures()` in `ingest/academic_aggregates.py` — a separate, older pipeline (predates the bucket-aware-rollup round; its own docstring references "round 3, Academic Map edit 2 A1"). Its own comment explains it deliberately does NOT apply the `_NON_SUBJECT_ROWS` exclusion when summing entries per bucket: "the three IB core components are real, scored IB entries and belong in the IB bucket's points." That reasoning is right for *points* (the Core components genuinely contribute to the IB Diploma's real scoring) but wrong for *entries* — Learning Skills, Study Skills, Self Development, and the Baccalaureate row aren't separate subject choices a candidate made; every IB candidate already has them, layered on top of their real ~6 subject entries. Counting them as additional entries inflates the total for every IB school, and only IB schools (the other buckets don't have an equivalent set of mandatory non-subject summary rows).

## What to fix

In `_ks5_bucket_measures()`, `bucket:<b>::entries` should reflect real, comparable subject entries only — the same basis `academic_subject_family_rollup`/`academic_subject_rollup` already use. Exclude the same non-subject rows (Baccalaureate, Learning Skills, Study Skills, Self Development, and the Combined Certificate award — check whether that one is already separately excluded) from the entries sum specifically, while leaving the points computation exactly as it is (Core components correctly still feed the IB bucket's points figure, which is a genuinely different question from what counts as an entry). Don't touch `ib_diploma::entries` or `ib_combined_certificate::entries` — those are correct, deliberate, separate counts of the Diploma/Combined-Certificate awards themselves, not part of this bug.

Check whether the same class of issue affects `alevel`/`btec_ocr`/`tlevel` buckets too — confirm directly rather than assuming IB is the only one affected; A-level and the others may not have an equivalent mandatory non-subject row, but verify against real data rather than assuming.

Also check the map's circle sizing — `dfe-qualification-buckets.ts`'s own comment on `ks5BucketEntriesKey()` says this same measure drives "wherever entries drive a magnitude, such as the map's circle sizing." If IB schools' map circles are sized off this same inflated `bucket:ib::entries` figure, that's a second, real, live-visible consequence of the same bug — confirm and report either way.

## Verify

- Sevenoaks (URN 118952), TYPE = IB: "Candidate numbers" card now shows 1,443 (or whatever the correctly-recomputed real figure is — re-verify after the fix rather than assuming 1,443 stays exact), matching the Subjects section's own "Candidates" total.
- TYPE = All: completely unaffected, still 245.
- Spot-check a real BTEC/OCR/VRQ or T-Level school's "Candidate numbers" under that TYPE filter, to confirm those buckets were already correct (or fix them too if the same issue is found there).
- Confirm whether the map's circle sizing for IB schools changes after the fix, and report what you found.

## Deliverable

Build report: the confirmed root cause (re-verified independently, not just re-asserted from this brief), the real numbers before and after for Sevenoaks, confirmation of which other buckets were checked and their result, and the map circle-sizing finding. Commit and push, both repos.
