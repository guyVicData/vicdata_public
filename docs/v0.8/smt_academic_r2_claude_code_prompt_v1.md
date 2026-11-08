# VicData 0.8 — SMT Academic round 2 (follow-ups to feat/smt-academic-modes)

Claude Code prompt for the app repo (`~/dev/vicdata_public`), with one small step in the ingest repo (`~/dev/vicdata`). Written 8 Nov 2026 from Guy's review of round 1: its report (`docs/v0.8/smt_academic_r1_report_v1.md`), its decision log (OPEN_QUESTIONS, the "0.8 SMT Academic by qualification" section, A1–A11, and the pills round's calls) and its screenshots. **Build on `main` if round 1 is merged; otherwise branch from `feat/smt-academic-modes`.** Save this prompt as `docs/v0.8/smt_academic_r2_claude_code_prompt_v1.md` in the round's first commit. Guy's live review comes after this round.

## Decisions (Guy, 8 Nov)

### A1 — Subject matches: approved, and into `subject_label_map`

- `docs/v0.8/va_subject_matches_draft.md` is **approved as it stands**, including **D&T Textiles Technology in Arts, Media & Design** (it follows the results file's own mapping, as Teacher shows it).
- **App:** set `VA_SUBJECT_MATCHES_STATUS = "approved"`; rename the doc to `va_subject_matches_v1.md` (approved), keeping the table; R-VA-SUBJECT-MATCH then reports approved.
- **Ingest (`~/dev/vicdata`), a small step:** add the approved matches to `subject_label_map` (value-added name → results name, per qualification where it differs; `note` "value-added name, approved 8 Nov 2026"), so the whole platform shares one crosswalk. Names with no results equivalent that get an area directly go to `subject_family_map` instead. Dry run first, then Guy's command to promote (the ingest's usual pattern). Report rows added.
- **Then the app reads the matches from the database** and `src/lib/smt/va-subject-matches.ts` goes. **Keep the file until the ingest step has landed;** R-VA-SUBJECT-MATCH checks the database and the file agree while both exist.

### A7 — Progress 8 sets keep Teacher's rule

No change: an 11–18 school's Progress 8 set stays the nearest 10 state schools matched by Teacher's phase rule (Leighton Park: 11–18 schools, reaching 5.3 km).

### Accepted as built

A4 (a nearest-10 set each for Applied general and Tech level), A5 (column 1's place uses the set in force; "your set" when chosen), A6 ("DfE headline type" where a school has both BTEC and OCR), A8 (Value added's row 2 has three panels), A11 (superseded by fix 1 below), and the pills round's three calls (Day and boarding uses the whole roll, as the census has no boarders by phase; "the set" is its middle school, single-sex and non-boarding schools left out, not counted as 0; "where it shifts" is Year 7 against Years 8–11 and the sixth form against Years 7–11). A2, A3, A9 and A10 are noted as reported (data gaps or build steps).

**Mark A1–A11 and the pills round's calls decided in OPEN_QUESTIONS**, each with Guy's answer.

## Fixes found in review (screenshots)

1. **One entry total per page.** Plumstead, Entries mode: column 1 reads 419 entries (A level 229) while the entries mix reads 381 for the same year (A11: the mix uses `bucket:*::entries`, column 1 the subject rollup). One source must drive column 1, the mix and every share on the page, so the totals agree. Say which and why in the report, and add a rule (R-SMT-ENTRIES-ONE-TOTAL) that the page's totals match.
2. **The subject-areas share bars share one scale.** Today each row's bar is scaled to its own row (Finance 18.6% draws the same length as Economics 4.3%). One scale for the whole view (to the largest share shown), the set's typical marker on the same scale.
3. **Value added trend chart (Leighton Park, A level):** the y-axis has no labels, and the grey band fills nearly the whole plot instead of the set's middle half (+0.07 to +0.36 in 2024/25). Labels on the axis; the band is the set's 25th–75th percentile, year by year, as on the board. Check every mode's trend chart for the same fault.

## Checks and the report

- The round-1 rule suite in full (it wasn't rerun after the last fix), plus R-SMT-ENTRIES-ONE-TOTAL; parity as round 1.
- Screenshots of the three fixes, before and after, real data, both themes.
- Report to `docs/v0.8/smt_academic_r2_report_v1.md`. **Don't merge:** push the branch and wait. The ingest step's promote command goes to Guy first.
