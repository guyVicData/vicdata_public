# Post-16 against GCSE: the views matrix, v2 (after 0.6.5)

**v1, the audit:** [`post16_vs_gcse_matrix_v1.md`](post16_vs_gcse_matrix_v1.md), kept unchanged. **This v2 re-checks every ✗ and ~ cell after 0.6.5's S1–S6 and the ingest's BTEC rebuild,** and says what is now ✓, what remains and why. Build report: [`v065_report_v1.md`](v065_report_v1.md).

**How this was checked:**
- **Data:** real production figures after the BTEC rebuild (7 Oct). For example, Croydon 130432 Business BTEC National Diploma 2021/22–2024/25 is 31.16 · 20.27 · 27.39 · 26.47; it was 0.00 · 0.00 in the first two years.
- **Rules:** five real-data rule tests, R-POST16-BAND-DEFAULT, R-POINTS-SAME-QUAL, R-POST16-DEFAULT-SET, R-TREND-TABLE-YEARS and R-ALEVEL-STAR.
- **Rendered:** the 0.6.5 parity walk, which renders every panel and rail view on each tree's own real-data fixtures. Post-16 cases: 117037 A level Maths; 130432 Business, BTEC Extended Certificate, AS Law and T Level MIR; 118952 Biology and IB Mathematical Studies HL; 130416 T Level Health. Each case covers Candidates and every Results measure, at 1280 and 390, in both themes.

Key: ✓ works · ~ works with a caveat (named) · ✗ doesn't work (why) · **bold** = changed since v1.

## What changed since v1

| v1 finding | Now | Where |
|---|---|---|
| 1. BTEC points 2021/22–2022/23 stored as 0.00 | **✓ real figures** (ingest fix, production rebuilt). Trends, the Area chart and Comparisons' lines run 2021/22–2024/25 with no false zeros. Sets made only of COVID results stay blank (correct). | ingest repo `fix/btec-historic-points` |
| 2. Grade bands opens with no range at Post-16 | **✓ a default per scale:** A level and EPQ A* to A; AS and Core Maths A to B; IB 7 to 6; BTEC single / double / triple D*–D, D*D*–DD, D*D*D*–DDD; T Level D*–Merit. Context and Comparisons draw bands, not points. | 0.6.5 S1, R-POST16-BAND-DEFAULT |
| 3. A*–E only for A-level scales | **~ by design:** greyed in the Results switch for BTEC / IB / T Level / Pre-U, with the reason; a saved A*–E shows Average points for that focus. Core Maths and EPQ keep A*–E (your decision). | 0.6.5 S2 |
| 4. Comparisons and maps use bucket figures | **✓ exact qualification everywhere** (points, entries, ranks, labels). Croydon A level Maths reads 24.00 in Column 1 and Comparisons (was 21.45 in Comparisons). | 0.6.5 S3, R-POINTS-SAME-QUAL |
| 5. AS focus: Column 1's Trend map plots the A-level bucket; labels say "A-level" | **✓ fixed:** the map is exact AS rows; labels say "AS level". Where no other school has the qualification, a note: "No school in this set has AS level Law entries." | 0.6.5 S3 |
| 6. IB Diploma total isn't a subject | ✗ unchanged, by rule (R-IB-NONSUBJECT) | — |
| 7. Headline is A-level points per entry | **~ a note:** a school with no A-level entries sees "[School] has no A-level entries. Post-16 rankings use A-level points per entry." on the ranking tiles. A per-family headline remains a later option. | 0.6.5 S5 |
| 8. Default set = GCSE nearest 10 | **✓ the 10 nearest with Post-16 provision** (KS5 results in the last two years), named "10 nearest with a sixth form or 16+ provision" in the chooser (the column's pill keeps "10 nearest schools", so the grid doesn't shift). King's A level Maths comparators 3 → 7; The Chase A level History 5 → 10. FE colleges already defaulted to the nearest FE colleges. | 0.6.5 S4, R-POST16-DEFAULT-SET |
| 9. Few lines at Post-16 | **BTEC: ✓ 4 real years, so a line** (was 2). T Level still has 2 years: bars, by rule. | ingest fix; R-TREND-LINE-4YR |
| 10. Area views only where DfE scores | ~ unchanged: a data limit (EPQ, Core Maths, VRQ, AEA, Pre-U have no area rows; London LAs have none) | — |
| 11. T Level at Croydon | **~ a note:** "DfE publishes this college's T Level results only for all pathways together." in place of empty charts. Christ The King 130416 works. | 0.6.5 S6 |
| 12. Pre-U, FSMQ | ✗ unchanged: no current entries | — |

## View × family, now

