Read docs/vicdata_phase3_academic_results_frontend_build_brief_v1.md in full and
execute it. Before starting, confirm the real dependency the brief itself now spells
out: that academic_headline_lookup/academic_subject_family_lookup/
academic_geography_lookup exist as callable RPCs granted to anon in vicdata, and that a
real test call from vicdata_public actually returns rows — not just that the underlying
tables exist in vicdata's database (they grant select to authenticated only, so table
existence alone doesn't mean vicdata_public can read them). If that RPC bridge isn't
built and working yet, stop and say so rather than building against a guessed shape.

Read the brief's own "Read this first" section in full, including the real front-end
spec and sentence-wording docs it names, before writing any code. This round covers
both the free State of School "Academic snapshot" card and the whole paid Member Data
View "Academic" tab (Map, Graphs, Rankings, comparator-set re-pointing), across all
three key stages (KS2, KS4, KS5) together — not a phased/GCSE-first build.

Write up a full report in the same shape as every prior round. Do not commit or push —
build and test locally, write up the report, and stop there.
