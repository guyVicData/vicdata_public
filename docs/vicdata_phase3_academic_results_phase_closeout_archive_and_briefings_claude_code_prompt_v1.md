Read docs/vicdata_phase3_academic_results_phase_closeout_archive_and_briefings_brief_v1.md in
full and execute it. This is a housekeeping round to close out the Academic Results phase --
two parts, both need real judgement per file, not a blind sweep.

Part A: create docs/archive/ (flat, no subfolders) in BOTH repos (vicdata and vicdata_public).
git mv every round-specific working artifact into it -- briefs, Claude Code prompts, build/
verification reports, handoff notes -- basically the great majority of what's currently in both
docs/ folders. Leave at the top level: vicdata_roadmap.md, the three briefing docs (being
refreshed in Part B, not archived), STYLE.md/OPEN_QUESTIONS.md/vicdata_backlog_v1.md/
vicdata_data_view_open_questions.md, and leave vicdata_public/docs/reports/ completely alone --
it's a separate, existing, dated review-log convention this round doesn't touch. For spec/
design/investigation docs that don't fit cleanly either way, use judgement: archive if fully
superseded by shipped code and the refreshed briefings, otherwise leave at top level and say so
explicitly in the report rather than guessing silently.

Part B: vicdata_briefing_post16_what_is_measured_v1.md is now significantly stale (written
2026-09-14, before T-Level ingest, the VRQ bucket move, and the whole IB Diploma round) and
currently states things that are now flatly wrong -- e.g. it says T-Level isn't in the data at
all, and that the IB's own 45-point Diploma total isn't folded into any points conversion.
Rewrite it as a new v2 (keep v1, it'll get archived per Part A), verified against the live
current code and data, not copied forward from memory. Cover: the real qualification-bucket
system and why it exists, the real grading tables now implemented including the IB Core's real
three-column Table 2g structure (Reflective Project / Extended Essay / Theory of Knowledge) and
why the old two-column assumption was wrong, what Baccalaureate and the three Diploma Programme
Core rows actually are and why they're excluded from the subject system, the new
ib_diploma::avg_total_points headline metric and its real methodology, T-Level's real current
coverage, and whether the old doc's outstanding UCAS Tariff primary-source question was ever
actually resolved in a later round -- say plainly if it's still open.

Also check vicdata_briefing_gcse_what_is_measured_v1.md and
vicdata_briefing_ks2_what_is_measured_v1.md -- the KS2 domain-comparison round and the GCSE
exclusion round both happened since these were written. Update if anything is now inaccurate or
incomplete; if still accurate, say so rather than rewriting for its own sake.

Build report: what moved to docs/archive/ in each repo (rough counts are fine, no need to
enumerate every filename), what was deliberately left at the top level and why, anything you
weren't sure about and left in place, and the refreshed/confirmed state of all three briefing
docs. Commit and push, both repos.
