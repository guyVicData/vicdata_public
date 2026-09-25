# Teacher view dashboard content round: build report (v1)

Brief: `vicdata_phase3_teacher_view_dashboard_content_round_build_brief_v1.md`. Prompt: `..._claude_code_prompt_v1.md`. Built in the prompt's order, one commit per part:

| Part | Brief sections | Commit |
|---|---|---|
| 1 | S1–S4 | `aa1f22c` |
| 2 | S5 | `24d26ff` |
| 3 | S6–S7 | `ae76192` |
| 4 | S8 | `2571194` |
| 5 | S9 | `9d04d9a` |
| 6 | S10 | `29303a0` |
| 7 | S11 | `abc944a` |
| 8 | S12 | `4b5e0d0` |

Housekeeping: git refused the first commit because of a stale `.git/index.lock`. It was 0 bytes, dated 13:47, and no git process was running, so I removed it. Your uncommitted edit to the round 8 brief is still uncommitted and untouched.

## Real locations checked before building

Every named location matched the brief:

- ControlBar's `QUALIFICATION_ICON` (~l.44)
- `ExportButton`'s text label
- `PanelFooter`'s `ExportIcon`
- `ComparatorSchool.igcseExcluded`
- ControlBar's "All" button
- SubjectPanels' and CandidatesPanels' own "All subjects" chip rows
- Context's `contextAgainst` / `contextMembers` / `groupValueFor` area grouping
- ContextPills' three options
- The literal "This school" in ComparisonsPanels
- `AddPanelButton` and `canRemovePanel` / `removePanel`
- `nextStart` pills
- `PanelSummary` / `DIRECTION_*` as CardBox's caption

**Things the brief left out or described differently:**

- **Column 1 is two components.** It's `SubjectPanels` in Results mode and **`CandidatesPanels`** in Candidates mode. The brief names only `SubjectPanels`. Parts 2, 3, 6, 7 and 8 were applied to both.
- **The "Av. Points" tag isn't in SubjectPanels.** The tag text comes from the page's `currentLabel` prop, so S3 was a page change, not a SubjectPanels one.
- **S4's causes, traced in `src/app/api/teacher/dashboard/route.ts`:**
  - (a) Excluded schools were deliberately kept in every set with a null value. The table printed that null as "not comparable".
  - (b) Their `candidates` series was never gated at all.
  - (c) With a subject focused, which is now always (S5), Comparisons reads per-subject series built client-side from map profiles, with no gate in either measure.
  - (d) The Post-16 "—  —" rows are comparators with no figure for the focused subject; SortTable prints both columns as "—".

## Part 1 (S1–S4)

- **S1:** ControlBar's badge renders `PhaseGlyph({ phase })`. It keeps the same 40px box and `rgba(accent, 0.14)` tint, and the glyph is scaled to the old 23px. The invented mortarboard is deleted. ControlBar gains a `phase` prop.
- **S2:** `ExportButton` is icon-only. It uses `PanelFooter`'s `ExportIcon` (now exported) at 16px in a 30px bordered button, with `aria-label="Export all visible panels"`. `window.print()` and `print:hidden` are unchanged.
- **S3:** On average point score, Column 1's Current tag reads "Av. Points {year}". Grade 4+ / A*–E keeps "Results {year}", and the column heading is unaffected.
- **S4, server side (`rankSets`):** at GCSE, a comparator flagged by `igcseExclusionLikely` is dropped from every set in both measures.
  - Simply filtering the finished sets would leave "Nearest 10" with eight schools. Instead the sets are **rebuilt from the pool minus the excluded schools**, and any newly admitted schools are fetched and checked in turn (the pool only ever shrinks; capped at 4 passes, with a final filter as a backstop).
  - The target school is never dropped from its own dashboard. It still carries `igcseExcluded`, and its own results history is still withheld.
- **S4, client side (`ComparisonsPanels`):** a comparator with no series for the active measure and subject isn't listed at all. That's the per-subject gate, so a school reappears for any subject it does have. A comparator with history but nothing in the latest year is left out of the ranking. Neither rule applies while the per-subject rows are still loading.

## Part 2 (S5): no "All"

- The page keeps the teacher's choice as `chosenFocusKey` and derives `focusKey`: the choice while it's still ticked, otherwise the first ticked subject.
- `null` only means nothing is ticked. Every column already has its own "Pick a subject above…" text for that.
- The "All" buttons are gone from ControlBar and the phone subject menu. Clicking the active chip keeps it selected.
- SubjectPanels' and CandidatesPanels' chip rows and their "All subjects" aggregates are removed. Both take a required `focus`.
- Context's series is the focused subject only.

## Part 3 (S6–S7): Column 1's category comparison

