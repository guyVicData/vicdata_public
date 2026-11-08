# VicData 0.8 — SMT Academic by qualification: Results · Entries · Value added, and the SMT filter pills: plan (v1)

Agreed with Guy, 8 Nov 2026, from feedback items F-44 and F-45 (Acland Burghley, SMT Academic) and his review of the SMT gender pill. **Not yet built.** Mock-up: the Design canvas "VicData SMT — Value added and Academic mock-up" (https://claude.ai/artifact/LAtoEbQyvcPSa8eP1odU6L), exported to `docs/wireframes/smt-value-added/` (see its README). **Where a board and this plan disagree, the plan wins.**

## 1. The filter pills come off SMT

**Why:** the Girls/Boys pill filtered only the roll figures (about a third of Overview and Pupils), showed on Academic where nothing can be split, and had three bugs:
- the scorecard Roll row showed girls' (or boys') roll but ranked whole-school roll;
- Girls + "Boarding only" silently dropped the sex filter (the census has no boarders-by-sex);
- single-sex schools in the set counted as 0 in the set's girls or boys average.

**Decided:**
- **Both pills (Pupils: All / Girls / Boys, and Day and boarding) come off every SMT dashboard.** The control bar is the level chips and "Compared against".
- **Gender shown as content:** Pupils gains a **"Girls and boys"** view (mixed schools): girls' share by year group, its change since 2019/20 against the set, where it shifts (Year 7, the sixth form).
- **Boarding shown as content:** Pupils gains a **"Day and boarding"** view (**boarding schools only**): boarders' share by phase and over time, against the set's boarding schools.
- "The school now" keeps its Girls · Boys and Day · Boarding tiles.
- Admissions keeps its own sex filter (`ADM_SEX_FILTER`): there the question really is recruiting girls or boys.

## 2. Value added: a mode of Academic

**SMT keeps four dashboards: Overview, Academic, Pupils, Context** (Guy, 8 Nov, from the mock-up — reversing the earlier "own dashboard" decision, because the two designs converged). Academic's row 2 carries a **Results · Entries · Value added** switch beside the qualification chips; value added uses the same level chips, qualification groups, comparison sets, views and trends as results (§3). Academic's single Value added view goes (F-44, F-45 fold into this). This section records what's specific to value added.

### What exists (checked 8 Nov)

