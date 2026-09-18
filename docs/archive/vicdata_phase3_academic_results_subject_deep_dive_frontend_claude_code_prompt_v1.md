Read docs/vicdata_phase3_academic_results_subject_deep_dive_frontend_brief_v1.md in
full and execute it. Three parts: closing the subject-mode comparison-set gap the last
round deliberately deferred, a richer single-subject deep-dive view, and a new
navigation design (a breadcrumb-oriented drawer, reasoned through and chosen over two
other real options in the brief — read that reasoning, it's not an arbitrary pick) to
reach it.

**Check whether vicdata's own companion round (subject_deep_dive_backend_brief_v1.md,
same session) has landed before starting Part 1's real-average-point-score piece and
Part 2's grade-distribution/trend-line content** — those specifically depend on the new
academic_subject_headline RPC and the promoted historic data. If it hasn't landed yet,
build everything that doesn't depend on it first (the batched comparator fetch itself,
the drawer UI, the breadcrumb, wiring in KS5's existing value-added data, which is
already available today) and say plainly what's blocked on the backend round rather
than stubbing in fake data or skipping ahead with guesses about the new RPC's shape.

Build in the order the brief lays out its three parts — Part 1 first (it's the
continuation of exactly what the last round already scoped and stopped at), then Part 2
(reuses Part 1's own data shape for one subject instead of many), then Part 3 (the
drawer is the vehicle for Part 2's content, build it once Part 2's content actually
exists to put in it).

Reuse existing components wherever the brief says to — SubjectAreaBarChart,
SubjectAreaDivergingBarChart, whatever Part 1 builds for the comparison-set side, the
existing SubjectTable's value-added rendering — rather than rebuilding chart types that
already exist elsewhere in this file. The point of Option C over Option B in the
brief's own navigation reasoning was reusing this exact machinery; building the drawer
as a parallel implementation would undo that reasoning.

Check at the start of this session whether a browser tool is available and use it for a
real visual/interaction check of the drawer (open it, check the breadcrumb navigates
correctly both directions, check closing it returns you to where you were) — this is
new interactive UI, more worth a real check than most rounds; say plainly if no browser
tool is available rather than skipping the check silently.

Full build report, same shape as every prior round, including what's blocked on the
backend round if anything is. Commit and push per the normal working pattern once
verified, small real commits per logical piece.
