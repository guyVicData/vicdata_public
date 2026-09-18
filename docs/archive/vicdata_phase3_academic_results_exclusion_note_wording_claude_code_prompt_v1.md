Read docs/vicdata_phase3_academic_results_exclusion_note_wording_brief_v1.md in full and
execute it.

Small wording fix: ks5BucketExclusionNote() in src/lib/academic-data-view.ts (around line 468)
repeats the bucket label twice in one sentence -- "Capital City College isn't shown in this
BTec, OCR, VRQ comparison -- it has no real BTec, OCR, VRQ entries recorded." This was always
true of the template but only became visible once the label grew to "BTec, OCR, VRQ" in the
rename round. Both the single-school and multi-school branches have this repetition, and the
fix needs to read well for every bucket (A-level, IB, T Level, Other, BTec/OCR/VRQ), not just
the one that surfaced it.

The brief suggests dropping the label from the first clause and keeping it only in the second
("isn't shown in this comparison -- it has no real ${label} entries recorded."), but treat that
as a starting point, not a mandate -- if something reads better once you see it rendered, use
your judgement. The one hard requirement: the label shouldn't appear twice in one sentence.

ks5BucketWholeGroupSentence() is a separate function with a different sentence shape and
doesn't have this problem -- leave it alone.

Verify the single-school and multi-school cases for at least BTec, OCR, VRQ (longest label) and
A-level (shortest, to confirm the shorter sentence doesn't read oddly-terse once the repetition
is removed).

Brief build report: the reworded sentence(s) and confirmation it reads correctly across
buckets. Commit and push.
