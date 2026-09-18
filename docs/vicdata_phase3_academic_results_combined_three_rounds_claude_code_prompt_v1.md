Three independent, unrelated pieces of work, batched into one session for convenience.
Execute them in this order, as three separate pieces of work with their own commits and
their own build report sections below -- don't blend them into one commit or one report,
and don't let one round's scope bleed into another's.

===============================================================================
ROUND 1 of 3: phase closeout -- archive convention + briefing refresh
===============================================================================

Read docs/vicdata_phase3_academic_results_phase_closeout_archive_and_briefings_brief_v1.md
in full and execute it. This is a housekeeping round, dispatched a while back with no build
report yet received -- if you already did some or all of this in an earlier session, check
the real current state of docs/ and the three briefing docs before redoing anything, and
report what you find either way (already done / partially done / not started).

Two parts, both need real judgement per file, not a blind sweep. Part A: create docs/archive/
(flat, no subfolders) in BOTH repos (vicdata and vicdata_public). git mv every round-specific
working artifact into it -- briefs, Claude Code prompts, build/verification reports, handoff
notes -- basically the great majority of what's currently in both docs/ folders. Leave at the
top level: vicdata_roadmap.md, the three briefing docs (being refreshed in Part B, not
archived), STYLE.md/OPEN_QUESTIONS.md/vicdata_backlog_v1.md/vicdata_data_view_open_questions.md,
and leave vicdata_public/docs/reports/ completely alone -- it's a separate, existing, dated
review-log convention this round doesn't touch. For spec/design/investigation docs that don't
fit cleanly either way, use judgement: archive if fully superseded by shipped code and the
refreshed briefings, otherwise leave at top level and say so explicitly in the report rather
than guessing silently.

Part B: vicdata_briefing_post16_what_is_measured_v1.md is now significantly stale (written
2026-09-14, before T-Level ingest, the VRQ bucket move, the whole IB Diploma round, AND the
bucket-aware points rollup round that shipped since this brief was written -- fold that round
in too: the real qualification-bucket system now has real per-bucket subject/family points,
not just A-level). Rewrite it as a new v2 (keep v1, it'll get archived per Part A), verified
against the live current code and data, not copied forward from memory. Cover: the real
qualification-bucket system and why it exists, the real grading tables now implemented
including the IB Core's real three-column Table 2g structure and why the old two-column
assumption was wrong, what Baccalaureate and the three Diploma Programme Core rows actually
are and why they're excluded from the subject system, the ib_diploma::avg_total_points
headline metric and its real methodology, T-Level's real current coverage, the bucket-aware
points rollup (real per-bucket subject/family points now exist, additional-rows compatibility
approach, entries_share_of_school_percent now bucket-scoped), and whether the old doc's
outstanding UCAS Tariff primary-source question was ever actually resolved -- say plainly if
still open. Also check vicdata_briefing_gcse_what_is_measured_v1.md and
vicdata_briefing_ks2_what_is_measured_v1.md -- update if anything is now inaccurate, say so if
still accurate.

Build report for this round: what moved to docs/archive/ in each repo (rough counts fine),
what was deliberately left at top level and why, anything you weren't sure about, and the
refreshed/confirmed state of all three briefing docs. Commit and push, both repos, as its own
commit separate from rounds 2 and 3 below.

===============================================================================
ROUND 2 of 3: "Candidate numbers" card inflated under non-A-level TYPE filters
===============================================================================

Read docs/vicdata_phase3_academic_results_candidate_numbers_ib_inflation_brief_v1.md in full
and execute it. Guy found this live: Sevenoaks (URN 118952), TYPE=IB, the "Candidate numbers"
card at the top of the Graphs page (Section 01, Entries) shows 2,165 -- but the Subjects
section's own "Candidates" chart further down the same page correctly shows 1,443 real subject
entries (confirmed directly against academic_subject_family_rollup, bucket='ib', entity
118952, period 2024: 25+128+214+487+589=1,443). TYPE=All is unaffected (correctly 245).

Traced to a precise, likely cause before writing the brief -- confirm independently, don't
just re-assert it. The "Candidate numbers" card reads a DIFFERENT, older measure
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
POINTS computation for the IB bucket completely unchanged. Don't touch ib_diploma::entries or
ib_combined_certificate::entries -- those are correct, separate, deliberate counts of the
Diploma/Combined-Certificate awards themselves.

Check whether alevel/btec_ocr/tlevel have the same class of issue -- confirm directly with
real data, don't assume IB is the only one affected. Also check the map's circle sizing --
ks5BucketEntriesKey()'s own comment in dfe-qualification-buckets.ts says this same measure
drives "wherever entries drive a magnitude, such as the map's circle sizing." If IB schools'
map circles are sized off this same inflated figure, that's a second real, live-visible
consequence -- confirm and report.

Verify: Sevenoaks TYPE=IB "Candidate numbers" now matches the Subjects section's own 1,443 (or
the correctly-recomputed real figure -- don't assume it stays exactly 1,443). TYPE=All
unaffected. Spot-check a real BTEC/OCR/VRQ or T-Level school. Report the map circle-sizing
finding either way.

Build report for this round: the confirmed root cause, real before/after numbers for
Sevenoaks, which other buckets were checked and their result, and the map finding. Commit and
push, both repos, as its own commit separate from rounds 1 and 3.

===============================================================================
ROUND 3 of 3: TYPE=All should show a real points figure when a school's offer sits in one bucket
===============================================================================

Read docs/vicdata_phase3_academic_results_unfiltered_view_best_available_points_brief_v1.md
in full and execute it. Guy noticed live right after the bucket-aware-points-rollup round
shipped: Sevenoaks (URN 118952) now shows real IB points under TYPE=IB, but the default
unfiltered TYPE=All still shows nothing, because the 'all' rows are the pre-existing
A-level-only aggregate, deliberately left untouched that round. Not a bug then -- but a real,
now-closeable gap.

Hard constraint, non-negotiable: never blend or average points across incompatible scales
(same discipline that kept the IB Diploma total separate from the bucket points figure). Do
not build a cross-bucket weighted average. Instead: when a school's (or category's) scoreable
entries sit entirely or very nearly entirely in one scored bucket
(alevel/ib/btec_ocr/tlevel -- other never scores), TYPE=All should default to showing that
bucket's own points figure, clearly labelled which bucket it's from. When genuinely mixed
across two or more scored buckets, keep suppressing, but improve the wording to say why
("mixed offer" rather than the current bare "no data yet" phrasing) -- your call on exact
wording, say what you chose.

