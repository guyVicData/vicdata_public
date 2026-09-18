Read docs/vicdata_phase3_academic_results_unfiltered_view_best_available_points_brief_v1.md
in full and execute it. Guy noticed live right after last round shipped: Sevenoaks
(URN 118952) now shows real IB points under TYPE=IB, but the default unfiltered TYPE=All
still shows nothing, because the 'all' rows are the pre-existing A-level-only aggregate,
deliberately left untouched last round. Not a bug then -- but a real, now-closeable gap.

Hard constraint, non-negotiable: never blend or average points across incompatible scales
(same discipline that kept the IB Diploma total separate from the bucket points figure).
Do not build a cross-bucket weighted average. Instead: when a school's (or category's)
scoreable entries sit entirely or very nearly entirely in one scored bucket
(alevel/ib/btec_ocr/tlevel -- other never scores), TYPE=All should default to showing that
bucket's own points figure, clearly labelled which bucket it's from. When genuinely mixed
across two or more scored buckets, keep suppressing, but improve the wording to say why
("mixed offer" rather than the current bare "no data yet" phrasing, which reads as missing
data rather than a real design boundary) -- your call on exact wording, say what you chose.

Required first step: quantify the real shape before picking a threshold. Query real KS5
school/school-period scoreable-entry bucket distributions: how many are 100% one bucket, how
many have a small minority in a second bucket (pick your own real threshold once you see the
actual distribution, don't assume one), how many are genuinely mixed with no dominant bucket.
Check whether this is worth doing at category grain (a school could be mixed overall but have
one category that's 100% one bucket) or whether whole-school grain is close enough in
practice -- report real numbers either way.

Apply the same rule to both the Results current-value card and the Results-%-change card, on
both the school side and comparator side -- this phase already found and fixed one real bug
(results_pct_change_borrowed_points round) from exactly this kind of rule being applied to
one card and not its sibling. Don't reintroduce that.

Required deliverable, not optional: add a real, plainly-worded section to the real sources
page (src/app/sources/page.tsx in vicdata_public) explaining that every bucket's points figure
is real and independently sourced (name the real conversion tables -- DfE's Table 2g for IB,
Pearson/OCR's own Tariff tables for BTEC/OCR, DfE's Table 51 for T-Level, same discipline as
the existing A-level figure) -- but that a category's points figure is only comparable to
another school's figure WITHIN the same qualification type/bucket. A 48.52 under IB and a
48.52 under A-level are not the same achievement and must never be read as equivalent. This is
about cross-qualification-type comparability, not about whether the numbers are real.

Verify: Sevenoaks TYPE=All now shows real IB points matching TYPE=IB. A genuinely mixed real
school still honestly suppresses with the improved wording. A-level-only schools are
completely unaffected under TYPE=All. Both cards, both sides.

Build report: the real distribution counts, the threshold chosen and why, the category-vs-
whole-school grain decision with real numbers, the wording chosen, Sevenoaks + mixed-school
verification, A-level-only-unaffected confirmation, and the sources-page section added (quote
what was written). Commit and push, both repos.
