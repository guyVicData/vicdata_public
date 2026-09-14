Queue this one behind the GCSE exclusion round — do it once
docs/vicdata_phase3_academic_results_gcse_exclusion_brief_v1.md is fully built and
reported on. This new brief (docs/vicdata_phase3_academic_results_ks5_cohort_brief_v1.md)
is otherwise independent: it's KS5-only, the GCSE round is KS4-only, and neither
touches the other's files except both living in academic-data-view.ts (different
exports — no real conflict, but re-pull/re-read that file fresh before starting so
you're editing its current state, not a stale mental model from the other round).

Read the brief in full and execute it. It answers Guy's own flag directly — Capital
City College showing only A-level stats when most of its pupils do BTECs, and IB
schools apparently missing entirely — with real findings already confirmed before
writing it: both BTEC and IB data are genuinely in the ingested dataset already (BTEC
under DfE's own "Applied general"/"Tech level"/"Technical certificate" exam_cohort
values; IB folded into "Academic" alongside A-level/Pre-U/Extended Project/Core Maths,
confirmed against DfE's own official technical guidance). The real bug is a hardcoded
`HEADLINE_MEASURE.ks5 = "A level::aps_per_entry"` in academic-data-view.ts.

The brief also settles a previously-open question with a new real finding: DfE's raw
live CSV (fetched directly for this brief) has a genuine per-cohort entries-count
column, `aps_per_entry_student_count`, that dfe_ks5_headline.py never selected into its
own `_NUMERIC_COLUMNS`. Part 1 lands that column; Parts 2 and 3 use it to (a) auto-pick
each school's own real dominant KS5 qualification type for its single-school headline
stat, and (b) add an explicit, user-facing qualification-type selector wherever a
*group* of schools is compared (Rankings, Overview's spread/growth/trend sections,
Map) — this second part is what actually delivers the real BTEC-rankings/Academic-
(IB-inclusive)-rankings views Guy explicitly said he wants and has never seen
elsewhere, not just a display fix for one number.

Four real named schools anchor every verification step in the brief (Capital City
College 130421 — BTEC-dominant; Sevenoaks 118952 — Academic/IB-only, zero A-level;
North London Collegiate School 102257 — genuinely mixed; Leighton Park 110110 — small
real vocational minority alongside A-level) plus a control school for "nothing changes
for a normal A-level-only school." Re-run the same kind of real-execution verification
every prior round has used against all of them — don't rely on a code read alone for
Part 3's group-comparison behaviour, since that's exactly the class of thing ("does
the ranking's composition actually change when the selector changes, does the note
actually render") a diff can't confirm by itself.

New wording is needed (the brief specifies exactly what, including the one place —
labelling "Academic" honestly as an IB-inclusive-but-not-IB-only category — that needs
real judgement, not mechanical templating) — draft it into a new §13 of vicdata's own
docs/vicdata_phase3_academic_results_summary_wordings_v1.md, matching that doc's
existing house style and §11's own already-settled group-note pattern, rather than
inventing a new shape.

Write up a full report in the same shape as every prior round. Build and test locally
only — do not commit, push, or touch hosted/production. Guy will review Capital City
College, Sevenoaks, and NLCS himself before anything ships.
