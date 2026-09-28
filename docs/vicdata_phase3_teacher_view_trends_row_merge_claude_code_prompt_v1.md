# Teacher view — Trends row merge & view titles (Claude Code prompt v1)

Ground every step against the real files named below — re-check anything version sensitive, this repo moves fast, and note any drift in the build report the way earlier rounds have. `vicdata_public` only; no backend change.

## Step 0 — re-ground the panel model

Read `src/lib/teacher-view-panels.ts` (`PanelId`, `PANEL_ORDER`, `DEFAULT_PANELS`, `panelsFrom`, `togglePanel`) and `src/components/teacher/ColumnPanels.tsx` in full (the accordion mechanism, `PanelRender`, `PANEL_NAME`). Confirm nothing has moved since this prompt was written; if it has, follow the real current shape and note the drift.

## Step 1 — shrink the panel model

`PanelId = "current" | "trend"` (drop `"change"`). `PANEL_ORDER` becomes `["current", "trend"]`. `DEFAULT_PANELS` stays `["current"]`. `PANEL_NAME` drops its `change` entry; `trend`'s is already `"trends"`, so the merged panel's toggle/aria labels need no wording change. Leave `panelsFrom`'s filter mechanism as-is — a saved `"change"` id is silently dropped by the existing `.filter(p => saved.includes(p))`, which is the accepted behaviour for this round (see brief); do not add a migration step unless one already half-exists.

## Step 2 — merge each column's Trend and Change into one panel

For `CandidatesPanels.tsx`, `SubjectPanels.tsx` (covers both the Results and Context call sites), and `ComparisonsPanels.tsx`:

- Combine the two view-state hooks (e.g. `trendView`/`changeView`, `useState<"chart"|"actual"|"table">` and `useState<"chart"|"table">`) into one enum covering every real option that component currently offers across both panels. This prompt's naming (`"indexed" | "actual" | "trendTable" | "changeRanked" | "changeChart" | "changeTable"` etc.) is illustrative, not a contract — match whatever's actually there once you're in the file. Keep whichever of the two panels currently picks a sensible default view as the merged panel's default.
- Concatenate the two `actions` arrays into one rail, Trend-then-Change order, relabelling anywhere the same word appears twice: "Table" in both halves becomes "Trend table" / "Change table"; Comparisons' "Map" (Trend's absolute-change colouring vs. Change's %-change colouring) becomes "Trend map" / "Change map". Leave every button that already has a distinct label (Candidates' "Ranked change"/"Indexed"/"Actual", Comparisons' "Ranked bars") exactly as it reads today.
- `body` becomes one switch over the merged enum, calling exactly the same real sub-components each option already calls today (`MultiTrend`, `YearTable`, `ChangeList`, `GeographyView`, `RankingsMap` via each column's own map helper) — this step must not change what any option renders, only which panel it lives in and what its button is called.
- Merge `tag`/`afterTag`/`question`/`footerLead`/`flag`/`legend`/`headline`/`summary`/`source` sensibly for a single panel — default to Trend's own version of each field, and where Change's version is clearly the better fit for a merged panel, say so in the build report rather than guessing which one Guy would want; don't silently drop one panel's summary/source sentence if the two disagree — keep whichever's real content is more complete.
- Update the parent `render={{ current, trend, change }}` call to `render={{ current, trend }}` in each component.

## Step 3 — give every view a real title line

Add (or generalise from `SeriesViews.tsx`'s existing `TrendScaleTitle`) one small shared component — same visual treatment (`text-[12px] font-semibold text-[var(--muted2)]`, sits directly above the body) — and call it from every view in the merged panel, in every column, so nothing in the merged rail is titleless. Two kinds of view are ALREADY real and good — leave them exactly as they are, do not rewrite or re-verify their wording, just carry them into the merged panel unchanged:

- Trend's Indexed/Actual chart views (`TrendScaleTitle`'s own sentence), in Candidates and SubjectPanels.
- The % Change geography-comparison views (school vs. LA/region/England) in both Candidates and SubjectPanels — chart AND table — via `GeographyComparison.tsx`'s own real heading, "{geography.label} against the wider system". This already reads clearly; nothing to add here.

Everywhere else is a real, confirmed gap — this is the precise list, do not go looking for others or re-titling views not named here:

- **Comparisons' Trend map and Change map** — titleless today (only an internal legend label inside `RankingsMap`, which stays, and is not a substitute for a page-level title): give each its own line naming what's coloured and since when — e.g. "Change since {fromYear}, coloured by school" for Trend's absolute-change map, "% change since {fromYear}, coloured by school" for Change's %-change map, using the real `academicYearLabel`/period values each map already computes.
- **Comparisons' Trend table, Change table, Change ranked bars** — titleless today: name the scope ("every comparator school") and shape ("by year" / "{fromYear} vs latest, ranked by change" / "ranked against comparator schools") from the real `setLabel`/`changeSince` values already in scope.
- **SubjectPanels' Trend map** — titleless today: name the real subject label already in scope, plus "change by school, on the map".
- **SubjectPanels' % Change ranked list and table, non-geography mode** — titleless today (confirmed: `SubjectPanels.tsx`'s `render={{ current, trend, change }}` wraps only `current` in its category-scope title; `trend` and `change` are passed through raw). Fix this the same way Candidates already does it for its own equivalent views: wrap with the same category-scope line Candidates' `titled()` uses ("Entries in {categoryLabel}" / "Results in {categoryLabel}", by `measure.id`), so the wording matches across columns rather than inventing a second phrasing.
- **Candidates' % Change ranked list and table when there is no category to name** (a lone subject, so `titled()`'s own condition — `group && categoryLabel` — is false and nothing is shown): give this case a plain fallback title naming the shape alone, e.g. "Entries by year, since {fromYear}", rather than leaving it silent.

Use the real label/period/measure values already computed in each component (`categoryLabel`, `subjectLabel`, `geography.label`, `setLabel`, `academicYearLabel(...)`, `measure.noun`) — do not invent a generic placeholder like "Chart view" where a real, specific noun is one variable away. Where a view's existing summary/caption sentence already says the same thing the title would, don't duplicate it word-for-word — shorten the title to what the summary doesn't already cover, or leave the summary as the fuller version and keep the title terse.

## Verify

- Every one of the merged panel's view buttons, in every one of the three components, across at least one GCSE and one Post-16 subject: a real title line sits above the chart/table/map, distinct enough from every other view's title in the same rail that a screenshot of the body alone (no button rail visible) tells you which view it is.
- No two buttons in the same rail share a label.
- Nothing that was reachable before the merge is unreachable after it — every real option from the old Trend and Change panels still has a button.
- A saved "change" panel-open preference from before this round doesn't error; the merged panel just isn't force-opened by it (per Step 1).
- `tsc`, `eslint`, `next build` clean.
- Screenshot at least one column (real school, real subject) before/after so the merge and the new titles can be sanity-checked visually, the way earlier rounds' screenshots were.
