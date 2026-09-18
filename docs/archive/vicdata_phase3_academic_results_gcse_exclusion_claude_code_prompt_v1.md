Read docs/vicdata_phase3_academic_results_gcse_exclusion_brief_v1.md in full and
execute it. This builds on top of the stage-1 fixes round already sitting uncommitted
in this working tree (report at
docs/vicdata_phase3_academic_results_stage1_fixes_build_report_v1.md) — Parts A, B, C
of that round (the map remount fix, the Category filter fixes, the tooltip fix) are
done and correct, leave them exactly as they are. This brief replaces only that
round's Part D: instead of showing a caveat alongside a misleading GCSE number for
IGCSE-heavy independent schools, those schools now get left out of GCSE comparison
entirely, with a visible explanation in place of both the number and (where relevant)
their spot in any group comparison. The exact wording is already settled in the
sibling `vicdata` repo's own
docs/vicdata_phase3_academic_results_summary_wordings_v1.md §11 — use it as written,
don't redraft it.

The gate itself changed from the version already in `igcseExclusionLikely` (drop the
`ebacc_94_percent` check, add an `establishment_type_group === "Independent schools"`
restriction) — the brief explains exactly why and gives you seven real schools with
their real figures to verify against (five should trigger exclusion, two — Crosfields
and Huntington School — should not). Re-run the same kind of real-execution check the
last round did, against all seven, not just the original three.

This round touches more surfaces than the last one (free card, Overview, Rankings,
Map, and now group/comparator-set behaviour, not just the target school), so take the
time to get the "one or more ticked schools excluded" and "whole group excluded"
cases right, not just the "school being viewed is itself excluded" case — the brief
has real wording for all three shapes.

If a browser tool is available this session (check at the start, same as always),
use it this time for a real visual check — this round is specifically about a group
note appearing correctly and a chart's composition actually changing, which a code
read alone can't fully confirm. If none is available, say so plainly rather than
implying a check that didn't happen.

Write up a full report in the same shape as every prior round. Build and test
locally only — do not commit, push, or touch hosted/production.
