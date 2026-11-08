# VicData 0.8 — SMT Academic by qualification: Results · Entries · Value added (and the SMT pills off)

Claude Code prompt for the app repo (`~/dev/vicdata_public`). Written 8 Nov 2026 from the plan agreed with Guy and the mock-up he reviewed. Feedback items **F-44** and **F-45** (planned, "0.8 SMT academic"). **To land before the Leighton Park demo (27 Nov).**

## Read first

- **`docs/v0.8/smt_value_added_plan_v1.md`** — the plan. Every decision is in it, with who made it. **Where a board and the plan disagree, the plan wins.**
- **`docs/wireframes/smt-value-added/README.md`** and its boards (`*.dc.html`): specs to read, not pages to run. The README says which figures are mock-up stand-ins (sets by straight distance, region ranks, EPQ points, one column-1 "set's typical [x]%") and that `PM-Option2` was **rejected**.
- `docs/FEEDBACK.md`; F-44 and F-45 in full: `select * from feedback_for_triage where ref in ('F-44','F-45')` (read-only).
- The existing SMT code: `src/components/smt/`, `src/lib/smt/`, `src/catalogue/dashboards/smt.ts`, and Teacher's comparison-set and Candidates code, which this round reuses.

Commit the two docs folders (`docs/v0.8/` plan and this prompt, `docs/wireframes/smt-value-added/`) with the round's first commit.

## The work

### 0. Subject-name matches for value added — draft first, Guy checks (gate)

About a quarter of A-level subject value-added rows get no subject area today, because DfE's value-added file names subjects differently from the results file ("Government & Politics", "Art & Design (Fine Art)", "Computer Studies/Computing", …). Applied and other qualifications have more.

- **Draft** a match from every distinct value-added subject name (`dfe_ks5_subject_value_added`, all qualifications, both years) to the results file's name, through the existing crosswalk (`subject_label_map`), so the area follows from `subject_family_map`. Only names with no results equivalent get an area directly.
- Write it to **`docs/v0.8/va_subject_matches_draft.md`**: one table, value-added name · qualification · proposed results name (or "none") · area · how decided. Put the uncertain ones first.
- **Don't apply it to the database until Guy has checked it.** Build everything else against the draft (read from a local constant or file), so swapping in the approved list is a data change only.
- The (i) on every by-area view says which matches are VicData's.

This also fixes a **live bug**: Academic's value-added view at Post-16 with an area chosen silently drops those subjects.

### 1. The filter pills come off SMT

