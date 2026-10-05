# VicData 0.6.2, S1: reconciling the grade rollup

Branch `v0.6.2-grades`, from `main` (e109b98). **No app change.** Everything here was read-only against production on 5 October 2026. Scripts and their outputs are in `docs/v0.6/audit_scripts/grade_rollup/` (README there).

## The decisions

| Phase | Source for 2021/22–2024/25 | Why |
|---|---|---|
| **GCSE (KS4)** | **The rollup**, through a new lookup RPC (proposed below, not applied) | It equals the facts on every key in all four years, and equals what the app shows today for 2023/24–2024/25 on every figure tested. It's the only source that can be filtered to one subject in the database, which is what S3 needs. |
| **Post-16 (KS5)** | **The historic facts, read directly with the same parser** | The rollup's figures match, but it can't reproduce what the app draws today: it has no zero-entry grade rows, and the app draws them (Grade counts and the grade distribution in 127 of 155 sampled subjects). Reading `dfe_ks5_subject_results_historic` works: same breakdown format, same parser, sensible results, about 50 ms a school for the historic source (124–216 ms with the modern read, in parallel). |

So the round does **not** stop at S1: KS5 ships, on the historic facts. Two things gate S2 and are set out below: the RPC needs applying for KS4 (§5), and the historic KS5 grade labels need mapping (§4).

**The prompt's "about −0.9%" in historic KS5 is the IB non-subject rows**, not suppression or missing data. And the "double count" in the modern years came from including the "All subjects" rows. The rollup equals the facts exactly, at both phases (§2).

## 1. How the app reads grades today

- **The fetch:** `fetchSubjectLevelDataForSchools(urns, stage)` (`src/lib/academic-data-view.ts:1194`).
  - Sources (`:1200`): `dfe_ks4_subject_entries` at KS4; `dfe_ks5_subject_results` + `dfe_tlevel_results` at KS5 (`KS5_SUBJECT_SOURCE_IDS`, `:1163`). The modern sources only, so periods 2023 and 2024.
  - It goes through `lookupReferenceData` → the anon RPC `reference_data_lookup`. That reads `canonical_facts_current` and has a **lineage fallback**: when a URN has no rows of its own in that source, a clean single predecessor's rows come back under the URN.
  - Pages of 1,000 rows, at most 50 pages (`src/lib/vicdata-reference.ts:8`). All subjects are fetched, then filtered.
