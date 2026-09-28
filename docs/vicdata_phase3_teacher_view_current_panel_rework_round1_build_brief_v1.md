# Teacher view — Current panel rework, round 1 (build brief v1)

Guy reviewed Column 1 (Candidates) live against real data (The Chase, Maths General GCSE) and is now restructuring the Current panel (row 1) across columns. Trends (row 2) is explicitly a separate, later pass — nothing here touches it. Scope is deliberately tight so this can ship today; anything not named below is unchanged.

## The naming convention, all columns

Every Current panel gets the same tag treatment "Trends" already has: a fixed word ("Current") in the existing bold tag style, with the date alongside it in regular weight — not each column's own label (today: "Candidates — 2024/25", "Results — 2024/25", "{Category} Context — 2024/25", "Candidates at the {set} — 2024/25"). Concretely: `tag: "Current"`, and the date moves into `afterTag` as plain regular-weight text ("Data 2024/25") — the same slot `FromYearMenu` already occupies on Trends, just static text instead of a control here. This is a one-line change per column's `current: PanelRender`, real and mechanical.

The specific meaning each old tag carried (which subject, which comparison group, which measure) doesn't disappear — it moves into a real title on the view itself, the same `ViewTitle` mechanism the Trends round just built. Two of these titles are given by Guy directly; the rest are modelled below and flagged as such — check the wording with him before or shortly after shipping, they're not locked the way the two given ones are.

## Column 1 (Candidates variant) — real content move

Bar chart and Ranked list are the category comparison (verified: both read the same `subjects` list Trend's own category comparison uses — Maths General against Science Double Award, Biology, etc within Sciences & Maths). They move to Column 2. Column 1 keeps Number tiles only, so its `actions` view-switcher goes away entirely — one view, no rail.

Title on the remaining view: **"{Subject} Candidates: {data date}"** — e.g. "Maths (General) Candidates: 2024/25". Given directly by Guy.

**Scope note, flagged rather than assumed**: this was discussed and shown specifically on the Candidates variant of Column 1. The Results variant (`SubjectPanels`, when Results is the active tab) has its own analogous Bar chart / Sortable table views in Current, which are not named in this instruction. Leave Results' Current panel's views untouched this round — do not mirror the move there without checking with Guy first, even though the two panels are structurally similar.

## Column 2 (Context) — gains the move, gains a new default group

`ContextPills.tsx`'s `CompareAgainstId` is `"whole" | "selected"` today — a real prior round (S8) deliberately removed a third option, "Other subjects in {category}", specifically because Column 1 already covered that comparison and having it in both places was redundant. That reasoning holds; what's changing is where it lives. Add it back as `CompareAgainstId = "whole" | "selected" | "category"`, labelled "Subject category" in the pill, and make it the default (`against` initial state / whatever the column's default-group logic currently resolves to for "whole"). Whichever real category-comparison data Column 1's Bar chart and Ranked list already use (the `subjects` list, category-scoped) is the same data this option needs — don't re-fetch or re-derive it, wire the existing source through.

Column 2's Current panel gains Bar chart and Ranked list as additional views (moved from Column 1, same components/logic, reading whichever group is currently selected in the pill — category by default, but still correct if the user picks "All subjects" or "Selected subjects"). Bar chart becomes the default view, replacing whatever is default today.

Titles:
- Donut view: **"Entries in {Subject} as a proportion of {compare against group}"** — e.g. "Entries in Maths (General) as a proportion of Sciences & Maths" once category is the default group. Given directly by Guy.
- Bar chart / Ranked list (modelled, not yet confirmed): **"Entries by subject in {compare against group}"** — e.g. "Entries by subject in Sciences & Maths", or "…in all subjects" / "…in your selected subjects" for the other two group choices. Same construction as the donut's title, so the three views read as one family once someone's switching between them.

## Column 3 (Comparisons) — tag only, this round

No content changes were specified for Column 3. It still gets the universal tag convention ("Current" bold + "Data {date}" regular). Its three views (Map or Number tiles depending on whether a ranking set is active, Bar chart, Ranking) don't yet have real per-view titles — add them now while the mechanism's being built elsewhere, using the same modelled style, but treat these as more provisional than Column 1/2's:
- Map / Number tiles: **"{Subject} entries by school, on the map"** / **"{Subject}'s rank in {set label}"**
- Bar chart: **"Entries by school in {set label}"**
- Ranking: **"Schools ranked by {subject} entries in {set label}"**

## What this round is not

Not the Trends panel — the geography comparison living inside Column 1's Trends panel (the "against the wider system" views we found together) is the same "school comparison muddled into Column 1" issue, but Guy's confirmed that's a separate, later pass. Don't move it as part of this round even though the reasoning is identical.

Not Grade bands/Grade counts — not mentioned in this round, leave `GradeCountsPanels.tsx` alone.
