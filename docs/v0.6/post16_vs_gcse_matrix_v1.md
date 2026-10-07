# Post-16 against GCSE: the views matrix (0.6.4 Part B)

**Audit only. No code or data was changed.** Spec: Part B of `docs/v0.6/vicdata_0_6_round4_tables_post16_speed_claude_code_prompt_v1.md`. Branch `v0.6.4`, 7 Oct 2026.

**How this was checked**
- **Code:** read on the branch. Every claim cites file:line. Searches covered the whole of `src/`, not one folder.
- **Data:** read-only, through the app's own fetchers (`fetchSubjectLevelDataForSchools(..., "ks5", { gradeYears: "four" })`, `fetchSubjectQualificationHeadlineForSchools`, `fetchSubjectHeadlineForSchools` with every bucket, `fetchSchoolGradeRows`, `lookupAcademicSubjectQualificationGeography`, `lookupAcademicSubjectGradeGeography`, `resolveDefaultNearest`). Anon keys only.
- **Scripts and raw output:** the session scratchpad, `b_audit/` (`p1`–`p6`, `results.md`). They are not committed. Ask if you want them under `docs/v0.6/audit_scripts/`.
- **Nothing was rendered.** The live page is gated, and no harness was run for this pass. Where the doc says a view "shows X", it is read from the host code and the data, not a screenshot.
- **Years:** "2021" means 2021/22, and so on to 2024/25, the latest year.

---

## Headline findings

**The config already matches.**
- One function builds all four Teacher dashboards (`src/catalogue/dashboards/teacher.ts:147-201`), from one `VIEWS` table (`teacher.ts:38-76`).
- All 40 dataviews list both phases (`phases: PHASES`, `src/catalogue/dataviews.ts:21`).
- The variant axes (Results pill, Compare against, comparator kind) have no phase axis (`src/catalogue/variants.ts:35-39`).
- So **rail order, defaults and titles are already the same on paper.** Every real difference comes from a host rule, a phase-gated lib rule, or the data.
- I couldn't read the *published* configs: the anon key sees "no stored dashboard", which is presumably RLS. Not verified that the published versions still match the code copy.

**What can't match, and why:**

1. **BTEC / vocational points for 2021/22 and 2022/23 are 0.00, not missing.** This is a data fault, and the biggest finding.
   - At Croydon 130432 Business Studies, every BTEC size has 0.00 in 2021 and/or 2022: the school's own rows, England's rows (all sizes) and the comparators' `btec_ocr` bucket rows.
   - `subjectPointsAt` and `latestOwnPoints` drop only nulls (`src/lib/teacher-view-measures.ts:64-80`). So the points trend and the Area chart draw false zeros, and Comparisons' 4-year line runs through them.
   - Only 2023/24 and 2024/25 are real. Most likely the ingest scores the historic short codes (`* D M P`) without mapping them first. That cause is not verified.

