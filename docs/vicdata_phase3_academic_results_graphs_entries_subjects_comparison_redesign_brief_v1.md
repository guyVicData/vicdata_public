# Graphs page: Entries pie charts + Subjects comparison-view redesign — brief for Claude Code

Guy's brief, 2026-09-14, plus four live corrections/confirmations from this planning session (quoted below). Two sections of Academic Results' Graphs page (`vicdata_public/src/components/data-view/AcademicGraphsView.tsx`): Section 01 "Entries" gets one new row; Section 03 "Subjects" gets restructured into a school-vs-comparison-set view. This doc describes what's being asked and what's already confirmed true of the current code — implementation is Claude Code's own call, per usual.

## Decisions confirmed live before this brief was written (don't re-litigate these)

1. **Section 03's default "comparison set" state is an average per category/subject, not a single blended number.** Guy's own words: "because we are showing multiple subjects it needs to be an average for each subject, and then switchable to an individual comparison school." So every row in Section 03 charts one value per category (or per subject, in subject mode) for the comparison side too — never one aggregate figure for the whole set.
2. **B) Candidates' right-hand panel is a market-share percentage, not a comparison-set total.** First stated as "total number (school) + comparison set total," then corrected live: "make candidates school's % of the total" → confirmed as **market share**: "this school accounts for X% of all [category] entries across the compared schools."
3. **B) Candidates is still a left/right split, same as the other three rows** — a further live correction reversing an earlier draft of this brief, which had wrongly made it a single chart. Guy's own words: "left school candidates totals per subject are, right a market-share chart... So it is a left/right split like the others." Left = school's own raw entries totals per category/subject (already built). Right = the market-share percentage (new). Treat this exactly like rows C and D structurally — the only thing that's different about Row B is what the right-hand value *is* (a ratio against the comparison-set total, not an average).
4. **C) Results stays as originally briefed**: school's own average point score (or value-added, in subject mode at KS5) next to the comparison set's **average** across schools, per category/subject — confirmed, no correction here.

## Section 01 "Entries" — new row

**Ask**: "New row at bottom of this section. 2 pie charts break down entries by subject category — one pie chart for school + one showing comparison set average."

- **Left pie (school)**: this already exists as a working component — `EntriesShareDonut` (same file), fed by `stageFamiliesLatest(targetProfile, stage)`. Reuse directly, don't rebuild.
- **Right pie (comparison set average)**: new. Per decision 1's spirit (average, not total-of-totals): for each category, average that category's own `entries_share_percent` **across each comparator school's own profile**, then plot that averaged distribution as a second pie. Not: sum every comparator school's raw entries into one combined pool and take shares of that pool — that's a different (total-based) number, and Guy's own wording here was "average," matching decision 1, not the total-based "market share" used for Section 03's Candidates row below. Worth stating the distinction plainly in whatever comment goes near this code, since the two rows use genuinely different arithmetic on data that looks superficially similar.
- **Data availability, checked**: `comparableGroup` (this file, ~line 296) already holds full `AcademicSchoolProfile` objects for every comparator-set school, and the existing bottom-of-Section-03 chart (`familyBarPointsWithScore`) already calls `familyYearsFor(p, stage, id)` per comparator profile `p` — so each comparator school's own family/category entries history, including whatever's needed to derive `entries_share_percent` per category, is already fetched and sitting in memory. This new pie is a client-side computation over data already on hand, not a new fetch.
- Wrap in the existing `Card` component (from `GraphsView.tsx`, already imported/reused throughout this file) so it gets the fullscreen-expand button for free, matching every other chart in this section.

## Section 03 "Subjects" — comparison-view redesign

### What's there today (read directly, not from memory)

`SubjectAreaSection.tsx`'s own header comment is explicit that today's version deliberately does **not** compare against other schools — "how do THIS school's own categories/subjects compare with EACH OTHER," not "with other schools" — that comparison job was left to the pre-existing content below it (the single-family avg-point-score-vs-comparator bar chart). Guy's closing line from that round ("I will think about how the comparisons work") was him deferring exactly this. He's now specified it.

Today's actual layout: one 2-column grid (Candidates chart | Results chart), each a single `SubjectAreaBarChart` plotting every category (or every subject, once a category's picked) as its own bar — school only. Below that, a second 2-column grid (Candidates % change | Results % change), same shape, using `SubjectAreaDivergingBarChart`. Both modes (category vs subject) already work from real data; the subject-level "Results % change" row is already deliberately omitted with an inline note, for a real reason (see below).

