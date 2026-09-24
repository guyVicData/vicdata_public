# Teacher view — Round 8: 3-column redesign — Claude Code prompt

Read `docs/vicdata_phase3_teacher_view_dashboard_round8_3column_redesign_brief_v1.md` in full before writing any code, and skim the round 6 and round 7 briefs/build reports alongside it — round 8 builds directly on the `CardBox`/`DashboardGrid`/`PillMenu` mechanisms those rounds shipped, not a fresh implementation. §1 of the round-8 brief is grounding you should re-verify yourself, not take on faith, the same discipline those rounds used.

Guy said, live, "time to see it live" once this round's wireframe was settled — treat that as this round's explicit go-ahead to commit **and push**, the same one-off basis rounds 6 and 7 used (not a new standing default — ask again next round).

This is a bigger, more structural round than 6 or 7: it changes the dashboard's own grid, removes two existing measure toggles in favour of one shared one, and adds two genuinely new pieces of functionality (private notes, per-panel print). Stage it accordingly — each numbered section below is its own commit, `tsc --noEmit`/`eslint`/production-build clean before the next, pushed once clean (per the go-ahead above).

## Build order

### 1. Grid: 4 columns → 3 (brief §2)

`DashboardGrid.tsx`: `grid-template-columns` from `1fr_2px_1fr_2px_1fr_2px_1fr` to `1fr_2px_1fr_2px_1fr`. Merge `CandidatesPanels` and the Results column's three `CardBox` panels into one column (Column 1); Context and Comparisons keep their existing column identity, just narrower divider count. Don't touch the `max-w-7xl` page cap — it's already correct (brief §1).

### 2. Shared control bar + the shared measure toggle (brief §3)

New top-level `measure: "candidates" | "results"` state in `page.tsx`. Build the single control-bar row (GCSE icon, largest on the page + school name + Candidates/Results toggle on the left; subject-focus chips + edit on the right), replacing the old per-column title rows.

Wire the shared toggle into Column 1, Context, and Comparisons. **Remove** `ContextPills`' own `candidatesMeasure`/`onMeasure` pill and Comparisons' `COMPARISONS_MEASURES` pill — both fully superseded, not left dormant alongside the new one. **Do not** touch Comparisons' separate "Compared against" comparator-set pill (same sector/local rivals/similar size/nearest 10) — that stays, under Comparisons' own column heading, not folded into the shared bar (brief §3).

The shared bar itself stays minimal: GCSE icon, the Candidates/Results toggle, and the subject-focus chips — nothing measure-specific in it (see the row-alignment fix below for why).

Subject chips are single-select (one focus subject at a time), per Guy's direct resolution in brief §3 — not a shared multi-tick list. Column 1's own existing multi-subject tracked bars are untouched by this and need no change here.

**Row alignment (brief §3)**: put the Results sub-measure pill (Average point score / Grade 4+ rate / Grade bands / Grade counts, round 6 §4.1) under **Column 1's own column heading**, not in the shared bar — same slot Comparisons' "Compared against" pill occupies under its heading. Give Context a matching pill in that same slot for its own real "Compare against" dimension (Whole school / Other subjects in its subject area / Selected subjects, round 6 §4.2), independent of the shared toggle. When Column 1 is in Candidates mode and has no pill to show, render a spacer of the same height there instead of leaving the row out, so all three columns' Current/Trend/%change panels line up at the same y-position regardless of toggle state.

### 3. Regularised panel height + per-panel chrome (brief §2, §4)

- Fixed height on every panel (Current/Trend/%change, all three columns) — compute the real px figure from the new 3-column grid at 1280px, don't copy the wireframe's 260px/394px literally (brief §7).
- `CardBox`'s `actions` (view-choice icons): move from the round-7 horizontal row to a vertical rail on the chart's left edge, with a divider line separating it from the content.
- Chart/content height: replace fixed-pixel chart areas with fill-available-height sizing (bars scale proportionally, line-chart SVGs stretch via `preserveAspectRatio="none"` or equivalent).
- Comparisons' Ranking list: scrollable within its own box once the comparator set overflows the panel.
- New bottom-row footer: `position: relative` on the panel, footer pinned to its bottom padding (genuinely fixed, not flex-pushed) — replaces `CardBox`'s current stacked `caption`/`source` footer.

### 3a. Panel titles and Column 1's icon (brief §4)

- Column 1's Current panel tag becomes `{{col1Title}} 2024/25` — "Candidates 2024/25" or "Results 2024/25" depending on the shared toggle, replacing the generic "Current — 2024/25." Context's Current panel tag becomes the static "Context 2024/25". Leave Comparisons' tag and every Trend/%change tag as they are — not asked for.
- Column 1's `colhead` icon switches with the shared toggle between the two icons already shipped for real (round 6/7: person for Candidates, bar chart for Results) — it currently stays fixed on the Candidates icon in Results mode, which is the bug Guy flagged.

### 4. Source citation → icon + popover (brief §1, §4)

`CardBox`'s `source` prop stops rendering as a printed sentence and becomes an icon in the new bottom-row footer that opens a small popover with the same citation text on click. Reuse `PillMenu`/`PanelMenu`/`useDismiss` (already shared by Context's and Comparisons' pills) for the popover mechanism rather than building a second one.

### 5. Export, in the bottom-row footer (brief §5)

Three functions, one menu, per panel:

- **Print this graph** — real. Reuse the existing fullscreen modal to isolate the one panel, plus a print stylesheet that hides everything outside the open modal, extending the existing page-level `window.print()`/`beforeprint`/`afterprint` theme-forcing mechanism in `TeacherChrome.tsx` rather than parallel-building a second print path.
- **Copy to custom dashboard** / **Copy to a presentation** — build both as visibly present, visibly disabled ("Coming soon") menu rows. Nothing exists yet for either to do (brief §1) — don't half-wire them, don't hide them.

### 6. Private note per panel (brief §5)

New functionality, not a relocation. One note per user per panel, private to its author. Extend `teacher_view_preferences` (`src/lib/teacher-view-data.ts: savePreferences`) or add a sibling table keyed the same way — whichever fits the existing shape better; your call, but say which and why in the build report. Wire the note button in the bottom-row footer to it.

## Verification and build report

Follow the round-8 brief's §8 checklist in full — including confirming every item on KS5/Post-16 as well as KS4, per round 7's parity discipline, and specifically: the shared toggle genuinely driving all three columns (not just Column 1); Context's and Comparisons' old measure pills genuinely gone; a private note saved by one user genuinely invisible to another. Write a build report in the usual format, naming the real school(s)/subject(s) verified against, with a "simplifications made without Guy there to confirm" section for anything genuinely judged (the exact panel px dimensions and the notes-table shape from §3/§6 above are the most likely candidates). Stage commits per numbered section above, each clean before the next, and push each section once it's clean, per the go-ahead at the top of this prompt.