- **Members:** the focused item first, then every other item this school has whose `familyFor(headline, subject)` matches the focused subject's family, by entries. That's the same lookup Context's "area" option used, so membership agrees with it.
- **Colours:** peers are drawn in one muted colour; the focused subject keeps its qualification colour.
- **Results:** a peer with no figure at all on the active measure is left out. At GCSE on points that means a BTEC or Cambridge National, which carries no points.
- **Overlays**, drawn with the Context `groups` machinery (now a list):
  - `{Category} average`: the self-inclusive per-subject mean. It appears in both measures, and in Candidates mode too.
  - **GCSE and points only:** `England {Category} average` (blue), the mean of each member subject's England figure from the existing subject-grain national rows. **At GCSE every member also carries its own England marker.** No backend change was needed.
- **Post-16 ships without the England category overlay, by design.** The national figure at KS5 exists only per qualification bucket, not per subject; the per-subject KS5 backend is the separate, already-logged round. At Post-16 only the focused subject keeps the bucket-level marker it always had.
- **Candidates mode:** no England overlay, as agreed. The category average still shows.
- **TrendChart change:** comparison lines now use their series' own colour. Every existing caller already passed `var(--muted3)`, so nothing else changed visually.

## Part 4 (S8): Context

- `CompareAgainstId` is now `"whole" | "selected"`. The area row and every "area" branch in the page are gone.
- A saved "area" from before now reads as Whole school.
- "Select all" and "Clear all" sit at the top of the Selected-subjects checklist, each a single save. They're disabled when they would do nothing.
- The list offers only subjects with real entries at the school in the latest year.

## Part 5 (S9): Comparisons

- The target row is labelled with the school's real name (the page's `schoolName`).
- The row is tinted `rgba(accent, 0.14)` with accent text via a new `SortRow.highlight`, and its graph bar is drawn in the accent.
- The ranking's scroll box centres the school's row whenever the rows or the sort change. It sets the box's own `scrollTop`, not `scrollIntoView`, which would also scroll the page.

## Part 6 (S10): open/shut panels (my interpretation; see §D1)

**What was built:**

- **Model:** all three panels are always rendered in `PANEL_ORDER`, and each opens and collapses independently.
- **Persistence:** the stored list per column is now the **open** set, under the same key that held the present set. Anyone with saved panels therefore gets exactly those panels back, open. No migration is needed. An absent key means Current open only; an empty list (everything collapsed) is now a valid state.
- **Collapsed panel:** one full-width header-bar button showing the title, the panel's headline figure right-aligned, and a down chevron. Clicking anywhere on it opens the panel. Collapsed bars are `print:hidden`, so "Export all visible panels" prints only what's open.
  - Current shows the focused subject's figure, or the school's rank ("3 of 10") in Comparisons.
  - Trends shows the direction ("↓ Declining").
  - % Change shows the focused subject's or the school's change.
- **Open panel:** as before, except the ✕ is now an up chevron labelled "Collapse …".
- **Removed:** `AddPanelButton.tsx` is deleted, along with `addPanel`, `removePanel`, `canRemovePanel`, `PANEL_PICKER_ICONS`, `PlusIcon` and `RemoveIcon`.
- **Height:** `PANEL_HEIGHT` goes from 256px to **224px**. My estimate for two open panels plus one collapsed bar is about 860px at 256 and about 800px at 224, against a typical laptop viewport of roughly 780–800px. Part 8 gives the Trend panels back the caption space this takes. Three open panels scroll, as agreed. This is an estimate, not a measurement.

## Part 7 (S11): headings

- **Column headings:** one H2 with the short title in bold and the explanation after an em dash. KS2, and the state with nothing ticked, keep the old titles and §5 questions.
  - "{Subject} Candidates — how many pupils take {Subject} GCSE."
  - "{Subject} Results — how well pupils do in {Subject} GCSE."
  - "{Subject} in Context — how {Subject} compares with the whole school / the subjects you selected."
  - "{Subject} Comparisons — how {Subject} here compares with the {live set label}."
  - Post-16 says "students" and uses its own qualification label.
- **Current tags:**
  - Context: "Whole School Context {year}" or "Selected Subjects Context {year}".
  - Comparisons: "{Candidates|Results} at the {Nearest 10 Schools / Same Sector Schools / …} {year}", read from `comparatorSetOptions` rather than hard-coded.
- **Trends and % Change:** uniform titles, each followed by the new shared `FromYearMenu` ("From 2021/22 ▾"), which lists the real start years (`startOptions`). With fewer than two choices it reads as plain "from {year}" text. This replaces the From:/Since: cycling pills in all six panels, and `nextStart` is deleted.
- **Caveats:** SubjectPanels' caveat (the threshold measure's "published per grade only from 2023/24…") was printed under the figure in every panel. It now sits inside each panel's "i" popover, after the source.
- **Left as is:** Comparisons' set caveat ("Independent schools only") appears once, under its own pill, not per panel.
- **Chart/text overlap:** I couldn't check this without a browser (see Verification).

