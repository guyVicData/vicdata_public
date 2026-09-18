Read docs/vicdata_phase3_academic_results_candidate_numbers_ib_inflation_brief_v1.md in
full and execute it. Guy found this live: Sevenoaks (URN 118952), TYPE=IB, the "Candidate
numbers" card at the top of the Graphs page (Section 01, Entries) shows 2,165 -- but the
Subjects section's own "Candidates" chart further down the same page correctly shows 1,443
real subject entries (confirmed directly against academic_subject_family_rollup, bucket='ib',
entity 118952, period 2024: 25+128+214+487+589=1,443). TYPE=All is unaffected (correctly 245).

I traced this to a precise, likely cause before writing the brief -- confirm independently,
don't just re-assert it. The "Candidate numbers" card reads a DIFFERENT, older measure
(bucket:ib::entries) than the Subjects section's chart -- computed by _ks5_bucket_measures()
in ingest/academic_aggregates.py, a pipeline that predates the bucket-aware-points-rollup
round and wasn't touched by it. That function's own comment says it deliberately does NOT
exclude the IB Core components (Learning Skills, Study Skills, Self Development) or the
Baccalaureate row from its entries count, reasoning that they're real scored IB entries
belonging in the IB bucket's points. That's correct for POINTS, but wrong for ENTRIES -- those
aren't separate subject choices, every IB candidate already has them layered on top of their
real ~6 subject entries, so counting them as additional entries inflates the bucket's entries
total. academic_subject_family_rollup/academic_subject_rollup already correctly exclude these
rows (that's why 1,443 is right); _ks5_bucket_measures does not.

Fix: bucket:<b>::entries in _ks5_bucket_measures() should exclude the same non-subject rows
(Baccalaureate, Learning Skills, Study Skills, Self Development, Combined Certificate -- check
if that one's already separately handled) from the ENTRIES sum specifically, leaving the
POINTS computation for the IB bucket completely unchanged (Core components correctly still
count toward IB bucket points -- that's a genuinely different question from what counts as an
entry). Don't touch ib_diploma::entries or ib_combined_certificate::entries -- those are
correct, separate, deliberate counts of the Diploma/Combined-Certificate awards themselves.

Check whether alevel/btec_ocr/tlevel have the same class of issue -- confirm directly with
real data, don't assume IB is the only one affected or that the others are automatically fine.

Also check the map's circle sizing -- ks5BucketEntriesKey()'s own comment in
dfe-qualification-buckets.ts says this same measure drives "wherever entries drive a
magnitude, such as the map's circle sizing." If IB schools' map circles are sized off this
same inflated figure, that's a second real, live-visible consequence -- confirm and report.

Verify: Sevenoaks TYPE=IB "Candidate numbers" now matches the Subjects section's own 1,443 (or
the correctly-recomputed real figure -- don't assume it stays exactly 1,443). TYPE=All
unaffected. Spot-check a real BTEC/OCR/VRQ or T-Level school. Report the map circle-sizing
finding either way.

Build report: the confirmed root cause, real before/after numbers for Sevenoaks, which other
buckets were checked and their result, and the map finding. Commit and push, both repos.
