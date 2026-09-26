# Teacher View — Comparisons %Change → ChangeList, Trends pp-change bar, real Grade 4+ comparator data

Three fixes from the latest review round, confirmed against real data live on The Chase (GCSE, Maths (General)) and against the actual code paths. Investigation only — discussion, verification and the Design-canvas wireframe are Guy's own; all of this is for you to build. One commit per item.

Wireframe reference (real data, both options shown for item 2): `https://claude.ai/artifact/3Mu1shp1U9SF8RxPDXTDaw`, board **"Comparisons %Change, Trends scale, Grade4+ data fix"** (canvas.json key `Round9Fixes.dc.html`).

---

## 1. Comparisons % Change (Column 3) — stop building a new chart, reuse `ChangeList`

**Problem.** `ComparisonsPanels.tsx` (~L521-528) renders `ChangeChart` with exactly two bars — "You" and whichever one thing the "vs:" selector currently points at (one named school, or the average). It never shows where the other comparator schools actually sit, and reading it means clicking through the selector one school at a time. The table view (`changeTable`, ~L416, rendered ~L517-520) already shows every school ranked with no selector, and Guy has confirmed that table is right — the bar chart just needs to match it.

**The fix already exists in the codebase.** `SeriesViews.tsx` (~L217-287) has `ChangeList` — Option H: a ranked, diverging bar-per-row list, own row picked out via `focusKey`, group average as a dashed reference line, rank number, full value beside every bar. It's already used this exact way by `CandidatesPanels.tsx` (~L343) and `SubjectPanels.tsx` (~L606) for their own % Change panels. Comparisons' % Change panel is the odd one out still using the bespoke 2-bar `ChangeChart`.

**Do this:**
- In `ComparisonsPanels.tsx`, replace the `ChangeChart` call (~L521-528) with `ChangeList`, built from `changeTable.series` (the same data already driving the table — every school in the set, "own" row first): one `ChangeRow` per school (`key`, `label`, `colour`, `percent` from `percentChange(series.values)`), `focusKey="own"`, and `group` set to the average across `others` (the same value already computed for `versusValues` when `versus === AVERAGE`, ~L358-360 — compute its own `percentChange` rather than re-deriving from `versusPct`, since `versusPct` currently follows whichever school the selector points at).
- Remove the "vs:" selector from this panel's `controls` (~L502-504) — `changeVersusOpen`/`changeVersusRef`/`versusPill` stay for the Trend panel above it (unaffected, out of scope here), just not repeated on % Change. Drop the now-unused `versusPct`/`versusSchool` reads that were feeding `ChangeChart` specifically, once nothing else in this panel needs them.
- `ChangeChart.tsx` itself can stay (used elsewhere, if anywhere — check) or be deleted if this was its only caller.