## Part 8 (S12): footer row

- **New CardBox slots:** `footerLead` (before the "i") and `flag` (right-aligned, truncating). A panel that passes neither renders the same footer as before.
- **Trend panels, all three columns:**
  - `footerLead` is a new compact "Trend line" toggle (`TrendLineToggle` in PanelFooter), and the top-of-panel pill is gone.
  - The `flag` is the coloured "↑ Growing" / "↓ Declining" / "→ Broadly stable".
  - The full trend sentence is the flag's tooltip and still shows as the caption in fullscreen, where there's room. The in-panel caption is suppressed when a flag is present.
- **Top of the Trend panel:** Results/Candidates now shows nothing but the title and "From {year}". Comparisons still has its "vs:" selector there.

## Files touched

- **Server:** `src/app/api/teacher/dashboard/route.ts`
- **Page:** `src/app/teacher/[phase]/page.tsx`
- **Library:** `src/lib/teacher-view-panels.ts`
- **Components** (`src/components/teacher/`):
  - `ControlBar`, `TeacherChrome`, `TeacherNav`
  - `SubjectPanels`, `CandidatesPanels`, `ComparisonsPanels`
  - `ColumnPanels`, `CardBox`, `PanelFooter`, `PanelIcons`
  - `ContextPills`, `DashboardColumn`, `SortTable`, `TrendChart`
- **New:** `FromYearMenu.tsx`
- **Deleted:** `AddPanelButton.tsx`

## Verification

**Done:**
- `tsc --noEmit` and `eslint` are clean after every part.
- `next build` succeeds.
- Every commit touches only files under `src/`, plus this round's docs in Part 1.

**Not done, still to check live.** Localhost is still behind the Basic Auth gate and sign-in, and I don't enter credentials. So none of the brief's live checks have been run:

- **S1:** the badge glyph matches the home-page tile.
- **S2:** the Export icon prints and is hidden in print.
- **S3:** the Av. Points tag changes only with its sub-measure.
- **S4:** Malvern College and Malvern St James are absent at GCSE in both modes, and Post-16 shows no "—/—" row. **Caveat:** the fix applies the existing `igcseExclusionLikely` rule consistently; it doesn't widen the rule. I couldn't confirm from here that those two schools actually trip it (English/Maths 9–4 at 0%, independent, Attainment 8 above 5). The 514e285 docs don't name them, and the figures are in the reference data store. If either doesn't trip it, it will still appear, and the rule itself would need a look.
- **S5:** no "All" anywhere, with one subject across all columns.
- **S6/S7:** category membership matches the old Context "area" grouping, and the England category line appears at GCSE only.
- **S8:** two options, select-all and clear-all.
- **S9:** real name, accent row, centred on a long set.
- **S10:** 2 open + 1 collapsed fits without scrolling at laptop size, and saved panels come back open.
- **S11:** headings, tags and the From menus read right, with no chart/text overlap.
- **S12:** trend footers look right, and other footers are unchanged.

## Open decisions

- **§D1 (S10): accordion markup.**
  - Built: the collapsed panel is a full-width bar button (title, headline figure, chevron). The open panel's ✕ became a collapse chevron. The column header no longer has any control.
  - Alternatives: collapse by clicking the open panel's title rather than a chevron; put the headline figure left, next to the title.
  - Recommendation: see it live.
- **§D2 (S10): panel height.** It's now 224px, from an estimate rather than a measurement. If 2-open-plus-1 still scrolls at your usual window size, or the charts feel cramped, this constant is the one lever (`CardBox.tsx`).
- **§D3 (S12): what "the declining message" moves as.** Built: only the flag (arrow + word) sits in the footer, and the full sentence is its tooltip plus the fullscreen caption, because a sentence can't fit one footer row. The alternative is to keep the sentence visible under the chart and put only the flag in the footer. That duplicates the message, but nothing is hover-only.
- **§D4 (S6): what Column 1's Current shows.** Built: the focused subject plus every category peer, as bars or rows, with per-subject England markers at GCSE. The alternative is the focused subject plus just the two average bars. That's more compact, but you lose which peer is where.
- **§D5 (S8): "Clear all".** An empty selection falls back, as it always has, to the subjects you teach, rather than an empty group. Say if Clear all should instead leave the group empty.
- **§D6 (S4): the target school when it is itself IGCSE-excluded.** It keeps its "not comparable" row in its own ranking, because a school can't be omitted from its own dashboard. Every comparator is omitted, never caveated.
- **§D7 (S11): heading wording.** The Context and Comparisons sentences ("{Subject} in Context", "{Subject} Comparisons") are my own wording; the brief gave only the Column 1 example.
