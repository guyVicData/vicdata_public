# VicData 0.6.3 — Grade counts selector, honest maps, transposable tables

Claude Code build prompt. One continuous pass, stages in order, committing after each.

**When every check passes, merge into `main` and push.** Render deploys, and Guy reviews on live (there are no members yet). Stop before merging only for the stop conditions below.

It was agreed with Guy on 6 Oct 2026, after a live review of GCSE Grade counts and the maps. An audit of the code fed into it; file references below are from that audit, so re-check them.

## Ground rules

- **Branch `v0.6.3-grades-maps` from `main`.** Commit per stage, with tsc, eslint, build and all tests clean.
  - Unit tests: `npx -y tsx --test scripts/catalogue-unit-tests.ts src/lib/*.test.ts`.
  - Rule tests: `npx -y tsx --env-file=.env scripts/catalogue-rule-tests.ts`.
  - Parity: the 0.6.2 harness.
- **Log calls** under "2026-10-06 — 0.6.3 grade counts, maps, tables" in `docs/OPEN_QUESTIONS.md`.
- **Pixel-perfect,** both themes, real tokens and components.
- **Change both drawing paths:** the new config renderer (`src/lib/view-series/`, `src/components/dashboard-config/`) **and** the legacy hosts (`ComparisonsPanels.tsx`, `SubjectPanels.tsx`, `GradeCountsPanels.tsx`), so `?views=v1` stays correct.
- **The Data View must not change.** Every Teacher view map draws through `RankingsMap` → the Data View's `AcademicMapView`. All changes go behind **new optional props** that the Data View never passes, as `accentHex`, `forcedColourMode` and `changeValues` do now.
  - **Don't edit shared colour helpers** (`trendColour`, `TREND_STOPS`, `TREND_LEGEND_STOPS`, `DIRECTION_HEX`, `GRADE_BAND_STOPS`, `gradeBandColour`): they're used by the Data View maps, `DivergingBarChart` and the choropleth. **Add new exports** instead.
  - Prove the Data View is pixel-identical.