(The same rows, schools and items as v1's table.)

| View | A level | AS | BTEC single | BTEC double / triple | IB subject | IB Diploma | T Level | Core Maths | EPQ | Pre-U / FSMQ |
|---|---|---|---|---|---|---|---|---|---|---|
| C1 Candidates tiles | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ not a subject | ✓ | ✓ | ✓ | ✗ no 2024 entries |
| C1 Candidates Indexed / Actual / Trend table | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ~ 2 years: bars (rule) | ✓ | ✓ | ✗ |
| C1 Candidates Area chart / Change table | ✓ | ~ thin (England 31–35 schools, no LA) | **✓ England rows real** | **✓** | ✓ | ✗ | ~ England and region only | ✗ no area rows (says so) | ✗ no area rows | ✗ |
| C1 Points tiles / bars / table | ✓ | ✓ | **✓** | **✓** | ✓ | ✗ | ✓ (130416); **~ note at 130432** | ✗ no points (DfE scores none) | ✗ no points | ✗ |
| C1 Points Trends Chart / table | ✓ line | ✓ | **✓ 4 years, a line** | **✓** | ✓ | ✗ | ~ 2 years: change list | ✗ | ✗ | ✗ |
| C1 Points Area chart / Change table | ✓ | ~ thin | **✓** | **✓** | ✓ | ✗ | ~ 2 years, no LA | ✗ none | ✗ none | ✗ |
| C1 Points Trends Map | **✓ exact** | **✓ exact AS** (or the note) | **✓ exact size** | **✓** | **✓ HL or SL** | ✗ | ✓ | ✗ | ✗ | ✗ |
| A*–E (C1, C2, C3) | ✓ | ✓ | **~ greyed; Average points shown** | **~ greyed** | **~ greyed** | ✗ | **~ greyed** | ✓ (your decision) | ✓ (your decision) | **~ greyed** (Pre-U) |
| Grade bands / single grade (C1 Current) | **✓ opens on A* to A** | **✓ A to B** | **✓ D* to D** | **✓ D*D* to DD / D*D*D* to DDD** | **✓ 7 to 6** | ✗ | **✓ D* to Merit**; 2 years | **✓ A to B** | **✓ A* to A** | ✗ |
| Grade bands Trends (C1, C2, C3) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ~ 2 years | ~ 1 year (2024) | ✓ | ✗ |
| Grade counts, none / a selection | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✓ (130416); **~ note at 130432** | ✓ | ✓ | ✗ |
| C2 Context Current (Candidates) | ✓ | ~ group is "Other" (data family) | ✓ | ✓ | ✓ | ✗ | ✓ | ✓ | ✓ | ✗ |
| C2 Context on points | ✓ | ~ only itself carries points in "Other" (the family note says so) | **✓** | **✓** | ✓ | ✗ | ✓ | ✗ | ✗ | ✗ |
| C2 Context on bands | **✓ draws bands** (was points) | **✓** | **✓** | **✓** | **✓** | ✗ | **✓** | **✓** | **✓** | ✗ |
| C2 Context Trends | ✓ | ✓ | **✓** | **✓** | ✓ | ✗ | ~ bars | ~ | ~ | ✗ |
| C3 Current Map / Bar / Ranking (points) | **✓ exact; 7 comparators** (was 2) | **✗ note: no school in the set has AS Law** (data limit) | **✓ exact size; 4 FE comparators** | **✓** | **~ exact HL; 1 comparator** (boarding set; IB is rare) | ✗ | ~ 1 comparator | ✗ no points | ✗ no points | ✗ |
| C3 Current on rates / bands | **✓ 7 comparators** | ✗ 0 comparators (note) | **✓ bands; A*–E greyed** | ✓ | ~ 1 comparator | ✗ | ~ 1 | ~ 0–1 | ~ 3 | ✗ |
| C3 ranking tiles (headline) | ✓ | ✓ (school headline) | **~ note for a college without A levels** | **~ note** | **~ note for an IB-only school** | ✗ | **~ note** | n/a | n/a | n/a |
| C3 Trends Chart / table / maps | ✓ line | ✗ 0 comparators (note) | **✓ real 4-year lines** | **✓** | ~ 1 comparator | ✗ | ~ table only (2 years) | ✗ | ~ rates only | ✗ |

## What remains, and why

| What | Why | Option |
|---|---|---|
| IB Diploma total | Not a subject (R-IB-NONSUBJECT); grade rows only, no points, no England figure | A whole-school "Diploma average out of 45" tile (v1's B2) |
| Pre-U, FSMQ, AEA | No current entries | None needed |
| AS Law, Croydon (no comparators) | No school in the Post-16 set takes AS Law: a data limit | The note says so; a saved set or a ranking reaches further |
| IB comparators (Sevenoaks: 1) | Few schools offer IB; Sevenoaks' default is its boarding recipe | A saved set, or a ranking on IB later |
| T Level (2 years) | Only 2023/24 and 2024/25 published | Bars until a third year |
| Croydon's T Levels | DfE publishes them only for all pathways together | The note |
| Core Maths / EPQ points | DfE scores neither | Grades and bands work |
| Area views for EPQ, Core Maths, VRQ, AEA, Pre-U; London LAs | No area rows published | The "no area rows" note |
| Ranking headline for colleges / IB-only schools | The Post-16 headline is A-level points per entry | A per-family headline (logged as a later option) |
| AS in Context | Its family is "Other" (with EPQ, Core Maths), so on points only itself scores | The family note says so |