### New layout: four independently-expandable rows, each a left/right school-vs-comparison-set split

Per Guy's ask: "50-50... all rows can be opened to full screen... left hand side chart for the school, right hand side - comparison set view... selector to pick individual schools from the set for comparison (as we did for rolls)."

Each row becomes its own `Card` (free fullscreen, as in Section 01 above) containing a left/right split — **all four rows, including Candidates, per decision 3 above.**

| Row | Left (school) | Right (comparison set) |
|---|---|---|
| **B) Candidates** | School's own raw entries totals per category/subject (already built — `SubjectAreaBarChart`, `candidateItems`) | **Market share**: school's entries ÷ **sum** of every comparator school's entries in that category/subject, × 100. New chart, same `SubjectAreaBarChart` component with a percentage formatter. |
| **B) Candidates, % change** | School's own entries % change since baseline (already built — `SubjectAreaDivergingBarChart`, `candidatesTrendItems`) | Comparison-set's entries % change since baseline, computed the same total-based way as the pre-market-share Candidates ask (sum comparator entries at baseline year vs latest year, % change of that sum) — **stated assumption, not yet confirmed with Guy**, since his live corrections touched the raw Candidates row twice but never this one. Flag back if this reads wrong once built. |
| **C) Results** | School's own avg point score / value-added per category-subject (already built) | **Average** avg point score / value-added across the comparison set, per category/subject — or, when the selector (below) has one school picked, that one school's own figure instead of the average. |
| **D) Results, % change** | School's own % change (already built, category mode only today) | Comparison-set average's % change, same average-then-trend logic as C — **but inherits the exact same omission this component already applies on the school side**: KS4 subject level has no results figure to trend at all (omit both sides, existing note stays); KS5 subject level uses value-added, which centres on/crosses zero, so a % change is mathematically unstable and already deliberately withheld with a plain-text note today. The comparison-set side must follow the identical rule, not compute a technically-possible-but-misleading % change just because two value-added numbers can be divided. |

### The individual-school selector ("as we did for rolls")

Checked directly: **Rolls doesn't have quite this pattern already built**, so this needs new (small) UI, not a straight reuse. `RollTrendsChart.tsx`'s own "average toggle" is a mode-switch between "every school's own line shown" and "target + average only" — related in spirit (aggregate vs individual), but it's not a dropdown that picks one specific comparator school by name, which is what Guy's asking for here. Build a small selector (dropdown or similar) listing the comparator-set schools by name, defaulting to "Average across the set," which swaps the right-hand chart to that one school's own real figures instead of the set average/market-share when something's picked — applies to rows C and D, and to Row B's % change row. **Row B's own market-share row is the one exception**: a single school's share of the total doesn't have a meaningful "swap to one other school" reading in the same sense a plain average does (100% of one other school's own entries isn't the same kind of comparison) — leave the selector out of that specific row unless Guy asks for it once he sees the rest built.

### Data availability — the one real new backend lift

**Category mode** (whole school selected, no family picked): fully buildable from data already fetched. Confirmed by reading the existing code: `comparableGroup` already carries every comparator school's full profile, including `familyYearsFor` history per family — same data source the pre-existing bottom chart already uses for its own comparator bars.

**Subject mode** (a category picked, showing individual subjects): **not yet available**. `subjectData` (entries/valueAdded/subjectFamilyMap) is currently fetched only for the target school — `fetchSubjectLevelData(urn, stage)`, one URN. Extending the right-hand panel to subject level (both the "average across comparator set" default and the "one selected school" state) needs that same fetch repeated for every school in the comparator set — the average/market-share states need everyone's data regardless of what's selected, since both need the whole set's entries to compute against. Comparator sets here are normally small (Nearest 10 + target, per the existing default), so this is a bounded number of parallel calls, not an open-ended one, but it's genuinely new fetching work, not a client-side computation over what's already loaded the way Section 01's pie and Section 03's category mode are.

### Bottom of Section 03: unchanged

Guy's own words: "bottom - the current chart remains for now: Average point score per entry in Arts, Media & Design, 2024/25 — Acland Burghley School compared with Nearest 10 (any LA)." This is the existing `familyBarPointsWithScore` → `SortedBarChart` block (every comparator school as its own bar, target highlighted) — leave exactly as is, per instruction, underneath the four new rows above.