- **Never put a server key in client code.** No database migrations are expected; if one is needed, write it, test it and leave it for Guy (don't merge in that case).
- **Stop before merging only for:**
  - an RLS change;
  - a destructive migration;
  - any Data View change;
  - a figure change outside the expected list in S5.

## S1 — Grade counts: click one grade or a range, and Columns 2 and 3 follow

**Today:**
- Column 1 Current on Grade counts lets you click two grades, which only fades the other bars.
- The range is local `useState` (`GradeCountsPanels.tsx` ~57–103).
- Columns 2 and 3 silently fall back to **average points** (the note sits in the "i"; `comparisonsMeasureFor` / `contextFallsBack`, `teacher-view-measures.ts` ~234–273).

**New behaviour:**
1. **First click selects that grade alone,** applied straight away. **A second click on another grade widens to the range** between them. **A third click starts a new selection** from that grade. **Clear** removes it, as does clicking the single selected grade again.
2. **The selection IS the top-bar band setting (`band:range`):** one setting, two ways in.
   - Set Custom 9–5 in the top bar, and Grade counts' Column 1 highlights 9–5.
   - Click grade 9 in Column 1, and switching Results to Grade bands shows 9.
   - Keep the saved key and format, so existing choices carry over.
3. **U / Fail / Unclassified can't be a range end** (the top bar hides them, `ResultsControl.tsx` ~41–42). Clicking them does nothing, with a tooltip saying why. This applies at both phases.
4. **Answer line** on Column 1 Current, in the scale's own wording:
   - *"Grade 9: 3% of entries (7) · England 5%"*
   - *"Grades 7–9: 23% of entries (53) · England 21%"*
   - *"A*: 18% of entries (9)"*
   - *"Distinction*: …"*

   Use `rangeLabel` per scale, which says "Grade" only on GCSE 9–1.
5. **Columns 2 and 3 follow the selection** on Grade counts, using the existing band machinery (`contextBandShareAt`, `bandRate`, comparator grades):
   - **Context:** *"Share at grade 9, by subject"*, with the focus highlighted.
   - **Comparisons:** *"Share at grade 9, by school (10 nearest)"*, on every view: bars, ranking, table, and the map (S2).
   - **Trends follow too.**
   - **A chip on each title,** *"Grade 9 · from your highlight"*, links back to Column 1.
6. **Before any selection,** Columns 2 and 3 show a **prompt**, not a points fallback:

   > *Click a grade in Results to compare it across subjects* (Context) / *…across schools* (Comparisons)

   It's a quiet empty-state card at panel size, using the existing empty-state style. **Remove the silent average-points fallback on Grade counts.**
7. **Minimum counts:** reuse the dashboard's existing small-entries rules. Single grades often have tiny counts, so rows and schools below the minimum are shown as "too few entries", not as a %.

## S2 — Maps: size = candidates, colour = what you selected, the hover explains the colour

**Maps in scope** (cards and fullscreen):
- Comparisons Current "on the map": `DV-C3-CUR-MAP`; `map.ts` ~54–69; `ComparisonsPanels.tsx` ~395–412.
- Comparisons Trends: the trend map `DV-C3-TR-MAP` and the change map `DV-C3-TR-CHANGEMAP`.
- Column 1 Results' Trend map: `DV-C1-RES-TR-MAP`; `SubjectPanels.tsx` ~843–855; `map.ts` ~39–48.

**Rules:**

| Map | Dot size | Colour | Hover / label |
|---|---|---|---|
| **a. Candidates · Current** | entries | **none**: one neutral fill (a new `ColourMode` such as `"none"`), with no colour key, and the caption has no "Colour:" part | **entries only** |
| **b. Candidates · Trends** | entries | change in entries, diverging and centred on zero | the change first ("+12 entries since 2022/23"), then entries |
| **c. Results · Current** | the subject's total entries | **the selected measure** (average points / Grade 4+ / A*–E / band share / single-grade share), **coloured by rank within the set, green = top** | the selected result first, e.g. *"Grade 9: 12% (7 of 58)"*, *"Grade 4+: 76% (101 of 132)"*, *"Average points: 5.3"*; then entries |
| **d. Results · Trends** | entries | **change in the selected measure** over the panel's own span (statements from 2022/23, per 0.6.2), diverging and centred on zero | the change first ("+4pp since 2022/23"), then entries |

**Wiring:**
- **Pass a `valueOverride`** (urn → value, n, label) through `RankingsMap`, as `changeValues` is passed. The per-school figures already exist: `f.schools[].values`; `gradeRateScorer` / `bandRate` → `{rate, met, entries}`.
- **The catalogue:** `DV-C3-CUR-MAP` measures gain THRESHOLD and BANDS (and the S1 counts-with-selection).
- **Column 1's Trend map** today shows % change in average points from a fixed year (`trendBadge`). It must follow the selected measure and the panel's span. Remove its own Grade band / Trends toggle, or make it follow.
- **Rank follows the measure:** the Comparisons panel's "rank N of M" (`onTargetRank` / `mapRank`, ~716) uses the selected measure, matching the map. **A deliberate change.**
- **No subject chip:** each school is coloured by its own dominant bucket today, which mixes A level and BTEC. Colour only when every plotted school is on the same measure and qualification; otherwise use neutral dots plus a one-line note.

**Look, for every map in scope:**
- **Palette: dark red → pale amber → deep green, lightness varying** so it reads in colour-blind vision and in print.
  - **Current maps:** sequential by rank.
  - **Trend maps:** diverging, zero = pale amber, with **one symmetric scale** either side, so the same colour means the same size of change on both sides.
  - Put it in new exports (e.g. `RAG_RANK_STOPS`, `RAG_DIVERGING_STOPS`), and check the stops for contrast in both themes.
- **Own school:** a **thick white ring** (dark grey in the light theme), replacing today's red `#dc2626` outline, which clashes with the scale.
- **No figure, or below the minimum:** a **hollow grey dot** (outline only), with "Too few entries" or "No published figure" on hover. Today it's a filled grey dot with no minimum.
- **Legend on every map, card included,** labelled, e.g. *"Green = highest Grade 4+ rate in the set"*, *"Green = biggest rise since 2022/23"*, *"Dot size = entries"*. The card's unlabelled strip goes.

## S3 — Post-16 safeguards (must hold for S1 and S2)

1. **"*" is A*.** Historic A-level rows store A* as `*`. Treat them as A* in every score, share and range, or 2021/22 shows false falls (e.g. King's Worcester).
2. **The scale comes from the focus's qualification type, never from grade overlap.** `bestScale` can tie T Level with vocational; fix how it's chosen for comparators so none become false grey dots.
3. **Context keeps to the focus's qualification family** (`displayBucketFor`) on bands and grade counts at Post-16. Don't rely on the scale check alone: A level, EPQ, Core Maths and FSMQ all read A*–E. AS and AEA stay excluded (R-KS5-ASAEA-EXCL).
4. **England's share is computed over graded, non-suppressed rows only.**
   - When any grade is suppressed (the 5-school minimum, common for BTEC, IB and T Level), show no England figure, or mark it "partial", and log which.
   - Make Grade counts' and bands' England totals use the **same** denominator (`grade-spread.ts` ~55 vs ~108).
   - Map historic vocational labels on the England lookup too (R-HISTORIC-GRADE-LABELS applies only to own rows today); verify.
5. **Size, share and rank on one basis:** dot size, share denominator and "rank N of M" all use the **exact qualification type's graded entries**, never the bucket's (`bucketFor` puts AS and AEA in "alevel"). An AS focus plots AS.
6. **Grade 4+ / A*–E at Post-16** scores only A-level-scale qualifications (existing). For BTEC, IB and T Level, say so on the panel (*"A*–E applies to A levels; use a grade or band for this qualification"*), rather than showing grey dots with no reason.
7. **There are no Post-16 presets,** so the prompt is the normal starting state there. That's fine.

**Add rule-test cases:** King's Worcester (117037) A level Maths A* trend; Croydon College (130432) BTEC Business, Distinction*; an IB school (Sevenoaks 118952) 7 / 6–7; and a T Level if one is available.

## S4 — Tables: years across or years down

- **In the View step (Table):** a **"Years across / Years down"** choice (the layout default for that view). Add it to the `AddView2Table` look box in the same chip style.
- **On every year table** (card and fullscreen): a small **transpose button** beside the existing controls (`PanelIcons` style), with the tooltip "Swap rows and columns".
  - It's remembered per member, like other view settings.
  - The editor's choice is the default.
- **Years down shows every year,** not just first and latest, plus the change row or column. Card sizing scrolls inside the panel, as long tables do now.
- **Automatic default:** when a table has **one or two rows** (a single subject, or the school vs England), it opens **years down**, unless the view says otherwise.
- **Applies to:** the Trend table, the change tables, Results' area table, Comparisons' change table, and Grade counts' change table.
- **The change column/row keeps** 0.6.2's "since 2022/23" rule and the note.

## S5 — Checks

1. **Expected changes only:**
   - Grade counts' Columns 2 and 3: prompt or band instead of points.
   - Map colours, legends, hover text and dots (S2).
   - The Comparisons "rank N of M" on non-points measures.
   - Table layout defaults (S4).
   - Post-16 fixes (S3) where today's figures were wrong. List each with before/after.
2. **Everything else must be identical:** all Candidates figures, all points figures and charts other than the maps, and **the Data View (pixel-identical)**.
3. **Parity matrix:** 137625 GCSE History; 100053 GCSE; 117037 Post-16 Maths; 130432 Post-16 BTEC; 118952 Post-16 IB. Candidates and all four Results measures; Grade counts with no selection, with grade 9, and with 7–9; 1280 and 390; both themes.
4. **Headless walk-throughs:**
   1. **The Chase History, Grade counts:** click 9 and check the answer line, Context share of 9s, and Comparisons share of 9s on the map. Click 7 to widen to 7–9. Clear, and the prompt returns.
   2. **The top bar:** Custom 9–5 shows in Column 1.
   3. **Maps a–d** on GCSE and Post-16: legend, hover, white ring, hollow dots.
   4. **Transpose** a single-subject trend table.
5. **Screenshots** in `docs/v0.6/grades_maps_tables_screenshots/`, both themes.

## Finish

1. **Write `docs/v0.6/grades_maps_tables_report_v1.md`,** with:
   - what changed per stage;
   - before/after for named schools (including the rank changes);
   - the Post-16 fixes;
   - parity;
   - Data View identical;
   - logged calls;
   - a short click-through for Guy on live.
2. **If no stop condition was hit, merge and push:**
   ```
   git checkout main && git pull && git merge --no-ff v0.6.3-grades-maps -m "0.6.3 grade counts, maps, tables" && npm run build && git push
   ```
3. **Tell Guy** to wait for Render's "Deploy live" and hard-refresh.
