Read docs/vicdata_phase3_academic_results_vrq_into_btec_ocr_bucket_brief_v1.md in full and
execute it. Real finding behind this: Capital City College's real "BTEC in Fine Art" (a real
family's own children, one currently enrolled) turned out in the live data to be classified by
DfE as VRQ Level 3, not any Pearson-branded BTEC qualification type -- substantial, real,
ongoing entries every year 2021-2024 (22-36/year), currently invisible under the BTec & OCR
pill because VRQ was deliberately routed to "Other" in the original bucket round. Confirmed
decision: move VRQ into btec_ocr.

Before writing any code, re-verify the real data-quality problem the brief documents: VRQ's
raw "size" field contains non-numeric garbage for a real subset of rows (letter grades, "Covid
impacted", "Level 2 distinction star", and similar, sitting where a numeric
a_level_equivalent_size should be) -- likely a column-shift bug in
dfe_ks5_subject_results(_historic).py for some VRQ source-file layout. Scope how far this
reaches (which years/file variants) before relying on any VRQ size value.

Entries and subject-list visibility come first and do not wait on the points question --
verify Capital City College's real VRQ Art & Design entries (22-27 in 2024) appear under BTec
& OCR immediately once the bucket reassignment lands.

Points are the harder part, and the brief is explicit: do not rush this. VRQ's real grade
vocabulary is much bigger and messier than BTEC/OCR's -- multiple real label forms for what
may be the same grade (word form, letter form, abbreviated form), a five-grade scale
(Distinction/High merit/Merit/High pass/Pass) that doesn't match any existing table, paired and
tripled combination grades that mostly but not entirely match the existing VOC_SEVEN/VOC_TEN
tables, and real non-grade markers (COVID result, No result, No result / X, Suppressed) that
must not be scored as if they were grades. Research whether DfE's own practical guide has a
real, verifiable challenge table for each real VRQ grade shape. Where one exists and can be
verified against a real known figure, compute real points the same way IB and BTec & OCR were
computed last round. Where it can't -- because no real table exists, or the size-column
problem can't be resolved with confidence -- those VRQ entries should count toward
entries_total but stay excluded from the points average, same as other real unscoreable cases
already in this system (dirty BTEC grade codes, T Level's Partial achievement). Report exactly
which VRQ grade shapes could and couldn't be scored, and why -- an honest partial-coverage
bucket is the right outcome if full coverage isn't real.

Update KS5_BUCKET_DESCRIPTION.btec_ocr to mention VRQ. KS5_OTHER_NO_FIGURE_NOTE currently
names VRQ specifically as its reason for having no headline figure -- that sentence is now
wrong and needs rewriting for whatever stays in Other (EPQ, Core Maths, Free-standing Maths,
Pre-U, Other General). If BTec & OCR ends up with a partial-coverage caveat, give it the same
kind of visible note Other already has rather than a silent gap.

Recompute with the same guarded chain as every prior round, and hand-check Capital City
College directly: real VRQ Art & Design entries now under BTec & OCR, with the right count and
either a real computed points figure or an honest not-scored state.

Note: a separate brief, vicdata_phase3_academic_results_qualification_row_ux_fixes_brief_v1.md,
is already in flight and its issue 5 is the empty-state bug at this exact school/category. That
empty state may stop reproducing once this round lands. Re-verify issue 5 against real data
AFTER this round, not before -- if both are being executed close together, do this one first.

Full build report: the data-quality finding and its real scope, the grade-alias map and
reasoning, which grade shapes got real points versus honest non-scoring and why, the bucket
move, updated description text, the recompute, and the Capital City College hand-check. Commit
and push once verified.