**Acceptance:** Comparisons → Results → Av. Points → % Change, chart view, shows one row per comparator school (own row highlighted, matching the table's order and figures), a dashed average line, no selector. Numbers match the table view exactly (This school +6%, Dyson Perrins +2%, Nunnery Wood −1%, Blessed Edward Oldcorne −3%, John Masefield −6%, Hanley Castle −9%, Christopher Whitehead −13%, average −5% — verified live).

---

## 2. Grade 4+ rate Trends — replace the slope-row fallback with a simple pp-change bar list

**Problem.** `SeriesViews.tsx`'s `TrendList` (~L114-186, the `MultiTrend` fallback used below `TREND_LINE_MIN_YEARS`) draws a dot-per-year slope row on a shared scale. It's correctly labelled now (the `formatDelta` fix already shipped), but the scale still runs the measure's full `barScaleMax` (0–100% for the threshold measure), and real Grade 4+ figures cluster in a narrow band (70–100% for Column 1, 49–88% for Column 2) — every row's dots bunch together and the actual differences between subjects are hard to see.

Guy has seen both a scale-zoom option and a "simpler bar chart" option side by side (wireframe board above) and prefers the bar chart, for the same reason as item 1: it's the same ranked-diverging-bar pattern already in the codebase, rather than a second bespoke mechanism.

**Do this:**
- In `MultiTrend` (~L76-84), when `!multiTrendHasLine(data)`, render a ranked bar list instead of `TrendList`'s slope rows — reuse `ChangeList`'s pattern, but ranked and coloured by the *first-to-last delta in the measure's own units* (`measure.formatDelta`), not by percent change. `ChangeList` today is hardcoded to percent (`ChangeRow.percent`, formatted with `signed(..., (v) => \`${v}%\`)`, ~L226-274) — that's correct for items 1/CandidatesPanels/SubjectPanels (all genuinely percent-based), but wrong for this case: Grade 4+ rate's own delta is percentage-*points*, a different number from its percent change (Maths (General): +6pp vs +7%, confirmed live).
  - Generalise: give `ChangeList` (or a sibling using the same layout) a `formatValue: (v: number) => string` prop and a `value` field on the row type in place of the hardcoded `percent`/`%`, mirroring the pattern `ViewChart` already uses (`formatValue` prop, ~L38 of `ViewChart.tsx`) so "a measure formats its own values, the chart doesn't infer the unit." Default `formatValue` to today's signed-percent behaviour so `CandidatesPanels`/`SubjectPanels`'s existing calls need no change.
  - For this fallback, pass `value = changeOver(s.values)?.delta ?? null` and `formatValue = measure.formatDelta`, ranked by that same delta — i.e. exactly `TrendList`'s existing `changeOver`/`directionOf` calculation (~L127-129), just rendered as ranked bars instead of dots-on-a-line. No group average line needed here (nothing to benchmark against) — pass no `group`.
- This replaces `TrendList` for every measure that hits the "not enough years" fallback, not just the threshold measure — for points/entries, `formatDelta` there is already the right choice (its own point/count units), so behaviour there is a like-for-like swap, just as a bar instead of a slope row.
- `TrendList` and its dot-opacity mechanism (`opacity()`, ~L120) become dead code once nothing calls it — safe to delete rather than leave unreferenced.

**Acceptance:** Results Trends (Column 1) and Context Trends (Column 2), Grade 4+ rate measure, both show a ranked bar per subject, own subject picked out, bar length and bold figure in pp (e.g. Science Double Award +8pp longest, Maths (General) +6pp picked out, down to Biology/Physics/Electronics +2pp each for Column 1; Computer Science +20pp longest positive, Photography −23pp longest negative for Column 2 — verified live figures, both directions render correctly). Av. Points Trends (which already has enough years for the real line chart) is unaffected.

---

## 3. Comparisons, Grade 4+ rate — the "not available" message is wrong; wire in the real data

**Correction, not a new finding:** the previous round shipped `page.tsx`'s `unavailableNote` (~L1636-1638) as an honest "data doesn't exist" message. It doesn't — Guy was right to question it. Here's exactly where it's wrong and how to fix it.

**What's actually going on.** `comparatorSubjectSeries` (`page.tsx` ~L1098-1109) is built from `mapProfiles` (fetched lazily via `/api/data-view/academic-schools?...&includeSubjects=1`, which calls `fetchAcademicProfiles(urns, {includeSubjects})` → `fetchSubjectHeadlineForSchools`, `academic-data-view.ts` ~L1255). That pipeline's `AcademicSubjectHeadlineEntry` type (~L1230-1250) genuinely only carries `entriesTotal`/`avgPointScore` — no grade distribution, no threshold. *For that specific pipeline*, the note was factually accurate.

But it's not the only pipeline. The target school's own Grade 4+ rate never comes from that route at all — it comes from `gradeRows` state (~L95), populated from `subjectData.gradeDistribution` in the main dashboard payload, which is `fetchSubjectLevelDataForSchools([urn], phase)` (`route.ts` ~L149) → `academic-data-view.ts` ~L1193-1226. That function already accepts a whole array of URNs (`lookupReferenceData({ sourceId: "dfe_ks4_subject_entries", entityIds: urns })`, one batched call regardless of set size, `byUrn` map keyed per school) — it's simply only ever called with `[urn]`. The exact same batched call, given the comparator URNs too, already exists and is already proven at comparator-set scale: `academic-subject-comparison/route.ts` (~L68) calls it as `fetchSubjectLevelDataForSchools(urns, stage)` across the whole set for the Data View's subject deep-dive, specifically because "the raw-fact batched fetch... needs real per-school grade profile for the comparison side too."

**Do this:**
- Extend whichever request already supplies `mapProfiles`' URN set (`/api/data-view/academic-schools`, or a sibling call triggered alongside it — your call which is cleaner) to also fetch `fetchSubjectLevelDataForSchools(urns, phase)` for those same URNs, and return each school's `gradeDistribution` (`SubjectGradeCount[]`, identical shape to `gradeRows`) keyed by URN.
- In `page.tsx`, hold that as e.g. `comparatorGradeRows: Record<string, SubjectGradeCount[]>`, and when building `comparatorSubjectSeries` (~L1098-1109) under `usingThreshold`, compute each comparator school's per-period rate the same way `thresholdAt()` already does for the target school (~L838-842): filter that school's rows to `activeMapChip.subject` + qualification type + period, then `thresholdRate(rows, phase)?.rate`. Populate `SchoolSeries.results` with those values (the field `seriesFor` already reads generically for "Results" mode, regardless of which measure is active, ~L193 `ComparisonsPanels.tsx`) instead of leaving threshold mode's `results` empty.
- Narrow `unavailableNote` (~L1636-1638) so it only fires when a comparator school genuinely has no published grade-distribution row for that specific subject/qualification (the real "not available" case — some schools won't offer every subject) — not unconditionally whenever the threshold measure is active with a subject focused.

**Acceptance:** Comparisons → Results → Grade 4+ rate → Maths (General): Trends and % Change panels show real per-school figures for every comparator school that publishes that subject, the same way Av. Points already does — no caveat message except for a school that genuinely doesn't offer the subject.

---

Real data used throughout, verified live against The Chase, GCSE, 2024/25 (preview session): Maths (General) is the focus subject; comparator set is the nearest 10 schools; other real figures (Grade 4+ rate first→last, Column 1: Biology 98→100, Chemistry (General) 96→100, Physics (General) 96→98, Electronics (Physics) 89→91, Maths (General) 78→83, Science Double Award 70→78; Column 2 also includes French Language 71→83, Computer Science 49→69, Photography 88→65, D & T 69→60) are on the wireframe board if useful as fixtures.