- **Remove both pills** (Pupils: All / Girls / Boys; Day and boarding) from every SMT dashboard. The control bar is the level chips and "Compared against". Remove `SmtFilters` threading that no longer has a consumer; keep `pillsFor` only if something else needs it.
- **Pupils gains "Girls and boys"** (mixed schools only): girls' share by year group; its change since `CENSUS_FIRST_PERIOD` against the set; where it shifts (Year 7, the sixth form). From the census's sex × single-age counts, which the school and every set school have.
- **Pupils gains "Day and boarding"** (boarding schools only): boarders' share by phase and over time, against the set's boarding schools.
- "The school now" keeps its Girls · Boys and Day · Boarding tiles.
- The three pill bugs go with the pills (scorecard roll rank on whole-school roll beside a girls' value; sex filter silently dropped under "Boarding only"; single-sex set schools counted as 0). Confirm none survives in the new views.
- **Admissions is unchanged** (`ADM_SEX_FILTER` stays).

### 2. Academic: the shell

- **SMT keeps four dashboards** — Overview, Academic, Pupils, Context. **No Value added dashboard.**
- **Level chips: GCSE and Post-16 only** — no "Whole school". Opens on the school's main exam level (the rule Overview's set uses; an IGCSE school's is Post-16). Old `?level=whole` addresses fall back to it.
- **Row 2** (the bar's `subRow`), left to right:
  - **the mode switch: Results · Entries · Value added**, held in the address (`?mode=`);
  - at **Post-16**: the **qualification-group chips**, only the groups the school offers: **All** (first, wherever the school offers more than one group) · A level · Applied · EPQ · Core Maths · AS · IB · T level;
  - at **GCSE**: the existing subject-area chips (Results and Entries); in Value added mode, a short line in their place saying DfE publishes no GCSE value added by subject.
- **Applied** = DfE's headline types, **Applied general** and **Tech level**: two lines in column 1, and a two-chip switch (Applied general · Tech level) above the chart, table and map. The individual qualifications and sizes appear only in the subject-areas view. The (i) says DfE sorts qualifications into the two types by subject, so one school's BTECs and OCRs can fall in both.
- **Comparison sets, per group:** each group's default is the **nearest 10 offering that qualification**, widening the net: Teacher's `findSurroundingSchools` plus its exact-qualification filter (the IB rule that finds 10 IB schools for Sevenoaks). The pill names it ("10 nearest offering IB") and changes with the group. **Once the SMT chooses a set, it holds across groups**; each view shows that set's schools offering the qualification and says so ("4 of 12 offer EPQ"). "Default" in the pill returns to per-group. No new chooser: Teacher's `PillMenu` and `ComparatorSetChooser`, as now.
- **With "All" chosen**, the trends follow the group with the most entries.

### 3. Academic: the views (all three modes)

- **Column 1 follows the level and the mode.** Never a Progress 8 line on a Post-16 view, never Post-16 lines at GCSE.
- **Large view rail at Post-16:** chart · ranking table · map · subject areas (by qualification) · grade profile (Results mode). Every view is about the chosen group. Subjects become the subject-areas view's rows; each subject is ranked **only against the same subject in the same qualification**.
- **Map:** the Overview `SetMap`, with a mode-aware colouring (below).
- **Row 2, trends:** (1) the chosen group's measure over time against the set's middle half, with a trend table; (2) every column-1 line's change since last year; (3) in Results and Entries modes, **entries mix by qualification group over time** (VicData's groups, `bucket:*::entries`). This replaces the never-built "results by band" panel.
- **Phone:** column 1, then the views as tabs, then row 2 as tabs (`Phone.dc.html`).

### 4. Results mode

- **Column 1, one line per group: points per entry with DfE's grade equivalent** (`<type>::aps_per_entry`, `<type>::aps_per_entry_grade`) and the place in that group's default set. A level, Academic, Applied general, Tech level, T level from DfE's headline; EPQ, Core Maths, AS and IB from the subject file and VicData's groups, as Teacher does.
- **EPQ points:** VicData doesn't hold them. The EPQ line says so plainly; don't invent a figure. Log it in `OPEN_QUESTIONS.md` as a data gap.
- **Top-grades share** (A*–A, Distinction*–Distinction, IB 6–7) appears in the views (grade profile, subject rows), never in column 1.
- Chart and map colour by **quarter within the set**; the chart marks the set's median. Results trends start at `TREND_BASE_PERIOD` (2021/22's grading), as now.

### 5. Entries mode

