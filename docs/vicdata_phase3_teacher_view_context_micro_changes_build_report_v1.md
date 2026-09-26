# Teacher view Context column: live-review micro-changes, build report (v1)

Five parts, one commit each, all pushed. `tsc`, `eslint` (touched files) and `next build` are clean.

| Part | What | Commit |
|---|---|---|
| A | Subheading wording | `a051732` |
| B | "Whole school" shown as "All subjects" | `a904a6d` |
| C | Donut fills the panel; caption wording | `32c741b` |
| D | Trend lines in the categorical palette | `0fb050c` |
| E | % Change table: ranked, bare rank, no sorting | `d0c3a91` |

## A. Subheading wording

Context's Candidates sentence is now fixed: "entry numbers compared with other subjects at {school}." The `against` variable is gone.

**I applied the same fix to the Results sentence** as asked: "this subject's results compared with other subjects at {school}." Only the Candidates wording was flagged, but it was the same pattern.

## B. "Whole school" shown as "All subjects"

This is a label-only change; the id stays `"whole"`. The grep found exactly three display literals, all in the named places:
- `contextGroupLabel` in `page.tsx`;
- `ContextPills`' `againstLabel` and its menu row.

Everything that reads `contextGroupLabel` follows automatically: the tag ("All Subjects Context {year}"), the Trend and % Change sentences, the benchmark label and the donut's `groupLabel`. The only other match, ComparisonsPanels' `WHOLE_SCHOOL`, is an unrelated internal key (Comparisons' "no subject" value), so I left it alone.

## C. Donut fills the panel; caption wording

- **Sizing:** it's now measured, with a layout effect plus ResizeObserver: the same fix as the bar chart in `c3716e4`.
  - **Beyond the prompt:** the legend moved **under** the circle. Beside it, the legend took about half the card's width, which capped the circle at about 140px however tall the panel is.
  - The diameter is the smaller of the width and the height above the legend, so it stays a circle. The old 104/180px are the floor.
- **Measured** in headless Chrome, in a 384px card replica with the view rail, using the built CSS: **104px → 242px**, with the legend ending at the content box's bottom edge and no scroll.
- **Caption:** "All other entries — {total}". I left the `aria-label` as it was: it now reads "Maths (General) is 12% of All subjects", which is fine.

## D. Trend lines in the categorical palette

SubjectPanels' Trend now uses `paletteInOrder()` (the same helper and split as Candidates, `b518e1e`). `trendFull` reads the palette colours, while Current's bars, the table and % Change keep the grey `colourFor`. Column 1 Results (`"all"`) is untouched. SubjectPanels now takes `theme` and `accentHex` from the page.

**Applied in both Context modes:**
- **Selected subjects:** every line gets a colour.
- **All subjects (Option K):** the four standout lines get colours too, since four greys were just as hard to tell apart. The "rest of school" band stays grey.

**Table dots:** these follow automatically, confirmed in the code. Both Trend tables are given the same `trendData` as their charts (Candidates' Trend table and SubjectPanels' Trend table), and YearTable's dot is `r.s.colour` from that series. So the dots match the lines in Column 1 and Column 2 with no separate work. I haven't seen it live.

## E. % Change table: ranked, bare rank, no sorting

**Correction to the prompt:** this `YearTable` call isn't shared with Results. It's in the Context-only branch; Results' % Change is still the classic bar chart (`ChangeChart`). So this changes Context only. The Trend table's call is untouched.

A new `leadingRank` option on YearTable:
- the rank is a bare number in an unheaded first column, on the card and in fullscreen;
- rows stay in rank order, and headers aren't clickable;
- padding and type tighten (px-1, 11px).

**Measured** in the card replica with 20 real subjects (2020/21 and 2024/25): the table is 316px in a 316px content box, **no horizontal scroll**. Long names truncate (for example "Electronic…"), with the full name on hover.

**Judgement calls (§D1):**
- **Rank by % change, not latest-year size.** YearTable's existing rank was by size, but beside the ranked % Change list a size rank would contradict it.
- **Same layout in fullscreen.** Sorting a list whose point is its rank order would undo it.

## Open decisions

- **§D1:** Part E ranks by % change, and fullscreen uses the same layout.
- **§D2:** Part C's legend moved under the donut.
