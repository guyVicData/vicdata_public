Round 3 on Academic Results — Map (edit 2), Graphs (edit 1), Rankings (edit 1).
Full detail in docs/vicdata_phase3_academic_results_round3_map_graphs_rankings_brief_v1.md
— read it in full before starting. Map round 2 (commit bec66f8) is the
current baseline.

Two real decisions are already made (both confirmed directly with Guy, not
open questions): use real entries data for GCSE and Post-16 map/label
sizing (roll population stays for KS2 — DfE doesn't publish a cohort-size
figure for it), and the grade-band colour scale is value-based, normalised
to the real min-max range of whichever comparison set is currently active
(not rank position, not a fixed universal scale) — see the brief's own A1
and A2 for the full real grounding (which live DfE columns exist, which
don't, and why).

Part A (Map) needs one real ingest change before the frontend work: add
`pupil_count` to `dfe_ks4_headline.py` and `end1618_student_count` to
`dfe_ks5_headline.py`, then backfill both — real columns confirmed present
in the live DfE data sets via their own `/meta` endpoints, not currently
ingested. Everything else in Part A is frontend (colour scale, button
order/position, popup copy — exact target text is in the brief, item by
item per stage). Item A5 (Post-16's map trend/grade-band toggle not really
working today) needs real live investigation before fixing — the brief
names a likely cause but asks you to confirm it against real behaviour
first, not assume.

Parts B (Graphs) and C (Rankings) are additive UI work reusing Rolls' own
existing components directly — `SectionHeading` and `Card`/
`FullscreenChartModal` from `GraphsView.tsx` for Graphs' new accordion/
fullscreen structure, and Rolls' own existing headline-number/rank-table
computations (not new ones) for Rankings' four new tiles.

Local build/test only, no commit, push, or hosted/production changes,
same as every prior round — the ingest backfill included (verify real
before/after row counts, same discipline as prior ingest rounds, without
touching hosted). Full build report when done, naming every real design/
implementation judgement call and A5's actual root cause explicitly.