- **The parser:** `parseSubjectGradeDistribution` (`:1109`). It drops null values, the total labels in `SUBJECT_TOTAL_LABELS` (`:1050`: "Total exam entries", "Total") and "All subjects". It keeps zero-entry rows, and it keeps one row per size at KS5 (`sizeWeight`).
- **Callers:**
  - `/api/teacher/dashboard` (`route.ts:173`, `subjectData.gradeDistribution` at `:186`);
  - `/api/teacher/comparator-grades` (`route.ts:50–52`: the whole set, every subject, then filtered to one);
  - `/api/data-view/academic-subject-comparison` (`route.ts:70`, the Data View's deep-dive drawer). **S2 must decide whether this one changes too.**
- **The rules are applied on the page, by subject × qualification type × period:**
  - `NON_GRADE_VALUES` (`src/lib/subject-grades.ts:85`) and `thresholdRate` / `bandRate` / `bestScale` (`subject-grades.ts`);
  - `gradeRowsAt` / `subjectThresholdAt` / `subjectBandAt` / `hasGradesAt` (`src/lib/teacher-view-measures.ts:131–157`);
  - AS/AEA exclusion and family gating, through `inGroup` (`teacher-view-measures.ts:340–390`, `teacher-view-populations.ts`);
  - Grade counts and the distribution: `gradeCounts` / `bandDistribution` (`src/lib/grade-spread.ts`).

  All of these key on qualification type, which the rollup keeps. **None reads `sizeWeight`.** Its only reader is `averagePointsFor` (`src/lib/dfe-qualification-buckets.ts:342`), which nothing calls. So summing over sizes changes no figure.
- **The rollup itself:**
  - Built by `recompute_academic_subject_grade_rollup()` (`vicdata/ingest/academic_aggregates.py:994`) from `canonical_facts`, over the same five sources plus the two historic ones.
  - It drops: totals ("Total", "Total number entered", "Total exam entries"), "All subjects", the IB non-subject rows (`_NON_SUBJECT_ROWS`, R-IB-NONSUBJECT) and every value ≤ 0.
  - It **sums KS5 sizes** (documented in its docstring) and keeps raw grade labels.
  - Table: `vicdata/supabase/migrations/20260927120000_academic_subject_grade_rollup.sql`. **Select is granted to `authenticated` only.** Checked live: anon gets HTTP 401 and service_role gets 403 ("permission denied"). The app can't read it today.
- **Period mapping, confirmed:** period P is P/(P+1).
  - The historic sources hold 2020–2022; 2020 has totals only, no grades. The modern sources hold 2023–2024.
  - Check: GCE A level A* share in the rollup is 14.6% for 2021 (summer 2022's generous grading), then 9.0, 9.6 and 9.9.
  - `canonical_facts` and `canonical_facts_current` hold the same rows for every subject source and period, so the rollup and the app read the same facts.

## 2. Whole-table reconciliation (every key, both phases)

**Method:** `full_reconcile.sql`. The facts are aggregated with the rollup's own rules to (school, key stage, subject, qualification, grade, period), summed over size at KS5, then full-outer-joined to the rollup.

| Phase | Period | Keys | Equal | Only in one | Keys summed over >1 size | Entries (facts = rollup) |
|---|---|---|---|---|---|---|
| KS4 | 2021 | 602,783 | 602,783 | 0 | 0 | 4,950,392 |
| KS4 | 2022 | 621,586 | 621,586 | 0 | 0 | 5,073,301 |
| KS4 | 2023 | 636,349 | 636,349 | 0 | 0 | 5,201,165 |
| KS4 | 2024 | 634,020 | 634,020 | 0 | 0 | 5,120,856 |
| KS5 | 2021 | 223,220 | 223,220 | 0 | 657 | 1,131,615 |
| KS5 | 2022 | 235,154 | 235,154 | 0 | 3,186 | 1,132,792 |
| KS5 | 2023 | 232,059 | 232,059 | 0 | 3,296 | 1,145,200 |
| KS5 | 2024 | 226,441 | 226,441 | 0 | 3,162 | 1,147,597 |

The KS4 totals are the prompt's, to the entry.

**Where the facts' other rows go (KS5, `q5.sql`):**

| Rows | 2021 | 2022 | 2023 | 2024 |
|---|---|---|---|---|
| Grade rows (= rollup) | 1,131,615 | 1,132,792 | 1,138,624 + T Level 6,576 | 1,136,582 + T Level 11,015 |
| IB non-subject rows (Baccalaureate, IB core) | 10,478 | 9,543 | 10,444 | 10,641 |
| Zero-entry grade rows (count of rows) | 115,914 | 83,597 | 76,167 | 76,474 |
| "All subjects" rows (entries) | – | – | 2,457,498 | 2,446,898 |

- **The "about −0.9%":** 10,478 ÷ (1,131,615 + 10,478) = 0.92% in 2021, and 0.84% in 2022. It's R-IB-NONSUBJECT, as designed.
- **Not suppression:** no subject fact has a null value or a text value. DfE's suppressed cells reach us as grade labels ("Suppressed", "X", "Supp"), which both paths keep as rows.
- **Not T Levels:** they're in both, from `dfe_tlevel_results`.
- **No qualification is excluded** beyond those rows.
- **The "double count" in a naive modern check** is the "All subjects" pseudo-rows (about 2.45m entries a year), not size.
- **Sizes:** 657–3,296 KS5 keys a year span more than one size, all of them VRQ Level 3 (`sizes.sql`). A level, AS, AEA, IB and BTEC each have their own qualification type, so the rollup never merges A level with AS. It merges only award sizes within one qualification type, and no app figure separates those (§1).

## 3. Sample: the rollup against what the app shows today

**Method:** `sample.py` (seed 20261005) drew 200 (school, subject, qualification) sets per phase from the rollup's 117,238 KS4 and 82,564 KS5 sets, plus The Chase GCSE History.

`compare.mts.txt` then read the same schools **through the app's own code**:
- `fetchSubjectLevelDataForSchools` for 2023/24–2024/25, in chunks of 5 schools (see surprise 1);
- `lookupReferenceData` on the historic source with a verbatim copy of `parseSubjectGradeDistribution` (the original isn't exported).

It scored both sides with the app's own `thresholdRate`, `bandRate` (two ranges per set), `hasGrades`, `gradeOrderFrom` and `gradeCounts` (rows, counts, years compared, modal grade).

| Check | KS4 | KS5 |
|---|---|---|
| Rollup = facts per grade, 4 years (keys) | 4,660 / 4,660 | 2,119 / 2,119 (23 summed over size) |
| Modern set-years: non-zero grades equal to the app's | 289 / 289 | 232 / 232 |
| Grade 4+ / A*–E rate equal | 289 / 289 | 232 / 232 |
| Band rate equal | 289 / 289 | 232 / 232 |
| "Has grades" (R-THRESHOLD-PERIODS) equal | 289 / 289 | 232 / 232 |
| Grade order (the axis) equal | 289 / 289 | **49 / 232** |
| Grade counts (rows, counts, years, modal) equal | 174 / 174 | **28 / 155** |
| Zero-entry rows the app has and the rollup doesn't | 0 | 376 rows in 183 set-years |
| Historic set-years: facts through the parser (after the rollup's rules) = rollup | 293 / 305 | 253 / 257 |
| … the rest: rollup empty, facts filled through a predecessor | 12 | 4 |

**KS5's only difference is the zero rows,** and they show:
- 136296 Psychology, A level: the app draws a "*" row at 0 beside 2024/25's "A*".
- 143369 Photography: D and E at 0.
- 135761 Health Studies, BTEC Extended Diploma: the scale's empty top three grades and its two empty bottom grades.

The rollup draws none of these. Rates and bands are unaffected.

**The Chase (137625), GCSE History, grade by grade** (rollup / facts, the app's rows for 2023/24–2024/25):

| Grade | 2021/22 | 2022/23 | 2023/24 | 2024/25 |
|---|---|---|---|---|
| 9 | 9 / 9 | 9 / 9 | 15 / 15 | 11 / 11 |
| 8 | 21 / 21 | 18 / 18 | 15 / 15 | 14 / 14 |
| 7 | 19 / 19 | 9 / 9 | 12 / 12 | 20 / 20 |
| 6 | 12 / 12 | 16 / 16 | 17 / 17 | 22 / 22 |
| 5 | 11 / 11 | 8 / 8 | 18 / 18 | 16 / 16 |
| 4 | 6 / 6 | 5 / 5 | 12 / 12 | 17 / 17 |
| 3 | 9 / 9 | 13 / 13 | 18 / 18 | 14 / 14 |
| 2 | 5 / 5 | 7 / 7 | 7 / 7 | 12 / 12 |
| 1 | 2 / 2 | 4 / 4 | 4 / 4 | 5 / 5 |
| U | 1 / 1 | 2 / 2 | 2 / 2 | 1 / 1 |
| X (non-grade) | – | – | 1 / 1 | – |
| **All rows** | **95** | **91** | **121** (120 graded) | **132** |
| "Total number entered" (facts only) | 0 / 95 | 0 / 91 | – | – |

The last row is the historic KS4 total label. The app's parser doesn't know it, so **read raw, it would become a "grade" of 95** (314 such rows in the sample). The rollup drops it. Only matters if KS4 were read from facts.

## 4. KS5: reading the historic facts directly

**Feasible.** `dfe_ks5_subject_results_historic` uses the same `qualification::subject::size::grade` breakdown. "Total" is its only total label, and `parseSubjectGradeDistribution` already drops it. It keeps zero rows like the modern source. Lineage comes free through `reference_data_lookup`.

**Sample results through the unchanged parser and rules** (`ks5_historic.out`):

| School, subject | 2021/22 | 2022/23 | 2023/24 | 2024/25 |
|---|---|---|---|---|
| King's Worcester (117037), Maths, A level, A*–E | 100% (45) | 100% (56) | 100% (56) | 100% (35) |
| King's Worcester, Physics, A level, A*–E | 100% (29) | 100% (24) | 100% (38) | 100% (19) |
| The Chase (137625), Psychology, A level, A*–E | 100% (34) | 100% (42) | 100% (34) | 100% (23) |

The figures in brackets are graded entries. The A-level grade spreads are sensible ("*" then "A*", as today).

**But the historic grade labels differ,** whichever source is read. The rollup keeps them raw too. **S2 must map them, or historic vocational years break:**

| Historic label | Modern equivalent | Effect if left raw |
|---|---|---|
| "COVID result" (KS5 only) | a non-grade | Counted as graded. A*–E gives **no figure** for any A-level set that has one, and band rates are pulled down. In 2021/22 that's 2,952 A-level sets (about 9% of 33,760), plus 5,537 AS; in 2022/23, 218. |
| "Supp" | "Suppressed" | Same as above, for 143 and 118 A-level sets. |
| Vocational short codes: `*` `D` `M` `P` `HM` `HP`, `**` `*D` `DD` `DM` `MM` `MP` `PP`, `***` `**D` … `PPP` | "Distinction*", "Distinction", … "Pass-Pass-Pass" | `*` and `D` collide with A level's, so `bestScale` puts a BTEC on the A-level scale. Bands give no figure, and Grade counts shows letters. Affects 9,178 and 10,714 historic BTEC/OCR/VRQ sets. |

Example: Croydon College (130432), Business Studies, BTEC Extended Certificate.
- 2021/22 reads `*:2 D:9 COVID result:44 M:31 P:9`.
- 2023/24 reads `Distinction:7 Merit:22 Pass:25 Fail:3`.

**The mapping depends on the qualification** (`*` is A* on an A level but Distinction* on a BTEC), so it belongs at parse time for the historic source. Log it as a new rule, for example R-HISTORIC-GRADE-LABELS. Alternatively, S2 ships A level/AS/IB/Pre-U/EPQ/Core Maths history and leaves vocational at 2 years.

The grade geography aggregate behind the England ticks is built from the same rollup, so its 2021/22–2022/23 vocational rows carry the same short labels.

KS4's historic labels need nothing new: "No result" and "Covid impacted" are already in `NON_GRADE_VALUES`, and GCSE 9–1 is identical.

## 5. Why KS4 needs a new RPC, and the lineage it must copy

- **No read path exists** (§1). Proposed: `docs/v0.6/proposed_sql/vicdata_academic_subject_grade_rollup_lookup.sql`.
  - It's a security-definer `academic_subject_grade_rollup_lookup(p_entity_ids, p_ks_stage, p_subject, p_qualification_type, p_period_min, p_period_max, p_limit, p_offset)`, granted to anon, in the shape of the existing `academic_subject_*_lookup` functions.
  - **Not applied.** It targets the vicdata data database, so it isn't in this repo's `supabase/migrations/`, which belongs to the vicdata-public project.
- **Lineage, which a direct read gets wrong:**
  - **82 KS4 URNs (30 KS5)** have no rows of their own but get modern grades today through a predecessor. A direct rollup read would blank their latest year.
  - **130 KS4 schools (64 KS5)** have modern rows of their own, while their 2021/22–2022/23 rows sit under a predecessor. These are the 12 + 4 sample differences above.
  - So the RPC falls back **per era** (periods to 2022, and from 2023), checking the URN's own rows across every subject. That mirrors `reference_data_lookup`'s per-source fallback.
  - Run read-only on live, its body gives 150009 History 52 / 90 / 79 / 67 and 150127 Maths 89 / 85 / – / 64. Those equal the facts path.
- **Tested on PGlite:** `node supabase/tests/v062_s1_grade_rollup_lookup_pglite.mjs` passes 8/8. It covers own rows; historic years from the predecessor; modern years from the predecessor; no fallback with two predecessors; no fallback when the URN has rows in that era in another subject; "Merged" links never followed; the subject filter; and that anon still can't read the table.
- **Known edge:** a URN whose only historic facts are 2020 totals falls back here but not in the facts path. That's historic years only, never a year shown today.
- **If Guy would rather not apply it,** KS4 can read the historic facts as KS5 does. It reconciles just as well, but needs "Total number entered" added to `SUBJECT_TOTAL_LABELS`, and it can't filter to one subject, so S3 gets no faster.

## 6. Timings and indexes

**Timings** (medians of 3; `timing_ks4.out`, `timing_ks5.out`, `explain.sql`):

| Read | Today (facts over HTTP) | Rollup |
|---|---|---|
| One school, GCSE, every subject, modern only (the dashboard) | 52 ms (413 rows) | SQL 9 ms cold (802 rows, 4 years) |
| One school, + historic facts, every subject | +50 ms (473 rows; ≈ the same in parallel) | – |
| One school, GCSE History, 4 years | (fetches all subjects, as above) | SQL 6.4 ms cold, 0.4 ms warm through the proposed RPC body |
| The Chase + 10 nearest, comparator-grades, modern only | **400 ms** (4,291 grade rows fetched, 220 used) | SQL 42 ms cold (`= any`), 2.6–5.2 ms warm through the RPC body |
| The same set, + historic facts | +479 ms in sequence (5,207 rows) | (included above) |
| King's Worcester + 10 nearest, Post-16, modern / + historic facts | 141 / 123 ms | n/a (KS5 reads facts) |
| One Post-16 school, modern + historic facts in parallel | 124–216 ms (King's, Croydon College) | n/a |
| One existing grade RPC over HTTP (England, one subject) | 52 ms | the likely floor for the new RPC |

**Indexes:** none needed for the reads S2 and S3 make.
- Every call is entity-led: `(entity_id, ks_stage, subject)` is the primary key's prefix, and `academic_subject_grade_rollup_entity_idx (entity_id, ks_stage, period)` covers the RPC's era check.
- A population-wide `(ks_stage, subject, period)` read takes 2.1–2.3 s (it uses `family_idx`, or a sequential scan). **Nothing planned needs it:** area figures come from the geography aggregate. So no index migration is proposed.

## 7. Surprises

1. **`lookupReferenceData` truncates silently at 50 pages (50,000 rows).**
   - A one-call fetch of the ~195 sampled schools came back with only some of them. 92 of 289 KS4 set-years were empty until the script went to chunks of 5.
   - At about 700 GCSE grade rows a school, any comparator set over about 70 schools would lose schools in `comparator-grades` today. Adding the historic years would roughly halve that limit if they were fetched together.
   - Reading one subject from the rollup removes the risk for S3.
2. **The rollup isn't readable by the app at all** (authenticated-only grant). The table's own comment says so ("not itself exposed to anon"). The prompt's "Read the rollup in server routes only, as the existing grade routes do" needs the RPC first.
3. **Historic grade labels** (§4) affect both sources and both the school and England sides. They're the main S2 risk for Post-16.
4. **A level already mixes "*" (to 2023/24) and "A*" (2024/25)**, because DfE changed the label. The app draws both today, so a four-year A-level spread will show both. That's existing behaviour, not new, but worth a look in S2.