- **Ranked measure: the share of the school's entries at that level** (Teacher's measure), **always with the raw count beside it** ("Psychology 23 entries · 6%").
- **Size badge XS–XL for each subject's cohort, against England:** fifths of all schools entering that subject in that qualification, that year. Reuse the existing XS–XL badge. Pre-compute the cut points per subject × qualification × year; don't compute them per request.
- Chart and table rank the set by the chosen subject's or group's share; the map colours by it; the subject areas show each subject's count, three-year counts, size badge, share against **the set's typical share** (median of the set's schools offering it) and how many of the set offer it; trends show entries and share over time against the set, biggest moves, and where the mix differs most from the set (`AC-PM-Entries.dc.html`).
- Column 1 shows each group's entries and share, with the set's typical share.
- At GCSE the same, with subject areas as the chips.

### 6. Value added mode

- **Measures:** Progress 8 at GCSE (state schools, to `LAST_P8_PERIOD`); at Post-16, DfE's headline value added for A level, Academic, Applied general, Tech level, Technical certificate, and the subject file (`dfe_ks5_subject_value_added`) for EPQ, Core Maths, AS, IB and every by-area row.
- **Bands:**
  - DfE's own progress banding where DfE publishes it (the Post-16 headline types);
  - **Progress 8: DfE's five bands derived exactly from DfE's definition** (figure and 95% range; well above/below beyond ±0.5). The (i) says so;
  - **everything else: three labels from the 95% range — "Clearly above" (range entirely above 0), "In line" (range crosses 0), "Clearly below" (range entirely below 0).** Deliberately unlike DfE's five.
- **Chart:** ranked dot and 95% range per set school, yours highlighted, a line at 0, a faint England strip. **The axis fits the data** (today's ±1.2 clamp goes).
- **Ranking table:** figure, range, band, last year, change, place in set; above it the place in set, region and England, and "n clearly above / below average".
- **Map:** coloured by band; grey where not published.
- **Subject areas:** subjects by qualification, your dot over the set's dots, place among the set's schools teaching it. The EPQ sits outside areas. Not offered at GCSE.
- **No value added for a qualification** (T levels; anything DfE doesn't publish): the switch stays; the views say so, never hide.
- **Independent and IGCSE schools at GCSE:** the default set is the **nearest 10 state schools with Progress 8**; the school's own row says why it has none (no Key Stage 2 tests, so no starting point). If a chosen set has no state schools, a clear message sits in the middle of the chart, table and map (`LP-NoState.dc.html`).
- **Column 1 at GCSE:** Progress 8 with range, England place, the set's middle half and its three years; for an independent school, the explanation and a summary of the set's state schools.
- **Notes live in the (i)**, never as footer lines (F-45). Progress 8's gap ("stops at 2023/24: no KS2 tests in 2020 or 2021") and the absent 2021/22–2022/23 sixth-form value added come from `years.ts`. The 2025/26 sixth-form release (mid-November) must extend the trends with no code change: test it with the year rehearsal.
- Remove Academic's old single Value added view (`DV-SMT-A-VA`), and the subject value-added cut at 14 rows (show all, or "and N more").

### 7. Data and performance

- Every figure through existing reads where one exists; new reads only where none does (England fifths for entries; per-group sets). Say in the report which are new.
- Respect the 0.8 DB-performance round's rules: no per-request scans of `canonical_facts`; precompute or cache the set-and-group lookups.
- Years from `years.ts` only. R-SMT-YEARS must still find no year literal in SMT source.

## Rules and checks

- New rule tests, named in the catalogue: R-SMT-NO-PILLS, R-SMT-ACADEMIC-MODES, R-SMT-QUAL-GROUPS, R-SMT-GROUP-SETS, R-SMT-COL1-LEVEL (no Progress 8 on Post-16, no Post-16 at GCSE), R-SMT-VA-BANDS (P8 derivation and the three range labels, tested at each edge), R-SMT-VA-INDEPENDENT (state-school set; no-state-schools message), R-SMT-ENTRIES-SIZE (England fifths), R-VA-SUBJECT-MATCH (no value-added subject without an area once the list is approved; the draft is reported meanwhile).
- **Parity:** Teacher and Admissions byte-identical; Overview, Pupils and Context identical except the pills' removal and Pupils' two new views. Report the pairs.
- **Real-data checks**, each with figures in the report: Leighton Park (110110: independent, no P8, A level + BTEC + OCR + EPQ, IB entries ending in 2024/25), Acland Burghley (100053: state, P8, A level, applied, Core Maths), Sevenoaks (118952: IB only), Plumstead Manor (100183: applied-heavy, Applied general and Tech level both). The mock-up's figures are real; yours should match them where the set rule agrees.
- Pixel-perfect against the boards and the existing SMT conventions; both themes; 1440, 1280 and phone.

## Decisions and the report

- Log genuine decision points in `docs/OPEN_QUESTIONS.md`; don't resolve them by assumption. Stop only for real blockers.
- Report to `docs/v0.8/smt_academic_r1_report_v1.md`: what changed, what's new data, the parity and real-data results, the crosswalk draft's status, and screenshots of each board's counterpart.
- **Don't merge.** Push the branch and wait. If anything needs a migration, write and test it in PGlite and give Guy the command first, then the merge.
