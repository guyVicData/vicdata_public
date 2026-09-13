Read docs/vicdata_phase3_academic_results_frontend_build_report_v1.md (round 1's own
report) in full, then read
docs/vicdata_phase3_academic_results_frontend_round2_brief_v1.md in full and execute
it. This builds directly on round 1's own still-uncommitted working tree — don't redo
what round 1 already did, and don't take its report's claims on faith, check the real
code the same way you'd check anyone else's.

Do Part A (the census double-fetch perf fix) first — it's small and self-contained.
Then B, then C, prioritised in that order — if C's subject-level depth doesn't fully
fit in this round, land B completely and get as far into C as you honestly can, and say
exactly where you stopped, rather than rushing a shoddy version of both.

The minimum-N judgement call in Part C needs real evidence from the real ingested data,
not a round number picked without looking — show your work.

Part D is read-only investigation — confirm what going live would actually require,
do not apply any migration or deploy anything.

Check at the start of this session whether a browser tool is available and use it for a
real visual check of what you build if so; if not, say so plainly the way round 1 did,
don't imply a browser test that didn't happen.

Write up a full report in the same shape as every prior round. Do not commit or push,
and do not touch hosted/production in any way — build and test locally, write up the
report, and stop there.
