# Teacher view — dashboard card mechanism, Round 7: Claude Code prompt

Read `docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round6_brief_v1.md` and `docs/vicdata_phase3_teacher_view_dashboard_card_mechanism_round7_polish_brief_v1.md` in full before writing any code. Round 7 is a direct follow-on to round 6's build, found by walking through the real, deployed GCSE dashboard live (school: The Chase, URN 100053) rather than the wireframe. §0 of the round-7 brief is not optional: **every fix below applies to the 16+ (Post-16/KS5) dashboard as well as GCSE (KS4)** — implement each one in the shared components both phases already use, and verify both phases, not just KS4.

You are authorised to commit **and push** this round, the same one-off basis as round 6 — Guy asked directly for this round to be built, committed and pushed.

## Build order

### 1. Header row + built-dashboard icon (all four columns, both phases) — brief §1

Single-line header: the existing per-column icon (person/bar-chart/clock/medal) + title + subtitle on the left, "+ Add" on the right, one row. Don't drop the real icon in favour of the wireframe's plainer layout — combine them.

### 2. Panel heading style (every panel, both phases) — brief §2

Remove the pill/background behind panel tags ("Current — 2024/25", "Average point score — 2020/21–2024/25", etc.) — plain text, no background, font size scaled up slightly so it doesn't read as a demotion from the current styling.

### 3. Icon row split (every panel, both phases) — brief §3

Top-right: exactly two icons — fullscreen (swap in the wireframe's cleaner fullscreen glyph) and close/remove. Top-left, under the heading: the view-choice icons (chart/table/donut/bar/graph/map/ranking, whichever apply to that panel).

### 4. Chart type by real data length (every Trend panel, both phases) — brief §4

3 real years or fewer → vertical bar chart. 4 real years or more → line chart. This is a genuine threshold, not a rough guideline — test right at the boundary (a series with exactly 3 real years, and one with exactly 4).

### 5. Bar chart Y-axis autoscale (both phases) — brief §5

Largest real value fills 100% of the chart height. No fixed/padded axis maximum beyond what the real data needs.

### 6. Fix the Trend panel period/value bug — brief §7

**Repro case**: The Chase (URN 100053), GCSE, Results column, Trend panel, Maths (General). The panel currently narrates "grown from 4.9 to 5.2 ... since 2020/21" — neither the figure nor the period is real. Confirmed directly against production: `academic_subject_headline.avg_point_score` is null for The Chase's Maths (General) at period 2020, and the real values are 5.18 / 5.15 / 5.36 / 5.14 for periods 2021–2024.

This is not a chart-geometry issue — `TrendChart.tsx`'s line-plotting and x-axis-label positions share the identical formula, so they can't drift apart from each other visually. Trace the period-to-value pairing upstream of the chart component, in whatever builds the trimmed trend series (the leading-null-stripping step is the most likely place a periods array and a values array stop lining up). The same symptom showed on Context's "All subjects" aggregate trend for the same school — check whether the fix needs to happen once, in a shared helper, or separately per column. Re-test against the exact repro case above, plus at least one other school/subject with a genuine leading gap, before calling this fixed.

### 7. Context — split into two pills — brief §8

Replace the single combined "Compare against + Measure" dropdown with two separate pills, matching Comparisons' pattern exactly (same pill styling, same popover mechanism). This reverses round 6 §4.2's explicit "one combined dropdown, deliberately different from Comparisons" decision — that reversal is confirmed, not accidental; make the change cleanly rather than leaving traces of the combined-dropdown approach behind.

### 8. Comparisons — make Graph and Ranking subject-specific — brief §9

The Map view already computes real per-subject rank across the comparator set (`mapChips`/`mapRank`). Extend Graph and Ranking, and the "Measure" pill, to use that same per-subject data source and the same ticked-subject chip selection the Map already offers, rather than staying limited to whole-school Attainment 8. Round 6's assumption that comparator data was whole-school-only (§6.7) was wrong — the Map already disproves it; don't rebuild per-subject comparator data fetching, reuse whatever the Map already calls.

## Verification and build report

Follow round 7 brief §10's checklist — including confirming every item on KS5/Post-16, not just KS4 — on top of round 6's own §7 checklist where still relevant. Write a build report in the usual format, naming the real school(s)/subject(s) verified against, with a "simplifications made without you there to confirm" section for anything genuinely judged. Stage commits per numbered section above (same pattern as round 6), each `tsc --noEmit`/`eslint`/production-build clean before the next, and push each section once it's clean — you're authorised to push this round, per Guy's instruction above.
