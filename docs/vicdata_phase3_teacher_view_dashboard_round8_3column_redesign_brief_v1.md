# Teacher view — Round 8: 3-column redesign (brief)

## 0. What this is

A structural redesign of the whole Teacher-view dashboard, prototyped live with Guy as an interactive wireframe (Design-canvas artifact, https://claude.ai/artifact/3Mu1shp1U9SF8RxPDXTDaw, board `Redesign.dc.html`). Unlike rounds 6–7, this is not an incremental polish pass on the existing four columns — it replaces the 4-column layout (Candidates / Results / Context / Comparisons) with 3 columns, merging Candidates and Results into one column driven by a single shared toggle. The round 6/7-era boards (`Main`/`Results`/`Context`/`Rankings.dc.html`) are superseded and kept in the canvas only as reference.

Companion Claude Code prompt: `vicdata_phase3_teacher_view_dashboard_round8_3column_redesign_claude_code_prompt_v1.md`.

**Parity, per round 7's established discipline**: this must land in the shared components both the KS4 (GCSE) and KS5 (16+/Post-16) dashboards already use — `DashboardGrid`, `CardBox`, `PillMenu`/`PanelMenu`, and `page.tsx`'s per-phase column wiring. Build once, verify both phases before calling anything done.

## 1. What's already real today (checked directly against `vicdata_public`, 2026-09-24)

- **`DashboardGrid.tsx`**: today's 4-column grid via a Tailwind arbitrary `grid-template-columns: 1fr_2px_1fr_2px_1fr_2px_1fr`, capped by `page.tsx`'s own `mx-auto max-w-7xl` (1280px, line ~1038). That cap already matches the wireframe's own 1280px canvas exactly — nothing to change about the page-width cap itself, only the column count inside it.
- **`CardBox.tsx`**: the shared shell every panel already uses. Props: `title`, `subtitle`, `question`, `tag`, `actions` (the view-choice icons, moved to a row under the heading in round 7 §3), `trailingActions` (the one icon after fullscreen — Remove), `controls` (a full-width row above content — chip/pill rows), `caption` (the one-line summary), `source` (the citation line), `children`. Fullscreen is a real modal (`TeacherModal`), rendered inline inside the box rather than portalled, `z-[1500]`.
- **Source citation is already real** — `CardBox`'s `source` prop, rendered today as a full sentence at 9.5px in the footer. This is the "repeated text" Guy flagged as wanting compacted to "1 word, pop up." Compact the existing mechanism; don't invent a new citation source.
- **Print is already real, but page-level**: `TeacherChrome.tsx`'s Export button calls `window.print()`, forcing light theme via a `data-theme` swap on `beforeprint`/`afterprint`. `CardBox`'s `actions`/`trailingActions` rows are already `print:hidden`. There is no per-panel print scoping today.
- **Context and Comparisons already each have their OWN Results/Candidates measure switcher** — `ContextPills` (`candidatesMeasure`/`onMeasure` props) and Comparisons' own `COMPARISONS_MEASURES` pill (round 6 §4.3, confirmed §6.7: "ship the flat Results/Candidates pair"). These are two separate, independent toggles today, each with its own persisted state. **Round 8's single shared control bar replaces both of them with one global toggle** — a real removal of existing UI and state, not just an addition. See §3. **This does not touch Comparisons' separate "Compared against" pill** (the four comparator sets — same sector / local rivals / similar size / nearest 10, round 6 §4.3/§6.7) — that's a different mechanism from the Results/Candidates measure pill and stays, just needs a home in the new layout (§3).
- **Results already has a planned sub-measure set that was never surfaced as a shared control**: Average point score (real), Grade 4+ rate (buildable — real per-subject grade data already flows through the payload per round 6 §4.1, just not wired to this switcher yet), Grade bands and Grade counts (both "Coming soon," no data model). Round 6 §4.1 designed this as a per-column pill under Results' own heading; round 8 relocates it into the shared top bar instead (§3), since it's the natural place once Results is a shared, cross-column state.
- **No private-note mechanism exists anywhere in `vicdata_public`** (checked `src/components/teacher` directly — no "note" match of any kind). It was "adopted" in the original Teacher-view design brief (§12 / Phase 8 of the original build prompt) but never built. Round 8's note button is genuinely new functionality, not a relocation. See §5.
- **No "custom dashboard" or "Meetings" concept exists anywhere in the codebase** (checked directly — no match). The Export menu's other two functions (Guy's spec: "print this graph, copy to custom dash, copy to a presentation") have nothing to attach to yet. See §5.

