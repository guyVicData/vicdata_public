# Teacher View — two small fixes: Column 1 category subheading spacing, Column 3 Trends table-only when too few years

Two independent detail fixes. Ground truth checked against HEAD `c339134` in `vicdata_public` — re-read before editing since line numbers may have shifted. One commit each.

## 1. Column 1, Panel 1 (Current) — more space below the category subheading

**Where:** `src/components/teacher/SubjectPanels.tsx`, the `render.current` override (~L645-661). When a subject is focused within a category that has more than one subject, the panel prepends a subheading before the chart/table:

```tsx
<p className="shrink-0 text-[12px] font-semibold text-[var(--muted2)]">
  {measure.id === "entries" ? "Entries" : "Results"} in {categoryLabel}
</p>
{current.body(fullscreen)}
```

("Results in Humanities & Social Sciences" / "Entries in ..." depending on the shared measure toggle.)

**Problem:** the `<p>` has no bottom margin, so the bar chart or table underneath sits right against it — too cramped.

**Fix:** add bottom spacing to the `<p>` (e.g. `mb-2`, adjust to taste against the file's existing rhythm — `gap-2`/`gap-2.5` elsewhere in this codebase). This wrapper is shared by both the graph and table views of Panel 1 (`current.body(fullscreen)` renders whichever is active), so one change fixes both — no need to touch the graph/table components themselves.

## 2. Column 3, Panel 2 (Trends) — table only until there's enough data for a real line

**Where:** `src/components/teacher/ComparisonsPanels.tsx`, the `trend: PanelRender` block (~L465-507).

**Problem:** `TrendChart` (used when `trendView !== "table"`) already falls back to a bars-per-year rendering (`TrendBars`, via `trendChartKind()` in `TrendChart.tsx` ~L94) when there are fewer than `TREND_LINE_MIN_YEARS` (4) real years — genuinely correct for a shared-scale line, which needs several points to read as a line at all. But Comparisons currently still offers the "Chart" toggle in that state, so the user can flip to a 2-bars-per-year view that isn't really a trend line — Guy wants the toggle gone entirely in that state, table only, until there's enough span for the real line chart.

**Fix:**
- Compute `const hasTrendLine = trendChartKind(trendData) === "line";` (same helper already imported and used at ~L486) before the `trend` object.
- `actions` (~L490-495): when `!hasTrendLine`, render nothing (`undefined`) instead of the Chart/Table `IconButton` pair — there's only one view, so no toggle is needed.
- `body` (~L497-507): when `!hasTrendLine`, always render the `YearTable` branch regardless of `trendView` state (covers the case where `trendView` is still `"chart"` from a subject that did have enough years, before the focus changed to one that doesn't).
- `footerLead` (~L482-488): when `!hasTrendLine`, render `undefined` instead of the `TrendLineToggle` — there's no chart to fit a trend line onto, so a disabled toggle with nothing to act on is just clutter. (Its `disabled` condition already checks `trendChartKind(trendData) === "bars"` for the same reason; simplest is to gate the whole element on `hasTrendLine` rather than lean on `disabled`.)

**Acceptance:** Comparisons → Results → Grade 4+ rate → any subject (currently 2 real years, 2023/24–2024/25): Trends panel shows the table straightaway, no Chart/Table toggle, no trend-line-fit control. Comparisons → Results → Av. Points (4+ real years): unchanged, Chart/Table toggle and fit control both present as before.

Not in scope: `SubjectPanels.tsx`'s own non-redesigned Trend panel (Results/Context "all" scope, ~L486) uses the same `trendChartKind` check for its fit-toggle `disabled` state and could have the identical issue — flagging in case it's wanted too, but this prompt only covers Column 3.
