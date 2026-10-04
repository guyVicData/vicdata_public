# VicData 0.6, editor review: pinch points and a simpler model (working notes)

**Status:** working notes from a live walk-through with Guy, 4 Oct 2026. GCSE Results at The Chase, History, viewed as Teacher, in the editor. Not yet decided. Guy is still testing, and his feedback will follow.

## Pinch points found

| # | Pinch point | Kind |
|---|---|---|
| 1 | The "What's changed" line shows raw placeholders ("[subject] results from [from-year]") and internal view names ("Area chart"). Members see it. | Bug |
| 2 | A removed view keeps drawing if it was the panel's open view (remembered state), instead of falling back to the default. | Bug |
| 2b | The editor preview doesn't refresh after removing a view; Edit has to be turned off and on. | Bug |
| 3 | Two views share a title ("History against the wider system": the Area chart and the Change table), so they can't be told apart in the rail. | Naming |
| 4 | The Move/Copy to another panel map doesn't highlight in yellow where the view currently sits. | Design |
| 5 | Comparison ("compared to") is set on the column, with a panel-level override. A view can't choose its own comparison lines, and "Nothing (this school only)" isn't an option. So the simplest view, the subject's own trend, can only be a "planned" view built in code. | **Model** |
| 6 | Removing a view on one measure (e.g. Grade bands) removes it from all four. Guy expected ticks. | **Model** |
| 7 | The Add a view chooser can't turn comparison off either (same as 5). | Model |
| 8 | Ready-made shows too many choices. It should ask what you want first, then offer a short list. The steps are "almost incomprehensible". | Flow |
| 9 | Browse by icon doesn't work. Browse the real dashboards instead, see the real graphs, and move or copy one. | Flow |
| 10 | It isn't clear which measure you're adding a view for. The editor's measure pill is small and far right, and the chooser doesn't say "Adding to … · Average points". | Clarity |
| 11 | There are two places for "which grade measure": the editor pill (a preview filter) and Step 1's "Which result" (reached only via Change). There should be one always-visible switch. | Clarity |
| 12 | Members' own Results switch (Average points ▾ under Column 1's heading) is so hidden that Guy hadn't found Grade counts. | Clarity |
| — | (Guy) The measure must be **ticks**, so a graph can be on for all four result types. | Model |

## The simpler model under discussion

1. **A dashboard is a grid of panels.** Each panel holds a few views, and members flip between them with the rail. Nothing else.
2. **A view is one graph or table, and all its settings live on the view, in one place:**
   - **What:** measure ticks (Average points / Grade 4+ / Grade bands / Grade counts). The current pill is pre-ticked; measures the view can't honestly draw are greyed out with a reason.
   - **Compared with:** Nothing (this school only) / Subject category / LA / Region / England / 10 nearest…, honest options only. On grade bands that's only Nothing and in-school options.
   - **Years.**
   - **Title.**
3. **No inheritance layers.** The column and panel "compared to", "inherits column" and "overridden" all go. A column has a heading only.
4. **Removing** unticks the current measure. A separate "Remove everywhere" deletes the view.
5. **Add a view = browse the real dashboards.** Pick a real graph you can see, then copy or move it. A filter first narrows the list (e.g. "change · bar · grade bands").
6. **One measure switch,** visible at the top of the dashboard for members. The editor uses the same switch to preview.
7. **Placeholders are only for genuinely new data or a new chart type.** Anything that is an existing chart with different comparison lines or years is a setting.

## Next

- Guy's feedback after hands-on testing.
- Then wireframe three screens: **Edit this view**; **Add a view** (browse real dashboards); **the measure switch at the top**.
- Check them against this list before any build.

## Later the same session (17:00–18:00)

**More pinch points:**
- 13: the Custom… grade band does nothing (it switches to a "pick a range" view that isn't in the rail).
- Grade counts is hard to edit anywhere: its comparison is baked in, and it's drawn by separate code (GradeCountsPanels).
- Root cause of 5 and 7: views are fixed chart+comparison pairs, so a column set to "no comparison" matches nothing and the chooser falls back to a placeholder.

**Decided with Guy:**
- **Comparison becomes a setting on the chart** (series as a parameter), not part of what the chart is.
- **Grade band choice moves to the top bar,** next to the Results switch, for members and the editor alike.
- **Add a view = 3 steps:** 1 Data (lines to remove or add, colours, averages); 2 Kind (tiles + choices per kind); 3 Preview (result-type ticks with mini previews, rail icon, title).
- **Edit = the same 3 steps,** opening at step 3 with steps clickable. Remove view… lives there.
- **Rail menu:** "Shows for" ticks, Edit view…, Take off [measure] / Remove everywhere.
- **Desktop:** preview at real panel size on the left, steps as tabs on the right, so no scrolling. Phone: one scrolling column.
- **Every ranking starts from the full Comparisons ranking component** (columns switchable).

**Boards on the canvas:** AddView1–3, AddView2Table, AddView2Rank, AddView2Bar, EditView, RailMenu, EditWide.

**Open:**
- merging Grade bands and Grade counts into "Grades";
- step 1 for school-set data (Comparisons);
- Current-row year picker;
- scatter and small multiples (later).
