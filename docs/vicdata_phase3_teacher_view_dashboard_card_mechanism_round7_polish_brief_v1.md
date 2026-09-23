# Teacher view — dashboard card mechanism, Round 7: UI refinements & data findings (brief)

## 0. Scope and parity requirement — read first

Everything below was reviewed live against the **GCSE (KS4)** dashboard only (school: The Chase, URN 100053). **Every point in this brief applies equally to the 16+ (Post-16/KS5) dashboard.** Implement each fix once, in the shared components both dashboards already use, rather than twice — and verify both phases before calling any item done. Keeping the two in sync is a requirement of this round, not a nice-to-have.

## 1. Header row (all four columns)

The wireframe's single-line header — icon + title + subtitle on the left, "+ Add" on the right, one row — is good, and should replace the current two-line treatment. But keep the built dashboard's own per-column icon (the small circular icon already shipped: person for Candidates, bar chart for Results, clock for Context, medal for Comparisons) rather than dropping it for the wireframe's plain layout. Combine the two: real icon, wireframe's single-line arrangement.

## 2. Panel heading style (every panel — Current, Trend, % change)

Remove the pill/background behind tags like "Current — 2024/25" and "Average point score — 2020/21–2024/25" — as built, it reads as a clickable button, which it isn't. Plain text, no background, with the font size scaled up slightly so it doesn't read as a demotion.

## 3. Icon row decluttering (every panel)

Currently up to 4 icons crowd the top-right of each panel (view toggles + fullscreen + remove). Split this:
- **Top-right**: exactly two icons — fullscreen (using the wireframe's cleaner fullscreen glyph, not the one currently shipped) and close/remove.
- **Top-left, under the panel heading**: the view-choice icons (chart/table/donut/bar/graph/map/ranking, whichever apply to that panel).

## 4. Chart type by data length (every Trend panel)

- **3 real years of data or fewer → vertical bar chart.**
- **4 real years or more → line chart.**

This replaces always defaulting to a line chart regardless of how few points it has to plot — a 2-point line overstates precision a short series doesn't have.

## 5. Chart Y-axis scale (bar charts)

Autoscale so the largest real value fills 100% of the chart height, rather than a fixed/padded axis maximum that leaves the bars looking small (e.g. Candidates' Current chart currently scales to 500 when the tallest real bar is 231).

## 6. Data finding — how many real years Results actually has

Checked directly against the live production `academic_subject_headline` table, not assumed:

- Real, non-null `avg_point_score` exists for **4 years**: 2021/22 through 2024/25.
- **2020/21 has rows (entries are recorded) but `avg_point_score` is null for every school and every subject that year, nationwide** — confirmed at the whole-table level, not just for one school. This is a genuine DfE-wide gap: 2020/21 GCSE grades were teacher-assessed (COVID), and DfE never published average point scores for that cohort. It is not a missing ingest, and there is nothing to backfill.

So: Results genuinely has 4 real years — enough for a line chart under §4. Candidates/Grade 4+ genuinely has only 2 real years (2023/24–2024/25, per the subject-level ingest brief's own confirmed check against the EES release pages) — enough only for a bar chart under §4. The two measures are reading from two different DfE datasets with two different real histories; this is not an inconsistency to fix, just a fact to design around.

## 7. Bug — Results Trend panel shows a period/value that isn't real

**Reproducible case**: The Chase (URN 100053), GCSE dashboard, Results column, Trend panel, subject Maths (General).

The panel's own narrative currently reads *"grown from 4.9 to 5.2 ... since 2020/21."* Checked directly against production: Maths (General)'s `avg_point_score` for The Chase is **null** at 2020/21 (per §6 above), and the real values are 5.18 / 5.15 / 5.36 / 5.14 for 2021/22 through 2024/25. Neither the "4.9" figure nor "2020/21" as a starting point corresponds to any real row for this school and subject.

This is not a chart-geometry bug — `TrendChart.tsx`'s line-plotting and its x-axis tick labels use the identical position formula, so they cannot visually drift apart from each other. The likely cause is upstream: a period-to-value indexing mismatch in how the leading null period gets stripped when the trimmed trend series is built, so the label/narrative end up describing the wrong period. The same symptom appeared on Context's "All subjects" aggregate trend for the same school, so this is likely systemic rather than a one-subject fluke — trace it against the repro case above rather than guessing at a fix.

## 8. Context column

- **Header**: same fix as §1.
- **Split "Compare against" and "Measure" into two separate pills**, matching Comparisons' pattern, replacing the single combined dropdown.

**Flagging explicitly**: this reverses round 6's §4.2, which recorded the combined dropdown as Guy's deliberate, explicit choice — *"one combined dropdown, not two pills ... a deliberate difference from Comparisons."* Recording the reversal here so it's on the record rather than silently drifting from what was decided last round.

## 9. Comparisons column — Graph and Ranking should be subject-specific

The Map view already has real, working per-subject ranking — `mapChips`/`mapRank`, wired from an earlier round — genuinely live per-subject comparator data for the whole comparator set, already shipped and working today.

Graph and Ranking (this round's new views) and the "Measure" pill currently only read whole-school Attainment 8. That was built on an assumption in round 6's brief (§6.7) that comparator-school data was whole-school-headline only, "not per-subject" — an assumption the Map's own live mechanism disproves, since it's already computing real per-subject rank across the same comparator set. Graph and Ranking should be extended to use that same per-subject data source and the same ticked-subject chip selection the Map already offers, rather than staying limited to whole-school headline figures.

## 10. Verification checklist addendum (on top of round 6's §7)

- Every item above confirmed on the KS5/Post-16 dashboard, not only KS4.
- §7's bug re-tested against the exact repro case, plus at least one other school/subject known to have a genuine leading data gap.
- §4's bar/line switch tested right at the 3-vs-4-year boundary.
- §9's Graph/Ranking subject-specificity tested against a subject where the comparator set's own per-subject figures genuinely differ from their whole-school Attainment 8 rank (so the fix is visibly doing something, not coincidentally matching).
