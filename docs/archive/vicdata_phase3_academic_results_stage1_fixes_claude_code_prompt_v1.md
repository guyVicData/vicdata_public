Read docs/vicdata_phase3_academic_results_stage1_fixes_brief_v1.md in full and execute
it. This is the first batch of fixes from Guy's own structured 4-stage review of the
live Academic Results feature (stage 1: wiring/functionality) — every root cause in
the brief was already confirmed directly against the real code (diffed against Rolls'
own working MapView.tsx) and real hosted data (curled against the live
academic_headline_lookup RPC for the two real schools named in Part D) before it was
written. Don't re-litigate the diagnosis, but don't take it on faith either — confirm
it against the real code yourself as you go, the same discipline every prior round in
this project has used.

Do Parts A, B, C first — they're all small, well-scoped, and in the same two files
(AcademicMapView.tsx, AcademicDataView.tsx). Part D (the IGCSE caveat) touches
different files (wherever KS4 headline is rendered) and has its exact wording already
drafted in the sibling `vicdata` repo's own docs/vicdata_phase3_academic_results_summary_wordings_v1.md
§11 — use that wording as written, don't redraft it.

For Part A specifically: check a real browser tool is available and use it for a real
interaction test (load a school, switch Map → Graphs → Rankings → Map, confirm the map
and its markers are still there) rather than trusting the diff alone — this is exactly
the class of bug (Leaflet + React remount timing) that reads fine in a code review and
still fails live. If no browser tool is available, say so plainly rather than implying
a test that didn't happen, same as every prior round.

For Part D: the trigger condition is a real, checkable data signature (ebacc_94_percent
and engmath_94_percent both 0 with a non-trivial attainment8_average), not a hardcoded
list of school names — verify it fires for Leighton Park (URN 110110) and Wellington
College (URN 110125) and does NOT fire for a normal comprehensive with real EBacc
entries (pick any school you already know has real EBacc figures from earlier rounds,
e.g. Huntington School, URN 121673).

Write up a full report in the same shape as every prior round. Build and test locally
only — do not commit, push, or touch hosted/production. Guy will review these fixes
against the same sample schools before anything ships further.
