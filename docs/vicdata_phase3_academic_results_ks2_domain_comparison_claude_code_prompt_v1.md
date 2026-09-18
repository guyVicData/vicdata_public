Read docs/vicdata_phase3_academic_results_ks2_domain_comparison_brief_v1.md in full
and execute it. This replaces Section 03's current KS2 placeholder ("KS2 is assessed
by domain, not subject...") with real content: domain standing in for subject as the
comparison axis, same Card-row shell the GCSE/A-level subject engine already uses.

Start by confirming the five real `subject` strings this brief guesses at (Reading,
Writing, Maths, GPS, Science) against real ingested `dfe_ks2_attainment` rows — only
"Reading, writing and maths" is already confirmed live in the codebase. Don't assume
the brief's guesses are exact; check.

This should be achievable as a vicdata_public-only round — the brief explains why
(dfe_ks2_attainment is already fully ingested on hosted production, and the batched
multi-URN lookupReferenceData call this needs already exists and is already used for
the KS2 whole-school headline). If you find a real reason new backend work is needed
after all, say so plainly rather than forcing a workaround, but this shouldn't be
expected.

Build the six real design decisions in the brief as specified — no Candidates row,
the richest-available metric leading per domain rather than one uniform metric
(scaled score for Reading/Maths/GPS, % expected standard for Writing/Science/RWM
combined — six rows will genuinely show two different kinds of number, label units
clearly per row so this reads as intentional), higher_standard_pupil_percent and the
progress-measure CI as real supporting figures rather than separate rows, a new
participation/access row from the absence/disapplied percentages, no drawer or third
level. These were confirmed directly with Guy this session, not left for you to
re-derive — build what's specified rather than substituting your own judgement on
these particular points.

Full build report, same shape as every prior round: real data verified against a real
school and its real comparison set (Acland Burghley or Upton Court Grammar, whichever
has cleaner KS2 data if either is a primary/through-school, otherwise find a real
primary school), not just code inspection. Commit and push once verified.