## 2. Layout — the 3-column grid

- `DashboardGrid.tsx`'s grid-template-columns goes from 4-column (`1fr_2px_1fr_2px_1fr_2px_1fr`) to 3-column (`1fr_2px_1fr_2px_1fr`) — same divider-column pattern, one fewer divider.
- Column 1 = merged Candidates/Results, driven by the shared toggle (§3). Column 2 = Context, same column identity as today. Column 3 = Comparisons, same column identity as today.
- Each column gets more width automatically from the grid change (Guy's explicit second aim, "create more width for each column") — `CardBox` itself doesn't set a fixed width, so this falls out of the grid change; no width prop to touch.
- **Regularised panel height**: every panel (Current / Trend / % change, all three columns) becomes a fixed height, not sized to its own content — a true fixed 3×3 grid. The wireframe uses 260px at its own 394px column width; scale proportionally to whatever the real column width comes out to once the grid is 3-wide inside the real 1280px cap, rather than copying 260px literally.

## 3. The shared control bar (replaces the per-column header row AND both existing per-column measure pills)

One row, replacing today's title row and separate column headers: a GCSE-qualification icon (deliberately the largest icon on the page — the wireframe uses a 40px box / 23px glyph against 30px/16px for the three per-column icons; keep it visibly larger than those, the exact numbers can flex to the real design system) + "GCSE — {school name}" + a Candidates/Results toggle, on the left; subject chips + an edit ("±") control, on the right.

The toggle is genuinely new top-level state (e.g. a single `measure: "candidates" | "results"` in `page.tsx`, alongside whatever per-column state survives), and it drives:

- Column 1's Current/Trend/%change content — today's separate `CandidatesPanels` and Results panels merge into one column that reads this shared measure.
- Context's Current/Trend/%change panels — **replaces** `ContextPills`' own `candidatesMeasure`/`onMeasure` with the shared toggle; remove the now-redundant pill from Context's `controls` row.
- Comparisons' Current/Trend/%change panels — **replaces** the `COMPARISONS_MEASURES` pill with the shared toggle; remove it too.

**Results sub-measure, resolved (superseded once, see below)**: Average point score / Grade 4+ rate / Grade bands ("Coming soon") / Grade counts ("Coming soon") — the same four options round 6 §4.1 already specified. Average point score is the only one with real data behind it today; build Grade 4+ for real per round 6 §4.1's own resolution (real per-subject grade data already in the payload) if time allows this round, otherwise ship it greyed alongside bands/counts and say so plainly in the build report.

**Row-alignment fix, resolved — supersedes putting the Results pill in the shared bar**: Guy caught, live, that a pill only appearing in the shared top bar for Results mode (and Comparisons having its own pill lower down, and Context having none at all) throws the panel grid out of alignment across columns depending on toggle state. Resolved: the Results sub-measure pill above moves **out of the shared control bar** and sits **under Column 1's own column heading** instead — the same slot Comparisons' "Compared against" pill already occupies under its heading. Context gets a matching pill in that same slot (see below). When Column 1 is in Candidates mode (no pill to show there), render a plain spacer of the same height rather than leaving the row out — so the Current/Trend/%change panels start at the same y-position in all three columns regardless of which toggle state is active. The shared control bar itself goes back to just the GCSE icon, the Candidates/Results toggle, and the subject-focus chips — nothing measure-specific in it.

**Context's own "Compare against" pill, resolved**: Guy, live — *"compare against under context"*. Context already has its own real "Compare against" dimension in round 6 §4.2 (Whole school / Other subjects in [subject area] / Selected subjects), independent of the shared Candidates/Results toggle — this redesign's first draft never gave it anywhere to live. It goes in the same under-heading slot as Column 1's pill and Comparisons' pill (previous paragraph), both for its own sake and so all three columns' control rows are the same height. Whole school is the only option with real content behind it in this draft (the existing whole-school-average bars); the other two switch the label and show an honest gap, same pattern as everywhere else unwired in this brief.

**Subject selection, resolved**: Guy, live — *"lets leave single subject selected for now as it would change which graphs were shown."* The control bar's subject chips are a **single-select "focus" subject** (one active at a time, not a multi-tick group), used by Context and Comparisons, which are already single-subject-scoped mechanisms (Context's own focus state, Comparisons' subject-specific ranking). This is a smaller, more contained change than unifying subject selection everywhere: **Column 1's own existing multi-subject tracked list** (the several subjects Candidates/Results already shows side by side) **is untouched, a separate mechanism the shared focus-subject chips don't affect.** Don't build a shared multi-subject tick-list across all three columns this round — that's explicitly what Guy is deferring.

**Comparisons' "Compared against" pill, resolved**: Guy, live — *"also need the comparison picker somewhere"* (a real gap in the wireframe, caught the same way Claude Code caught round 6's own gaps). This is column-specific, not shared like the Candidates/Results toggle, so it does **not** move into the shared control bar — it stays under the Comparisons column's own heading, in its `controls` row, same general position round 6 gave it. Four options, all already real (round 6 §4.3): same-sector, local rivals, similar size, and the default nearest-10.

