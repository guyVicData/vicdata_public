# Teacher view — Current panel rework, round 1 (Claude Code prompt v1)

Ground every step against the real files named below — re-check anything version sensitive. `vicdata_public` only. Trends (row 2) is out of scope this round, including the geography comparison inside Column 1's Trends panel — leave it exactly as it is.

## Step 0 — re-ground

Read `CandidatesPanels.tsx`'s `current: PanelRender` block, `SubjectPanels.tsx`'s `current: PanelRender` block (both its GCSE/Post-16 and Results/Context uses), `ComparisonsPanels.tsx`'s `current: PanelRender` block, and `ContextPills.tsx` in full. Confirm the real shape of `currentLabel`, `CompareAgainstId`, and each column's `current.tag` construction hasn't moved since this prompt was written.

## Step 1 — universal Current tag

In each of `CandidatesPanels.tsx`, `SubjectPanels.tsx`, `ComparisonsPanels.tsx`, change `current.tag` to the fixed string `"Current"` and move the date into `current.afterTag` as plain regular-weight text (`"Data " + academicYearLabel(latest)` or equivalent — match the real date-formatting helper each file already uses). This replaces `currentLabel`-based tag strings everywhere they build `current.tag` — but `currentLabel` itself (and the richer strings like "Av. Points", "{category} Context", "Results against {saved set}") isn't deleted; it's the raw material for the new per-view titles in Step 3, so keep it threaded through.

## Step 2 — move Bar chart and Ranked list, Column 1 (Candidates variant) → Column 2 (Context)

In `CandidatesPanels.tsx`: remove the "Bar chart" and "Ranked list" `IconButton`s from `current.actions`, remove the `view === "bars"`/else-ranked-list branches from `current.body`, and remove `view` state entirely if nothing else in the file needs it — Current becomes Number tiles only, no action rail. Do NOT touch `SubjectPanels.tsx`'s own Bar chart / Sortable table (the Results variant) — those are a different, not-yet-authorised move; leave them as they are.

In `SubjectPanels.tsx`'s Context call site specifically: add "Bar chart" and "Ranked list" to Context's Current `actions`/`body`, reusing `CandidatesPanels.tsx`'s real `VerticalBars`/ranked-list rendering (the same components, not a reimplementation) fed by whichever subject set the compare-against pill currently resolves to (Step 3) rather than a fixed category list. Bar chart becomes Context's default view (`useState` initial value), replacing whatever's default today.

## Step 3 — Context's new "Subject category" compare-against group

In `ContextPills.tsx`: extend `CompareAgainstId` to `"whole" | "selected" | "category"`, add a `MenuRow` for "Subject category" in the `PillMenu`, and make it the default initial value wherever `against`'s starting state is set (in the page or wherever Context's own state lives — find the real initial-state assignment, don't guess a default prop). Find the real subject list `CandidatesPanels.tsx`'s Bar chart/Ranked list/category comparison already reads (the `subjects` prop, category-scoped) and wire the SAME source into Context for the new "category" option — no new fetch or derivation. When `against === "category"`, Context's donut, Bar chart and Ranked list should all read this list; when `"whole"`/`"selected"`, they keep reading whatever they read today.

## Step 4 — titles

Add (reuse the Trends round's `ViewTitle` component from `SeriesViews.tsx`) a title above every Current view named below. Two are exact, given by Guy — use this wording verbatim, substituting real values:

- Column 1 (Candidates), Number tiles: `"{subjectLabel} Candidates: {dataDate}"` — e.g. "Maths (General) Candidates: 2024/25".
- Column 2 (Context), donut: `"Entries in {subjectLabel} as a proportion of {compareAgainstGroupLabel}"` — e.g. "Entries in Maths (General) as a proportion of Sciences & Maths". `{compareAgainstGroupLabel}` should read naturally for all three group choices (category label, "all subjects", or the selected-subjects set's own label/count) — find or write the real label each already has rather than inventing new phrasing.

The rest are modelled, not yet confirmed with Guy — implement them so nothing is titleless today, but flag in the build report that these specific ones are provisional and may get reworded:

- Column 2, Bar chart / Ranked list: `"Entries by subject in {compareAgainstGroupLabel}"`.
- Column 3 (Comparisons), Map or Number tiles (whichever is active): `"{subjectLabel} entries by school, on the map"` / `"{subjectLabel}'s rank in {setLabel}"`.
- Column 3, Bar chart: `"Entries by school in {setLabel}"`.
- Column 3, Ranking: `"Schools ranked by {subjectLabel} entries in {setLabel}"`.

Use each component's own real variables (`subjectLabel`, `categoryLabel`, `setLabel`/`setNoun`, `academicYearLabel(...)`) — no placeholder text.

## Verify

- Column 1 (Candidates): Current shows only Number tiles, no action rail, tag reads "Current" + "Data {date}", title reads "{subject} Candidates: {date}".
- Column 1 (Results variant): unchanged — still has its own Bar chart/Sortable table, only its tag construction changed per Step 1.
- Column 2: Compare-against pill has three options, "Subject category" is selected by default and shows the same subjects Column 1 used to; Bar chart is the default view; donut/Bar chart/Ranked list titles read correctly for all three group choices.
- Column 3: tag updated, three views each have a title, content otherwise unchanged.
- Trends panels, in every column: byte-for-byte unchanged.
- `tsc`, `eslint`, `next build` clean.
- Screenshot Column 1 and Column 2 together, real subject, before/after.