2. **Grade bands has no Post-16 default range.**
   - GCSE opens on 7–9 (`src/lib/teacher-view-measures.ts:189-190`).
   - Post-16 has no presets on any scale (`src/lib/subject-grades.ts:232-236`). So Column 1 Current says "Pick a grade range…" in every view (`SubjectPanels.tsx:591-594`), and Context and Comparisons fall back to points (R-MEASURE-FALLBACK).
   - This is by design (0.6.3 S3 #7). The result is that Grade bands opens empty at Post-16.

3. **A*–E scores A-level-scale qualifications only** (R-GRADE-SCALE-MATCH). BTEC, IB, T Level and Pre-U get the note "A*–E applies to A levels…" on all three columns (`TeacherDashboard.tsx:1726-1727, 2012, 2220, 2296`).
   - Core Maths and EPQ are graded A–E, so they *are* scored as A*–E: 93.8% and 100% at King's 117037 in 2024. That is a design question for you.

4. **Comparisons and both school maps use bucket figures at Post-16. Column 1 uses the exact qualification.**
   - The map chip is keyed by bucket (`TeacherDashboard.tsx:1121-1129, 1152-1156`), and comparator series read the bucket rows (`TeacherDashboard.tsx:1571-1583`; `academic-data-view.ts:155-161`).
   - Real gaps between the bucket figure and Column 1's figure:
     - Croydon Maths 2024: A-level bucket 21.45 against A level 24.00 (AS blended in).
     - Croydon Business 2024: BTEC bucket 25.00 against five sizes at 16.67–27.64.
     - Sevenoaks Maths 2024: IB bucket 46.76 against HL 49.07 and SL 41.17.
   - They match only where the bucket holds one qualification: King's Maths, and T Level Health at 130416.
   - This works against R-POINTS-SAME-QUAL ("KS5: bucket or exact qualification").

5. **An AS focus on points:**
   - Comparisons gives way to a note (0.6.3 S3).
   - **Column 1's Trend map does not.** It plots the A-level bucket, A level and AS together, for every school (`TeacherDashboard.tsx:1673-1717`). This is an accident.
   - The note's wording is also wrong. It names the bucket ("…published for A-level on its own, only with A levels", `TeacherDashboard.tsx:2285`), because `qualificationShortLabel` returns the bucket label at Post-16 (`teacher-view-theme.ts:99-100`). Map legends do the same: "Law (A-level)" for an AS item (`TeacherDashboard.tsx:1137`). Also an accident.

6. **The IB Diploma total is not a subject** (R-IB-NONSUBJECT, `teacher-view-populations.ts:36`). It has no Teacher view at all. It has grade rows (24–45) but no points and no area rows (118952).

7. **The whole-school headline at Post-16 is A-level points per entry** (`academic-data-view.ts:245, 251`). It drives Comparisons' ranking Number tiles and every view with no subject chip.
   - An IB-only school or an FE college without A levels gets no headline. This was already logged in 0.6.3: "a BTEC-only college shows hollow".

8. **The default comparator set is the same 10 nearest schools as at GCSE.** It is not filtered to schools with a sixth form (`default-comparator-lists.ts:728-744`; FE colleges get the nearest 10 FE colleges, `:693`).
   - With the same qualification in 2024, few remain: 3 for King's A-level Maths (2 with grades), 1 for Sevenoaks IB, 0 for Croydon AS Law, and 0–4 per BTEC size.
   - Rankings and maps are therefore thin at Post-16. This is a data limit plus a design choice.

9. **Few Post-16 qualifications have 4 real years, so many show bars, not lines** (R-TREND-LINE-4YR).
   - T Level has 2 years at most (2023–2024).
   - BTEC has 2 real years (point 1).
   - A level and IB have 4 years, so they match GCSE.

10. **Area chart / Change table have figures only for qualifications DfE scores.**
    - Post-16 offers the area views for every qualification (`teacher-view-geography.ts:57-59, 66-68`). GCSE offers them for GCSE Full Course only.
    - EPQ, Core Maths, VRQ, AEA and Pre-U have no area rows, so those views say so.
    - LA rows are missing in London for every family checked.

11. **T Level works only where DfE publishes per-pathway grades.**
    - Christ The King 130416 does (Health 2023–2024).
    - Croydon 130432 has T Level entries but grades only under "All subjects" and no points, so every Results view is empty. That is a data limit; my guess is small-cohort suppression (not verified).

12. **Pre-U and FSMQ are effectively gone.** No 2024 entries at Eton 110158 or Winchester 116532, so they are never in the picker. I found no AEA item.

**What does match:** A level, at King's 117037, works on every view as GCSE does, with real figures from 2021 to 2024. IB subjects (HL/SL) match too, apart from A*–E and the bucket blend.

---

## B1. The matrix

### How to read it

- **Rail:** the views in the order the member sees them, after the host has dropped any it can't draw (`src/components/dashboard-config/rail.tsx:68-76`). Default views are in **bold**.
- **Titles:** the view's title, from its `titleTemplate` (`dataviews.ts`) and the host's own `ViewTitle`.
- **Where Post-16 differs** it says so, with the cause:
  - **D** = design;
  - **L** = data limit;
  - **R** = a rule (named);
  - **A** = accident.
- **Wording that changes in every row at Post-16:**
  - "A*–E rate" for "Grade 4+ rate" (`teacher-view-panels.ts:115-117`).
  - "students" for "pupils" (`TeacherDashboard.tsx:1824`).
  - The headline label "average points per A-level entry" for "Attainment 8 average score" (`academic-data-view.ts:248-252`).
  - Bars run on a 0–60 scale, not 0–9 (`teacher-view-panels.ts:107-109`).
  - A subject the school runs in more than one qualification is labelled "Subject (qualification)" (`teacher-view-populations.ts:55-57`).
  - Map legends read "Subject (bucket label)" (`TeacherDashboard.tsx:1137`).

### Column 1, Candidates (CandidatesPanels)

| Panel | GCSE rail · default · titles | Post-16 today | Difference | Why |
|---|---|---|---|---|
| Current | Number tiles only (no rail) · **Number tiles** · "[subject] Candidates: [year]" (`teacher.ts:40-42`) | Same | None | n/a |
| Trends | Indexed · Actual · Trend table · Area chart · Change table (`CandidatesPanels.tsx:302-304, 395-398`) · **Indexed** · "Entries in [category]", "…, year by year", "[subject] against its LA and England, year by year", "[subject]: change against its LA, region and England" | Same rail, default and titles | (1) The Area chart and Change table are offered for every qualification, not only GCSE Full Course (`teacher-view-geography.ts:57-59`). EPQ, Core Maths, VRQ and AEA show the "no area rows" note. (2) Actual and the Trend line disable below 4 years (T Level). | (1) D, R-GEO-APPLIES (Post-16 Part C); the gaps are L. (2) R-TREND-LINE-4YR, L |

### Column 1, Results on Average points, A*–E and Grade bands (SubjectPanels)

| Panel · measure | GCSE rail · default · titles | Post-16 today | Difference | Why |
|---|---|---|---|---|
| Current · Average points | Number tiles · Bar chart · Sortable table (`SubjectPanels.tsx:551-566`) · **Number tiles** · tiles untitled; bars and table "Results in [category]" | Same | The England tile, marker and "vs National" use the exact subject × qualification (`teacher-view-measures.ts:107-118`). None for EPQ, Core Maths, VRQ, AEA or Pre-U. BTEC 2021–2022 are 0.00. | R-KS5-ENGLAND-EXACT (D); L (BTEC zeros) |
| Current · A*–E | Same rail · **Number tiles** · same titles | Same rail | On a non-A-level-scale focus (BTEC, IB, T Level, Pre-U) the figure is blank and a note sits on the card (`TeacherDashboard.tsx:1726-1727, 2012`). Core Maths and EPQ are scored. | R-GRADE-SCALE-MATCH; the note is 0.6.3 S3 (D) |
| Current · Grade bands (range) | Number tiles · Grade distribution · Bar chart · Sortable table · **Number tiles** · tiles, "Results in [category]" | Same once a range is picked | GCSE opens on 7–9. **Post-16 opens with no range**: every view except Grade distribution says "Pick a grade range from Grades ▾…" (`SubjectPanels.tsx:591-594`). | D: no Post-16 presets (`subject-grades.ts:232-236`; `measures.ts:103` "No presets: custom range only") |
| Current · a single grade | As bands | As bands | As bands (one grade is a range whose top and bottom are the same) | as above |
| Trends · Average points | Chart · Trend table · Map · Area chart · Change table (`SubjectPanels.tsx:839-841, 979-982`) · **Chart** · "Results in [category]: each subject's line", "…, year by year", "Change in [subject] [measure] since [year], by school", "[subject] against its LA and England…" | Same rail | (1) The Map uses bucket figures (A level + AS; all BTEC sizes; IB HL + SL), not Column 1's exact ones. (2) An AS focus's Map plots the A-level bucket with no note. (3) BTEC's line goes through 0.00 in 2021–2022. (4) T Level has 2 years: no line, a ranked change list instead. | (1) D, against R-POINTS-SAME-QUAL. (2) A. (3) L. (4) R-TREND-LINE-4YR |
| Trends · A*–E | Same rail · **Chart** · same | Same | The Area chart and Change table show the not-applicable note at both phases. Map rates come from exact-qualification grade rows (match Column 1). Non-A-level focus: note. | R-NO-GRADE-RATE-GEO; R-COMPARATOR-RATE-PER-QUAL |
| Trends · Grade bands / single grade | Same rail · **Chart** · same | Same rail, but no range on first visit, so nothing to plot until one is picked (not verified how the empty chart draws) | Default range | D (no presets) |

### Column 1, Results on Grade counts (GradeCountsPanels)

| Panel | GCSE | Post-16 today | Difference | Why |
|---|---|---|---|---|
| Current, nothing selected | Grade distribution (no rail) · tag "Grade counts [year]" · England ticks | Same | The scale comes from the qualification (T Level → its own scale, `subject-grades.ts:130-133`). England ticks only where grade geography exists. | R-SCALE-FROM-QUAL; L |
| Current, a selection | Same, plus the answer line ("A*: 23% of entries (8) · England 18%") | Same | None in shape. England is left off when partial. | R-ENGLAND-GRADED-ONLY |
| Trends | Spread by year · Change table (`GradeCountsPanels.tsx:225-226`) · **Spread by year** (the panel's default, Chart, isn't on this state, so the first view shown) · "[subject]'s spread of grades: [year] against [compare year]…", "[subject]'s entries at each grade…" | Same | Fewer years for T Level (2). BTEC grade rows are fine for 2021–2024; the historic labels are mapped. | L; R-HISTORIC-GRADE-LABELS |

### Column 2, Context (SubjectPanels as Context)

| Panel · measure | GCSE rail · default · titles | Post-16 today | Difference | Why |
|---|---|---|---|---|
| Current · Candidates | Share (donut) · Bar chart · Ranked list · Sortable table · **Bar chart** · "Entries in [subject] as a proportion of [group]", "Entries by subject in [group]" | Same | Category and Selected keep to the focus's family at both phases. At Post-16 a family is the display bucket, so an AS focus's family is "Other" (with EPQ, Core Maths, Pre-U), and AS/AEA peers are left out. | R-QUAL-FAMILY-MATCH, R-KS5-ASAEA-EXCL |
| Current · Average points | Same rail, donut disabled ("Share is only meaningful for candidate numbers") · **Bar chart** · "Results by subject in [group]" | Same | Every group keeps to the focus's family, All subjects included, with the note "Points are on a different scale for each qualification type, so only [family] subjects are compared" (`TeacherDashboard.tsx:2234-2236`). At GCSE, All subjects crosses families (only GCSE Full Course has points anyway). | R-POINTS-SAME-QUAL (S3b) |
| Current · A*–E | Same · **Bar chart** | Same | Non-A-level focus: the note. All subjects mixes A level, EPQ and Core Maths rates (all on A*–E). | R-GRADE-SCALE-MATCH |
| Current · Grade bands / single grade | Donut enabled with a range · **Bar chart** | Same rail | No range on first visit, so it falls back to points with "Pick a grade range…". All groups keep to the family (0.6.3 S3). | D (no presets); R-MEASURE-FALLBACK; `TeacherDashboard.tsx:1420-1422` |
| Current · Grade counts, none / a selection | Prompt "Click a grade in Results…" / the selection's share, chip "Grade 9 · from your highlight" | Same | Family-kept at Post-16 | R-COUNTS-SELECTION; `teacher-view-measures.ts:274-278` |
| Trends · Candidates | Indexed · Actual · Trend table · Ranked change · Change table · **Indexed** · "Entries in [group]"… | Same | T Level: bars only | R-TREND-LINE-4YR |
| Trends · Results measures | Chart · Trend table · Ranked change · Change table · **Chart** · "Results in [group]: each subject's line"… | Same | BTEC zeros in 2021–2022 (points). Bands: no default range. | L; D |

### Column 3, Comparisons (ComparisonsPanels)

| Panel · measure | GCSE rail · default · titles | Post-16 today | Difference | Why |
|---|---|---|---|---|
| Current · Candidates | Map · Bar chart · Ranking (a set); Number tiles · Bar chart · Ranking (a ranking) (`ComparisonsPanels.tsx:424-432`) · **Map** (tiles for a ranking) · "[subject] entries by school, on the map", "Entries by school in the [set]", "Schools ranked by…" | Same | (1) Entries are the bucket's (all BTEC sizes, A level + AS), not the exact item's. An AS focus uses exact graded entries (`TeacherDashboard.tsx:2280-2284`). (2) Few comparators offer the qualification. | (1) D. (2) L + the nearest-set design |
| Current · Average points | Same · **Map** · "[subject] average points by school…" | Same | Bucket figures, so the school's own dot can differ from Column 1 (Croydon Maths 21.45 against 24.00). AS: the whole column gives way to a note (worded "A-level", A). | D against R-POINTS-SAME-QUAL; A |
| Current · A*–E, bands, a counts selection | Same · **Map** | Same | Exact-qualification rates (comparator grade rows). Non-A-level focus on A*–E: note. Bands: no range, so it falls back to points. | R-COMPARATOR-RATE-PER-QUAL; D |
| Current · ranking set | Number tiles on the headline | Same | The headline is A-level points per entry. IB-only schools and FE colleges have none. | D (HEADLINE_MEASURE.ks5) |
| Trends · any measure | Chart (≥4 years) · Trend table · Trend map (≥2 years, not a ranking) · Ranked bars · Change table · Change map (`ComparisonsPanels.tsx:711-712, 748-750, 821, 832-834`) · **Chart** · "This school's [measure] against [versus], year by year"… | Same | Chart is hidden below 4 years (T Level). BTEC shows a "line" over two false zeros. Bucket figures as in Current. | R-TREND-LINE-4YR; L; D |

### Maps, 0.6.3 rules a–d (R-MAP-ENCODING)

| Map | GCSE | Post-16 |
|---|---|---|
| a. Candidates Current | Size = subject entries, no colour | Same, on bucket entries (exact for AS) |
| b. Candidates Trends (Trend map / Change map) | Change in entries | Same, bucket entries |
| c. Results Current | Colour = rank on the selected measure | Points: bucket figure. Rates: exact. AS points: note, no map. |
| d. Results Trends (Comparisons' maps, Column 1's Map) | Change over the span, from 2022/23 | Same. BTEC change from 0.00 in 2022/23 is false. Column 1's Map for AS points: blend (A). |

All five schools checked have a location (`location_point`, easting/northing), so the maps can place them.

---

## View × family, at real schools

Key: ✓ works · ~ works with a caveat (named) · ✗ doesn't work (why).

**Schools and items checked:**

| Family | School | Item |
|---|---|---|
| A level | King's Worcester 117037 | Mathematics :: GCE A level |
| AS | Croydon College 130432 | Law :: GCE AS level (AS-only in 2024) |
| BTEC single | Croydon 130432 | Business Studies :: BTEC Ext Certificate (Band F) |
| BTEC double / triple | Croydon 130432 | Business Studies :: National Diploma (Band J) / Extended Diploma (Band N) |
| IB subject | Sevenoaks 118952 | Mathematical Studies HL / SL |
| IB Diploma | Sevenoaks 118952 | "Baccalaureate :: International Baccalaureate" |
| T Level | Christ The King 130416 | Health (Croydon's three T Levels as the failing case) |
| Core Maths | King's 117037 | Core Maths Qualifications at Level 3 |
| EPQ | King's 117037 | Extended Project (Diploma) |
| Pre-U | Eton 110158 | Chinese, Pre-U Principal Subject |
| FSMQ | Winchester 116532 | Additional Mathematics FSMQ |

### Data each family has

| Item | Points years (own) | Grade-row years · scale | England points (exact) | England grades | Nearest 10 with the same qual, 2024 (entries / points / grades) |
|---|---|---|---|---|---|
| 117037 A level Maths | 2021–2024: 49.1, 45.2, 48.0, 41.7 | 2021–2024 · A*–E | 2021–2024: 40.4, 38.5, 38.6, 39.2; region and LA too | 2021–2024; region, LA | 3 / 2 / 2 |
| 130432 AS Law | 2022–2024: 7.7, 5.3, 0.0 (all Fail) | 2022–2024 · A*–E | 2022–2024 (31–35 schools); region 5 schools; no LA | 2022–2024 | 0 / 0 / 0 |
| 130432 BTEC Ext Cert Business | 2023, 2024 (20.5, 21.9); **2022 = 0.00** at 30% coverage | 2021–2024 · vocational single | **2021, 2022 = 0.0**; 2023 29.1, 2024 29.9 | 2021–2024 | 2 / 1 / 1 |
| 130432 BTEC National Diploma (double) | 2023, 2024 (27.4, 26.5); **2021, 2022 = 0.00** | 2021–2024 · double | 2021, 2022 = 0.0; 2023 32.3, 2024 33.1 | 2021–2024 | 2 / 0 / 0 |
| 130432 BTEC Ext Diploma (triple) | 2023, 2024 (26.6, 27.6) | 2021–2024 · triple | 2021, 2022 = 0.0; 2023 29.7, 2024 30.5 | 2021–2024 | 4 / 4 / 4 |
| 118952 IB HL Maths | 2021–2024: 51.4, 49.7, 47.5, 49.1 | 2021–2024 · IB 7–1 | 2021–2024; region, LA | 2021–2024 | 1 / 1 / 1 |
| 118952 IB Diploma total | none | 2021–2024 · 45–24 | none | none | n/a (not in the picker) |
| 130416 T Level Health | 2023, 2024: 32.7, 40.0 | 2023, 2024 · T Level | 2023, 2024 (38.1, 38.3); region; no LA | 2023, 2024 | 2 / 1 / 1 |
| 130432 T Levels (3 pathways) | none | none (grades only under "All subjects") | 2023, 2024 | 2023, 2024 | 1–2 |
| 117037 Core Maths | none | 2024 · A*–E (A–E) | none | 2021–2024 | 0 / 0 / 0 |
| 117037 EPQ | none | 2021–2024 · A*–E | none | 2021–2024 | 3 / 0 / 3 |
| 110158 Pre-U Chinese | none | 2021, 2022 · Pre-U | none | 2021, 2022 | n/a (not in the picker: no 2024 entries) |
| 116532 FSMQ | none | none | none | 2021–2022 "COVID result" only | n/a (not in the picker) |

**Candidates years:** headline rows carry entries for 2021–2024 for the long-standing qualifications, so Candidates has 4 years. T Level has 2.

**Bucket against exact (Comparisons and maps against Column 1), 2024:**

| Item | Bucket figure | Exact figures | Same? |
|---|---|---|---|
| 117037 Maths | alevel 41.71 | A level 41.71 | yes |
| 130432 Maths | alevel 21.45 | A level 24.00, AS 4.44 | no |
| 130432 Business | btec_ocr 25.00 | five sizes: 16.67 to 27.64 | no |
| 118952 Maths | ib 46.76 | HL 49.07, SL 41.17 | no |
| 130416 Health | tlevel 40.00 | T Level 40.00 | yes |

### The table

| View | A level | AS | BTEC single | BTEC double / triple | IB subject | IB Diploma | T Level | Core Maths | EPQ | Pre-U / FSMQ |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 Candidates tiles | ✓ | ✓ (not ranked against A levels) | ✓ | ✓ | ✓ | ✗ not a subject (R-IB-NONSUBJECT) | ✓ (130416) | ✓ | ✓ | ✗ no 2024 entries |
| C1 Candidates Indexed / Actual / Trend table | ✓ 4 years | ✓ | ✓ | ✓ | ✓ | ✗ | ~ 2 years: bars, Actual disabled | ✓ | ✓ | ✗ |
| C1 Candidates Area chart / Change table | ✓ | ~ thin (England 31–35 schools, no LA) | ~ 2021–2022 England rows are 0.0 | ~ as single | ✓ | ✗ | ~ England, region only | ✗ no area rows (says so) | ✗ no area rows | ✗ |
| C1 Points tiles / bars / table | ✓ | ✓ (England thin) | ~ England 0.0 in 2021–2022 (Current reads 2024: OK) | ~ | ✓ | ✗ | ✓ (130416); ✗ at 130432 (no points) | ✗ no points | ✗ no points | ✗ |
| C1 Points Trends Chart / table | ✓ line | ✓ 3 years: bars / change list | ✗ false 0.00 points in 2022 | ✗ false 0.00 in 2021–2022 | ✓ | ✗ | ~ 2 years: change list | ✗ | ✗ | ✗ |
| C1 Points Area chart / Change table | ✓ | ~ thin | ✗ England 0.0 in 2021–2022 | ✗ same | ✓ | ✗ | ~ 2 years, no LA | ✗ none | ✗ none | ✗ |
| C1 Points Trends Map | ~ bucket = exact here | ✗ plots the A-level bucket, no note (A) | ~ bucket blends all sizes; zeros | ~ same | ~ blends HL and SL | ✗ | ✓ | ✗ | ✗ | ✗ |
| A*–E (C1, C2, C3) | ✓ 100% | ✓ (AS is A–E) | ✗ note (R-GRADE-SCALE-MATCH) | ✗ note | ✗ note | ✗ | ✗ note | ~ scored as A*–E (93.8%): your call | ~ scored (100%): your call | ✗ |
| Grade bands / a single grade (C1 Current: tiles, distribution, bars, table) | ~ no default range | ~ same | ~ same; grades 2021–2024 | ~ same | ~ same | ✗ | ~ same; 2 years | ~ same | ~ same | ✗ |
| Grade bands Trends (C1, C2, C3) | ✓ 4 years once picked | ✓ | ✓ 4 years (grade rows are real) | ✓ | ✓ | ✗ | ~ 2 years | ~ 1 year (2024) | ✓ | ✗ |
| Grade counts, none / a selection | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (130416); ✗ at 130432 | ✓ | ✓ | ✗ |
| C2 Context Current (Candidates) | ✓ | ~ group is "Other" (EPQ, Core Maths…), AS peers out | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| C2 Context on points | ✓ family-kept | ~ only itself carries points in "Other" | ~ zeros 2021–2022 in Trends | ~ | ✓ (HL and SL in one family) | ✗ | ✓ | ✗ | ✗ | ✗ |
| C2 Context Trends | ✓ | ✓ | ~ zeros (points) | ~ | ✓ | ✗ | ~ bars | ~ | ~ | ✗ |
| C3 Current Map / Bar / Ranking (points) | ~ 2 comparators | ✗ note (no exact-AS figures elsewhere) | ~ bucket blend, 1 comparator | ~ 0–4 comparators | ~ 1 comparator, HL and SL blended | ✗ | ~ 1 comparator | ✗ | ✗ | ✗ |
| C3 Current on rates / bands | ~ 2 comparators | ✗ 0 comparators | ✗ A*–E / ~ bands, 1 comparator | ~ | ~ 1 comparator | ✗ | ~ 1 | ~ 0–1 | ~ 3 | ✗ |
| C3 ranking tiles (headline) | ✓ | ✓ (school headline) | ✗ for a college without A levels | ✗ | ✗ IB-only school | ✗ | ✗ | n/a | n/a | n/a |
| C3 Trends Chart (≥4 years) / table / maps | ✓ line | ✗ 0 comparators | ✗ zeros make a false 4-year line | ✗ | ~ 1 comparator | ✗ | ~ table only | ✗ | ~ rates only | ✗ |

**Context's family gating** (`teacher-view-populations.ts:75-80`; `teacher-view-theme.ts:132-145`):
- Families are A-level, IB, BTec/OCR/VRQ, T Level and Other. AS and AEA sit in Other.
- Category and Selected keep to the family on every measure, as at GCSE.
- All subjects keeps to the family on points, bands and a counts selection at Post-16 only (`teacher-view-measures.ts:274-278`). It crosses families on Candidates and A*–E.

---

## B2. Proposal (for your review; nothing built)

### Target Post-16 rails and defaults

**Keep the shared `VIEWS` table as it is.** The matrix shows that every GCSE view also works at Post-16 for A level and IB, so the rails and order already match.

| Panel | Rail (same as GCSE) | Default |
|---|---|---|
| C1 Candidates, Current | Number tiles | **Number tiles** |
| C1 Candidates, Trends | Indexed, Actual, Trend table, Area chart, Change table | **Indexed** |
| C1 Results, Current | Number tiles, Grade distribution, Bar chart, Sortable table, (Grade counts: Grade distribution) | **Number tiles**; on Grade bands see change 1 |
| C1 Results, Trends | Chart, Trend table, Map, Area chart, Change table, (counts: Spread by year, Change table) | **Chart** |
| C2 Context, Current | Share (donut), Bar chart, Ranked list, Sortable table | **Bar chart** |
| C2 Context, Trends | Indexed / Chart, Actual, Trend table, Ranked change, Change table | **Indexed** (Candidates), **Chart** (Results) |
| C3 Comparisons, Current | Number tiles (ranking), Map, Bar chart, Ranking | **Map** |
| C3 Comparisons, Trends | Chart, Trend table, Trend map, Ranked bars, Change table, Change map | **Chart** |

### What can't match, and the honest alternative

| # | What | Alternative (proposed) | Kind |
|---|---|---|---|
| 1 | Grade bands opens with no range at Post-16 | **Either (a)** add a default band per scale, matching GCSE's 7–9: A level A*–A, IB 7–6, vocational Distinction*–Distinction, T Level Distinction*–Merit (your call on which). **Or (b)** keep no preset, and open Post-16 Column 1 Current on Grade distribution, which draws without a range (`SubjectPanels.tsx:575-590`). | a different default |
| 2 | BTEC points 0.00 in 2021/22–2022/23 | Fix in ingest: map the historic short codes before scoring (vicdata repo, `academic_aggregates.py` / `dfe_points.py`), then re-roll. Interim, app-side: treat a Post-16 vocational points row of exactly 0 with grade rows above Fail as missing (a new rule; you decide). | data fix + greyed |
| 3 | A*–E on BTEC, IB, T Level, Pre-U | Keep the note. Optionally also grey "A*–E rate" in the Results pill for such a focus, with the same reason. | greyed view with reason |
| 4 | A*–E on Core Maths and EPQ | Decide: keep (they are A–E graded and DfE uses the same letters), or limit A*–E to A level and AS. | your call |
| 5 | Comparisons and maps on bucket figures | Read comparators' exact-qualification headline rows (`fetchSubjectQualificationHeadlineForSchools` for the set), as rates already do. Then Column 1, Comparisons and the maps show one figure, and the AS note goes. Cost: one more fetch per set (0.6.4 C cost to check). Interim: a caption "A level and AS together" / "all BTEC sizes together". | rule fix (R-POINTS-SAME-QUAL) |
| 6 | The default set has few Post-16 comparators | For the Post-16 default, use the nearest schools with Post-16 provision (`hasPost16Provision`, or the existing "Schools and FE colleges, 16+, in [LA]" list). | different default |
| 7 | The headline is A-level only | On a ranking or with no chip, say "[school] has no A-level entries; rankings use A-level points per entry" rather than a hollow figure. (A per-family headline is a bigger change.) | family-specific note |

### Per-family exceptions

- **A level:** none.
- **AS:**
  - Column 1's Trend map on points needs the same note as Comparisons (accident).
  - Labels should say "AS level", not "A-level".
  - Context's group is "Other", so it has only itself on points. Consider a note there.
- **BTEC / vocational:**
  - Points trends only become honest once change 2 is done.
  - Sizes blend in Comparisons until change 5 is done.
- **IB:**
  - HL and SL are separate in Column 1, but blended in Comparisons until change 5.
  - The **IB Diploma total** stays out (R-IB-NONSUBJECT). If you want it, it is a whole-school tile (0–45 points, grade rows only; no England figure), not a subject.
- **T Level:**
  - Works at 130416, with 2 years, so bars.
  - At 130432 there are no per-pathway grades or points. Add a note: "DfE publishes this college's T Level grades only for all pathways together."
- **Core Maths / EPQ:** no points anywhere, so points views give way to notes. Grades work.
- **Pre-U, FSMQ, AEA:** no current entries, so nothing to do.

### Config and catalogue changes, precisely

1. **`src/catalogue/dashboards/teacher.ts`**
   - `VIEWS` (38-76): no change.
   - **Only if option 1b is chosen:** in `panel()` (123-145), for `phase === "ks5"`, `column === "c1"`, `row.id === "current"` on the Results dashboard, set `defaultViewByResults: { bands: "${id}/DV-C1-RES-CUR-GRADES" }`. Today `panel()` takes no per-phase default, so this is a new argument.
2. **`src/lib/subject-grades.ts:232-235`** (`BAND_PRESETS`), for option 1a: add the Post-16 presets. Also:
   - `src/lib/teacher-view-measures.ts:189` (the preset id `"7-9"` is hard-coded): give each scale a default preset;
   - `src/catalogue/measures.ts:103` (the "No presets" text).
3. **`src/catalogue/dataviews.ts`:** no `measures` / `resultsMeasures` change is needed; every view already lists both phases. Wording only:
   - DV-C3-CUR-MAP's note (914) and DV-C1-RES-TR-MAP's `rules` (459) should say "bucket figures at Post-16" until change 5 lands.
   - `measures.ts:349`'s knownGap ("Context 'All subjects' blends qualifications") is stale since S3b.
4. **Hosts:**
   - **`TeacherDashboard.tsx:1673-1717`** (`column1MapSeries`): an AS / AEA focus on points returns a note, as Comparisons does at 2280-2286.
   - **`TeacherDashboard.tsx:1121-1137, 1571-1583`** (map chips, comparator series): exact-qualification series at Post-16 (change 5).
   - **`TeacherDashboard.tsx:2285` and `1137`:** name the exact qualification for AS / AEA (not `qualificationShortLabel`'s bucket label, `teacher-view-theme.ts:99-100`).
   - **`TeacherDashboard.tsx:1726`** (`aStarToEOff`): unchanged unless change 4 is taken.
   - **`teacher-view-measures.ts:64-80`** (`latestOwnPoints`, `subjectPointsAt`): the interim zero guard (change 2), if wanted.
   - **`chooser-sets.ts:70-75` / `default-comparator-lists.ts:728-744`:** the Post-16 default set (change 6).
5. **Ingest (vicdata repo):** the BTEC historic points (change 2). This needs a re-roll and a parity run.

---

## Not verified

- **The published dashboard configs:** the anon read returns "no stored dashboard" (RLS). I compared the code copy only.
- **Nothing rendered:** no screenshots or harness this pass. "Shows X" comes from the host code plus the fetcher data. That includes:
  - whether the BTEC 0.00 actually reaches a chart, which the code says it does (`teacher-view-measures.ts:64-80` keeps a 0);
  - how Column 1 Trends looks on Grade bands with no range.
- **Why the BTEC historic points are 0:** the cause in ingest is inferred.
- **Why Croydon's T Level grades are "All subjects" only:** suppression is a guess.
- **AEA:** no example found at these schools.
- **A data oddity, effect not traced:** some subject names change between years ("Business Studies:Single" in 2021–2023 becomes "Business Studies" in 2024 at 117037 and 130432, A level and AS). If so, A-level Business has only 2024 under its 2024 name, and its trends would be short.
- **England's 2021/22 AS Maths figure (17.9 from 31 schools)** looks suspect; not checked further.