Required first step: quantify the real shape before picking a threshold. Query real KS5
school/school-period scoreable-entry bucket distributions: how many are 100% one bucket, how
many have a small minority in a second bucket (pick your own real threshold once you see the
actual distribution), how many are genuinely mixed with no dominant bucket. Check whether this
is worth doing at category grain or whether whole-school grain is close enough in practice --
report real numbers either way.

Apply the same rule to both the Results current-value card and the Results-%-change card, on
both the school side and comparator side -- this phase already found and fixed one real bug
(results_pct_change_borrowed_points round) from exactly this kind of rule being applied to one
card and not its sibling. Don't reintroduce that.

Note: this round reads real entries data at the family/subject grain -- if round 2 above
changed what counts as an "entry" for bucket purposes, make sure this round's own distribution
query uses the corrected, real entries basis (academic_subject_family_rollup's entries_total,
which was already correct and untouched by round 2's fix -- round 2 only fixed the separate
headline bucket:<b>::entries measure, not this table). Confirm this explicitly rather than
assuming.

Required deliverable, not optional: add a real, plainly-worded section to the real sources
page (src/app/sources/page.tsx in vicdata_public) explaining that every bucket's points figure
is real and independently sourced (name the real conversion tables -- DfE's Table 2g for IB,
Pearson/OCR's own Tariff tables for BTEC/OCR, DfE's Table 51 for T-Level, same discipline as
the existing A-level figure) -- but that a category's points figure is only comparable to
another school's figure WITHIN the same qualification type/bucket. A 48.52 under IB and a
48.52 under A-level are not the same achievement and must never be read as equivalent.

Verify: Sevenoaks TYPE=All now shows real IB points matching TYPE=IB. A genuinely mixed real
school still honestly suppresses with the improved wording. A-level-only schools are
completely unaffected under TYPE=All. Both cards, both sides.

Build report for this round: the real distribution counts, the threshold chosen and why, the
category-vs-whole-school grain decision with real numbers, the wording chosen, Sevenoaks +
mixed-school verification, A-level-only-unaffected confirmation, and the sources-page section
added (quote what was written). Commit and push, both repos, as its own commit separate from
rounds 1 and 2.

===============================================================================
Overall deliverable
===============================================================================

Three separate build report sections (one per round above), three separate commits per repo
(not squashed together), all pushed. If any round surfaces something that changes how a later
round in this list should be scoped, stop and flag it rather than silently improvising --
but proceed through all three unless you hit a real blocker.
