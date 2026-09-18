Stage 2 of Guy's own review (UI/UX) is up next, now that stage 1 (wiring/
functionality) is confirmed live and correct. This is a real, fairly large batch of
UI/UX feedback gathered live against vicdata.co.uk — every item in the brief
(docs/vicdata_phase3_academic_results_stage2_ux_fixes_brief_v1.md) was traced to its
actual root cause in the code before being written up, not guessed at, so read it in
full and build against the causes named, not just the symptoms.

Eleven numbered items, roughly three groups: (1) a stage-tab rename plus three real
visibility/ordering/positioning fixes (items 1-5); (2) a confirmed parity gap between
Academic's Map view and Rolls' own Map view — the switcher, key, category filter, and
zoom/fitBounds all trace back to the same root cause (Academic's Map never got the
overlay-on-canvas treatment Rolls' `MapView.tsx` already has) — items 6-9; and (3) a
real bug in the KS5 qualification-type selector's default behaviour plus a genuine
comparator-set-sizing gap, items 10-11, developed against two real named schools
(Acland Burghley — dominant cohort "Academic" but zero real IB entries; Sevenoaks —
real confirmed IB).

Item 11 explicitly says: reuse `surrounding-schools.ts`'s existing `findSurroundingSchools()`
nearest-10-with-guaranteed-10 logic rather than building new selection logic from
scratch — this principle already exists in the codebase for Rolls' own default
comparator list, this is applying the same discipline to academic qualification-type
filtering, not inventing something new.

Item 10 needs real design judgement on how a mixed-metric (each school on its own
dominant cohort) default view actually charts — make a real call, name it plainly in
the build report, don't resolve it silently. Item 11's own note about KS4 GCSE
exclusion is a real, open, unresolved question for Guy — do not touch this morning's
KS4 exclusion mechanism as part of this round.

Re-verify with real execution against Acland Burghley (100053) and Sevenoaks (118952)
specifically once built — both are real, load-bearing examples the brief was written
against, not placeholders. In particular, confirm directly that selecting "A level"
on Acland Burghley's map no longer goes empty, rather than assuming item 11 fixed it
by inspection alone.

Local build/test only, same discipline as every prior round — do not commit, push, or
touch hosted/production. Full build report in the usual shape when done.