## 4. Per-panel chrome (every panel, all three columns)

- **View-rail**: the panel's view-choice icons (`CardBox`'s `actions` prop) move from a horizontal row under the heading (round 7 §3's placement) to a **vertical rail on the left of the chart/content**, with a right-hand divider line separating the rail from the content next to it. This is a real change to how `actions` renders inside `CardBox`, not just a restyle of the same row.
- **Chart/content fills available height**: today's fixed-pixel chart heights should flex to fill whatever vertical room the now-fixed-height panel leaves once its head, caption and footer are accounted for. Bar charts scale their bars proportionally to the available height rather than a fixed px scale; line charts stretch to fill (e.g. SVG `preserveAspectRatio="none"`) rather than sitting in a small fixed box with dead space round them.
- **Long lists scroll within their own box** — Comparisons' Ranking view, when the comparator set has more schools than the panel has room for, scrolls internally rather than overflowing the fixed panel height or growing the panel.
- **Bottom-row footer, genuinely fixed to the panel's own bottom edge** (not pushed there by content length — e.g. `position: relative` on the panel, the footer row pinned to its bottom padding, not just flex-pushed). This replaces `CardBox`'s current footer (`caption` + `source`, two stacked lines) with a single row containing: the source citation, now an icon that opens a small popover with the citation text on click (§1) rather than a printed sentence; the new private-note button (§5); and Export (§5), moved down from the view-rail. Reuse the popover mechanism `PillMenu`/`PanelMenu`/`useDismiss` already provide for Context's and Comparisons' pills for the source popover, rather than building a second one.
- **Fullscreen and Remove stay exactly where round 7 put them** — top-right, two icons, unchanged.
- **Panel titles reinforce their column, resolved (Guy, live)**: the generic "Current — 2024/25" tag becomes the column's own name — Column 1's Current tag reads "Candidates 2024/25" or "Results 2024/25" (i.e. `{{col1Title}} 2024/25`, following the shared toggle), and Context's Current tag reads "Context 2024/25". This wasn't raised for Comparisons or for the Trend/%change tags — leave those as they are unless Guy asks for them too.
- **Column 1's own icon, resolved (Guy, live — "Results icon needs to change, it's currently showing candidates icon")**: this column's `colhead` icon must switch with the shared toggle, alternating between the two icons round 6/7 already shipped for real — person for Candidates, bar chart for Results — rather than staying fixed on one regardless of state.

## 5. New functionality this round actually needs to build (not just relocate)

- **"Print this graph"** (Export function 1 of 3) — real to extend: `window.print()` already exists, page-level. Scope it to one panel by reusing `CardBox`'s existing fullscreen modal (which already isolates a single panel's content) plus a print stylesheet that hides everything outside the open modal, rather than building a second, parallel print pathway.
- **"Copy to custom dashboard" and "Copy to a presentation"** (functions 2 and 3) — nothing to attach to. No "custom dashboard" concept and no "Meetings" feature (the original design brief's own Phase 6/7, never built) exist in the codebase. Build the Export menu with both options present but disabled/"Coming soon" — the same house pattern already used for Results' greyed Grade-bands/Grade-counts measures (round 6 §5: "shown, not hidden — greyed, non-interactive, with a small tag"). Honest about not doing anything yet, rather than hidden or half-wired.
- **Private note per panel** — genuinely new. The original design brief (§12) already adopted this in principle: *"any Teacher-view user can leave a private note against a specific chart... using the same saved-state infrastructure that already exists per person per card"* — but it was never built. That infrastructure is `teacher_view_preferences` (Supabase, `src/lib/teacher-view-data.ts: savePreferences`, confirmed real in round 6 §2) — extend it, or add a sibling table keyed the same way if the shape doesn't fit, rather than inventing new persistence. Scope: one note per user per panel, visible only to its author — same privacy bar as the rest of that original section, no exceptions.

## 6. What's explicitly NOT in this round

- **Warning/flag badges** (e.g. a candidate-numbers-down-sharply flag) — raised and discussed live with Guy, deliberately deferred rather than designed further. Not part of this brief; a future round.
- **The 1280px page-width cap** — already correct as-is, confirmed in §1. Nothing to change here.
- **Graph and Map views inside Comparisons' Current panel** — the wireframe only wires up Ranking as an interactive demo; Graph and Map stay exactly the existing real round-6/7 views, just re-homed into the new vertical rail (§4). No new chart type to build this round.
- **KS2** — as with rounds 6 and 7, out of scope; Teacher view has no KS2 instance.

## 7. Open items — flagged for Guy rather than silently decided

- Exact panel/column pixel dimensions once the grid goes from 4 to 3 columns inside the real 1280px cap — the wireframe's 394px/260px figures were sized for the mockup's own canvas math; compute the real build's own numbers from the new grid rather than copying these literally.

(Subject selection and Comparisons' "Compared against" pill were both open items in the first draft of this brief — both resolved directly by Guy, see §3.)

## 8. Verification checklist for the build report

- Both phases (KS4 and KS5), same discipline as round 7.
- The shared toggle genuinely drives all three columns' Current/Trend/%change content, not just column 1.
- Context's and Comparisons' own former measure pills are gone, not just hidden.
- Fullscreen/Remove unaffected — confirm against round 7's existing behaviour, unchanged.
- The source popover shows the same real citation text the old sentence used to, for a genuinely real panel (not placeholder text).
- "Print this graph" produces a single-panel printout, not the whole dashboard.
- The custom-dashboard/presentation Export options are visibly present and visibly disabled, not silently missing.
- A private note saved by one user is invisible to a second user viewing the same school and panel.
- The Ranking list scrolls, rather than growing the panel, when a comparator set is long.
- Bar/line charts visibly use the available panel height at both a short (few-subject) and a long (many-subject) real case, not only the one subject count exercised in the wireframe.
- `teacher_view_preferences` (or its notes sibling) round-trips correctly on reload, matching round 6 §7's existing discipline for that table.
- The Results sub-measure pill only appears when the shared toggle is on Results, and disappears cleanly (no orphaned state) when switched back to Candidates.
- The subject-focus chips are genuinely single-select — picking a new subject deselects the previous one, and Column 1's own multi-subject bars are unaffected by it.
- Comparisons' "Compared against" pill still works exactly as round 6 shipped it, just relocated under its own column heading rather than removed or merged into the shared toggle.
- **Row alignment**: Current/Trend/%change panels start at the same y-position across all three columns in every combination of Candidates/Results toggle state — including Candidates mode, where Column 1's spacer (not a pill) is what's holding that row's height.
- Column 1's `colhead` icon and its Current panel's tag both flip correctly when the shared toggle switches — the icon between the two real shipped icons (person/bar chart), the tag between "Candidates 2024/25" and "Results 2024/25".