- **Progress 8:** state schools, 2021/22–2023/24 (~3,600 a year); none since; none for independents. No P8 banding is stored, but DfE defines it from the figure and its 95% range, so it can be derived exactly (say so in the (i)).
- **Post-16 headline value added** (with DfE's progress banding), 2023/24 and 2024/25: A level ~2,500 schools, Academic ~2,500, Applied general ~1,900, Tech level ~600, Technical certificate (L2) ~160. Independents included. 2025/26 due mid-Nov.
- **Subject value added** (`dfe_ks5_subject_value_added`), ~50 qualifications: A level (61 subjects), BTEC Nationals, OCR Cambridge Technicals, VRQ, EPQ (~1,600 schools), Core Maths, AS, IB components (~50 schools). Each row is subject × qualification, with an "All subjects" row per qualification.
- **No T-level value added** (attainment only, 219 schools in 2024/25). Named in the (i).
- **No GCSE subject value added** — DfE has never published it.
- Found in the mock-up: DfE's headline types don't follow the qualification. At Leighton Park the BTEC Extended Certificate is Tech level and the OCR Extended Certificate is Applied general.

### Decided

- **Level chips: GCSE and Post-16 only, for all of Academic** — no "Whole school" (Guy, 8 Nov). Opens on the school's main exam level (the rule Overview's set uses).
- **Column 1 follows the level chip and the mode** (Guy, 8 Nov, from the mock-up; replaces "column 1 is the whole-school summary"). In Value added mode: at Post-16 one line per qualification group the school offers (figure, band, place in that group's default set); at GCSE Progress 8 only, with its range, England place, the set's middle half and its three years. No Progress 8 on a Post-16 view. For an independent school at GCSE, column 1 explains why there's no Progress 8 and summarises the set's state schools.
- **At GCSE in Value added mode** the subject-area chips don't apply (no GCSE subject value added): row 2 says so in place of the chips.
- **Row 2 chips at Post-16 are the qualification groups** (only those the school offers): **All** (first, wherever the school offers more than one group) · A level · Applied (BTEC Nationals, OCR Cambridge Technicals, VRQ) · EPQ · Core Maths · AS · IB. The group drives the chart, table, map, trends and its default set. Subject areas live inside the "By subject area" view. **"All"** (Guy, 8 Nov) opens the by-subject-area view across every qualification, sorted by qualification within each area; with "All" chosen the trends follow the group with the most entries.
- **The applied group uses DfE's headline types — Option 1** (Guy, 8 Nov, from the mock-up: "much cleaner"): column 1 shows **Applied general** and **Tech level** as two lines, each with DfE's band; under the Applied chip the views carry a two-chip switch (Applied general · Tech level) above the chart, table and map. The (i) says DfE sorts qualifications into the two types by subject, so one school's BTECs and OCRs can fall in both. The individual qualifications and sizes (BTEC Diploma, OCR Extended Certificate, …) appear only in the "By subject area" view, as its qualification sub-heads.
- **Bands:**
  - DfE's own band where DfE publishes one (its Post-16 headline types: A level, Academic, Applied general, Tech level, Technical certificate).
  - Progress 8: DfE's five bands, derived exactly from DfE's definition (figure and 95% range); the (i) says so.
  - **Everything else** (EPQ, Core Maths, IB, every qualification in the by-area view): **three labels from the 95% range** (Guy, 8 Nov): **"Clearly above"** (range entirely above 0), **"In line"** (range crosses 0), **"Clearly below"** (range entirely below 0). Deliberately unlike DfE's five, so they're never mistaken for DfE's.
- **Large view rail:**
  - **Chart:** ranked dot-and-95%-range, one row per set school, yours highlighted, a line at 0, a faint England strip. The axis fits the data (no clamping).
  - **Ranking table:** figure, range, band, last year and change, place in set; above it the place in set, region and England, with "n clearly above / below average".
  - **Map:** the set's schools coloured by band (grey where not published) — the Overview SetMap with a value-added mode.
  - **By subject area:** each area, its subjects categorised by qualification (e.g. Business & Law: A-level Business, A-level Economics, BTEC Business); each row your dot, the set's dots and your place among the set's schools that teach it. The EPQ sits outside subject areas. Not offered at GCSE (no subject value added).
  - **No value added for a qualification** (T levels; anything DfE doesn't publish): the switch stays, and the views say so, never hide.
- **Row 2 (trends):** the chosen group's value added over the years against the set's middle half (with a trend table), and every line's change from last year.
- **Comparison sets:** each group's **default is the nearest 10 offering that qualification**, widening the net (Teacher's rule, reused: `findSurroundingSchools` + exact-qualification filter). The pill names it ("10 nearest offering IB") and changes with the group. **Once the SMT chooses a set it holds across groups**; each view shows the set's schools offering that qualification and says so ("4 of 12 offer EPQ"). "Default" in the pill returns to per-group.
- **Independent and IGCSE schools at GCSE:** the views show the set's **state schools' Progress 8**; the school's own row says why it has none. If the chosen set has no state schools, a clear message sits in the middle of the chart, ranking and map saying why there's no data.
- **Subject areas for the unmatched value-added subjects** (~a quarter of A-level subject VA rows today — Politics, Computing, Fine Art, PE, Product Design, Photography, Drama, …; plus applied labels): **match each value-added subject name to the results file's name through the existing subject-name crosswalk** (`subject_label_map`), so the area follows from `subject_family_map` and value added joins to each subject's results. Only names with no results equivalent get an area directly. Claude Code drafts the full list; **Guy checks it before it goes in**; the (i) says which mappings are VicData's.
  - This also fixes a **live bug**: at Post-16 with an area chosen, Academic's value-added view silently drops those subjects.

## 3. Academic by qualification (Post-16): results and entries

Guy, 8 Nov: "academic results — let's do that as well", and: "the relative popularity of subjects and subject areas and the trends are as important as grades for SMT allocating resources."

### What's wrong today

- "The level now" at Post-16 shows **A-level points per entry only**: a school whose Post-16 is mostly applied, or IB only (Sevenoaks), gets almost nothing. DfE publishes points per entry for Academic, Applied general and Tech level too, and VicData holds its own groups' points and entries (`bucket:alevel`, `bucket:btec_ocr`, `bucket:ib`, `bucket:tlevel`, `bucket:other`).
- The subject-area chips and subject tables **mix qualifications** (A-level Business and BTEC Business in one area total); BTECs aren't ranked.
- **One comparison set** for every qualification.
- **Entries are shown only as the school's own counts**, never against other schools, though Teacher already compares them three ways (other subjects, LA/region/England, the comparison schools).

### Decided

- **Post-16 row 2 chips are the qualification groups, as on Value added:** **All** · A level · Applied · EPQ · Core Maths · AS · IB · **T level** (T levels have results, though no value added). Only the groups the school offers. **GCSE keeps its subject-area chips** (GCSE results are almost all one qualification).
- **Column 1, one line per group:** **points per entry with DfE's grade equivalent** (e.g. "A level 38.4 · B", "Applied general 31.2 · Distinction−") and the place in that group's default set. DfE's headline figures for A level, Academic, Applied general, Tech level and T level; EPQ, Core Maths, AS and IB from the subject file / VicData's groups as Teacher does. **VicData doesn't hold EPQ points yet**: the build says so on the EPQ line rather than inventing a figure. The **top-grades share** (A*–A, Distinction*–Distinction, IB 6–7) appears inside the views (grade profile, subject rows), not in column 1.
- **Applied: the same split as Value added** (Applied general · Tech level, DfE's headline types). **Comparison sets: the same rule as Value added** (each group's default is the nearest 10 offering it; a chosen set holds across groups).
- **Large view rail at Post-16:** the same four as Value added — **points chart** (the set's schools ranked; quarters within the set; the set's median), **ranking table**, **map** (coloured by quarter within the set), **subject areas** broken down by qualification (subjects as its rows; each subject ranked only against the same subject in the same qualification) — **plus the grade profile**. Every view is about the chosen qualification group.
- **Row 2 (trends), three panels:**
  1. the chosen group's **points per entry over time** against the set's middle half (results from 2022/23, as now: 2021/22's generous grading);
  2. **every line's change** since last year, as on Value added;
  3. **entries mix by qualification group over time** (the share of entries that are A level, applied, IB, …), which matters as BTEC funding is withdrawn.
  This replaces the never-built "results by band" panel; entries by subject area move into the subject-areas view.
- **The mode switch — Results · Entries · Value added** (Guy, 8 Nov) — sits **on row 2, left of the qualification chips** (Guy: the top row was getting too complex). Results · Entries is Teacher's pattern; on every Academic view at both levels:
  - **the ranked measure is the share of the school's entries** at that level (Teacher's measure, so SMT and teachers see the same numbers), **always with the raw count beside it** ("Psychology 23 entries · 6%"), because staffing works from counts;
  - **a size badge, XS–XL,** for each subject's cohort, **against England**: fifths of all schools entering that subject in that qualification (stable; works for rare subjects). The badge reuses the existing XS–XL look;
  - in Entries mode: the chart and table rank the set by the chosen subject's or group's share; the map colours by it; the subject areas show each subject's share against **the set's typical share** and how many of the set's schools offer it; the trends show entries and share over time against the set;
  - column 1 adds each group's entries and share.

## 4. Smaller items found in review

- The value-added range bar is fixed at ±1.2 and pins anything beyond to the edge without saying so.
- Subject value added is cut at 14 rows with no "and N more".
- (Moot once the pills go) the pill choices weren't held in the address.
